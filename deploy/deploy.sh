#!/usr/bin/env bash
# Build and (re)start SmellMe under pm2. Run from anywhere on the server:  ./deploy/deploy.sh
# Needs: Node 22+, pm2 (npm i -g pm2), environments/.env.production filled in.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=environments/.env.production
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (copy environments/.env.example and fill it in)"; exit 1; }

# The browser apps need the same key as the API; Vite reads VITE_* from the environment at build time.
KEY=$(grep -E '^API_ENCRYPTION_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"' || true)
export VITE_API_ENCRYPTION_KEY="$KEY"
export VITE_API_URL=/api

[ "${SKIP_PULL:-}" = "1" ] || git pull --ff-only

npm ci
(cd web && npm ci)
(cd admin && npm ci)
npm run build

mkdir -p logs
# `startOrReload` = zero-config: starts on the first deploy, reloads afterwards. Migrations run on start (DB_MIGRATIONS_RUN=true).
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
echo "Deployed. Check:  pm2 logs smellme   and   curl -s localhost:\${PORT:-3001}/api/health"
