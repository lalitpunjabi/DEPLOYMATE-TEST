# DEPLOYMATE React Client Dashboard
### Frontend SPA Client · React 19 + TypeScript + Vite + Tailwind CSS v4

This directory houses the frontend Single Page Application (SPA) client for **DEPLOYMATE**. It provides a high-fidelity glassmorphic cloud console interface mapping pipeline states, telemetry diagnostics, Loki logs, and cluster topologies.

---

## 1. Directory Structure

```
frontend/
├── src/
│   ├── assets/             # Global graphic assets and images
│   ├── components/         # Reusable layouts, UI wrappers, and sidebar panels
│   ├── context/            # AuthContext.tsx managing JWT session authentication
│   ├── pages/              # Pages mapping to workspace views:
│   │   ├── AIAssistant.tsx # Splitscreen YAML editor, risk audits, auto-fixes, and chatbot
│   │   ├── Dashboard.tsx   # System overview stats, telemetry sparklines, health scores
│   │   ├── Deployments.tsx # Interactive visual topology maps, namespace selections,
│   │   │                   # Canary weight sliders, and Blue-Green traffic routing controllers
│   │   ├── GitOps.tsx      # ArgoCD sync timelines, drift diff panels, and sync triggers
│   │   ├── Terraform.tsx   # AI IaC code compilers, dry-run plan logs, and apply locks
│   │   ├── SreSLO.tsx      # Availability target progress gauges, incident tickets, SRE postmortems
│   │   ├── Chaos.tsx       # Chaos experiments scheduler (monkey injectors) & resilience history
│   │   ├── Login.tsx       # Glassmorphic user login with RBAC selector utilities
│   │   ├── Logs.tsx        # Loki LogQL query console with colorized terminal outputs
│   │   ├── Monitoring.tsx  # Dynamic metrics graphs (CPU, RAM, load rates)
│   │   ├── Pipelines.tsx   # Visual stage pipelines, log terminal streams, and AI audits
│   │   ├── Projects.tsx    # Workspace project repositories registry
│   │   ├── Register.tsx    # User registrations portal
│   │   └── Settings.tsx    # SMTP mailers, DB diagnosticians, webhooks, and developer keys
│   ├── App.tsx             # Master router mappings and layout shell structures
│   ├── index.css           # Tailwind v4 import, theme overrides, and custom glass definitions
│   └── main.tsx            # DOM root bootstrapping
├── vite.config.ts          # Vite configuration with @tailwindcss/vite plugin
├── tsconfig.json           # Type checking environments
└── package.json            # Client packages mapping
```

---

## 2. Tailwind CSS v4 & Vite Configuration

This project utilizes **Tailwind CSS v4** featuring the native `@tailwindcss/vite` compiler. PostCSS configurations and `tailwind.config.js` have been removed to leverage LightningCSS and compile-time compilation.

* **Vite Plugin:** Loaded in [vite.config.ts](file:///c:/Users/Lalit%20Punjabi/Documents/DEPLOYMATE-TEST/frontend/vite.config.ts):
  ```typescript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import tailwindcss from '@tailwindcss/vite'

  export default defineConfig({
    plugins: [
      react(),
      tailwindcss(),
    ],
  })
  ```
* **Theme Styling Overrides:** Maintained inside [src/index.css](file:///c:/Users/Lalit%20Punjabi/Documents/DEPLOYMATE-TEST/frontend/src/index.css) using standard CSS custom properties:
  ```css
  @import "tailwindcss";

  @theme {
    --color-background: #0B0F19;
    --color-panel: #131A2C;
    --color-border: rgba(255, 255, 255, 0.08);
    --color-primary: #6366F1;
    --color-secondary: #06B6D4;
    --shadow-glow: 0 0 15px rgba(99, 102, 241, 0.15);
  }
  ```

---

## 3. Advanced Features Walkthrough

1. **Interactive Namespace Graph & Progressive Delivery (Deployments tab):** Displays logical tree hierarchies linking Ingresses, Deployments, and Pods. Supports direct rollback commands, container log audits, dynamic Canary traffic-split allocation percentage sliders, and instant active Blue-Green color backend router toggles.
2. **Declarative GitOps Timelines (GitOps tab):** Renders visual sync progress bars mapping source changes to active cluster pods. Includes drift difference monitors demonstrating YAML parameter differences (e.g. replica configurations) in diff formats.
3. **AI Terraform Workspace (Terraform tab):** Generates cloud templates on instructions, checks init outputs via dry-run plans, and displays apply lock status indicators during execution.
4. **SRE Health Meters & Incident Center (SRE tab):** Visual progress gauges computing consumed error budgets for availability and latency metrics. Supports ticket reporting, automatic pod-killing anomalies healing, and AI postmortem compilations.
5. **Chaos Monkey (Chaos tab):** Triggers simulated faults inside namespaces, monitors SLO targets under stress, and scores the resilience recovery percentage.
6. **AI Diagnostics & Copilot (AI Diagnostics tab):** Leverages live `gemini-3.5-flash` model integrations to perform structured static analysis scans on Kubernetes manifests, highlights line-by-line security and availability risks, allows one-click auto-remediations directly inside the YAML editor, and provides an interactive SRE co-pilot chatbot.

---

## 4. Build & Development Commands

From inside the `frontend/` folder:

* **Start Development Mode:**
  ```bash
  npm run dev
  ```
  Runs the local client on `http://localhost:5173/` with HMR active.

* **Compile & Bundle checking:**
  ```bash
  npm run build
  ```
  Executes type compilation `tsc -b` and Rolldown bundling `vite build`. Outputs are generated inside `dist/`.
