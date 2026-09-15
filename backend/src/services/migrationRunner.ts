import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

export async function runMigrations(client: Client): Promise<void> {
  console.log('[Migration Runner] Checking database migrations status...');

  // Ensure schema_migrations table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migration Runner] No migrations directory found.');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const version = file;
    const checkRes = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);

    if (checkRes.rowCount === 0) {
      console.log(`[Migration Runner] Applying migration script: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`[Migration Runner] Migration ${file} applied successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migration Runner] Migration ${file} failed:`, err);
        throw err;
      }
    } else {
      console.log(`[Migration Runner] Migration ${file} already applied.`);
    }
  }
}
