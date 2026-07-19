import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function init() {
  console.log('Starting DEPLOYMATE Database Initialization...');

  // 1. Connect to default 'postgres' database to check/create 'deploymate'
  const adminClient = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('Connected to default postgres database.');

    // Check if target database exists
    const dbCheckRes = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || 'deploymate']
    );

    if (dbCheckRes.rowCount === 0) {
      console.log(`Database "${process.env.DB_NAME || 'deploymate'}" does not exist. Creating...`);
      // CREATE DATABASE cannot be executed inside a transaction block, so we run it directly
      await adminClient.query(`CREATE DATABASE ${process.env.DB_NAME || 'deploymate'}`);
      console.log(`Database "${process.env.DB_NAME || 'deploymate'}" created successfully.`);
    } else {
      console.log(`Database "${process.env.DB_NAME || 'deploymate'}" already exists.`);
    }
  } catch (error) {
    console.error('Error checking/creating database:', error);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to the 'deploymate' database and run migrations
  const client = new Client({
    ...dbConfig,
    database: process.env.DB_NAME || 'deploymate',
  });

  try {
    await client.connect();
    console.log(`Connected to target database "${process.env.DB_NAME || 'deploymate'}".`);

    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('UUID extension ensured.');

    // Create ROLES table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(50) UNIQUE NOT NULL,
        permissions JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);
    console.log('Roles table created/ensured.');

    // Create USERS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role_id UUID REFERENCES roles(id) ON DELETE RESTRICT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table created/ensured.');

    // Create PROJECTS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Projects table created/ensured.');

    // Create REPOSITORIES table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        github_repo_url VARCHAR(255) NOT NULL,
        default_branch VARCHAR(100) DEFAULT 'main',
        webhook_secret VARCHAR(100),
        access_token_enc TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Repositories table created/ensured.');

    // Create PIPELINES table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        definition JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Pipelines table created/ensured.');

    // Create PIPELINE_RUNS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
        run_number SERIAL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
        triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
        git_commit_sha VARCHAR(100),
        git_commit_message TEXT,
        git_branch VARCHAR(100),
        logs TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Pipeline runs table created/ensured.');

    // Create DEPLOYMENTS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
        environment VARCHAR(50) NOT NULL,
        namespace VARCHAR(100) NOT NULL DEFAULT 'default',
        deployment_name VARCHAR(100) NOT NULL,
        image_tag VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'DEPLOYED',
        config_yaml TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Deployments table created/ensured.');

    // Create RELEASES table
    await client.query(`
      CREATE TABLE IF NOT EXISTS releases (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
        version_tag VARCHAR(50) NOT NULL,
        release_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Releases table created/ensured.');

    // Create NOTIFICATIONS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Notifications table created/ensured.');

    // Create AUDIT_LOGS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id UUID,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Audit logs table created/ensured.');

    // Create pipeline_security_scans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_security_scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        sonar_maintainability_score CHAR(2) NOT NULL,
        sonar_reliability_score CHAR(2) NOT NULL,
        sonar_security_score CHAR(2) NOT NULL,
        sonar_coverage_percentage NUMERIC(5,2) NOT NULL,
        sonar_technical_debt_minutes INTEGER NOT NULL,
        trivy_critical_count INTEGER NOT NULL DEFAULT 0,
        trivy_high_count INTEGER NOT NULL DEFAULT 0,
        trivy_medium_count INTEGER NOT NULL DEFAULT 0,
        trivy_low_count INTEGER NOT NULL DEFAULT 0,
        owasp_cve_count INTEGER NOT NULL DEFAULT 0,
        scan_report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_passed BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Pipeline security scans table created/ensured.');

    // Create gitops_sync_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gitops_sync_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        app_name VARCHAR(100) NOT NULL,
        revision_sha VARCHAR(100) NOT NULL,
        sync_status VARCHAR(50) NOT NULL,
        cluster_health VARCHAR(50) NOT NULL,
        drift_detected BOOLEAN DEFAULT FALSE,
        drift_details_json JSONB DEFAULT '{}'::jsonb,
        sync_duration_seconds INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('GitOps sync history table created/ensured.');

    // Create terraform_states table
    await client.query(`
      CREATE TABLE IF NOT EXISTS terraform_states (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        stack_name VARCHAR(100) NOT NULL,
        configuration_code TEXT NOT NULL,
        state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        variables_json JSONB DEFAULT '{}'::jsonb,
        last_action VARCHAR(50) NOT NULL,
        last_status VARCHAR(50) NOT NULL,
        logs TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Terraform states table created/ensured.');

    // Create sre_slo_targets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sre_slo_targets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        service_name VARCHAR(100) NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        slo_target_percentage NUMERIC(5,3) NOT NULL,
        sli_value_current NUMERIC(5,3) NOT NULL,
        error_budget_remaining_percentage NUMERIC(5,3) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('SRE SLO targets table created/ensured.');

    // Create sre_incidents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sre_incidents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        severity VARCHAR(10) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        assigned_devops_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE,
        postmortem_report TEXT
      );
    `);
    console.log('SRE incidents table created/ensured.');

    // Create chaos_experiments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chaos_experiments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        scenario_type VARCHAR(50) NOT NULL,
        target_resource VARCHAR(255) NOT NULL,
        duration_seconds INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
        resilience_score INTEGER DEFAULT 100,
        report_json JSONB DEFAULT '{}'::jsonb,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Chaos experiments table created/ensured.');

    // Create self_healing_actions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS self_healing_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        pod_name VARCHAR(255) NOT NULL,
        namespace VARCHAR(100) NOT NULL,
        anomaly_detected VARCHAR(100) NOT NULL,
        action_taken VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        incident_id UUID REFERENCES sre_incidents(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Self-healing actions table created/ensured.');

    // 3. Seed initial Roles
    const rolesToSeed = [
      {
        name: 'Super Admin',
        permissions: {
          all: true,
          projects: ['create', 'read', 'update', 'delete'],
          pipelines: ['create', 'read', 'update', 'delete', 'run'],
          deployments: ['create', 'read', 'update', 'delete', 'rollback'],
          users: ['manage'],
          logs: ['read'],
          metrics: ['read']
        }
      },
      {
        name: 'DevOps Engineer',
        permissions: {
          projects: ['create', 'read', 'update'],
          pipelines: ['create', 'read', 'update', 'run'],
          deployments: ['create', 'read', 'update', 'rollback'],
          logs: ['read'],
          metrics: ['read']
        }
      },
      {
        name: 'Developer',
        permissions: {
          projects: ['read'],
          pipelines: ['read', 'run'],
          deployments: ['read'],
          logs: ['read'],
          metrics: ['read']
        }
      },
      {
        name: 'Viewer',
        permissions: {
          projects: ['read'],
          pipelines: ['read'],
          deployments: ['read'],
          logs: ['read'],
          metrics: ['read']
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

    // 4. Seed default Super Admin User
    const superAdminRoleRes = await client.query("SELECT id FROM roles WHERE name = 'Super Admin'");
    const adminRoleId = superAdminRoleRes.rows[0].id;

    const adminEmail = 'admin@deploymate.com';
    const adminPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const userCheck = await client.query("SELECT 1 FROM users WHERE email = $1", [adminEmail]);
    if (userCheck.rowCount === 0) {
      console.log('Seeding default Super Admin user (admin@deploymate.com / admin123)...');
      await client.query(
        `INSERT INTO users (name, email, password_hash, role_id) 
         VALUES ($1, $2, $3, $4)`,
        ['Super Administrator', adminEmail, passwordHash, adminRoleId]
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
