# Secundus stylist agent (standalone process)

This package runs the **Gemini ReAct stylist loop** outside the FastAPI backend. It talks to the API over **HTTP** (`/internal/agent/*`) for catalog search, sidebar state, RAG context, and **Socket.IO fan-out** (`POST /internal/agent/emit` pushes `shop_sync` / `catalog_results` into the patron’s room).

## Why separate?

- The backend keeps **data**, **Chroma**, **sessions**, and **Socket.IO rooms**.
- The agent process holds **only** `GEMINI_API_KEY` for inference and streams results back through the same SSE contract as in-process mode.

## Environment

Shared secret (must match backend `app/backend`):

- `AGENT_INTERNAL_SECRET` — required on the backend to enable `/internal/agent/*` and on the agent to call those routes and to accept proxied `POST /v1/chat/stream`.

Agent-only:

- `GEMINI_API_KEY` — Gemini client runs in this process.
- `BACKEND_URL` — default `http://127.0.0.1:8000` (no `/api` prefix; use the same origin the browser would use for Socket.IO when testing).

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
| `config/soul.md` | Atelier persona appended to `system_stylist` |
| `agent_prompts.py` | Load `soul.md` and merge into prompt dict |
| `secundus_agent/main.py` | FastAPI: `POST /v1/chat/stream`, `GET /health` |
| `secundus_agent/remote_deps.py` | `StylistAgentDeps` via `httpx` to `/internal/agent/*` |
| `stylist_loop/stream_loop.py` | Shared Gemini ReAct loop |
| `stylist_loop/deps.py` | `StylistAgentDeps` protocol |
| `atelier_tools/` | Optional ADK `Agent` factory + shared tool functions |
| `../backend/stylist_backend_bridge.py` | In-process deps when the loop runs inside the API (imports `shop_tools`) |
| `../backend/shop_tools.py` | Catalog keyword search + sidebar helpers (API + stylist loop) |
