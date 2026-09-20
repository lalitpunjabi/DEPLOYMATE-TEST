# DEPLOYMATE Security Specification & Operational Architecture

This document details the security model, role-based access control (RBAC), session lifecycle management, and DevSecOps safeguards implemented in the **DEPLOYMATE** platform.

---

## 1. Authentication & Session Architecture

- **Stateful JWT Revocation**: Every login generates an 8-hour access token stored as a SHA-256 hash in `user_sessions`. Logging out or resetting passwords updates `revoked_at = NOW()`, immediately invalidating token access.
- **Strict Role Assignment**: Public registration (`/api/v1/auth/register`) enforces the `'Developer'` role. Caller attempts to request `'Super Admin'` or `'DevOps Engineer'` are ignored server-side.
- **Super Admin Management**: Admin endpoints under `/api/v1/admin/` allow Super Admins to view active user sessions, update roles, toggle user active status (`is_active`), and revoke sessions.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Role | Permissions & Capabilities |
| :--- | :--- |
| **Super Admin** | Full platform administration (`all: true`). User management, role modification, session revocation, policy overrides, all operations. |
| **DevOps Engineer** | Operational access (`pipeline.*`, `deployment.*`, `terraform.*`, `gitops.*`, `chaos.execute`, `ai.remediation.approve`). Cannot manage user roles. |
| **Developer** | Read access to projects, pipelines, and deployments. Can trigger pipelines and dry-run terraform plans. Cannot execute chaos or apply terraform. |
| **Viewer** | Read-only access to monitoring dashboards, audit logs, and status views. No mutation access. |

---

## 3. WebSocket Upgrade & Handshake Security

- **Short-Lived Single-Use Tickets (`POST /api/v1/auth/ws-ticket`)**: Authenticated clients request a 60-second single-use ticket before initiating a WebSocket upgrade. This avoids passing long-lived JWTs in URL query strings.
- **Fail-Closed Authorization**:
  - **`/ws/logs`**: Validates the WebSocket ticket and verifies that the `runId` maps directly to a project owned by or accessible to the user.
  - **`/ws/terminal`**: Validates ticket, verifies user role is `Super Admin` or `DevOps Engineer`, and verifies namespace mapping via `SELECT DISTINCT project_id FROM deployments WHERE namespace = $1`. Ambiguous or unmapped namespaces fail closed with HTTP 403.

---

## 4. Input Sanitization & Attack Prevention

- **Command Injection Prevention**: Infrastructure commands (`terraform`, `git`, `docker`, `kubectl`) use `safeSpawnCommand` with array argument vectors and `shell: false`.
- **SSRF Prevention**: `validateExternalUrl` validates incoming Webhook and Git URLs, blocking loopback addresses (`127.0.0.1`, `localhost`), metadata service (`169.254.169.254`), and private CIDRs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Path Traversal Protection**: `sanitizeFilePath` verifies resolved file paths remain strictly inside base directory boundaries using `path.resolve()`.

---

## 5. Webhook & AI Service Security

- **Raw-Body Constant-Time HMAC SHA-256**: GitHub webhooks on `/api/v1/webhooks/github` calculate HMAC SHA-256 over raw HTTP request bytes before JSON parsing using `crypto.timingSafeEqual`.
- **Persistent Database Replay Protection**: `X-GitHub-Delivery` header is checked against PostgreSQL `webhook_deliveries` with `INSERT ... ON CONFLICT DO NOTHING`. Replayed delivery IDs return HTTP 200 IGNORED without re-triggering CI pipelines.
- **Deterministic Repository Mapping**: GitHub repos must match a single unique project mapping. Ambiguous repository URLs fail closed.
- **Internal AI Service Authentication**: FastAPI AI module requires `X-Internal-Token` matching `AI_INTERNAL_TOKEN` on all internal requests. Requests missing or with invalid internal tokens fail closed.

---

## 6. Multi-Tenant Project Isolation & Error Sanitization

- **Child Resource ID Resolution**: `requireProjectAccess` middleware resolves child resource IDs (`pipelineId`, `runId`, `deploymentId`, `stateId`, `incidentId`, `chaosId`, `scanId`) to `project_id` in database before checking membership across Terraform, GitOps, Chaos, and Logs controllers.
- **Honest Simulation Labelling**: Non-live operations explicitly specify `execution_mode: "SIMULATED"` and scrub fabricated AWS or Kubernetes resource IDs.
- **Sanitized Error Responses**: Production error handler (`sendSafeError`) hides internal stack traces, raw SQL messages, and system paths from client responses, attaching `X-Request-ID` UUID correlation headers for audit tracking.
