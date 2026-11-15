import * as Joi from 'joi';

// 'production' and 'prod' are both used in the wild; see env.util.ts.
const IS_PRODUCTION = Joi.string().valid('production', 'prod');
const bool = () => Joi.boolean().truthy('true').falsy('false');

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'local', 'dev', 'test', 'staging', 'production', 'prod').default('dev'),
  PORT: Joi.number().default(3001),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: bool().default(false),
  // Dev convenience only: let TypeORM create tables. Production uses migrations.
  DB_SYNC: bool().default(false),
  // Run pending migrations on startup (production).
  DB_MIGRATIONS_RUN: bool().default(false),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  TOKEN_EXPIRATION_TIME: Joi.number().default(900),
  REFRESH_TOKEN_EXPIRY_DAYS: Joi.number().default(30),

  RATE_LIMIT_MAX: Joi.number().default(100),

  // Public URLs - drive CORS and links inside WhatsApp messages.
  APP_URL: Joi.string().uri().required(),
  WEBSITE_URL: Joi.string().uri().required(),
  ADMIN_URL: Joi.string().uri().required(),
  CORS_EXTRA_ORIGINS: Joi.string().allow('').default(''),

  // AES-256-GCM key for request/response encryption: 32 bytes as 64 hex chars.
  // Required in production. Generate with `npm run gen:key`.
  // With a key set, API_REQUIRE_ENCRYPTED_BODY (default true in production) makes the API
  // reject plaintext JSON bodies, so encryption can't be bypassed by crafting plain requests.
  API_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
    is: IS_PRODUCTION,
    then: Joi.string().length(64).hex().required(),
    otherwise: Joi.string().length(64).hex().optional().allow(''),
  }),

  API_REQUIRE_ENCRYPTED_BODY: Joi.boolean().truthy('true').falsy('false').when('NODE_ENV', {
    is: IS_PRODUCTION,
    then: Joi.boolean().default(true),
    otherwise: Joi.boolean().default(false),
  }),

  // Cloudflare R2 (S3 API). Public bucket: product media. Private bucket: payment receipts.
  R2_ACCOUNT_ID: Joi.string().allow('').default(''),
  R2_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  R2_PUBLIC_BUCKET: Joi.string().allow('').default(''),
  R2_PRIVATE_BUCKET: Joi.string().allow('').default(''),
  R2_PUBLIC_URL: Joi.string().allow('').default(''),

  // WhatsApp (Gupshup) - OTP + order notifications. Wired up in the auth/notifications phase.
  GUPSHUP_API_KEY: Joi.string().allow('').default(''),
  GUPSHUP_APP_NAME: Joi.string().allow('').default(''),
  GUPSHUP_SOURCE_NUMBER: Joi.string().allow('').default(''),
  GUPSHUP_WEBHOOK_TOKEN: Joi.string().allow('').default(''),
  // Approved WhatsApp template ids, one per event (see docs/WHATSAPP.md for the wording and parameter order).
  GUPSHUP_TEMPLATE_OTP: Joi.string().allow('').default(''),
  GUPSHUP_TEMPLATE_ORDER_PLACED: Joi.string().allow('').default(''),
  GUPSHUP_TEMPLATE_PAYMENT_APPROVED: Joi.string().allow('').default(''),
  GUPSHUP_TEMPLATE_PAYMENT_REJECTED: Joi.string().allow('').default(''),
  GUPSHUP_TEMPLATE_SHIPPED: Joi.string().allow('').default(''),
  GUPSHUP_TEMPLATE_DELIVERED: Joi.string().allow('').default(''),
  GUPSHUP_TEMPLATE_CANCELLED: Joi.string().allow('').default(''),

  // Static UPI QR. The amount is shown beside it, not encoded in it.
  UPI_VPA: Joi.string().allow('').default(''),
  UPI_PAYEE_NAME: Joi.string().default('SmellMe'),

  // Seed script only.
  OWNER_NAME: Joi.string().optional(),
  OWNER_EMAIL: Joi.string().email().optional(),
  OWNER_PASSWORD: Joi.string().optional(),
});
