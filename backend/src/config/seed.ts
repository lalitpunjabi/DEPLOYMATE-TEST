import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seed() {
  console.log('Seeding DEPLOYMATE Roles & Default Super Admin User...');

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
    console.log(`Connected to database "${dbConfig.database}". Seeding roles...`);

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
          settings: ['manage'],
        },
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
          ai: ['remediation.approve'],
        },
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
          security: ['read'],
        },
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
          security: ['read'],
        },
      },
    ];

    for (const r of rolesToSeed) {
      await client.query(
        `INSERT INTO roles (name, permissions) 
         VALUES ($1, $2) 
         ON CONFLICT (name) DO UPDATE SET permissions = $2`,
        [r.name, JSON.stringify(r.permissions)]
      );
    }
    console.log('Roles seeded.');

    // Seed Super Admin User
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
      console.warn('⚠️ WARNING: Using default development admin credentials.');
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

    console.log('✅ Database seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
