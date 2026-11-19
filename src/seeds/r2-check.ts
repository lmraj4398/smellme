/**
 * Smoke test for Cloudflare R2: runs the same steps a browser upload does, straight against R2.
 *   npm run r2:check
 * Needs the R2_* values in environments/.env.dev. Leaves nothing behind (test objects are deleted).
 */
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { R2Service } from '../common/r2/r2.service';

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const step = (ok: boolean, msg: string) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);

async function run(r2: R2Service, folder: 'media' | 'receipts', scope?: string) {
  console.log(`\n== ${folder} ==`);
  if (!r2.isConfigured(folder)) return step(false, 'not configured (missing R2_* values)');

  const p = await r2.presignUpload(folder, 'image/png', PNG.length, scope);
  step(r2.isValidKey(folder, p.key, scope), `presigned, key = ${p.key}`);

  // Exactly what the browser does: PUT the bytes with the signed headers.
  const put = await fetch(p.upload_url, { method: 'PUT', headers: p.headers, body: PNG });
  step(put.ok, `PUT to R2 -> ${put.status} ${put.ok ? '' : await put.text()}`);
  if (!put.ok) return;

  const head = await r2.head(folder, p.key);
  step(head?.size === PNG.length && head.contentType === 'image/png', `head -> ${JSON.stringify(head)}`);

  if (folder === 'media') {
    const res = await fetch(p.public_url!);
    step(res.ok, `public URL ${p.public_url} -> ${res.status}`);
  } else {
    const res = await fetch(await r2.signedGetUrl(folder, p.key, 60));
    step(res.ok, `signed GET -> ${res.status}`);
    const anon = await fetch(p.upload_url.split('?')[0]);
    step(anon.status >= 400 && anon.status < 500, `unsigned GET is refused -> ${anon.status}`);
  }

  // Server must refuse the wrong type / size before signing anything.
  await r2.presignUpload(folder, 'text/html', 10, scope).then(() => step(false, 'text/html accepted'), (e) => step(e.status === 400, `text/html rejected (${e.status})`));
  await r2.presignUpload(folder, 'image/png', 50 * 1024 * 1024, scope).then(() => step(false, '50MB accepted'), (e) => step(e.status === 400, `50MB rejected (${e.status})`));

  await r2.delete(folder, p.key);
  step((await r2.head(folder, p.key)) === null, 'deleted');
}

(async () => {
  const r2 = new R2Service(new ConfigService(process.env));
  await run(r2, 'media');
  await run(r2, 'receipts', randomUUID());
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
