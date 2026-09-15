# DEPLOYMATE Project Synopsis

This document contains the official project synopsis for **DEPLOYMATE** (Enterprise DevSecOps, GitOps & AIOps Platform), formatted according to major project submission guidelines.

---

## 1. Project Identification and Details

| S.No. | Guide/Supervisor Name | Project Title | Project Description | Domain |
| :--- | :--- | :--- | :--- | :--- |
| **25** | **Dr. VISHAL SHRIVASTAVA** | **DevOps-Based Continuous Integration and Deployment (CI/CD) Management System (DEPLOYMATE)** | The system automates software build, testing, deployment, and monitoring processes using DevOps best practices. Developers can manage source code repositories, configure deployment pipelines, track software releases, execute GitOps reconciliations, run resilience lab experiments, calculate SRE error budget burn rates, and perform Gemini-driven AIOps log diagnostics through a unified centralized control plane. | Software Engineering & Cloud Operations |

---

## 2. Technical Profile

* **TYPE:** WEB BASED & AI BASED
* **TECHNOLOGY BASED ON:** JavaScript/TypeScript (Node.js) & Python 3.11+

### Front End / Back End Technology Used:

* **FRONT END:** ReactJS (React 19), Tailwind CSS v4, Vite, TypeScript, Lucide Icons, Recharts (`[Implemented]`)
* **BACK END:** Express.js (TypeScript/Node.js), Python + FastAPI, WebSockets (`ws`), Nodemailer (`[Implemented]`)
* **DATABASE:** PostgreSQL with versioned SQL migrations (`001_init_schema.sql`, `schema_migrations` tracking) (`[Implemented]`)
* **CLOUD & INFRASTRUCTURE:** Kubernetes API (`@kubernetes/client-node` / `SIMULATION` mode toggle), Terraform HCL Engine, ArgoCD Reconciler Emulator (`[Implemented / Simulation Mode Support]`)
* **CONTAINERIZATION & PLATFORM:** Multi-stage Dockerfiles, Docker Compose, Kubernetes Helm Chart (`helm/`), GitHub Actions Dogfood CI (`[Implemented]`)

---

## 3. Problem Statement

Traditional cloud operations and DevOps management systems are highly **fragmented, operationally complex, and inefficient**. Modern software delivery requires teams to stitch together a large variety of disparate tools: Git repositories for version control, Jenkins or GitHub Actions for continuous integration (CI) pipelines, ArgoCD for GitOps CD, Terraform for Infrastructure-as-Code (IaC), Chaos Mesh for resiliency stress-testing, and Grafana/Prometheus/Loki for application logging and metrics. 

This tool sprawl introduces key challenges:
1. **Operational Overhead:** Integrating and maintaining separate dashboards, access credentials, and billing accounts consumes significant engineering resources.
2. **Configuration Drift & Visibility Gaps:** Lack of unified correlation between pipeline builds, infrastructure state changes, Kubernetes pod statuses, and application metrics.
3. **Manual Diagnostics:** Sifting through raw error logs during outages is manual and slow, leading to high Mean Time to Resolution (MTTR).
4. **Decoupled Security Gating:** Security scans (vulnerability assessments and code quality analysis) are often decoupled from delivery pipelines, allowing insecure configurations into production.

**DEPLOYMATE** addresses these challenges by providing a **centralized, scalable, and intelligent AI-driven platform** that unifies CI/CD pipelines, GitOps reconciliation, infrastructure provisioning, and SRE monitoring under a single dashboard, utilizing Gemini AI models to automate diagnostic analysis, human-in-the-loop remediation, and postmortem generation.

---

## 4. Objective and Scope

### OBJECTIVES:
* To develop a **centralized cloud operations control plane** (DEPLOYMATE) integrating CI/CD workflows, GitOps deployment syncs, infrastructure provisioning, and monitoring.
* To incorporate a **Gemini-powered AIOps Engine** that automatically diagnoses pipeline failures, parses application logs, provides structured evidence lists, and drafts markdown incident postmortems.
* To implement **automated DevSecOps security gating** evaluating Trivy container CVEs and SonarQube quality ratings persisted in database policies.
* To enable **declarative GitOps tracking** with visual topology drift detection and automatic reconciliation triggers.
* To support **Progressive Delivery** (Canary traffic allocation 10% → 100% and Blue-Green router color swaps).
* To provide a **secure, database-locked Infrastructure-as-Code (IaC) execution suite** using Terraform with static security policy checks.
* To support **automated Resilience Lab experiments** (`POD_KILL`, `CPU_STRESS`, `NETWORK_DELAY`) with safety constraints (max 300s duration, namespace checks) to calculate dynamic resilience scores.

### SCOPE & CAPABILITIES:
* **Role-Based Access Control (RBAC):** Granular permission enforcement (`pipeline.execute`, `deployment.rollback`, `terraform.apply`, `chaos.execute`, `security.override`, `ai.remediation.approve`).
* **Compliance Audit Logs:** Complete audit trail page (`/audit-logs`) tracking operator actions, IP addresses, and JSON payloads.
* **Human-in-the-Loop Gate:** Approval modal requiring explicit operator confirmation before executing high-risk AI remediations or infrastructure mutations.
* **Self-Observability:** Platform health endpoints (`/health`, `/ready`, `/metrics`).

---

## 5. System Modules

* **User & Access Management (RBAC) Module:** Manages developer authentication, JWT tokens, and granular permission enforcement. `[Implemented]`
* **Compliance Audit Module:** Logs operational events to PostgreSQL and renders interactive audit log stream. `[Implemented]`
* **Interactive CI/CD Pipeline Module:** Automates code compilation, testing, Docker builds, and Trivy/SonarQube security gating with WebSocket streaming. `[Implemented]`
* **Continuous GitOps Sync Module:** Compares desired Git specs with live Kubernetes state to highlight drift diffs. `[Implemented]`
* **Progressive Delivery Module:** Controls Canary traffic split percentages and Blue-Green router color swaps. `[Implemented]`
* **Terraform IaC Module:** Compiles HCL configurations, runs dry-run plans with policy enforcement, and locks state databases. `[Implemented]`
* **Kubernetes Topology & Observability Module:** Renders dynamic graphical trees of active Services, Deployments, and Pods with real-time CPU/RAM metrics. `[Implemented]`
* **Resilience Lab Module:** Schedules failure injections (`POD_KILL`, `CPU_STRESS`, `NETWORK_DELAY`) under strict safety guardrails. `[Implemented]`
* **SRE SLO & Alerting Module:** Tracks availability, latency, and error budget burn rates, opening P1 incident tickets on burn rate spikes (>14.2x). `[Implemented]`
* **AIOps Co-Pilot & Diagnostics Module:** Integrates Gemini to perform structured JSON log analysis, manifest audits, auto-fixes, and postmortem generation. `[Implemented]`

---

## 6. End-to-End Workflow

Developers log in and set up projects or register remote Kubernetes namespaces. When code commits are pushed, the **CI/CD Module** runs automated tests and DevSecOps security gates.

Upon passing gates, the **GitOps Module** reconciles git configurations with active deployments, rendering running pods inside the **Kubernetes Topology Map**. Concurrently, cloud infrastructure is provisioned through the database-locked **Terraform IaC Module**.

The platform continuously monitors telemetry metrics. If SLI metrics degrade or error budget burn rate spikes (>14.2x), DEPLOYMATE automatically opens P1 incident tickets, initiates self-healing restarts, and invokes the **AIOps Engine** (powered by Gemini) to return structured JSON diagnostics with correlated evidence. Operator approval via the **Human-in-the-Loop Modal** authorizes automated remediation and generates markdown postmortems.
