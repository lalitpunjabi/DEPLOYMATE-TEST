#!/usr/bin/env bash
# DEPLOYMATE Automated Database Restore Script

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found."
  exit 1
fi

echo "[DEPLOYMATE DB Restore] Restoring database from snapshot: ${BACKUP_FILE}..."

gunzip -c "${BACKUP_FILE}" | docker exec -i deploymate-db-prod psql -U "${DB_USER:-postgres}" postgres

echo "[DEPLOYMATE DB Restore] Database restoration completed successfully."
