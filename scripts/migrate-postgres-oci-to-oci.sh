#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 [--dry-run] <source_host> <dest_host> [ssh_key_path]" >&2
  echo "Example: $0 --dry-run ubuntu@155.248.176.237 ubuntu@<new-ip> /Users/takashiwada/Downloads/ssh-key-2026-03-04.key" >&2
  exit 1
fi

SOURCE_HOST="$1"
DEST_HOST="$2"
SSH_KEY_PATH="${3:-/Users/takashiwada/Downloads/ssh-key-2026-03-04.key}"

DB_CONTAINER="${DB_CONTAINER:-venue-booking-postgres}"
POSTGRES_DB="${POSTGRES_DB:-venue_booking_manager}"
POSTGRES_USER="${POSTGRES_USER:-venue_admin}"
DUMP_PREFIX="${DUMP_PREFIX:-venue-booking}"

timestamp="$(date +%Y%m%d-%H%M%S)"
local_dump="/tmp/${DUMP_PREFIX}-${timestamp}.dump"
remote_dump="/tmp/${DUMP_PREFIX}-${timestamp}.dump"

SSH_OPTS=(
  -i "${SSH_KEY_PATH}"
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=no
)

echo "[1/5] Dumping source database from ${SOURCE_HOST} ..."
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN: skip dump execution"
else
ssh "${SSH_OPTS[@]}" "${SOURCE_HOST}" \
  "docker exec -i ${DB_CONTAINER} pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} -Fc" \
  > "${local_dump}"
fi

echo "[2/5] Copying dump to destination ${DEST_HOST} ..."
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN: skip scp ${local_dump} -> ${DEST_HOST}:${remote_dump}"
else
scp "${SSH_OPTS[@]}" "${local_dump}" "${DEST_HOST}:${remote_dump}"
fi

echo "[3/5] Restoring dump on destination ..."
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN: skip pg_restore execution"
else
ssh "${SSH_OPTS[@]}" "${DEST_HOST}" "
  set -e
  docker ps --format '{{.Names}}' | grep -q '^${DB_CONTAINER}\$'
  docker exec -i ${DB_CONTAINER} pg_restore -U ${POSTGRES_USER} -d ${POSTGRES_DB} --clean --if-exists '${remote_dump}'
"
fi

echo "[4/5] Running lightweight validation ..."
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN: skip validation query"
else
ssh "${SSH_OPTS[@]}" "${DEST_HOST}" "
  set -e
  docker exec -i ${DB_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c 'select now();'
"
fi

echo "[5/5] Cleaning temporary dump files ..."
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN: skip temporary file cleanup"
else
rm -f "${local_dump}"
ssh "${SSH_OPTS[@]}" "${DEST_HOST}" "rm -f '${remote_dump}'"
fi

echo "Migration completed successfully."
