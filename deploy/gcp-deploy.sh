#!/bin/bash
# Run this ONCE from your local machine to create the GCP VM.
# Prerequisites: gcloud CLI installed and authenticated (gcloud auth login)
#
# Usage:
#   export GEMINI_API_KEY=your_key
#   export KAGGLE_API_TOKEN=KGAT_your_token
#   bash deploy/gcp-deploy.sh

set -e

# ── Config — edit these ────────────────────────────────────────────────────────
PROJECT_ID="gen-lang-client-0154452540"
INSTANCE_NAME="secundus-dermis"
ZONE="us-central1-a"                    # free-tier eligible zone
MACHINE_TYPE="e2-micro"                 # free tier: 1 e2-micro/month
REPO_URL="https://github.com/codejedi-ai/SecundusDermis.git"
# ──────────────────────────────────────────────────────────────────────────────

if [[ -z "$GEMINI_API_KEY" || -z "$KAGGLE_API_TOKEN" ]]; then
  echo "ERROR: set GEMINI_API_KEY and KAGGLE_API_TOKEN env vars first"
  exit 1
fi

echo "→ Setting project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "→ Creating firewall rule (allow HTTP)..."
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server \
  --description "Allow HTTP traffic" \
  --quiet 2>/dev/null || echo "  (rule already exists, skipping)"

echo "→ Creating VM instance..."
gcloud compute instances create "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_TYPE" \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=20GB \
  --tags=http-server \
  --metadata \
    GEMINI_API_KEY="${GEMINI_API_KEY}",\
    KAGGLE_API_TOKEN="${KAGGLE_API_TOKEN}",\
    REPO_URL="${REPO_URL}",\
    startup-script-url="https://raw.githubusercontent.com/codejedi-ai/SecundusDermis/main/deploy/gcp-startup.sh"

echo ""
echo "✓ VM created. Startup script is running (takes ~5 min to build Docker images)."
echo ""

# Get the external IP
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)")

echo "External IP: $EXTERNAL_IP"
echo "App will be live at: http://$EXTERNAL_IP"
echo ""
echo "To watch startup logs:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE -- 'tail -f /var/log/startup.log'"
echo ""
echo "To SSH in:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
