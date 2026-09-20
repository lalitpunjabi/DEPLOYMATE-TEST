# DEPLOYMATE Production Deployment Guide

This guide details the step-by-step instructions for deploying the **DEPLOYMATE** platform onto AWS EC2 or any Linux host using Docker Compose and Nginx reverse proxying.

---

## 1. Prerequisites

- **Host Operating System**: Ubuntu 22.04 LTS / Debian 12 / Amazon Linux 2023
- **Software Dependencies**:
  - Docker Engine v24.0+
  - Docker Compose v2.20+
  - Git
- **Recommended System Requirements**:
  - **CPU**: 2 vCPUs
  - **RAM**: 4 GB RAM minimum (8 GB recommended for 100 concurrent users)
  - **Disk**: 30 GB SSD

---

## 2. Production Environment Setup

Create `.env` file in root workspace:

```env
# Backend & DB Configuration
PORT=5000
NODE_ENV=production
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<GENERATE_RANDOM_PASSWORD>
DB_APP_USER=deploymate_app
DB_APP_PASSWORD=<GENERATE_RANDOM_PASSWORD>
DB_NAME=deploymate

# Security & Initial Credentials
JWT_SECRET=<GENERATE_RANDOM_SECRET>
INITIAL_ADMIN_EMAIL=admin@your-company.com
INITIAL_ADMIN_PASSWORD=<GENERATE_RANDOM_PASSWORD>
FRONTEND_URL=https://deploymate.example.com

# AI Microservice & Security Configuration
AI_SERVICE_URL=http://ai-module:8000
AI_INTERNAL_TOKEN=<GENERATE_RANDOM_SECRET>
GITHUB_WEBHOOK_SECRET=<GENERATE_RANDOM_SECRET>
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
```

### Generate Random Production Secrets
Run the following shell commands to generate secure random secrets for `.env`:
```bash
# Generate DB_PASSWORD and DB_APP_PASSWORD
openssl rand -hex 24

# Generate JWT_SECRET, AI_INTERNAL_TOKEN, and GITHUB_WEBHOOK_SECRET
openssl rand -hex 32

# Generate INITIAL_ADMIN_PASSWORD
openssl rand -base64 24
```

---

## 3. Production Deployment Commands

### Step 1: Clone Repository
```bash
git clone https://github.com/lalitpunjabi/DEPLOYMATE-TEST.git
cd DEPLOYMATE-TEST
```

### Step 2: Configure TLS Certificates (HTTPS)
Place valid TLS certificates in `/etc/nginx/certs/`:
- `/etc/nginx/certs/fullchain.pem`
- `/etc/nginx/certs/privkey.pem`

### Step 3: Launch Production Stack
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Step 4: Run Database Initialization, Migrations & Initial Seed
Execute the decoupled database scripts:
```bash
# Run database schema initialization
docker exec -t deploymate-backend-prod npm run db:init

# Run versioned SQL migrations (001_init_schema.sql, 002_security_sessions_reset.sql)
docker exec -t deploymate-backend-prod npm run db:migrate

# Seed RBAC roles and initial Super Admin account
docker exec -t deploymate-backend-prod npm run db:seed
```

---

## 4. Verification & Health Monitoring

- **Frontend Portal**: `https://<EC2_PUBLIC_IP>/` (or `http://<EC2_PUBLIC_IP>/` for automatic 301 HTTPS redirect)
- **Health Endpoint**: `curl https://<EC2_PUBLIC_IP>/api/v1/health`
- **Database Readiness**: `curl https://<EC2_PUBLIC_IP>/api/v1/ready`
- **Prometheus Operational Metrics**: `curl https://<EC2_PUBLIC_IP>/api/v1/metrics`

---

## 5. Database Backup & Restoration

### Backup Snapshot
```bash
bash scripts/backup_db.sh
```

### Restoration
```bash
bash scripts/restore_db.sh backups/deploymate_db_backup_20260921_000000.sql.gz
```
