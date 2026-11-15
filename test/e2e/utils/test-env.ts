// Must be the FIRST import of every e2e spec: AppModule reads process.env while
// its decorators are evaluated, so the environment has to exist before it loads.
// Points at the local dev Postgres server (docker-compose.dev.yml) but a
// separate database, so tests never touch dev data. Override with TEST_DB_*.
const set = (k: string, v: string) => {
  process.env[k] ??= v;
};

process.env.NODE_ENV = 'test';
set('DB_HOST', process.env.TEST_DB_HOST ?? 'localhost');
set('DB_PORT', process.env.TEST_DB_PORT ?? '5432');
set('DB_USERNAME', process.env.TEST_DB_USER ?? 'smellme');
set('DB_PASSWORD', process.env.TEST_DB_PASSWORD ?? 'smellme_dev');
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'smellme_test';
process.env.DB_SYNC = 'true';
process.env.JWT_SECRET = 'e2e-jwt-secret-e2e-jwt-secret-e2e-jwt';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-e2e-refresh-secret';
process.env.RATE_LIMIT_MAX = '10000';
process.env.APP_URL = 'http://localhost:3011';
process.env.WEBSITE_URL = 'http://localhost:5184';
process.env.ADMIN_URL = 'http://localhost:5183';

// Encryption is off unless a spec sets API_ENCRYPTION_KEY before importing build-app.
delete process.env.API_ENCRYPTION_KEY;
delete process.env.API_REQUIRE_ENCRYPTED_BODY;

// Fake R2 settings: presigning is pure local crypto, so no network is involved.
process.env.R2_ACCOUNT_ID = 'testacct';
process.env.R2_ACCESS_KEY_ID = 'AKIATEST';
process.env.R2_SECRET_ACCESS_KEY = 'secret-test';
process.env.R2_PUBLIC_BUCKET = 'smellme-public-test';
process.env.R2_PUBLIC_URL = 'https://cdn.test';
process.env.R2_PRIVATE_BUCKET = 'smellme-private-test';
