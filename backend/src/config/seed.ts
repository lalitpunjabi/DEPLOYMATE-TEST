import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { RBAC_ROLES } from './rbacRoles';
import { resolveRuntimeDbConfig } from './dbRuntimeConfig';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seed() {
  console.log('[db:seed] Seeding RBAC roles and initial Super Admin (no schema migrations).');

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
    console.log(`[db:seed] Connected to "${cfg.database}" as runtime user "${cfg.user}".`);

    for (const r of RBAC_ROLES) {
      await client.query(
        `INSERT INTO roles (name, permissions)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET permissions = $2`,
        [r.name, JSON.stringify(r.permissions)]
      );
    }
    console.log('[db:seed] Roles upserted.');

    const superAdminRoleRes = await client.query("SELECT id FROM roles WHERE name = 'Super Admin'");
    if (superAdminRoleRes.rowCount === 0) {
      throw new Error('Super Admin role is missing. Run db:migrate before db:seed.');
    }
    const adminRoleId = superAdminRoleRes.rows[0].id;

    const isProd = process.env.NODE_ENV === 'production';
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim();
    let adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (!adminEmail) {
      throw new Error('FATAL: INITIAL_ADMIN_EMAIL is required for db:seed.');
    }

    if (!adminPassword) {
      if (isProd) {
        throw new Error('FATAL SECURITY ERROR: INITIAL_ADMIN_PASSWORD is required in production. No default password is used.');
      }
      adminPassword = crypto.randomBytes(18).toString('base64url');
      console.log('[db:seed] INITIAL_ADMIN_PASSWORD was not set.');
      console.log(`[db:seed] Generated one-time development Super Admin password for ${adminEmail}:`);
      console.log(adminPassword);
      console.log('[db:seed] This value is not stored in plaintext. Save it now; it will not be shown again.');
    }

    if (adminPassword.length < 12) {
      throw new Error('FATAL SECURITY ERROR: INITIAL_ADMIN_PASSWORD must be at least 12 characters.');
    }

    const userCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [adminEmail.toLowerCase()]);
    if (userCheck.rowCount === 0) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      console.log(`[db:seed] Creating Super Admin user (${adminEmail.toLowerCase()})...`);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role_id)
         VALUES ($1, $2, $3, $4)`,
        ['Super Administrator', adminEmail.toLowerCase(), passwordHash, adminRoleId]
      );
      console.log('[db:seed] Super Admin created.');
    } else {
      console.log('[db:seed] Super Admin user already exists; password was not changed.');
    }

    console.log('[db:seed] Completed successfully.');
  } catch (error) {
    console.error('[db:seed] Failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
