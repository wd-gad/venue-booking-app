#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/next-app}"
SERVICE_NAME="${SERVICE_NAME:-venue-booking-app.service}"
BRANCH="${BRANCH:-main}"

cd "${APP_DIR}"

git fetch --all --prune
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

npm ci
npm run db:push -- --force
npm run build
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl is-active --quiet "${SERVICE_NAME}"

echo "OCI deploy completed for ${BRANCH} at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
