import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Connect a Neon database to the Vercel project.');
  return url;
}

let pool: Pool | null = null;
let db: Db | null = null;

/** One small pool per function instance; Neon's pooler handles the fan-in. */
export function getDb(): Db {
  if (!db) {
    pool = new Pool({ connectionString: databaseUrl(), max: 3, idleTimeoutMillis: 10_000 });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}
