-- DEPLOYMATE Hardening Migration 003
-- 1) Audit-log tenant isolation: explicit project relationship for audit records.
-- 2) Multi-replica WebSocket ticket store: shared persistence (Postgres) replacing process-local memory.
-- 3) Webhook delivery retention support: index on created_at for bounded cleanup.

-- =====================================================================
-- 1. AUDIT LOG PROJECT ISOLATION
-- project_id = owning project for project-scoped events.
-- NULL project_id = system-global event (auth, admin, webhooks). Global
-- events are only visible to Super Admins, except events with a
-- user_id which remain visible to their own user.
-- =====================================================================
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================================
-- 2. SHARED WEBSOCKET TICKET STORE
-- Single-use 60-second tickets consumed atomically via
-- DELETE ... RETURNING so any backend replica can validate a ticket
-- created by any other replica. Only the SHA-256 hash of the ticket
-- secret is stored (replay/theft of DB rows cannot mint sessions).
-- =====================================================================
CREATE TABLE IF NOT EXISTS ws_tickets (
  ticket_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  allows_terminal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ws_tickets_expires_at ON ws_tickets(expires_at);

-- =====================================================================
-- 3. WEBHOOK DELIVERY RETENTION
-- Retention cleaner deletes delivery records older than the replay
-- protection window; an index on created_at keeps the sweep cheap.
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
