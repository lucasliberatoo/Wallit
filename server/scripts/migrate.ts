import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { closeDb, getDb } from '../db/client';

/** Applies pending SQL migrations (runs on every Vercel build). */
async function main() {
  await migrate(getDb(), { migrationsFolder: 'server/db/migrations' });
  console.info('[db] migrations applied');
}

main()
  .catch((error) => {
    console.error('[db] migration failed', error);
    process.exitCode = 1;
  })
  .finally(closeDb);
