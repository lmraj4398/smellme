import 'reflect-metadata';
import dataSource from '../data-source';
import { AdminUser } from '../models/admin-users/admin-user.entity';
import { hashPassword, PASSWORD_MAX, PASSWORD_MESSAGE, PASSWORD_MIN, PASSWORD_RULE } from '../security/auth/password';

// Creates the first (unrestricted) admin login if - and only if - none exists.
//   dev:  npm run seed:owner
//   prod: docker compose exec api node dist/seeds/owner.seed.js
// Needs OWNER_EMAIL and OWNER_PASSWORD in the environment. Run it after the
// tables exist (the API creates them in dev; migrations create them in prod).
async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || 'Owner';

  if (!email || !password) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD');
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX || !PASSWORD_RULE.test(password)) {
    throw new Error(PASSWORD_MESSAGE);
  }

  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(AdminUser);
    if ((await repo.count()) > 0) {
      console.log('An admin login already exists - nothing to do.');
      return;
    }
    await repo.insert({ name, email, password_hash: await hashPassword(password), allowed_screens: null, is_active: true });
    console.log(`Created owner login ${email}. Remove OWNER_PASSWORD from the environment now.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
