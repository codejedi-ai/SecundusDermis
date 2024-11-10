#!/bin/bash
# VM startup script — runs once on first boot
# Pulls secrets from instance metadata, clones repo, starts docker compose

set -e
exec > /var/log/startup.log 2>&1

echo "=== SecundusDermis GCP startup ==="

# ── Install Docker ─────────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 curl git

systemctl enable docker
systemctl start docker

# ── Pull secrets from instance metadata ───────────────────────────────────────
METADATA="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
H="Metadata-Flavor: Google"

GEMINI_API_KEY=$(curl -sf -H "$H" "$METADATA/GEMINI_API_KEY"       || echo "")
KAGGLE_API_TOKEN=$(curl -sf -H "$H" "$METADATA/KAGGLE_API_TOKEN"   || echo "")
REPO_URL=$(curl -sf -H "$H" "$METADATA/REPO_URL"                   || echo "https://github.com/codejedi-ai/SecundusDermis.git")

# ── Clone repo ─────────────────────────────────────────────────────────────────
git clone "$REPO_URL" /app
cd /app

# ── Write .env ─────────────────────────────────────────────────────────────────
cat > .env <<EOF
GEMINI_API_KEY=${GEMINI_API_KEY}
KAGGLE_API_TOKEN=${KAGGLE_API_TOKEN}
EOF

# ── Start ──────────────────────────────────────────────────────────────────────
docker compose up --build -d

echo "=== Done. App running on port 80 ==="
