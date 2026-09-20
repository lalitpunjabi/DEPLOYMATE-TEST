#!/usr/bin/env bash
# DEPLOYMATE Automated Database Backup Script

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/deploymate_db_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[DEPLOYMATE DB Backup] Starting database dump to ${BACKUP_FILE}..."

docker exec -t deploymate-db-prod pg_dumpall -c -U "${DB_USER:-postgres}" | gzip > "${BACKUP_FILE}"

echo "[DEPLOYMATE DB Backup] Backup completed successfully: ${BACKUP_FILE}"
echo "[DEPLOYMATE DB Backup] Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
