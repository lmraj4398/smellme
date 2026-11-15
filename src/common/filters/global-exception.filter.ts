import { ArgumentsHost, Catch, ExceptionFilter, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { encrypt } from '../crypto/aes';
import { ApiErrorLogsService, safeStringify } from '../api-error-logs/api-error-logs.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly errorLogs: ApiErrorLogsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let retryAfter: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const m = typeof res === 'string' ? res : ((res as { message?: string | string[] }).message ?? message);
      message = Array.isArray(m) ? m[0] : m;
      // Rate-limit style errors carry a countdown the website shows ("try again in 24s").
      const ra = (res as { retry_after?: unknown }).retry_after;
      if (typeof ra === 'number') retryAfter = ra;
    } else if (exception instanceof Error) {
      // Real detail goes to the log only. Customers hit this API, so a raw
      // driver/SQL error in the response would leak internals.
      this.logger.error(exception.message, exception.stack);
    }

    const body = { statusCode: status, message, ...(retryAfter ? { retry_after: retryAfter } : {}), timestamp: new Date().toISOString() };
    this.record(host, request, status, message);

    try {
      // Encrypted like every other private response when a key is configured.
      response.status(status).json(process.env.API_ENCRYPTION_KEY ? encrypt(JSON.stringify(body)) : body);
    } catch {
      response.status(status).json(body);
    }
  }

  private record(host: ArgumentsHost, request: Request, status: number, message: string) {
    const ctx = host as ExecutionContext;
    const controller = typeof ctx.getClass === 'function' ? ctx.getClass()?.name : undefined;
    const handler = typeof ctx.getHandler === 'function' ? ctx.getHandler()?.name : undefined;
    const key = controller && handler ? `${controller}.${handler}` : `${request?.method} ${request?.path}`;
    const user = (request as Request & { user?: { id?: string; type?: 'admin' | 'customer' } }).user;

    void this.errorLogs.record({
      group_key: key,
      group_label: controller && handler ? `${controller.replace(/Controller$/, '')} · ${handler}` : key,
      severity: status >= 500 ? 'error' : 'warning',
      status_code: status,
      method: request?.method ?? 'UNKNOWN',
      url: request?.originalUrl ?? '',
      request_query: safeStringify(request?.query),
      request_body: safeStringify(request?.body),
      message: String(message),
      user_id: user?.id ?? null,
      user_type: user?.type ?? null,
      screen: (request?.headers?.['x-client-screen'] as string) ?? null,
    });
  }
}
