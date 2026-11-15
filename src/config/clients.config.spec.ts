import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { serveClients } from './clients.config';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}
@Module({ controllers: [PingController] })
class TestModule {}

describe('serveClients', () => {
  let dir: string;
  let app: INestApplication;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'smellme-public-'));
    for (const [name, title] of [['web', 'STORE'], ['admin', 'ADMIN']]) {
      mkdirSync(join(dir, name, 'assets'), { recursive: true });
      writeFileSync(join(dir, name, 'index.html'), `<html>${title}</html>`);
      writeFileSync(join(dir, name, 'assets', 'app-abc.js'), 'console.log(1)');
    }
    app = await NestFactory.create(TestModule, { logger: false });
    app.setGlobalPrefix('api');
    serveClients(app, dir);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const get = (p: string) => request(app.getHttpServer()).get(p);

  it('serves the storefront at / and for client-side routes', async () => {
    expect((await get('/')).text).toContain('STORE');
    expect((await get('/product/saffron-dusk')).text).toContain('STORE');
  });
  it('serves the admin panel at /admin and for its client-side routes', async () => {
    expect((await get('/admin')).text).toContain('ADMIN');
    expect((await get('/admin/orders/12')).text).toContain('ADMIN');
  });
  it('serves hashed assets with long cache, from the right app', async () => {
    const res = await get('/admin/assets/app-abc.js').expect(200);
    expect(res.headers['cache-control']).toContain('immutable');
    await get('/assets/app-abc.js').expect(200);
  });
  it('keeps /api for the API, never the SPA', async () => {
    expect((await get('/api/ping').expect(200)).body).toEqual({ ok: true });
    await get('/api/nope').expect(404);
  });
  it('404s a missing file instead of returning index.html', async () => {
    await get('/assets/missing.js').expect(404);
  });
  it('does not serve the SPA for non-GET requests', async () => {
    await request(app.getHttpServer()).post('/checkout').expect(404);
  });
});
