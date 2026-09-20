import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { runMigrations } from '../services/migrationRunner';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function init() {
  console.log('Starting DEPLOYMATE Database Migration & Initialization...');

  // 1. Connect to default 'postgres' database to check/create 'deploymate'
  const adminClient = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('Connected to default postgres database.');

    const dbName = process.env.DB_NAME || 'deploymate';
    const dbCheckRes = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (dbCheckRes.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database "${dbName}" created successfully.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (error) {
    console.error('Error checking/creating database:', error);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to the target database and execute migrations
  const client = new Client({
    ...dbConfig,
    database: process.env.DB_NAME || 'deploymate',
  });

  try {
    await client.connect();
    console.log(`Connected to target database "${process.env.DB_NAME || 'deploymate'}".`);

    // Run SQL migrations via Migration Runner
    await runMigrations(client);

    // 3. Seed Permissions & Initial Roles
    const rolesToSeed = [
      {
        name: 'Super Admin',
        permissions: {
          all: true,
          project: ['read', 'write', 'delete'],
          pipeline: ['read', 'create', 'execute', 'cancel'],
          deployment: ['read', 'create', 'promote', 'rollback'],
          terraform: ['read', 'plan', 'apply'],
          gitops: ['read', 'sync', 'rollback'],
          incident: ['read', 'create', 'resolve'],
          chaos: ['read', 'execute'],
          security: ['read', 'override'],
          ai: ['remediation.approve'],
          users: ['manage'],
          settings: ['manage']
        }
      },
      {
        name: 'DevOps Engineer',
        permissions: {
          project: ['read', 'write'],
          pipeline: ['read', 'create', 'execute'],
          deployment: ['read', 'create', 'promote', 'rollback'],
          terraform: ['read', 'plan', 'apply'],
          gitops: ['read', 'sync', 'rollback'],
          incident: ['read', 'create', 'resolve'],
          chaos: ['read', 'execute'],
          security: ['read'],
          ai: ['remediation.approve']
        }
      },
      {
        name: 'Developer',
        permissions: {
          project: ['read'],
          pipeline: ['read', 'execute'],
          deployment: ['read'],
          gitops: ['read'],
          terraform: ['read', 'plan'],
          incident: ['read', 'create'],
          security: ['read']
        }
      },
      {
        name: 'Viewer',
        permissions: {
          project: ['read'],
          pipeline: ['read'],
          deployment: ['read'],
          gitops: ['read'],
          terraform: ['read'],
          incident: ['read'],
          security: ['read']
        }
      }
    ];

    console.log('Seeding default roles...');
    for (const r of rolesToSeed) {
      await client.query(
        `INSERT INTO roles (name, permissions) 
         VALUES ($1, $2) 
         ON CONFLICT (name) DO UPDATE SET permissions = $2`,
        [r.name, JSON.stringify(r.permissions)]
      );
    }
    console.log('Roles seeded.');

    // 4. Seed Super Admin User
    const superAdminRoleRes = await client.query("SELECT id FROM roles WHERE name = 'Super Admin'");
    const adminRoleId = superAdminRoleRes.rows[0].id;

    let adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    let adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL SECURITY ERROR: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD environment variables are required in production mode.');
      }
      adminEmail = adminEmail || 'admin@deploymate.local';
      adminPassword = adminPassword || 'AdminPass123!';
      console.warn('⚠️ WARNING: Using default development admin credentials. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in production!');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const userCheck = await client.query("SELECT 1 FROM users WHERE email = $1", [adminEmail.toLowerCase().trim()]);
    if (userCheck.rowCount === 0) {
      console.log(`Seeding initial Super Admin user (${adminEmail})...`);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role_id) 
         VALUES ($1, $2, $3, $4)`,
        ['Super Administrator', adminEmail.toLowerCase().trim(), passwordHash, adminRoleId]
      );
      console.log('Super Admin user seeded successfully.');
    } else {
      console.log('Super Admin user already exists.');
    }

    console.log('DEPLOYMATE Database migration & seeding completed successfully.');
  } catch (error) {
    console.error('Error during migrations and seeding:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

init();
