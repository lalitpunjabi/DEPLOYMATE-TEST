-- DEPLOYMATE Database Migration 001: Core Enterprise Schema Initialization

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Permissions & Roles
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 3. Users & Auth
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Projects & Repositories
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  github_repo_url VARCHAR(255) NOT NULL,
  default_branch VARCHAR(100) DEFAULT 'main',
  webhook_secret VARCHAR(100),
  access_token_enc TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Pipelines & Runs
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  definition JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- 6. Deployments & Progressive Delivery
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
  canary_weight INTEGER DEFAULT 0,
  blue_green_color VARCHAR(20) DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logging
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

-- 8. DevSecOps & Security Gate Policies
CREATE TABLE IF NOT EXISTS security_gate_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE UNIQUE,
  fail_on_critical_count INTEGER DEFAULT 0,
  fail_on_high_count INTEGER DEFAULT 2,
  fail_on_sonar_rating VARCHAR(5) DEFAULT 'C',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- 9. GitOps Reconciliation
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

-- 10. Terraform IaC
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

-- 11. SRE SLI/SLO & Incidents
CREATE TABLE IF NOT EXISTS sre_slo_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  slo_target_percentage NUMERIC(5,3) NOT NULL,
  sli_value_current NUMERIC(5,3) NOT NULL,
  error_budget_remaining_percentage NUMERIC(5,3) NOT NULL,
  burn_rate NUMERIC(5,2) DEFAULT 1.0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- 12. AI Remediation Approvals & Human-in-the-Loop
CREATE TABLE IF NOT EXISTS remediation_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES sre_incidents(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  recommendation_summary TEXT NOT NULL,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  evidence_json JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
  requested_by_ai BOOLEAN DEFAULT TRUE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Chaos / Resilience Experiments
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

-- 14. Normalized Global Event Log System
CREATE TABLE IF NOT EXISTS global_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  source VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  resource VARCHAR(255) NOT NULL,
  namespace VARCHAR(100) DEFAULT 'default',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. System Notifications
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_global_events_type ON global_events(event_type);
CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_id);
