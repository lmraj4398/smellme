# web (storefront)

The SmellMe shop: perfumes, attars and SmellMe Originals. React 19 + TypeScript + Vite + Tailwind, talking to
the API at the repo root.

## Pages

Home · Shop (filters, sort, search) · Product (sizes, notes, pincode check, reviews, wishlist) · Scent finder quiz ·
Gifting · Our story · Help & FAQ (contact form, track an order) · Bag · Checkout (manual UPI payment) · Order
(QR, receipt upload, tracking) · Sign in (WhatsApp OTP) · Account (orders, wishlist, addresses, details).

Text and images on Home, Gifting, Our story and Help are edited by the owner in the admin panel (**Content**), not in
this code.

## Run it

You need Node 22+ and the API running on port 3011 (see the [root README](../README.md)).

```bash
npm install
cp .env.example .env.development     # then set VITE_API_ENCRYPTION_KEY to the API's API_ENCRYPTION_KEY
npm run dev                          # http://localhost:5184 ; /api is proxied to http://localhost:3011
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5184 |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit and component tests (Vitest + Testing Library) |
| `npm run build` | Typecheck, then a production build in `dist/` |
| `npm run preview` | Serve the build on port 5184 |

## Settings

Set in `.env.development` (dev) or as build arguments (production). They are compiled into the JavaScript, so a change
needs a rebuild.

| Name | Meaning |
|---|---|
| `VITE_API_URL` | The API. Defaults to `/api` (same origin; in dev, via the proxy) |
| `VITE_API_ENCRYPTION_KEY` | Must equal `API_ENCRYPTION_KEY` on the server. It is visible in the bundle, so it is obfuscation and replay protection, not a secret: HTTPS is the real protection. |

## How it is organised

```
src/
  api/          one file per area; every request goes through client.ts (token, encryption, refresh)
  components/   shared pieces: ProductCard, ProductGrid, WishlistButton, PincodeCheck, ProductReviews ...
    ui/         the small building blocks: Pill, Stars, States (loading/error/containers), Bottle, Emphasis
    layout/     Header, Footer, SiteLayout
  hooks/ lib/   hooks, and pure logic with tests (checkout, shop filters, scent finder, gifting budgets)
  pages/        one file per page, lazy-loaded from App.tsx
  store/        Zustand stores: the bag (saved in the browser) and the signed-in customer (memory only)
```

**Keep the UI reusable.** Before writing markup, look in `components/` and `components/ui/`. When a pattern appears a
second time, turn it into a component and give it a small test. Tailwind only generates class names it can read in full,
so variants are lookup tables of complete strings (see `ProductGrid`), never built with template strings.

The look comes from `tailwind.config.js` (colours, fonts) and `src/index.css` (`.btn-primary`, `.field`, `.eyebrow`).

## Deploying

`npm run build` writes the site to `../public/web`, and the API serves it at `/`. `../deploy/deploy.sh` builds everything under pm2;
see [`../deploy`](../deploy).

## Lockfile

Generate `package-lock.json` with Node 24 / npm 11 (`npm install --package-lock-only`) so it also lists the Linux and
Windows build tools that servers and CI need. A lockfile made on one machine's `node_modules` can omit them and break
`npm run build` elsewhere.
