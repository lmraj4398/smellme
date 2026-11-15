import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { ConfigService } from '@nestjs/config';
import { AdminUser } from '../../../src/models/admin-users/admin-user.entity';
import { StorageService } from '../../../src/common/storage/storage.service';
import { WHATSAPP_PROVIDER, type OutboundMessage, type SendResult, type WhatsAppProvider } from '../../../src/models/whatsapp/whatsapp.provider';

/** Records every WhatsApp message instead of sending it, so tests can read OTPs and notifications. */
export class RecordingWhatsApp implements WhatsAppProvider {
  readonly name = 'console'; // lets the service fall back to the event name as the template id
  sent: OutboundMessage[] = [];
  failNext = false;
  async send(m: OutboundMessage): Promise<SendResult> {
    if (this.failNext) { this.failNext = false; return { ok: false, error: 'simulated outage' }; }
    this.sent.push(m);
    return { ok: true, messageId: `m${this.sent.length}` };
  }
  /** The most recent OTP sent to this canonical number ("+919876543210"). */
  lastOtp(phone: string) {
    return [...this.sent].reverse().find((m) => m.to === phone.replace(/\D/g, '') && m.templateId === 'otp')?.params[0];
  }
}

/** Real signing logic, but deletes are recorded instead of sent to R2. */
export class TestStorage extends StorageService {
  deleted: string[] = [];
  /** Objects a test has "uploaded" to the private bucket (key -> what HEAD would report). */
  uploads = new Map<string, { size: number; contentType: string }>();
  async deleteObject(key: string) {
    this.deleted.push(key);
  }
  async headReceipt(key: string) {
    return this.uploads.get(key) ?? null;
  }
  /** Pretend the browser PUT a file to the signed URL. */
  simulateUpload(key: string, contentType = 'image/png', size = 2048) {
    this.uploads.set(key, { size, contentType });
  }
}

async function ensureDatabase() {
  const c = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await c.connect();
  try {
    const { rowCount } = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [process.env.DB_NAME]);
    if (!rowCount) await c.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
  } finally {
    await c.end();
  }
}

let dbReady: Promise<void> | null = null;

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  db: DataSource;
  storage: TestStorage;
  wa: RecordingWhatsApp;
  close: () => Promise<void>;
}

/** A fresh app (and so fresh in-memory rate-limit counters) with empty tables. */
export async function buildApp(extraControllers: Type<unknown>[] = []): Promise<TestApp> {
  dbReady ??= ensureDatabase();
  await dbReady;

  const wa = new RecordingWhatsApp();
  const mod = await Test.createTestingModule({ imports: [AppModule], controllers: extraControllers })
    .overrideProvider(WHATSAPP_PROVIDER)
    .useValue(wa)
    .overrideProvider(StorageService)
    .useFactory({ factory: (c: ConfigService) => new TestStorage(c), inject: [ConfigService] })
    .compile();
  const app = mod.createNestApplication();
  configureApp(app);
  // Listen once on an ephemeral port: supertest otherwise closes/reopens an unbound server between
  // back-to-back requests and can race ("Cannot read properties of null (reading 'address')").
  await app.listen(0);

  const db = app.get(DataSource);
  await resetTables(db);

  return { app, http: request(app.getHttpServer()), db, storage: app.get(StorageService) as TestStorage, wa, close: () => app.close() };
}

const TABLES =
  'admin_users, admin_refresh_tokens, api_error_logs, stock_ledger, product_media, product_notes, ' +
  'product_variants, products, notes, scent_families, brands, site_content, contact_messages, newsletter_subscribers, ' +
  'customers, customer_addresses, customer_otps, customer_refresh_tokens, app_settings, whatsapp_messages, ' +
  'orders, order_items, order_events, coupons, wishlist_items, product_reviews';

// TRUNCATE needs an exclusive lock, so it queues behind any statement still running from the
// previous test (the error-log insert is fire-and-forget and can outlive the app by a moment).
// A short lock_timeout + retry turns that rare wait into a quick retry instead of a 30 s hang.
async function resetTables(db: DataSource) {
  for (let attempt = 1; ; attempt++) {
    const qr = db.createQueryRunner();
    try {
      await qr.query("SET lock_timeout = '4s'");
      await qr.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
      return;
    } catch (e) {
      if (attempt >= 4) throw e;
    } finally {
      await qr.query('RESET lock_timeout').catch(() => undefined);
      await qr.release();
    }
  }
}

export const PASSWORD = 'correct-horse-9';

export async function seedAdmin(
  db: DataSource,
  over: Partial<AdminUser> = {},
): Promise<AdminUser> {
  const repo = db.getRepository(AdminUser);
  return repo.save(
    repo.create({
      name: 'Owner',
      email: 'owner@smellme.test',
      password_hash: await hash(PASSWORD, 4),
      allowed_screens: null,
      is_active: true,
      ...over,
    }),
  );
}

/** Extracts the raw refresh cookie value from a response's Set-Cookie header. */
export function refreshCookie(res: request.Response): string | undefined {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('sm_rt='));
  return raw?.split(';')[0].slice('sm_rt='.length);
}

/** Seeds an admin with the given screen limits and returns its bearer token (null = unrestricted owner). */
export async function tokenFor(t: TestApp, screens: string[] | null, email = `u${Math.random().toString(36).slice(2, 8)}@smellme.test`) {
  const user = await seedAdmin(t.db, { email, allowed_screens: screens });
  const res = await t.http.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { token: res.body.token as string, user, cookie: refreshCookie(res)! };
}

/** Full OTP sign-in for a phone like "9876543210". Returns the bearer token, refresh cookie and customer. */
export async function customerLogin(t: TestApp, phone = '9876543210', name?: string) {
  const canonical = `+91${phone.replace(/\D/g, '').slice(-10)}`;
  await t.http.post('/api/customer/otp/send').send({ phone }).expect(200);
  const code = t.wa.lastOtp(canonical)!;
  const res = await t.http.post('/api/customer/otp/verify').send({ phone, code, ...(name ? { name } : {}) }).expect(200);
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('sm_crt='));
  return { token: res.body.token as string, customer: res.body.customer as { id: string; phone: string; name: string }, cookie: raw?.split(';')[0].slice('sm_crt='.length) ?? '', phone: canonical };
}

/** Creates a customer straight in the database and signs a valid session token for them (skips the OTP rate limits). */
export async function customerToken(t: TestApp, phone: string) {
  const { JwtService } = await import('@nestjs/jwt');
  const rows = await t.db.query('INSERT INTO customers (phone) VALUES ($1) RETURNING id', [`+91${phone}`]);
  return t.app.get(JwtService).signAsync({ sub: rows[0].id, typ: 'customer' }) as Promise<string>;
}
