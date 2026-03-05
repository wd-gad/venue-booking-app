#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/next-app}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/postgres}"
LOG_FILE="${LOG_FILE:-/home/ubuntu/logs/postgres-backup.log}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

mkdir -p "${BACKUP_DIR}"
mkdir -p "$(dirname "${LOG_FILE}")"

CRON_CMD="cd ${APP_DIR} && BACKUP_DIR=${BACKUP_DIR} RETENTION_DAYS=14 ./scripts/backup-postgres.sh >> ${LOG_FILE} 2>&1"
TMP_CRON="$(mktemp)"

crontab -l 2>/dev/null | grep -v "scripts/backup-postgres.sh" > "${TMP_CRON}" || true
printf "%s %s\n" "${CRON_SCHEDULE}" "${CRON_CMD}" >> "${TMP_CRON}"
crontab "${TMP_CRON}"
rm -f "${TMP_CRON}"

echo "Installed cron schedule: ${CRON_SCHEDULE}"
echo "Backup dir: ${BACKUP_DIR}"
echo "Log file: ${LOG_FILE}"
