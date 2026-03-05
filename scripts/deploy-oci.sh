#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
LOCAL_DIR="${PROJECT_ROOT}/"
SSH_KEY="/Users/takashiwada/Downloads/ssh-key-2026-03-04.key"
REMOTE_HOST="ubuntu@155.248.176.237"
REMOTE_DIR="/home/ubuntu/next-app"
KNOWN_HOSTS="/tmp/venue-booking-known_hosts"

SSH_CMD="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o UserKnownHostsFile=${KNOWN_HOSTS}"

rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude '.env.local' \
  --exclude '.env.oci' \
  -e "${SSH_CMD}" \
  "${LOCAL_DIR}" \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

${SSH_CMD} "${REMOTE_HOST}" "
  cd ${REMOTE_DIR}
  export \$(grep -v '^#' .env.oci | xargs)
  npm install
  npm run db:push -- --force
  npm run build
  sudo systemctl restart venue-booking-app.service
  sudo systemctl status venue-booking-app.service --no-pager
"
