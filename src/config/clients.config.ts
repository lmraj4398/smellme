import { INestApplication } from '@nestjs/common';
import express, { NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import { join, sep } from 'path';

// The built React apps live next to dist/: public/web (storefront, served at /) and
// public/admin (admin panel, served at /admin). `npm run build:clients` produces them.
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

const ONE_YEAR = 31_536_000_000;

function serveSpa(app: express.Express, mount: string, dir: string) {
  const index = join(dir, 'index.html');
  const assets = express.static(dir, {
    index: false,
    redirect: false, // /admin (no slash) is answered by the fallback below, not redirected
    setHeaders: (res, file) => {
      // Vite puts a content hash in everything under /assets, so it can be cached for good.
      res.setHeader('Cache-Control', file.split(sep).includes('assets') ? `public, max-age=${ONE_YEAR / 1000}, immutable` : 'no-cache');
    },
  });
  const prefix = mount === '/' ? '' : mount;
  // Every non-API GET that is not a real file is a page of the single-page app (e.g. /product/saffron-dusk).
  const fallback = (req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    if (prefix && req.path !== prefix && !req.path.startsWith(`${prefix}/`)) return next();
    // A missing hashed asset must be a 404, never index.html (that would be parsed as JS/CSS).
    if (/\.[a-z0-9]+$/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  };
  app.use(mount, assets);
  app.use(fallback);
}

// Serves the storefront at / and the admin panel at /admin. Called from main.ts only
// (not from configureApp), so the e2e tests and `nest start` without a client build still work.
export function serveClients(app: INestApplication, publicDir = PUBLIC_DIR) {
  const server = app.getHttpAdapter().getInstance() as express.Express;
  const web = join(publicDir, 'web');
  const admin = join(publicDir, 'admin');
  // /admin first: it is the more specific mount.
  if (existsSync(join(admin, 'index.html'))) serveSpa(server, '/admin', admin);
  if (existsSync(join(web, 'index.html'))) serveSpa(server, '/', web);
}
