# SmellMe

The SmellMe shop (perfumes, attars and SmellMe Originals) as one monolithic application:

| Part | Where | Served at |
|---|---|---|
| API (NestJS + TypeORM + PostgreSQL) | `src/` | `/api` |
| Storefront (React 19 + Vite + Tailwind) | `web/` | `/` |
| Admin panel (React 19 + Vite + Tailwind) | `admin/` | `/admin` |

One repo, one Node process (run by pm2 in production), one port. `npm run build` compiles the two React apps into `public/` and the API into
`dist/`; the API then serves all three. Details of each client: [web/README.md](web/README.md), [admin/README.md](admin/README.md).
Deployment: [deploy/README.md](deploy/README.md).

## What it does

| Area | Routes (all under `/api`) |
|---|---|
| Catalog (public) | `/products`, `/products/:slug`, `/products/filters`, `/brands`, `/families`, `/samples` |
| Content (public) | `/content/:page`, `/settings/public`, `/contact`, `/newsletter` |
| Customer sign-in | `/customer/otp/send`, `/customer/otp/verify`, `/customer/refresh`, `/customer/logout` (WhatsApp OTP) |
| Customer account | `/customer/me`, `/customer/addresses`, `/customer/orders`, `/customer/wishlist`, `/customer/reviews/:productId` |
| Cart, delivery, orders | `/cart/price`, `/delivery/check`, `/customer/orders` (manual UPI payment with receipt upload) |
| Reviews | `GET /products/:slug/reviews`; only customers with a delivered order can write one |
| Admin | `/auth/*`, `/admin/*` (products, inventory, orders, customers, coupons, content, settings, reviews, inbox, WhatsApp log, error logs, logins) |

Swagger is served at `/api/docs` outside production.

The built storefront is served at `/` and the admin panel at `/admin` by the same process (`src/config/clients.config.ts`).

Private responses (anything about a customer, an order or the admin) are AES-256-GCM encrypted when
`API_ENCRYPTION_KEY` is set; public catalog and content responses stay plain so a CDN can cache them. See
`src/common/crypto` and `src/common/interceptors`.

## Run it locally

You need Node 22 and Docker (only for the local Postgres; any Postgres works).

```bash
docker compose -f docker-compose.dev.yml up -d      # Postgres on :5432
npm run install:all                                 # root + web + admin dependencies
cp web/.env.example web/.env.development            # set VITE_API_ENCRYPTION_KEY = the API's API_ENCRYPTION_KEY
cp admin/.env.example admin/.env.development        # (same key)
npm run start:dev                                   # API on http://localhost:3011 (reads environments/.env.dev)
npm run seed:owner                                  # creates the owner login from OWNER_EMAIL / OWNER_PASSWORD
npm run seed:catalog                                # optional sample brands, families and products
npm run dev:web                                     # storefront with hot reload: http://localhost:5184
npm run dev:admin                                   # admin with hot reload:      http://localhost:5183/admin/
```

Or run it as one app, the way production does: `npm run build && npm run start:prod`, then open
`http://localhost:<PORT>/` (site) and `/admin`.

**Demo catalog as plain SQL:** `db-scripts/catalog-seed.sql` is the same data as `seed:catalog` (safe to run twice):
`psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f db-scripts/catalog-seed.sql`.

**Sample admin logins (dev only):** `db-scripts/sample-admin-users.sql` inserts an owner and three limited logins (orders,
catalog, support). The emails, passwords and what each can open are listed at the top of the file. Run it with `psql -f`
once the tables exist. Never run it on the live shop: the passwords are public.

`environments/.env.dev` is not committed. Start from `environments/.env.example`; generate secrets and the encryption
key with `npm run gen:key`. In dev the schema is created automatically (`DB_SYNC=true`).

The storefront and admin proxy `/api` to port **3011** in development.

## Tests

```bash
npm test                                            # API unit tests
npm run test:web                                    # storefront tests
npm run test:admin                                  # admin tests
npm run test:all                                    # all of the above
npm run test:e2e                                    # real app + real Postgres (database smellme_test)
```

The e2e tests need the dev Postgres from above. They use their own database, so dev data is never touched.

## Database changes

Production never auto-syncs the schema. After changing an entity:

```bash
npx dotenv -e environments/.env.dev -- npm run migration:generate -- src/migrations/Name
npx dotenv -e environments/.env.dev -- npm run migration:run
```

(Use `.env.production` instead of `.env.dev` to run against the production database.)

**One SQL file for the whole database:** `db-scripts/schema.sql` is every migration in order, in a single transaction. To set
up an empty database without Node (for example on a managed Postgres):

```bash
psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f db-scripts/schema.sql
```

It also records the migrations as applied, so the API only runs migrations added later. It is generated, never edited by
hand: after adding a migration run `npm run db:sql` and commit the result (a unit test fails if the file is out of date).

Entity files must be named `*.entity.ts` or `*.entities.ts` so the migration tool finds them (a test enforces this).
With `DB_MIGRATIONS_RUN=true` the API applies pending migrations when it starts.

## Configuration

Every setting is documented in `environments/.env.example` and validated at start-up in `src/config/env.validation.ts`.
The ones you must set for production: the database, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `API_ENCRYPTION_KEY`
(must equal `VITE_API_ENCRYPTION_KEY` in both frontends), the public URLs, R2 storage ([docs/R2.md](docs/R2.md)), UPI details and the Gupshup
keys and templates (see [docs/WHATSAPP.md](docs/WHATSAPP.md)).

## Deploying

Linux + pm2 + nginx: `ecosystem.config.js` is the pm2 process file and `./deploy/deploy.sh` pulls, builds and reloads it.
See [deploy/README.md](deploy/README.md).
