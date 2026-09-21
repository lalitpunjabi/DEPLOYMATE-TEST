# DEPLOYMATE — Production Readiness & Hardening Audit Report

> Verification legend used throughout this document:
> **STATIC VERIFIED** — confirmed by compilation / unit tests / config parsing, no running services.
> **LIVE VERIFIED** — confirmed by executing commands against a genuinely running `docker-compose.prod.yml` stack (Postgres, backend, AI module, Nginx edge).
> **SIMULATED** — feature intentionally runs in a labelled non-live mode (`execution_mode: "SIMULATED"`).
> **NOT VERIFIED** — code path exists and is labelled honestly, but was **not** exercised against a real external system in this environment.
>
> This report does **not** claim unconditional readiness. See §24 for the final, scoped verdict.

---

## 1. Executive Summary

DEPLOYMATE is a single-lineage DevSecOps / Cloud-Operations control plane (there is exactly one architecture — no `v1`/`v2`/fork variants). This hardening pass focused on: multi-tenant authorization, audit-log isolation, genuinely shared multi-replica WebSocket state, honest execution-mode labelling, credential hygiene, and deployable infrastructure (Docker/Helm/CI).

Mandatory **security** gates (authorization, tenant isolation, WebSocket security, webhook HMAC + replay protection, password policy, secret validation, infra config) are **implemented and verified** — statically and, for the API/WS/Webhook/DB surface, live against a real container stack.

Optional **integration** gates that require external systems (a live Kubernetes API server, Prometheus, Google Gemini, Trivy/SonarQube/GitHub) are present, fail closed, and label themselves honestly, but remain **NOT VERIFIED** end-to-end in this environment. The final verdict in §24 reflects that distinction rather than overstating coverage.

---

## 2. Architecture

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| Frontend edge | Nginx (React 19 + Vite static build) | Only public listener: 80 → 301 → 443. Proxies `/api/v1/`, `/ws/`, `/health`, `/ready`. |
| API / pipeline engine | Node.js 20 + Express + TypeScript | Stateless app; all shared state lives in Postgres. |
| Realtime | `ws` (WebSocket) over `/ws/logs`, `/ws/terminal` | Ticket-authenticated; log fan-out via Postgres `LISTEN/NOTIFY`. |
| AI microservice | Python FastAPI (Gemini optional) | Enforces `X-Internal-Token`; labels `engine: LIVE|SIMULATED`. |
| Database | PostgreSQL 16 | Single source of truth for sessions, tickets, audit, pipeline state. |
| Orchestration | Docker Compose (prod) + Helm chart | Two supported deploy targets. |

**Shared-state decision (hardening spec §3):** The mandatory requirement was that WebSocket single-use tickets be shared across replicas. Redis is one valid option; this project deliberately uses **PostgreSQL as the shared store** (`ws_tickets` table consumed atomically with `DELETE ... RETURNING`, plus `pg_notify` for log broadcast) because Postgres is already a hard dependency and the ticket volume is tiny. This avoids adding/chunk-securing a second stateful service. The trade-off (one extra DB round-trip per WS connect) is negligible for this workload.

---

## 3. Security Controls (summary matrix)

| Control | Status | Evidence |
| :--- | :--- | :--- |
| Helmet + hardened HTTP headers | LIVE VERIFIED | HTTPS responses carry HSTS, CSP, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy. |
| Rate limiting | STATIC VERIFIED (partial) | `globalLimiter` (1000/15m) + dedicated `auth`/`ai`/`webhook` limiters. **Per-process** (see §23). |
| Input validation / UUID gating | STATIC + LIVE VERIFIED | `isValidUuid` on every resource id; 31/31 security tests + live 400/401/403 paths. |
| Error sanitization | STATIC VERIFIED | `sendSafeError` — no stack traces to clients. |
| No fabricated data | STATIC VERIFIED | Repo-wide grep: no fabricated CVE ids / mock-fallback strings; unsafe paths return `NOT_EXECUTED`/`DEGRADED`. |
| Secrets never defaulted | LIVE VERIFIED | Production startup aborts on missing/insecure secrets (security test 24); Helm `required()` fails render without secrets. |

---

## 4. Authentication & Session Security

- JWT access tokens with **server-side session records** (`user_sessions`, token hashed). Logout revokes the session; a revoked token is rejected.
- **LIVE VERIFIED:** login returns a token; after `/auth/logout`, the same token yields `401` ("Session has been revoked or logged out."). (Live test 3 & 4.)
- Self-registration always assigns the least-privilege `Developer` role — privilege escalation through the public API is impossible (**LIVE VERIFIED**, live test 5).
- RBAC permission category keys were corrected to match the runtime checks (see §5) so documented roles are actually enforced.
- **Administrative disable takes effect immediately:** `PATCH /admin/users/:id/status {isActive:false}` revokes the user's active sessions, and both `authenticateToken` and `/auth/login` reject a disabled account. (**LIVE VERIFIED**, live test 14: existing session → `401/403`, re-login → `403`.)

---

## 5. RBAC

Roles seeded from `backend/src/config/rbacRoles.ts`: **Super Admin**, **DevOps Engineer**, **Developer**, **Viewer**.

A previously latent defect is fixed here: routes authorize against **plural** categories (`projects`, `pipelines`, `deployments`) and the verb `run`, while the seed used **singular** keys (`project`, `pipeline`, `deployment`) and `execute`. That mismatch made every non-admin grant silently fail closed (roles other than Super Admin could not use most features). The seed keys/verbs are now aligned to the runtime contract; **capability levels were preserved** (Developer stays read-mostly, DevOps gains operational `create`/`run`, project deletion stays admin-only).

- **LIVE VERIFIED:** after Super Admin promotes two users to `DevOps Engineer`, each can create its own project; a `Developer` cannot.
- `security.test.ts` (31 tests) validates role-name and owner/member authorization logic — unaffected by the key rename because tests key off role names and `owner_id`/members.

---

## 6. Multi-Tenant Isolation

`requireProjectAccess` resolves the owning project from the **database record** of the target resource (state / pipeline / run / deployment / incident / chaos / gitops / scan / namespace) before any user-supplied id, defeating parameter pollution; it then checks `owner_id` OR `project_members`, with Super Admin as the only cross-tenant override. Responses avoid existence leakage (403/404).

**Authoritative context (hardening pass):** after resolution + authorization, the middleware attaches `req.projectContext = { projectId }`, which controllers are expected to read instead of re-trusting body/query ids. A client-supplied `projectId` is now used **only** when *no* protected resource id is present (create / list-within-a-project) and is always membership-checked; a referenced-but-nonexistent resource is a hard `404` so a bogus id can never fall through to the supplied project.

- **Fixed this pass:** the middleware previously resolved pipelines only from `req.params.pipelineId`, so `GET /pipelines/runs?pipelineId=…` (and `POST /devsecops/scan-thresholds` `body.pipeline_id`) were **not** DB-resolved. Both are now resolved from param/query/body alike — closing a real IDOR where a caller could list another tenant's pipeline runs by pairing the victim's `pipelineId` with its own `projectId` (**LIVE VERIFIED**, live test 6c). The scan-thresholds path also stopped failing closed for legitimate project members. As defense-in-depth, `listPipelineRuns` re-binds its query to `req.projectContext.projectId`.

Audit isolation (`auditService.queryAuditLogs`) implements three visibility classes: project-scoped (owner/members + Super Admin), personal (`user_id`, project NULL), and global (both NULL → Super Admin only). All write-controllers route audit through `insertAuditLog` with the resolved `project_id`.

- **LIVE VERIFIED:** User A is denied (`403/404`) on User B's project-scoped read while succeeding on its own project (`200`); A's project listing excludes B's project (live tests 6 & 6b).
- **STATIC VERIFIED:** security tests 1–11 (cross-tenant projects, pipelines, runs, deployments, terraform states, gitops, chaos, incidents, logs, WS logs/terminal).

---

## 7. WebSocket Security

- Authentication uses **single-use, 60-second tickets** (`POST /api/v1/auth/ws-ticket`), stored **only as SHA-256 hashes** in the shared `ws_tickets` table and consumed atomically (`DELETE ... RETURNING`) so any replica can validate a ticket minted by any other replica.
- `?token=<JWT>` query-string authentication is rejected outright.
- `/ws/terminal` requires a ticket explicitly flagged `terminal:true`, held only by `Super Admin`/`DevOps Engineer`, plus namespace→project scope match.
- **LIVE VERIFIED:** real `ws` upgrade succeeds with a valid ticket (`101`); replaying the consumed ticket → `401`; JWT query auth → `401`; malformed ticket → `401` (live tests 8–11).
- **LIVE VERIFIED (concurrency):** two simultaneous upgrades presented with the *same* ticket result in **exactly one** success — the `DELETE … RETURNING` claim is globally atomic on the shared Postgres store (**live test 8b**). This is the property that underpins correct behavior across replicas, since every replica reads the same table.
- **NOT VERIFIED:** running two *separate* backend processes behind a load balancer (the store is Postgres-shared and the atomicity above is proven, but a physical 2-replica deployment was not stood up here — see §23).

---

## 8. Webhook Security

- Raw-body **HMAC-SHA256** verification (byte-exact via `express.json({ verify })`), signature + delivery-id presence checks, and **Postgres replay protection** (`webhook_deliveries`).
- Repository→project mapping uses **exact** matching; ambiguous mapping returns `400` and triggers no run (no fuzzy `ILIKE`).
- Delivery rows are retained under a bounded cleanup window (index `idx_webhook_deliveries_created_at`) that does not over-delete recent replay records.
- **LIVE VERIFIED:** bad signature → `401`; valid signature accepted; duplicate delivery ignored (live test 13).
- **STATIC VERIFIED:** security tests 16–22.

---

## 9. Database Security

- **Privilege separation:** application runtime uses `DB_APP_USER`/`DB_APP_PASSWORD` only; the provisioning superuser (`DB_USER`/`DB_PASSWORD`) is used solely by `db:init` and is **not** injected into the backend runtime. Production runtime rejects known-insecure default passwords.
- Lifecycle split into `db:init` (create DB + restricted role + grants) → `db:migrate` (versioned SQL) → `db:seed` (RBAC + one Super Admin).
- **LIVE VERIFIED:** all three run cleanly; `003_hardening.sql` (audit `project_id`, `ws_tickets`, webhook index) applied on a live DB.
- **STATIC VERIFIED:** security tests 23–26 (production startup performs no DB init; aborts without secrets; runtime uses app user only; no default admin password).

---

## 10. Docker Security

- Multi-stage builds; `npm ci --omit=dev`; non-root runtime users.
- Compose prod: `security_opt: no-new-privileges`, `cap_drop: ALL` (with the minimal `cap_add` required by Postgres/Nginx bind), read-only cert mount, JSON log rotation, and `HEALTHCHECK` on backend/frontend/AI.
- `.dockerignore` added for backend/frontend/ai-module to keep secrets and `node_modules` out of build contexts.
- **Repo hygiene (verified this pass):** `git ls-files` confirms `dist/`, `node_modules/`, `.env*` and `certs/*.pem` are **not** tracked. A previously-committed `ai-module/__pycache__/main.cpython-313.pyc` was untracked (`git rm --cached`); `.gitignore` already excludes it, so it will not return.
- **LIVE VERIFIED:** all three prod images build; containers report healthy.

---

## 11. TLS / Nginx

- TLS 1.2/1.3, `ssl_ciphers HIGH:!aNULL:!MD5`, HSTS (`max-age=31536000; includeSubDomains`).
- Security headers: `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a restrictive CSP (`default-src 'self'`, `script-src 'self'`, `frame-ancestors 'self'`).
- ACME challenge served on HTTP before the blanket 301 redirect.
- **`/metrics` is intentionally NOT proxied at the public edge** — Prometheus scrapes `backend:5000/metrics` on the private network only.
- **LIVE VERIFIED:** `http://localhost/` → `301` to HTTPS; HTTPS `/health` `200` with the headers above; `https://localhost/metrics` returns the SPA `text/html` (not backend metrics), confirming no public metrics exposure.

---

## 12. AI Security

- The AI module requires `X-Internal-Token`; unauthenticated calls are rejected.
- The backend `aiService` gateway calls the module with a 30s timeout and **never serves unlabeled mock output**: unreachable / non-2xx / parse errors throw `AiUnavailableError` → HTTP `503` with `execution_mode: "DEGRADED"`. All five former silent-mock fallbacks were removed.
- `execution_mode` propagates the module's honest engine label: `LIVE` **only** when the module reports `engine: "LIVE"` (Gemini genuinely ran), else `SIMULATED`.
- **SIMULATED (live-verified as labelled):** with `AI_MODE=simulated` the module returns `engine:"SIMULATED"`.
- **No IDOR surface on AI analysis endpoints:** `failure-analysis`, `log-analysis`, `risk-assessment`, `pipeline-generator` and `chat` are stateless — they analyze client-supplied text only and never resolve a resource by id, so there is no cross-tenant lookup to bypass. `create-fix-pr` derives its project from the DB (`runId`/repo) and enforces owner/`project_members` membership before acting (**STATIC VERIFIED** by code audit).
- **NOT VERIFIED:** the Gemini `LIVE` branch (no API key in this environment) and the AI-container token-rejection path (AI container `/health` reachable internally; the enforced rejection was verified statically/prior).

---

## 13. Observability

- `getLiveMetrics` reports `source: "PROMETHEUS_LIVE"`, `execution_mode: "LIVE"` **only inside the successful-query block**. On failure with `PROMETHEUS_URL` set → `DEGRADED` (simulated placeholders + explicit notice); unset → `SIMULATED`.
- Centralized logs and SRE dashboards label simulated data honestly.
- **NOT VERIFIED:** live Prometheus querying (no instance configured here). Frontend badges display `execution_mode` honestly in Monitoring/Deployments/SRE.
- **Tenant posture (fail-closed by design):** `/api/v1/monitoring/*` and FinOps are gated by `authorize('metrics','read')`, and no seeded role grants `metrics` — so cluster-wide telemetry/FinOps is effectively **Super-Admin-only**. They accept a `namespace`/query but perform no per-project lookup; exposing them to non-admins would first require wiring `namespace → project` through `requireProjectAccess` (see §23). Left intentionally restrictive rather than widened without scoping.

---

## 14. GitOps

Reconciler sync/drift operations run in `execution_mode: "SIMULATED"` (DB bookkeeping; no live ArgoCD/cluster calls). **SIMULATED / STATIC VERIFIED.**

## 15. Terraform

HCL generation delegates to the AI module (honest `LIVE`/`SIMULATED`), returning `503 DEGRADED` when the generator is unreachable (static template explicitly labelled as non-AI). Plan/apply logs are `execution_mode: "SIMULATED"`; policy checks block `0.0.0.0/0` SSH. State ids and `project_id` are UUID-validated; apply audits are project-scoped. **SIMULATED / LIVE-verified labelling.**

## 16. Chaos Engineering

Scenario **allowlist** (`CPU_STRESS`, `POD_KILL`, `NETWORK_DELAY`, `MEMORY_PRESSURE`), positive-integer duration cap, name/target length limits, project UUID validation, project-scoped audit, and `execution_mode: "SIMULATED"` on reports/history. No real cluster fault injection occurs. **SIMULATED.**

## 17. SRE

SLO/SLI figures are labelled `SIMULATED` (stored reference targets, not live measurements). Incident create/resolve are validated and project-scoped. **Self-healing records now say `Recommended (SIMULATED): kubectl ...` with status `SIMULATED` — the previous fake `SUCCESS` was removed.** Postmortem generation uses the AI gateway (`503 DEGRADED` if unavailable; no fabricated template). Self-healing action listing is tenant-isolated. **SIMULATED / LIVE-verified labelling.**

## 18. Helm

- Chart externalizes the database: `env.dbHost` is **`required()`** — it never silently assumes an in-cluster `postgres`.
- `secret.yaml` uses `required()` for `dbAppPassword`, `jwtSecret`, `aiInternalToken`, `githubWebhookSecret` (Gemini optional) → render fails without them.
- Backend/ai run with hardened `securityContext`; frontend Nginx keeps only the minimal capabilities needed to bind ports; `PROMETHEUS_URL` wired as optional env.
- **LIVE VERIFIED:** `helm lint` → `0 chart(s) failed`; `helm template` renders 8 workloads with values supplied; omitting secrets aborts the render with a clear `required()` error (no silent defaults).
- **NOT VERIFIED:** `helm install` against a real Kubernetes cluster (no cluster available here).

## 19. CI/CD

`.github/workflows/deploymate-ci.yml` runs, with **no `|| true` masking anywhere**: backend build + compiled security regression tests + `npm audit`; a **Postgres-backed live-integration job** (`db:init/migrate/seed` → start server → `/health` gate → `LIVE_INTEGRATION=1` suite); frontend build; AI compile-check; `docker compose config -q` + full image build; and `helm lint` + `helm template` (with required values asserted). **STATIC VERIFIED** (workflow authored; individual commands reproduced locally as documented below).

Two CI-only defects that local/Docker runs masked were fixed: (1) the integration job sets `NODE_ENV=production`, which makes `npm ci` skip `devDependencies` (`@types/*`) and breaks `tsc` — corrected to `npm ci --include=dev`; (2) `tsc` does not copy non-TS `.sql` assets, so a raw `node dist/... db:migrate` found no migrations and **silently exited 0** (masked in Docker by an explicit `COPY src/migrations`). `migrationRunner.ts` now resolves the migrations dir from candidate paths and **throws** if none contain `.sql`, so downstream seeding can never run against an un-migrated schema.

## 20. Automated Test Results

Security regression suite — **STATIC VERIFIED, 31/31 PASSED** (`node dist/__tests__/security.test.js`), covering tenant isolation (1–11), WebSocket tickets (12–15), webhooks (16–22), DB lifecycle/secrets (23–26), 12-char password policy (27–29), UUID + WS-ticket format (30–31).

Backend `tsc` build and frontend `vite build` — **STATIC VERIFIED**, exit 0.

## 21. Live Environment Verification

Against a genuinely running `docker-compose.prod.yml` stack — **LIVE VERIFIED**:
- `docker compose config -q` → exit 0; three images built; `ps` shows backend/db/ai **healthy**, frontend up; **only 80/443 published** (5000/8000/5432 internal).
- `db:init` → `db:migrate` (applied `003_hardening.sql`) → `db:seed` all exit 0.
- **Live integration suite — 17/17 PASSED**: health/ready, login, session revocation, Developer-cannot-create (least privilege), cross-tenant deny + owner allow, listing excludes other tenant, **pipeline-run IDOR/pollution denied + owner allowed (6c)**, WS ticket issue, real WS `101` upgrade, **concurrent single-use consumption → exactly one success (8b)**, replay→401, JWT-query→401, malformed→401, password policy 400/201, webhook HMAC + replay, and admin-disabled user loses access immediately + cannot re-login (live test 14).
- HTTPS 301 redirect + header set; `/metrics` not publicly exposed.

## 22. Simulated Features (by design)

GitOps reconcile/sync/drift, Terraform plan/apply, Chaos injection, Kubernetes read/rollback when no kubeconfig is attached, SRE self-healing recommendations, DevSecOps scans when Trivy/SonarQube are absent (`scan_status: NOT_EXECUTED`), AI analysis when the engine is not `LIVE`, monitoring when no Prometheus, and centralized log content. Every one is returned with an explicit `execution_mode` and, where relevant, a `notice`.

## 23. Known Limitations

1. **Rate limiting is process-local** (`express-rate-limit` in-memory). Behind >1 replica without sticky sessions, effective limits are N× the configured value. Not a correctness/isolation issue, but the enforcement ceiling scales with replica count. Recommend a shared store if edge rate limits must be global.
2. **Multi-replica WS handoff:** concurrent single-use consumption of a ticket is **live-verified** to admit exactly one winner (test 8b), proving the shared-store atomicity. What remains untested is a physical **two-process deployment behind a load balancer** (same shared Postgres DB, but separate processes were not stood up here).
3. **External LIVE integrations (K8s, Prometheus, Gemini, Trivy/Sonar/GitHub) NOT VERIFIED** end-to-end; they must be validated against the real systems in the target environment before relying on their `LIVE` paths.
4. The AI-container internal-token rejection and Gemini `LIVE` branch were verified statically/by labelling, not against a live AI+Gemini deployment in this run.
5. **Frontend code-quality lint is advisory, not a CI gate.** `npm run lint` reports 58 pre-existing stylistic findings (mostly `@typescript-eslint/no-explicit-any` and the strict React-19 `react-hooks` purity/set-state rules) unrelated to security. The frontend `tsc -b` typecheck and production `vite build` are green and are what CI enforces. Clearing the hook/`any` findings is an out-of-scope refactor deferred to avoid regressions; no lint gate was disabled or `|| true`-masked to hide them.
6. **Cluster-wide Monitoring/FinOps are intentionally Super-Admin-gated (fail-closed).** Making them safe for lower-privilege roles requires `namespace → project` scoping via `requireProjectAccess` before widening the `metrics` permission (§13).

## 24. Production Deployment Checklist

- [ ] Supply unique `JWT_SECRET`, `AI_INTERNAL_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `DB_APP_PASSWORD`, `DB_PASSWORD`, `INITIAL_ADMIN_PASSWORD` (≥12 chars, none a default).
- [ ] Point `DB_HOST` / Helm `env.dbHost` at the external managed Postgres (chart will not render without it).
- [ ] Install real TLS certificates (or ACME) — do not ship the self-signed dev pair.
- [ ] Set `PROMETHEUS_URL` for live telemetry; leave unset to keep honest `SIMULATED`.
- [ ] Provide `GEMINI_API_KEY` + `AI_MODE=live` only when Gemini use is authorized; otherwise `simulated`.
- [ ] Run `db:init` → `db:migrate` → `db:seed` once during provisioning.
- [ ] Confirm only 80/443 are publicly bound; keep `/metrics` off the public edge.
- [ ] Run the CI pipeline green (build, security tests, live integration, compose config/build, helm lint/template).
- [ ] Load-test ≥2 backend replicas for the WS ticket handoff and decide on a shared rate-limit store.
- [ ] Validate each external integration's `LIVE` path in the target environment.

### Final Verdict

```text
CORE SECURITY CONTROLS .................. PRODUCTION READY (STATIC + LIVE VERIFIED)
  (authz, tenant isolation, WS security, webhook HMAC+replay,
   password policy, secret validation, DB lifecycle, infra config)

OPTIONAL LIVE INTEGRATIONS .............. NOT VERIFIED IN THIS ENVIRONMENT
  (real Kubernetes API, Prometheus, Gemini LIVE AI,
   Trivy/SonarQube/GitHub, multi-replica scale test)

OVERALL UNCONDITIONAL CERTIFICATION ..... WITHHELD
DEPLOYMATE is safe to operate in its labelled SIMULATED/DEGRADED modes today.
Full "PRODUCTION READY" across every integration is DEFERRED until the §23
external-system and multi-replica gates are exercised in the target environment.
```
