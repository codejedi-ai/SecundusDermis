#!/usr/bin/env bash
# Run the Secundus Dermis app from the `app/` directory.
#
#   app/dist/     — production build of the Vite SPA (`npm run build` writes here).
#   app/backend/  — FastAPI; when app/dist exists, the API also serves that bundle (HTML + /assets).
#
# Usage (from repo root or from app/):
#   ./app/run.sh dev         — API on :8000 + Vite dev server on :5173 (Vite proxies /api → API)
#   ./app/run.sh prod        — build SPA into app/dist, then start API only (open http://localhost:8000)
#   ./app/run.sh build-only  — only rebuild app/dist

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cmd="${1:-dev}"

case "$cmd" in
  dev)
    echo "[run.sh] Starting FastAPI on http://127.0.0.1:8000 (background)…"
    (cd "$ROOT/backend" && exec uv run python api.py) &
    BACKEND_PID=$!
    echo "[run.sh] Starting Vite on http://127.0.0.1:5173 …"
    (cd "$ROOT/frontend" && exec npm run dev)
    ;;
  prod)
    echo "[run.sh] Building frontend → $ROOT/dist …"
    (cd "$ROOT/frontend" && {
      if [[ ! -d node_modules ]]; then
        npm ci
      fi
      npm run build
    })
    echo "[run.sh] Starting API (serves SPA from $ROOT/dist when routes fall through)…"
    cd "$ROOT/backend" && exec uv run python api.py --no-reload
    ;;
  build-only)
    echo "[run.sh] Building frontend → $ROOT/dist …"
    (cd "$ROOT/frontend" && {
      if [[ ! -d node_modules ]]; then
        npm ci
      fi
      npm run build
    })
    echo "[run.sh] Done. Output: $ROOT/dist"
    ;;
  *)
    echo "Usage: $0 [dev|prod|build-only]"
    echo ""
    echo "  dev         — FastAPI :8000 + Vite :5173 (use this while developing)."
    echo "  prod        — npm run build (→ app/dist) then API only on :8000 (single process serves UI + API)."
    echo "  build-only  — rebuild app/dist only."
    exit 1
    ;;
esac
