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
AGENT_PID=""

cleanup() {
  if [[ -n "$AGENT_PID" ]] && kill -0 "$AGENT_PID" 2>/dev/null; then
    kill "$AGENT_PID" 2>/dev/null || true
    wait "$AGENT_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cmd="${1:-dev}"

_wait_agent_http() {
  local url="http://127.0.0.1:8765/health" n=0 max=120
  echo "[run.sh] Waiting for stylist agent at $url …"
  while (( n < max )); do
    if command -v curl >/dev/null 2>&1; then
      if curl -sf "$url" >/dev/null 2>&1; then
        echo "[run.sh] Agent is ready."
        return 0
      fi
    else
      if python3 -c "import urllib.request; r=urllib.request.urlopen('$url', timeout=2); assert r.status == 200" >/dev/null 2>&1; then
        echo "[run.sh] Agent is ready."
        return 0
      fi
    fi
    sleep 0.25
    n=$((n + 1))
  done
  echo "[run.sh] ERROR: Agent did not respond at $url within ~$(( max / 4 ))s. Check GEMINI_API_KEY and logs above." >&2
  return 1
}

case "$cmd" in
  dev|dev-with-agent)
    echo "[run.sh] Starting stylist agent on http://127.0.0.1:8765 (background)…"
    (cd "$ROOT/agent" && PYTHONPATH="$ROOT/agent:$ROOT/backend" exec uv run uvicorn secundus_agent.main:app --host 127.0.0.1 --port 8765) &
    AGENT_PID=$!
    _wait_agent_http || exit 1
    echo "[run.sh] Starting FastAPI with AGENT_SERVICE_URL=http://127.0.0.1:8765 (background)…"
    # Vite proxies /api → FastAPI: browser is same-origin to Vite, so HTTP CORS on the API is off.
    (cd "$ROOT/backend" && AGENT_SERVICE_URL=http://127.0.0.1:8765 CORS_ENABLED=false exec uv run python api.py) &
    BACKEND_PID=$!
    echo "[run.sh] Starting Vite on http://127.0.0.1:5173 …"
    (cd "$ROOT/frontend" && exec npm run dev)
    ;;
  backend-only)
    echo "[run.sh] FastAPI only on http://127.0.0.1:8000 (no agent process — patron chat needs AGENT_SERVICE_URL; legacy /api/chat* return 410)."
    (cd "$ROOT/backend" && CORS_ENABLED=false exec uv run python api.py) &
    BACKEND_PID=$!
    echo "[run.sh] Starting Vite on http://127.0.0.1:5173 …"
    (cd "$ROOT/frontend" && exec npm run dev)
    ;;
  agent)
    echo "[run.sh] Stylist agent only on http://127.0.0.1:8765 (PYTHONPATH includes app/agent for stylist_loop + backend for shop_tools/config)."
    echo "          Set GEMINI_API_KEY, AGENT_INTERNAL_SECRET (match backend), BACKEND_URL (default http://127.0.0.1:8000)."
    echo "          Backend needs AGENT_INTERNAL_SECRET on /internal/agent/*; optional AGENT_SERVICE_URL=http://127.0.0.1:8765 to proxy chat."
    export PYTHONPATH="$ROOT/agent:$ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"
    cd "$ROOT/agent" && exec uv run uvicorn secundus_agent.main:app --host 127.0.0.1 --port 8765
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
    echo "Usage: $0 [dev|dev-with-agent|backend-only|agent|prod|build-only]"
    echo ""
    echo "  dev / dev-with-agent — stylist agent :8765 (wait for /health) + FastAPI + Vite :5173."
    echo "                         Set GEMINI_API_KEY + AGENT_INTERNAL_SECRET in env (see app/backend/.env.example)."
    echo "  backend-only         — FastAPI + Vite without starting the agent (chat 503 unless AGENT_SERVICE_URL is set)."
    echo "  agent          — Stylist agent service only on :8765 (separate Gemini process; see app/agent/README.md)."
    echo "  prod           — npm run build (→ app/dist) then API only on :8000 (single process serves UI + API)."
    echo "  build-only     — rebuild app/dist only."
    exit 1
    ;;
esac
