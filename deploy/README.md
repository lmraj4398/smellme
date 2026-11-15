# Deploying SmellMe (Linux + pm2)

SmellMe is one Node process: the API plus the built storefront (`/`) and admin panel (`/admin`). pm2 keeps it running;
nginx (or any reverse proxy) puts HTTPS in front. Product photos come from the R2 bucket's public URL (`R2_PUBLIC_URL`).

## One-time server setup

```bash
# Node 22, pm2, nginx, PostgreSQL 15+ (any recent Linux)
sudo npm i -g pm2
pm2 startup            # run the command it prints, so pm2 restarts after a reboot
```

Create the database and user in Postgres (or use a managed one), then:

```bash
git clone <repo> /srv/smellme && cd /srv/smellme
cp environments/.env.example environments/.env.production
```

Edit `environments/.env.production`:

- `NODE_ENV=production`, `PORT=3001`, `DB_*` for your Postgres (`DB_SSL=true` for most managed databases).
- Strong `JWT_SECRET` and `JWT_REFRESH_SECRET`, and an `API_ENCRYPTION_KEY`: `npm run gen:key` prints one.
- `APP_URL`, `WEBSITE_URL` and `ADMIN_URL` all set to your one public URL, e.g. `https://smellme.in`.
- R2, Gupshup (WhatsApp) and UPI settings. Keep `DB_MIGRATIONS_RUN=true`: the tables are created on first start.

## Deploy / update

```bash
./deploy/deploy.sh
```

It pulls, installs, builds the API and both React apps (the encryption key is copied from the env file into the browser
builds), then `pm2 startOrReload ecosystem.config.js`. Set `SKIP_PULL=1` to deploy the files already on disk.
Changing `API_ENCRYPTION_KEY` needs a redeploy because it is compiled into the browser JavaScript.

## Reverse proxy and HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/smellme
sudo ln -s /etc/nginx/sites-available/smellme /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d smellme.in -d www.smellme.in
```

nginx must pass `X-Forwarded-For` (the sample does): the API rate-limits per client IP.

## First login

Set `OWNER_EMAIL` and `OWNER_PASSWORD` in `.env.production`, then once:

```bash
node --env-file=environments/.env.production dist/seeds/owner.seed.js
```

Remove `OWNER_PASSWORD` from the file afterwards. Sign in at `https://smellme.in/admin`, fill in **Content**,
**Settings** and add products. WhatsApp templates: see [../docs/WHATSAPP.md](../docs/WHATSAPP.md).

## Everyday pm2

```bash
pm2 status
pm2 logs smellme          # also in logs/out.log and logs/error.log
pm2 restart smellme
```

Run a single instance (`instances: 1`): rate limits and sessions live in process memory.

## Database managed by hand

To create the tables yourself (for example on a managed database) instead of on first start, load `db-scripts/schema.sql`
into the empty database first; see the root README.

## Back-ups

Schedule `pg_dump` (e.g. `pg_dump -U $DB_USERNAME $DB_NAME > backup.sql` from cron) and keep copies off the server.
