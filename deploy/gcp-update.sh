#!/bin/bash
# Run this to redeploy after pushing code changes to GitHub.
# Usage: bash deploy/gcp-update.sh

INSTANCE_NAME="secundus-dermis"
ZONE="us-central1-a"

gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" -- \
  'cd /app && git pull && docker compose up --build -d'

echo "✓ Redeployed."
