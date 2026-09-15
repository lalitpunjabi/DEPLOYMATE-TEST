# DEPLOYMATE — Enterprise DevSecOps, GitOps & AIOps Platform
### B.Tech Final-Year Major Project · Production-Grade Cloud Operations & DevSecOps Console

**DEPLOYMATE** is a unified, production-grade cloud operations web platform that consolidates core capabilities of industry-standard DevOps tools — **GitLab CI**, **Jenkins**, **ArgoCD**, **Harness**, **Terraform Cloud**, **Prometheus/Grafana**, **Trivy/SonarQube**, and **Chaos Mesh** — into a single operational workspace.

It provides an end-to-end continuous delivery pipeline:
```text
Git Commit → CI/CD Engine → Unit Tests → DevSecOps Gates (Trivy/Sonar) → Docker Build & Push → Declarative GitOps Sync → Kubernetes Rollout → Progressive Delivery (Canary/Blue-Green) → Observability & SLI/SLO Monitoring → Incident Detection → Gemini AIOps Diagnosis → Human Approval → Automated Remediation/Rollback → Markdown Postmortem
```

---

## 1. Target Architecture & Tech Stack

```text
                         DEPLOYMATE
                    ENTERPRISE CONTROL PLANE
                              |
                +-------------+-------------+
                |                           |
             React UI                  API Gateway
        (Vite + React 19)          (Node.js + Express)
                |                           |
                +-------------+-------------+
                              |
                 +------------+------------+
                 |                         |
              Auth/RBAC                Event System
           (Permissions DB)          (EventBus Stream)
                 |                         |
       +---------+---------+               |
       |         |         |               |
      CI/CD    GitOps   Terraform          |
       |         |         |               |
       +---------+---------+               |
                 |                         |
             Kubernetes                    |
          (Real / Sim Mode)                |
                 |                         |
      +----------+----------+              |
      |          |          |              |
   Metrics      Logs      Events           |
      |          |          |              |
 Prometheus     Loki      K8s API          |
      |          |          |              |
      +----------+----------+--------------+
                         |
                  Observability
                         |
                     SRE Engine
                         |
              +----------+----------+
              |                     |
             SLO                Incidents
              |                     |
              +----------+----------+
                         |
                    AIOps Engine
                         |
                  Gemini / AI
                         |
        +----------------+----------------+
        |                |                |
     Diagnosis      Recommendation    Postmortem
        |                |
        +-------+--------+
                |
        Policy / RBAC / Approval
          (Human-in-the-Loop)
                |
        +-------+-------+
        |               |
     Remediation      Rollback
```

### Stack Components:
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, custom dark glassmorphic styling engine. `[Implemented]`
* **Backend:** Node.js, Express.js, TypeScript, PostgreSQL (`pg`), Nodemailer (Email Alerts), `ws` (WebSockets). `[Implemented]`
* **AI Module:** Python 3.11+, FastAPI, Google GenAI SDK (`gemini-1.5-flash`), structured JSON outputs. `[Implemented]`
* **Infrastructure Layer:** `@kubernetes/client-node` API (`REAL` mode) + Fallback `SIMULATION` mode toggle, Terraform HCL Engine, ArgoCD Reconciler. `[Implemented / Simulation Mode Support]`
* **Database & Migrations:** PostgreSQL with versioned SQL migrations (`001_init_schema.sql`, `schema_migrations` tracking table). `[Implemented]`
* **Platform Operations:** `docker-compose.yml`, Helm Chart (`helm/`), `/metrics` self-observability, GitHub Actions dogfood CI pipeline. `[Implemented]`

---

## 2. Platform Feature Inventory & Status Matrix

| Module | Status | Capability Description |
| :--- | :---: | :--- |
| **Authentication & RBAC** | `Implemented` | JWT access tokens, password hashing via bcrypt, granular permission-based authorization (`pipeline.execute`, `deployment.rollback`, `terraform.apply`, `chaos.execute`, `security.override`, `ai.remediation.approve`). |
| **Audit Logging** | `Implemented` | Full compliance audit stream recording user ID, action, resource, timestamp, IP address, and JSON details with filtering in `/audit-logs`. |
| **CI/CD Pipeline Engine** | `Implemented` | Declarative YAML pipelines, stage duration tracking, WebSocket log streaming, artifact execution, and failure recovery. |
| **DevSecOps Security Gates** | `Implemented` | Automated gating evaluating Trivy container CVE counts (Critical/High) and SonarQube quality ratings persisted in `security_gate_policies`. |
| **Kubernetes Integration** | `Implemented` | Cluster topology visualizer (`Services ──► Deployments ──► Pods`) supporting both `REAL` KubeConfig connections and `SIMULATION` modes. |
| **Progressive Delivery** | `Implemented` | Interactive Canary traffic allocation (10% → 50% → 100%) and Blue-Green router swapping with active revision state persistence. |
| **GitOps Reconciler** | `Implemented` | Desired-vs-Live spec comparison, drift diff visualization, and manual/automated reconciliation triggers. |
| **Terraform IaC Runner** | `Implemented` | HCL code generation via AI, dry-run plan logging, static security policy checks (blocking `0.0.0.0/0` SSH access), and state locking. |
| **Observability & SRE** | `Implemented` | SLI/SLO calculations (Availability %, Latency p95/p99, Error Budget, Burn Rate) with automated P1 incident ticketing on burn rate spikes (>14.2x). |
| **AIOps & Co-Pilot** | `Implemented` | Gemini-powered structured JSON diagnosis with empirical evidence lists, confidence ratings (%), risk scores, and Markdown postmortem generation. |
| **Human-in-the-Loop Gate** | `Implemented` | Approval modal (`ApprovalModal.tsx`) requiring explicit operator confirmation before executing high-risk AI remediations or infrastructure mutations. |
| **Resilience Lab (Chaos)** | `Implemented` | Targeted failure injections (`POD_KILL`, `CPU_STRESS`, `NETWORK_DELAY`) with safety limits (max 300s duration, namespace checks) and dynamic resilience scoring. |
| **Platform Engineering** | `Implemented` | Multi-stage Dockerfiles, `docker-compose.yml`, Kubernetes Helm chart (`helm/`), self-observability (`/health`, `/ready`, `/metrics`), and dogfood GitHub Actions CI. |

---

## 3. Environment Setup & Configuration

### Environment Variables Template

Copy `.env.example` to `.env` inside `backend/` and `ai-module/`:

```env
# Backend (.env)
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<your_postgres_password>
DB_NAME=deploymate
JWT_SECRET=<your_secure_jwt_secret>
AI_SERVICE_URL=http://localhost:8000

# AI Microservice (ai-module/.env)
PORT=8000
GEMINI_API_KEY=<your_gemini_api_key>
```

> [!CAUTION]
> NEVER commit actual passwords, JWT secrets, or Gemini API keys to Git repositories. Use environment variables exclusively.

---

## 4. Installation & Booting Guide

### Option A: Single-Command Docker Setup (Recommended)

Run the entire DEPLOYMATE platform (Frontend, Backend API, AI Microservice, and PostgreSQL Database) with a **single command** — no need to open multiple terminal windows or execute manual database setup scripts!

```bash
docker compose up --build
```

**Automated Orchestration Features:**
- **Automated Database Initialization**: Automatically runs SQL migrations (`001_init_schema.sql`), creates database tables, seeds RBAC roles (`Super Admin`, `DevOps Engineer`, `Developer`, `Viewer`), and initializes default Super Admin credentials (`admin@deploymate.com` / `admin123`).
- **Health-Checked Dependency Graph**: Backend waits for PostgreSQL container health checks, and Frontend waits for Backend readiness before launching.
- **Single-Page Application Fallback**: Nginx configured with SPA routing so page refreshes and direct URLs work smoothly.

**Exposed Endpoints:**
- **Frontend Portal**: `http://localhost` (also accessible on `http://localhost:5173`)
- **Backend API Gateway**: `http://localhost:5000`
- **FastAPI AI Microservice**: `http://localhost:8000`
- **PostgreSQL Database**: `localhost:5432`

---

### Option B: Local Multi-Terminal Development Setup

If you prefer running services individually for code editing:

1. **Database Migration & Initialization**:
   ```bash
   cd backend
   npm install
   npx ts-node src/config/initDb.ts
   ```

2. **Start Backend Control Plane**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Start AI Microservice**:
   ```bash
   cd ai-module
   pip install -r requirements.txt
   python main.py
   ```

4. **Start React Frontend Client**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

### Option C: Kubernetes Helm Deployment

Deploy DEPLOYMATE onto a Kubernetes cluster using the included Helm chart:

```bash
helm upgrade --install deploymate ./helm \
  --namespace deploymate \
  --create-namespace
```

---

## 5. Demonstration Workflow (Golden E2E Scenario)

To demonstrate DEPLOYMATE in a technical evaluation or viva:

1. Log into portal as `admin@deploymate.com` / `admin123`.
2. Click **DEMO SEQUENCE** in the top navigation bar to trigger the 8-stage centerpiece demonstration.
3. Observe live pipeline execution, Trivy CVE scanning, Docker build, and GitOps reconciliation.
4. Watch latency metrics spike -> SLO error budget degradation -> Automated P1 Incident creation.
5. Review structured AI diagnosis from Gemini detailing root cause, confidence rating (98%), and correlated evidence list.
6. Interact with the **Human-in-the-Loop Approval Modal** to authorize automated pod rollback remediation.
7. Inspect generated SRE markdown postmortem report and check audit logs in `/audit-logs`.

---

## 6. Troubleshooting & Health Checks

- **Platform Health Endpoint**: `GET http://localhost:5000/health`
- **Database Readiness Endpoint**: `GET http://localhost:5000/ready`
- **Prometheus Metrics Endpoint**: `GET http://localhost:5000/metrics`
- **AI Microservice Health**: `GET http://localhost:8000/health`
