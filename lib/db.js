import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || '';

let pool;

export const hasDatabaseUrl = Boolean(connectionString);

export function getPool() {
  if (!hasDatabaseUrl) {
    throw new Error('DATABASE_URL não configurada.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}
