# DEPLOYMATE v2.0 — Intelligent Enterprise CI/CD, GitOps & AIOps Platform
### B.Tech Major Project · Production-Grade Cloud Operations & DevSecOps Console

DEPLOYMATE is a comprehensive, production-grade cloud operations web platform that consolidates core features of industry-standard tools like **GitLab**, **Jenkins**, **ArgoCD**, **Harness**, **Terraform Cloud**, **Grafana**, and **Chaos Mesh** into a unified workspace. It automates software build workflows, testing, vulnerability checks, containerization, deployment monitoring, declarative GitOps reconciliation, and chaos experiments.

The platform is designed with a premium glassmorphic dark-mode interface and incorporates a **Gemini-powered AIOps Engine** to troubleshoot pipeline logs, analyze cluster pod events, optimize cloud costs, assess configuration security risks, and compile incident postmortems.

---

## 1. System Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                          React Portal UI                               │
   │            (Vite + React 19 + TypeScript + Tailwind CSS v4)            │
   └─────────────┬────────────────────────────────────────────┬─────────────┘
                 │ (REST API Gateway)                         │ (WS Log Streams)
                 ▼                                            ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                     Express.js Platform Coordinator                     │
   │                         (TypeScript + Node.js)                         │
   └─────────────┬────────────────────────────────────────────┬─────────────┘
                 │                                            │
                 ├─► PostgreSQL Database Pool                 ├─► Kubernetes Cluster API
                 │   (RBAC Roles, Users, Audits, states)      │   (Local Context namespaces)
                 │                                            │
                 ├─► Observability Hub                        ├─► Python AIOps fastapi
                 │   (Prometheus Metric SLIs, Loki LogQL)     │   (Gemini Pro SDK, vector matches)
                 │                                            │
                 ├─► GitOps Sync timeline                     └─► Chaos Monkey Scheduler
                 │   (ArgoCD state drift comparisons)             (Failure injection simulator)
                 │
                 └─► Terraform Execution Runner
                     (Secure stack plan & apply states)
```

### Stack Components:
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts (graphs), custom glassmorphic styling engine.
* **Backend:** Node.js, Express.js, TypeScript, PostgreSQL Client (`pg`), Nodemailer (Email Alerting), `ws` (WebSockets).
* **AI Module:** Python 3.13+, FastAPI, Google GenAI SDK (Gemini-3.5-Flash).
* **Infrastructure Layer:** Kubernetes API (`@kubernetes/client-node` / simulated contexts), Terraform Engine, ArgoCD Webhook Emulator.
* **Data Layer:** PostgreSQL (Tables for roles, users, projects, pipelines, run histories, security scans, GitOps syncs, Terraform states, SRE SLOs, SRE incidents, chaos experiments, self-healing events).

---

## 2. Booting & Setup Instructions

Ensure your local PostgreSQL instance is running. The local service `postgresql-x64-18` on port `5432` with password `Lalit@postgre04` is assumed.

### Step 1: Database Migration & Seeding
Navigate to the `backend/` folder and run the database initialization script to create tables and seed default roles:
```bash
cd backend
npm install
npx ts-node src/config/initDb.ts
```
This automatically:
1. Creates the database `deploymate` (if not exists).
2. Sets up the DDL schemas (Users, Roles, Projects, Pipelines, Runs, Audits, Security Scans, GitOps syncs, Terraform states, SRE SLOs, SRE incidents, chaos experiments, self-healing events).
3. Pre-seeds 4 enterprise roles: `Super Admin`, `DevOps Engineer`, `Developer`, and `Viewer`.
4. Creates the default admin account:
   * **Email:** `admin@deploymate.com`
   * **Password:** `admin123`

### Step 2: Start the Backend Service
In the `backend/` folder, start the compiler/watcher:
```bash
npm run dev
```
The server will run on port `5000` (including WebSockets on `/ws/logs` and `/ws/terminal`).

### Step 3: Start the FastAPI AI Module
Navigate to the `ai-module/` folder, activate your environment, and start the FastAPI service:
```bash
cd ../ai-module
pip install -r requirements.txt
python main.py
```
This runs the Python microservice on `http://localhost:8000` and authenticates with your `GEMINI_API_KEY` defined inside `.env`.

### Step 4: Start the Frontend Client
Navigate to the `frontend/` folder, install dependencies, and launch Vite:
```bash
cd ../frontend
npm install
npm run dev
```
The client app boots on `http://localhost:5173/` with hot module replacements (HMR) fully active.

---

## 3. Platform Modules & Key Capabilities

1. **RBAC Guard Middleware:** Role Based Access Control checks restrict write operations on cloud infrastructure and release pipelines (e.g., Viewers are blocked from applying Terraform plans, swapping Blue-Green routing, or injecting chaos).
2. **DevSecOps Security Gating:** Analyzes code quality metrics (SonarQube) and container vulnerabilities (Trivy). Gating rules compare results against configurable limits to halt rollout pipelines on security policy violations.
3. **Continuous GitOps Controller:** Emulates ArgoCD pull-based deployment tracking. Features an interactive timeline topology, manual sync triggers, and live file drift detectors comparing live parameters to Git specs.
4. **Terraform IaC Runner:** Invokes Gemini AI prompts to compile HCL configurations, runs secure dry-run plan configurations, and applies resources with postgres-locked execution logs.
5. **SRE Incident Console:** Tracks service health SLIs (Availability, Latency, Error rates) against SLO targets. Features alert ticketing, auto-healing restarts, and Gemini-compiled markdown incident postmortems.
6. **Chaos Monkey Scheduler:** Injects simulated fault stressors (`POD_KILL`, `CPU_STRESS`, `NETWORK_DELAY`) to target deployments, calculates SLO drift during failure, and reports a resilience recovery score.
7. **Loki Log Explorer:** Formulates LogQL queries. Colorizes stdout terminal prints with regex highlighting status codes, SQL statements, and call latency metrics.
8. **Interactive K8s Topology Map:** Renders logical trees connecting `Services ──► Deployments ──► Pods`. Clicking pods opens inspectors streaming live CPU and RAM usage alongside rollback logs.
9. **AI Diagnostics & Copilot Workspace:** Features an interactive splitscreen YAML editor integrated with Gemini. Performs live manifest static security scans (evaluating security, resource, and availability rules), maps issues to precise line markers, supports one-click automated remediation code insertion, and connects developers to an interactive SRE co-pilot chatbot.

