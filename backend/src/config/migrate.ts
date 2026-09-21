import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { runMigrations } from '../services/migrationRunner';
import { resolveRuntimeDbConfig } from './dbRuntimeConfig';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  console.log('[db:migrate] Running versioned SQL migrations only (no database creation, no seeding).');

  const cfg = resolveRuntimeDbConfig();
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });

  try {
    await client.connect();
    console.log(`[db:migrate] Connected to "${cfg.database}" as runtime user "${cfg.user}".`);
    await runMigrations(client);
    console.log('[db:migrate] Completed successfully.');
  } catch (error) {
    console.error('[db:migrate] Failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
