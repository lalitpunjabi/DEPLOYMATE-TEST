import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { runMigrations } from '../services/migrationRunner';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  console.log('Running DEPLOYMATE Database Migrations...');

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres_dev_only',
    database: process.env.DB_NAME || 'deploymate',
  };

  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log(`Connected to database "${dbConfig.database}". Running migration scripts...`);
    await runMigrations(client);
    console.log('✅ Database migrations completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
