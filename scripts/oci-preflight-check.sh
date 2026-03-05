#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <source_host> <dest_host> [ssh_key_path]" >&2
  echo "Example: $0 ubuntu@155.248.176.237 ubuntu@<new-ip> /Users/takashiwada/Downloads/ssh-key-2026-03-04.key" >&2
  exit 1
fi

SOURCE_HOST="$1"
DEST_HOST="$2"
SSH_KEY_PATH="${3:-/Users/takashiwada/Downloads/ssh-key-2026-03-04.key}"

SSH_OPTS=(
  -i "${SSH_KEY_PATH}"
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=no
)

check_host() {
  local host="$1"
  echo "=== ${host} ==="
  ssh "${SSH_OPTS[@]}" "${host}" "
    set -e
    hostname
    echo '-- shape --'
    curl -s -H 'Authorization: Bearer Oracle' http://169.254.169.254/opc/v2/instance/ | jq -r '.shape // \"(unavailable)\"'
    echo '-- resources --'
    nproc
    free -h
    df -h /
    echo '-- docker --'
    docker --version || true
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
  "
  echo
}

check_host "${SOURCE_HOST}"
check_host "${DEST_HOST}"

echo "Preflight check completed."
