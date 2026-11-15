# admin (admin panel)

The owner's panel for SmellMe: products, stock, orders and payments, customers, coupons, reviews, the website's text
and pictures, and settings. React 19 + TypeScript + Vite + Tailwind, talking to the API at the repo root.

## Menu

Dashboard · Products · Brands, families & notes · Inventory · Orders · Verify payments · Customers · Coupons ·
Reviews · Content (home, gifting, our story, help) · FAQs · Messages · Notifications (WhatsApp log) · Error logs · Settings · Logins.

Each menu item belongs to a **screen**. The owner sees everything; other logins only see the screens they are granted
(Logins page). The list of screens lives in two places that a test keeps in sync: the API's `SCREENS` and
`src/lib/nav-routes.ts`.

Gift sets and the scent-finder text are edited under **Content**. The scent-finder questions themselves are in the website code
(`web/src/lib/scent-finder.ts`).

## Run it

You need Node 22+ and the API running on port 3011.

```bash
npm install
cp .env.example .env.development     # set VITE_API_ENCRYPTION_KEY to the API's API_ENCRYPTION_KEY
npm run dev                          # http://localhost:5183/admin/ ; /api is proxied to http://localhost:3011
```

Sign in with the owner login created by the API's `npm run seed:owner`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5183 |
| `npm run typecheck` | TypeScript check |
| `npm test` | Tests (Vitest + Testing Library) |
| `npm run build` | Typecheck, then a production build in `dist/` |

## Settings

Compiled into the JavaScript at build time.

| Name | Meaning |
|---|---|
| `VITE_API_URL` | The API. Defaults to `/api` (same origin) |
| `VITE_API_ENCRYPTION_KEY` | Must equal `API_ENCRYPTION_KEY` on the server |
| `VITE_WEBSITE_URL` | The public site, for the "View on website" buttons. Leave empty in production (same origin) |

## How it is organised

```
src/
  api/         one file per area; client.ts adds the token, encrypts bodies, refreshes the session
  components/
    ui/        shared building blocks: PillTabs, ListCard, QueryStatus, Stars, Pagination, Modal, Field, Switch, bits (Badge, PageHeader, Empty)
    layout/    the sidebar and mobile menu
  lib/         pure logic with tests (screens, order status, forms)
  pages/       one folder per menu item, lazy-loaded from App.tsx
  store/       the signed-in admin
```

**Keep the UI reusable.** A list page is `PageHeader`, optional `PillTabs`, `QueryStatus`, a `ListCard` of rows and a
`Pagination`. Use those instead of writing the markup again, and when a pattern repeats, extract it and add a test.

To add a page: add the menu entry in `src/lib/nav-routes.ts` (with its screen), the screen in the API's `SCREENS` and
`src/lib/screens.ts`, and map the path to your page in `App.tsx`.

## Deploying

`npm run build` writes the panel to `../public/admin`, and the API serves it at `/admin`. `../deploy/deploy.sh` builds
everything under pm2; see [`../deploy`](../deploy).

## Lockfile

Generate `package-lock.json` with Node 24 / npm 11 (`npm install --package-lock-only`) so it also lists the Linux and
Windows build tools that servers and CI need.
