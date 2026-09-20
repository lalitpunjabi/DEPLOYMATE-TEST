import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend directory .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

if (process.env.NODE_ENV === 'production') {
  if (!process.env.DB_APP_PASSWORD || process.env.DB_APP_PASSWORD === 'deploymate_app_password') {
    throw new Error('FATAL SECURITY ERROR: DB_APP_PASSWORD environment variable is required in production mode.');
  }
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_APP_USER || 'deploymate_app',
  password: process.env.DB_APP_PASSWORD || 'deploymate_app_password_dev',
  database: process.env.DB_NAME || 'deploymate',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Explicit production connection pool max limit
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection cannot be established
});

pool.on('error', (err) => {
  console.error('[DEPLOYMATE DB POOL] Unexpected error on idle client:', err);
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
