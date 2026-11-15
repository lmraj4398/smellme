import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import request from 'supertest';
import { applyRateLimits } from './rate-limits';

@Controller()
class DummyController {
  @Get('health') health() { return { ok: true }; }
  @Post('customer/otp/send') otp() { return { sent: true }; }
  @Post('auth/login') login() { return { ok: false }; }
}

@Module({ controllers: [DummyController] })
class DummyModule {}

async function makeApp(isProd: boolean, globalMax = 1000): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [DummyModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  // Mirrors main.ts: limiters are registered before routes.
  applyRateLimits(app, { isProd, globalMax });
  await app.init();
  return app;
}

describe('rate limits', () => {
  it('blocks the 11th OTP send from one IP and returns retry_after', async () => {
    const app = await makeApp(false);
    for (let i = 0; i < 10; i++) await request(app.getHttpServer()).post('/api/customer/otp/send').expect(201);
    const res = await request(app.getHttpServer()).post('/api/customer/otp/send').expect(429);
    expect(res.body.retry_after).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBeDefined();
    await app.close();
  });

  it('applies the global limit', async () => {
    const app = await makeApp(false, 3);
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/health').expect(429);
    await app.close();
  });
});
