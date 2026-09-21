import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { assertIdentifier, resolveAdminDbConfig } from './dbRuntimeConfig';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function execFormatted(client: Client, fmt: string, ...args: string[]): Promise<void> {
  const formatted = await client.query('SELECT format($1, VARIADIC $2::text[]) AS ddl', [fmt, args]);
  await client.query(formatted.rows[0].ddl);
}

async function init() {
  console.log('[db:init] Provisioning database and restricted application role only (no migrations, no seed).');

  const admin = resolveAdminDbConfig();
  const dbName = assertIdentifier(process.env.DB_NAME || 'deploymate', 'database name');
  const appUser = assertIdentifier(process.env.DB_APP_USER || '', 'application user');
  const appPassword = process.env.DB_APP_PASSWORD;

  if (!appPassword || !appPassword.trim()) {
    throw new Error('FATAL: DB_APP_USER and DB_APP_PASSWORD are required so db:init can provision the runtime role.');
  }

  const adminClient = new Client({
    host: admin.host,
    port: admin.port,
    user: admin.user,
    password: admin.password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('[db:init] Connected to administrative database "postgres".');

    const dbCheckRes = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (dbCheckRes.rowCount === 0) {
      console.log(`[db:init] Creating database "${dbName}"...`);
      await execFormatted(adminClient, 'CREATE DATABASE %I', dbName);
    } else {
      console.log(`[db:init] Database "${dbName}" already exists.`);
    }

    const roleCheck = await adminClient.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
    if (roleCheck.rowCount === 0) {
      console.log(`[db:init] Creating restricted application role "${appUser}"...`);
      await execFormatted(adminClient, 'CREATE USER %I WITH PASSWORD %L', appUser, appPassword);
    } else {
      console.log(`[db:init] Application role "${appUser}" already exists. Updating password.`);
      await execFormatted(adminClient, 'ALTER USER %I WITH PASSWORD %L', appUser, appPassword);
    }
  } catch (error) {
    console.error('[db:init] Failed while creating database or role:', error);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  const grantClient = new Client({
    host: admin.host,
    port: admin.port,
    user: admin.user,
    password: admin.password,
    database: dbName,
  });

  try {
    await grantClient.connect();
    console.log(`[db:init] Enabling "uuid-ossp" extension on "${dbName}".`);
    await grantClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log(`[db:init] Granting application privileges on "${dbName}" to "${appUser}".`);
    await execFormatted(grantClient, 'GRANT CONNECT ON DATABASE %I TO %I', dbName, appUser);
    await execFormatted(grantClient, 'GRANT USAGE, CREATE ON SCHEMA public TO %I', appUser);
    await execFormatted(grantClient, 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', appUser);
    await execFormatted(grantClient, 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', appUser);
    await execFormatted(grantClient, 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %I', appUser);
    await execFormatted(grantClient, 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %I', appUser);
    console.log('[db:init] Completed. Run db:migrate next, then db:seed.');
  } catch (error) {
    console.error('[db:init] Failed while granting privileges:', error);
    process.exit(1);
  } finally {
    await grantClient.end();
  }
}

init().catch((error) => {
  console.error('[db:init] Unhandled failure:', error);
  process.exit(1);
});
