# DEPLOYMATE Developer CLI (`dmate`)

### Terminal Cloud Operations & DevSecOps Tool

`dmate` is the official command-line developer interface for the **DEPLOYMATE** platform. It enables engineers to inspect platform health, list and trigger CI/CD pipelines, view environment settings, and execute Gemini AI log diagnostics directly from their terminal.

---

## 1. Available Commands

```text
dmate — DEPLOYMATE Enterprise Developer CLI

Usage: dmate [options] [command]

Commands:
  status               Check health and connectivity of DEPLOYMATE Control Plane, DB, and AI Microservice
  pipeline list        List available CI/CD pipelines in DEPLOYMATE
  pipeline run <id>    Trigger execution for a specific pipeline ID
  ai-diagnose          Invoke Gemini AIOps Engine to diagnose pipeline or app logs
  config               Show active CLI environment configuration endpoints
  help [command]       Display help for command
```

---

## 2. Command Examples

### Platform Status Check
```bash
dmate status
```
Outputs health report for Backend API, PostgreSQL Database, and AI Microservice.

### List CI/CD Pipelines
```bash
dmate pipeline list
```

### Trigger Pipeline Execution
```bash
dmate pipeline run pipe-001
```

### AI Log Diagnosis
```bash
dmate ai-diagnose -l "npm run build failed with exit code 1: missing dist/index.js"
```

### Show Environment Configuration
```bash
dmate config
```

---

## 3. Development & Build

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript (dist/)
npm run build

# Run locally using ts-node
npm start status
```
