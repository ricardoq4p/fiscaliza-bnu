import pg from 'pg';

const { Pool } = pg;

function normalizeConnectionString(value) {
  if (!value) return '';

  const url = new URL(value);
  if (url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return url.toString();
}

const connectionString = normalizeConnectionString(process.env.DATABASE_URL || '');

let pool;

export const hasDatabaseUrl = Boolean(connectionString);

export function getPool() {
  if (!hasDatabaseUrl) {
    throw new Error('DATABASE_URL não configurada.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}
