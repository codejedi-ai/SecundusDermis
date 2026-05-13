# Secundus Dermis — `app/`

This directory holds the **Vite frontend** (`frontend/`), the **FastAPI backend** (`backend/`), shared **runtime data** (`data/`), and the **production SPA bundle** (`dist/`) that the API can serve after `npm run build` (see `./run.sh`).

## One command to run

From **`app/`**:

```bash
./run.sh dev          # API :8000 + Vite :5173 (recommended for development)
./run.sh prod         # build dist/ then API only on :8000 (serves UI + API)
./run.sh build-only   # only rebuild dist/
```

**API (from repo root or anywhere):**

```bash
cd app/backend
cp .env.example .env   # once: set secrets; omit DATA_DIR to use app/data automatically
uv sync
uv run python api.py   # http://localhost:8000
```

**Frontend:**

```bash
cd app/frontend
npm install
npm run dev            # http://localhost:5173 — proxies /api → :8000
```

See the repository root `README.md` for full configuration and architecture.
