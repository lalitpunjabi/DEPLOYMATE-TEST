#!/usr/bin/env bash
# DEPLOYMATE Database Restore
# DESTRUCTIVE: replaces the contents of the target database.
# Uses the PostgreSQL bootstrap owner (DB_USER) inside deploymate-db-prod.
# Does not require backend privileged credentials.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${ROOT_DIR}/.env"
  set +a
fi

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  echo "This operation DESTROYS existing data in the target database."
  echo "Confirm by setting RESTORE_CONFIRM=YES"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER="${DB_CONTAINER:-deploymate-db-prod}"
PGUSER="${DB_USER:-postgres}"
PGDB="${DB_NAME:-deploymate}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found."
  exit 1
fi

echo "WARNING: Destructive restore."
echo "Existing data in database '${PGDB}' on container '${CONTAINER}' will be overwritten."
if [ "${RESTORE_CONFIRM:-}" != "YES" ]; then
  echo "Aborting. Re-run with RESTORE_CONFIRM=YES $0 ${BACKUP_FILE}"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "Error: container '${CONTAINER}' is not running."
  exit 1
fi

if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "[DEPLOYMATE DB Restore] Verifying checksum..."
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${BACKUP_FILE}.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "${BACKUP_FILE}.sha256"
  else
    echo "Error: sha256 tool not found; refusing to restore without checksum verification."
    exit 1
  fi
  echo "[DEPLOYMATE DB Restore] Checksum verified."
fi

echo "[DEPLOYMATE DB Restore] Restoring ${BACKUP_FILE} into ${PGDB}..."

gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER}" psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1

echo "[DEPLOYMATE DB Restore] Restore completed."
