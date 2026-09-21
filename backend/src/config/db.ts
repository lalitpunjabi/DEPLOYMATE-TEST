import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { resolveRuntimeDbConfig } from './dbRuntimeConfig';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const runtime = resolveRuntimeDbConfig();

const pool = new Pool({
  host: runtime.host,
  port: runtime.port,
  user: runtime.user,
  password: runtime.password,
  database: runtime.database,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DEPLOYMATE DB POOL] Unexpected error on idle client:', err);
});

export const query = (text: string, params?: unknown[]) => {
  return pool.query(text, params);
};

export default pool;
