import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiErrorLog } from './api-error-log.entity';

const SENSITIVE = /pass(word|wd)?|secret|token|authorization|otp|cvv|card|utr|api[_-]?key/i;
const MAX_BODY = 4000;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

export function safeStringify(value: unknown): string | null {
  if (value == null || (typeof value === 'object' && Object.keys(value as object).length === 0)) return null;
  const s = JSON.stringify(redact(value));
  return s.length > MAX_BODY ? s.slice(0, MAX_BODY) + '…[truncated]' : s;
}

@Injectable()
export class ApiErrorLogsService {
  private readonly logger = new Logger(ApiErrorLogsService.name);

  constructor(@InjectRepository(ApiErrorLog) private readonly repo: Repository<ApiErrorLog>) {}

  // Never throws: logging a failure must not turn into a second failure.
  async record(entry: Partial<ApiErrorLog>): Promise<void> {
    try {
      await this.repo.insert(entry);
    } catch (err) {
      this.logger.warn(`Could not store error log: ${(err as Error).message}`);
    }
  }

  // ── admin viewer ──────────────────────────────────────────────────────────

  /** One row per failing handler, newest first: how many times, when last, and whether any was a hard error. */
  async groups(q: { severity?: 'error' | 'warning'; page?: number; limit?: number }) {
    const page = q.page ?? 1, limit = q.limit ?? 30;
    const where = q.severity ? 'WHERE severity = $1' : '';
    const args: unknown[] = q.severity ? [q.severity] : [];
    const rows: { group_key: string; group_label: string; count: string; last_at: Date; has_error: boolean; status_code: number }[] = await this.repo.query(
      `SELECT group_key, MAX(group_label) AS group_label, COUNT(*) AS count, MAX(created_at) AS last_at,
              BOOL_OR(severity = 'error') AS has_error, (ARRAY_AGG(status_code ORDER BY created_at DESC))[1] AS status_code
       FROM api_error_logs ${where} GROUP BY group_key ORDER BY last_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      args,
    );
    const [{ n }] = await this.repo.query(`SELECT COUNT(DISTINCT group_key) AS n FROM api_error_logs ${where}`, args);
    return { total: Number(n), page, limit, items: rows.map((r) => ({ ...r, count: Number(r.count) })) };
  }

  async entries(q: { group: string; page?: number; limit?: number }) {
    const page = q.page ?? 1, limit = q.limit ?? 20;
    const [items, total] = await this.repo.findAndCount({
      where: { group_key: q.group }, order: { created_at: 'DESC' }, skip: (page - 1) * limit, take: limit,
    });
    return { total, page, limit, items };
  }

  async clearGroup(group: string) {
    const r = await this.repo.delete({ group_key: group });
    return { deleted: r.affected ?? 0 };
  }

  /** The table would otherwise grow forever: keep a month of history. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOld(days = 30) {
    try {
      await this.repo.createQueryBuilder().delete().where("created_at < now() - make_interval(days => :days)", { days }).execute();
    } catch (err) {
      this.logger.warn(`Could not purge old error logs: ${(err as Error).message}`);
    }
  }
}
