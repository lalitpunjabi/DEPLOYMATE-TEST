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
DB_PASSWORD=SecurePostgresPass2026!
DB_NAME=deploymate

# Security & Initial Credentials
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-length
INITIAL_ADMIN_EMAIL=admin@company.com
INITIAL_ADMIN_PASSWORD=ComplexAdminPass123!
FRONTEND_URL=http://your-ec2-ip-or-domain.com

# AI Microservice Configuration
AI_SERVICE_URL=http://ai-module:8000
GEMINI_API_KEY=your_production_gemini_api_key
```

---

## 3. Production Deployment Commands

### Step 1: Clone Repository
```bash
git clone https://github.com/lalitpunjabi/DEPLOYMATE-TEST.git
cd DEPLOYMATE-TEST
```

### Step 2: Launch Production Stack
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Step 3: Run Database Migrations & Initial Seed
```bash
docker exec -t deploymate-backend-prod npx ts-node src/config/initDb.ts
```

---

## 4. Verification & Health Monitoring

- **Frontend Portal**: `http://<EC2_PUBLIC_IP>/`
- **Health Endpoint**: `curl http://<EC2_PUBLIC_IP>/api/v1/health`
- **Database Readiness**: `curl http://<EC2_PUBLIC_IP>/api/v1/ready`
- **Prometheus Operational Metrics**: `curl http://<EC2_PUBLIC_IP>/api/v1/metrics`

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
