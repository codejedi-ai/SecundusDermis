# Secundus stylist agent (standalone process)

This package runs the **Gemini ReAct stylist loop** outside the FastAPI backend. It talks to the API over **HTTP** (`/internal/agent/*`) for catalog search, sidebar state, and RAG context. Patron-room fan-out uses **`POST /internal/agent/emit`** by default, or a **Socket.IO** connection when **`SD_SOCKETIO_EMIT=1`** (same auth as the browser agent path: `agent_secret` on connect, then `agent_emit` events — see repo root **`AGENT_MANIFEST.md`** and backend **`GET /api/agent-manifest.md`**).

## Why separate?

- The backend keeps **data**, **Chroma**, **sessions**, and **Socket.IO rooms**.
- The agent process holds **only** the Gemini API key for inference (see `agent_gemini.py`) and streams results back through the same SSE contract as in-process mode.

## Environment

Copy **`app/agent/.env.example`** → **`app/agent/.env`** for a deployment where **no Gemini variables** live on the API host. Shared dev setups often keep `AGENT_INTERNAL_SECRET` in `app/backend/.env` only; `agent_gemini.load_agent_environment()` loads backend `.env` first, then merges **`app/agent/.env` for non-empty keys only** (so a blank `AGENT_INTERNAL_SECRET=` placeholder does not wipe the backend value).

Shared secret (must match backend `app/backend`):

- `AGENT_INTERNAL_SECRET` — required in production for `/internal/agent/*` and proxied `POST /v1/chat/stream`. If unset, backend and agent both read `{DATA_DIR}/.sd_agent_internal_secret` (auto-created under `app/data` in local dev).

Agent-only (Gemini — resolved in **`agent_gemini.py`**):

- `GEMINI_API_KEY` — preferred.
- `GOOGLE_API_KEY` — optional alias if your host only sets this name.
- `BACKEND_URL` — default `http://127.0.0.1:8000` (see **`agent_runtime.py`**).
- `SD_SOCKETIO_EMIT` — optional `1` / `true` / `yes`: connect to the backend with **Socket.IO** as role `agent` and push `shop_sync` / `catalog_results` via `agent_emit` (falls back to HTTP emit if connect fails).

Backend (optional split mode):

- `AGENT_SERVICE_URL` — e.g. `http://127.0.0.1:8765` — when set, `POST /chat/stream` is **proxied** to the agent’s `POST /v1/chat/stream` instead of running the loop in-process.

## Run

From `app/`:

```bash
export AGENT_INTERNAL_SECRET='choose-a-long-random-string'
export GEMINI_API_KEY='...'
./run.sh agent
```

Or with repo `uv` from `app/agent`:

```bash
export PYTHONPATH=/path/to/SecundusDermis/app/agent:/path/to/SecundusDermis/app/backend
cd app/agent && uv run uvicorn secundus_agent.main:app --host 127.0.0.1 --port 8765
```

Full stack with proxy (also sets `AGENT_SERVICE_URL` for the API subprocess):

```bash
export AGENT_INTERNAL_SECRET='...'
export GEMINI_API_KEY='...'
./run.sh dev-with-agent
```

## WebSocket (optional)

The backend accepts Socket.IO connections with `auth: { agent_secret: AGENT_INTERNAL_SECRET }` and handles `agent_emit` with `{ session_id, event, data }` to push into `sd_{session_id}`. The default remote agent uses **HTTP** `/internal/agent/emit` only; you can extend `secundus_agent/remote_deps.py` to use a client socket instead.

## Persona (`soul.md`)

`config/soul.md` is merged into `system_stylist` at runtime via `agent_prompts.merge_prompts_with_soul` (used by the backend `gemini_chat_stream` and by `secundus_agent/main.py` when prompts are forwarded from the API). Edit that file to tune voice and guardrails without touching `app/data/prompts.json`.

## Optional ADK toolkit (`atelier_tools/`)

Google **ADK** helpers live here for experiments or a separate orchestrator: `create_agent`, `init_tools`, catalog/journal tools, and `describe_image`. The main product path remains **`stylist_loop`** + **`secundus_agent`**. The backend lifespan calls `init_tools` when imports succeed so tool state matches the in-process catalog and Gemini client.

## Code map

| Path | Role |
|------|------|
| `agent_gemini.py` | Dotenv load order, resolve `GEMINI_API_KEY` / `GOOGLE_API_KEY`, build `genai.Client` |
| `agent_runtime.py` | `BACKEND_URL` and boolean env helpers (no API keys) |
| `.env.example` | Agent-only env template (never commit `.env`) |
| `config/soul.md` | Atelier persona appended to `system_stylist` |
| `agent_prompts.py` | Load `soul.md` and merge into prompt dict |
| `secundus_agent/main.py` | FastAPI: `POST /v1/chat/stream`, `GET /health` |
| `secundus_agent/remote_deps.py` | `StylistAgentDeps` via `httpx` to `/internal/agent/*` |
| `stylist_loop/stream_loop.py` | Shared Gemini ReAct loop |
| `stylist_loop/deps.py` | `StylistAgentDeps` protocol |
| `atelier_tools/` | Optional ADK `Agent` factory + shared tool functions |
| `../backend/stylist_backend_bridge.py` | In-process deps when the loop runs inside the API (imports `shop_tools`) |
| `../backend/shop_tools.py` | Catalog keyword search + sidebar helpers (API + stylist loop) |
