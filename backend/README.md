# DEPLOYMATE Backend API Gateway & Control Plane

### Express.js + TypeScript + PostgreSQL + WebSockets

The **DEPLOYMATE Backend API Gateway** serves as the central control plane connecting the React UI client, PostgreSQL database, Kubernetes cluster API, and FastAPI AI microservice.

---

## 1. Directory Structure

```text
backend/
├── src/
│   ├── config/             # DB connection pool (db.ts) and schema init scripts (initDb.ts)
│   ├── controllers/        # Operational controllers (auth, pipeline, k8s, devsecops, etc.)
│   ├── middleware/         # Auth JWT verification & RBAC permission checks
│   ├── migrations/         # Database schema migrations (001_init_schema.sql)
│   ├── routes/             # REST API route handlers (/api/v1/*)
│   ├── services/           # Business logic & integrations (k8s, telemetry, terraform, chaos)
│   └── index.ts            # Server entry point, HTTP server, rate limiter, WebSockets
├── Dockerfile              # Production Node.js build container
├── package.json            # NPM dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

---

## 2. API Endpoints Overview

| Route Prefix | Component / Domain | Capabilities |
| :--- | :--- | :--- |
| `/api/v1/auth` | Authentication & RBAC | User registration, login JWT token generation, permission verification |
| `/api/v1/projects` | Projects Registry | Source repository & Kubernetes namespace project management |
| `/api/v1/pipelines` | CI/CD Engine | Pipeline trigger, stage log execution, duration tracking |
| `/api/v1/kubernetes` | K8s Cluster | Topology graph (`Services ──► Deployments ──► Pods`), pod restart/logs |
| `/api/v1/devsecops` | Security Gating | Trivy vulnerability scan reports & SonarQube ratings |
| `/api/v1/gitops` | GitOps Reconciler | Desired vs live spec comparison, drift diff visualization, sync triggers |
| `/api/v1/terraform` | IaC Runner | HCL code generation, dry-run plan logging, static security policy checks |
| `/api/v1/sre` | Observability & SRE | SLI/SLO calculations, error budget burn rates, incident tickets |
| `/api/v1/chaos` | Resilience Lab | Targeted failure injections (`POD_KILL`, `CPU_STRESS`, `NETWORK_DELAY`) |
| `/api/v1/webhooks` | Webhooks Ingestion | HMAC SHA256 validated GitHub push webhook listener |
| `/api/v1/policies` | OPA Compliance | Policy-as-Code evaluation rules |

---

## 3. WebSockets

- **`/ws/logs?runId=<ID>`**: Real-time pipeline build log streaming.
- **`/ws/terminal?pod=<POD>&namespace=<NS>`**: In-browser interactive pod container shell execution.

---

## 4. Development Commands

```bash
# Install dependencies
npm install

# Run database migration & seeding script
npx ts-node src/config/initDb.ts

# Start development server with hot reload
npm run dev

# Check TypeScript type safety
npx tsc --noEmit
```
