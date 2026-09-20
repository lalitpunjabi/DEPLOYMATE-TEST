# DEPLOYMATE React Client Console
### Frontend SPA Client · React 19 + TypeScript + Vite + Tailwind CSS v4

This directory houses the single-page application (SPA) client for **DEPLOYMATE**. It provides a high-fidelity glassmorphic cloud operations interface mapping CI/CD pipelines, DevSecOps security reports, Kubernetes topologies, Progressive Delivery controls, GitOps drift visualization, SRE SLO targets, AI co-pilot workspace, and compliance audit logs.

---

## 1. Directory Structure

```text
frontend/
├── src/
│   ├── assets/             # Graphic assets and branding media
│   ├── components/         # Reusable UI components:
│   │   ├── ApprovalModal.tsx # Human-in-the-Loop AI remediation approval modal
│   │   ├── CommandPalette.tsx# Ctrl+K / Cmd+K global search palette
│   │   ├── Layout.tsx      # Workspace layout wrapper shell
│   │   ├── Navbar.tsx      # Infrastructure Mode toggle, search, and session controls
│   │   ├── ProtectedRoute.tsx# Auth guard router wrapper
│   │   ├── Sidebar.tsx     # Platform navigation links
│   │   └── StatusBadge.tsx # Standardized status indicator badges
│   ├── context/            # Global context providers:
│   │   ├── AuthContext.tsx # JWT token & RBAC user session state
│   │   └── DemoContext.tsx # Centerpiece E2E demonstration sequence manager
│   ├── pages/              # View pages:
│   │   ├── AIAssistant.tsx # Splitscreen YAML editor, risk audit, auto-fixes, co-pilot chat
│   │   ├── AuditLogs.tsx   # Compliance audit stream with search & resource filters
│   │   ├── Chaos.tsx       # Resilience Lab experiment scheduler & resilience scoring
│   │   ├── Dashboard.tsx   # E2E centerpiece workflow, cluster gauges, FinOps summary
│   │   ├── Deployments.tsx # Topology map, Canary split sliders, Blue-Green router swaps
│   │   ├── GitOps.tsx      # Reconciler timeline, desired-vs-live diff viewer, sync triggers
│   │   ├── Login.tsx       # Glassmorphic user login
│   │   ├── Logs.tsx        # Centralized log explorer
│   │   ├── Monitoring.tsx  # Dynamic metrics graphs (CPU, Memory, Request Rate, Latency)
│   │   ├── Pipelines.tsx   # Pipeline run streams, stage durations, security reports
│   │   ├── Projects.tsx    # Project & repository registry
│   │   ├── Register.tsx    # User registration portal
│   │   ├── Settings.tsx    # Mailer configs, DB diagnostics, developer settings
│   │   ├── SreSLO.tsx      # SLI/SLO target progress gauges, incident tickets, AI postmortems
│   │   └── Terraform.tsx   # AI HCL code generator, dry-run plan logs, apply locks
│   ├── App.tsx             # Master route definitions
│   ├── index.css           # Tailwind v4 import, custom theme tokens & glass effects
│   └── main.tsx            # Application entry point
├── Dockerfile              # Multi-stage Nginx production container build
├── vite.config.ts          # Vite configuration with @tailwindcss/vite plugin
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies manifest
```

---

## 2. Key Capabilities & Status Matrix

- **Infrastructure Mode Switcher (`Navbar.tsx`)**: Toggle between `REAL CLUSTER` (Kubernetes API connection) and `SIMULATION MODE` (`execution_mode: "SIMULATED"`). `[Implemented]`
- **WebSocket Single-Use Ticket Authorization**: Interactive terminal and log components pre-fetch 60-second single-use tickets (`POST /api/v1/auth/ws-ticket`) prior to establishing WebSocket upgrades (`/ws/terminal`, `/ws/logs`). `[Implemented]`
- **Human-in-the-Loop Security Approval (`ApprovalModal.tsx`)**: Interactive approval modal requiring operator authorization before executing high-risk AI remediations. `[Implemented]`
- **Compliance Audit Log Stream (`AuditLogs.tsx`)**: Operational log viewer with real-time text search and resource category filters (`INFRASTRUCTURE`, `DEPLOYMENT`, `AIOps`, `SECURITY`). `[Implemented]`
- **Progressive Delivery Controls (`Deployments.tsx`)**: Interactive Canary traffic split sliders (10% → 100%) and Blue-Green router color swap toggles. `[Implemented]`
- **Global Search Command Palette (`CommandPalette.tsx`)**: Keyboard-driven (Ctrl+K / Cmd+K) search indexing projects, pods, pipelines, incidents, and terraform states. `[Implemented]`

---

## 3. Development Commands

From inside `frontend/`:

* **Start Development Server**:
  ```bash
  npm run dev
  ```
  Launches Vite dev server on `http://localhost:5173/` with HMR active.

* **TypeScript Check & Production Build**:
  ```bash
  npm run build
  ```
  Runs `tsc -b && vite build`. Output bundle is generated in `dist/`.
