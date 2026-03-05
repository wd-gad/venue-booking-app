#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.oci}"
CONTAINER_NAME="${CONTAINER_NAME:-venue-booking-postgres}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${ENV_FILE}" | xargs)
fi

if [[ -z "${POSTGRES_DB:-}" || -z "${POSTGRES_USER:-}" || -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD must be set (or available in ${ENV_FILE})." >&2
  exit 1
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"
backup_path="${BACKUP_DIR}/venue-booking-${timestamp}.dump"

PGPASSWORD="${POSTGRES_PASSWORD}" docker exec -i "${CONTAINER_NAME}" \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
  > "${backup_path}"

find "${BACKUP_DIR}" -name 'venue-booking-*.dump' -type f -mtime +"${RETENTION_DAYS}" -delete

echo "Backup written to ${backup_path}"
