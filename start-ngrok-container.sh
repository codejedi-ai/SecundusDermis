#!/usr/bin/env bash
set -euo pipefail

# Starts ngrok in Docker and forwards public traffic to local backend (:8000).
# Reads NGROK_AUTHTOKEN and NGROK_DOMAIN from .env if present.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

: "${NGROK_AUTHTOKEN:?NGROK_AUTHTOKEN is required (set it in .env)}"
: "${NGROK_DOMAIN:?NGROK_DOMAIN is required (set it in .env)}"

docker rm -f sd-ngrok >/dev/null 2>&1 || true

docker run -d \
  --name sd-ngrok \
  --network host \
  -e NGROK_AUTHTOKEN="${NGROK_AUTHTOKEN}" \
  ngrok/ngrok:latest \
  http "http://127.0.0.1:8000" --url "${NGROK_DOMAIN}"

echo "ngrok container started: sd-ngrok"
echo "Public URL: https://${NGROK_DOMAIN}"
