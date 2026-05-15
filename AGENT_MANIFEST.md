# Secundus Dermis (SD) — Agent & API integration manifest

**Bring your own agent (BYOA):** the Secundus Dermis **API does not host the stylist LLM**. Operators set **`AGENT_SERVICE_URL`** (and **`AGENT_INTERNAL_SECRET`**) to **their** stylist process; this repository includes a **reference** implementation under `app/agent`, which you run and operate yourself.

**Three lanes (not “one WebSocket from browser to model”):** (1) **Patron chat tokens** — browser → API → stylist over **HTTP + SSE** (`POST /api/patron/agent/chat/stream` proxied to the agent’s HTTP stream). (2) **Patron Socket.IO** — browser ↔ API only, room `sd_{session_id}`, for live UI events (`sd_stylist_message`, etc.); the stylist pushes via the API into that room. (3) **Optional agent duplex** — Socket.IO **stylist process ↔ API**, room `sd_agent_service`, for `sd_bridge` / operator control; the browser does not join this room.

Machine- and human-readable contract for **external stylist processes** and **evaluation agents** talking to the Secundus Dermis backend.

---

## 1. Roles

| Role | Process | Purpose |
|-------|---------|---------|
| **Backend (SD API)** | `app/backend` FastAPI + Socket.IO | Catalog, auth, patron chat/image routes (`/patron/agent/*`), internal agent routes, Socket.IO rooms `sd_{session_id}`. Legacy ``/api/chat*`` and ``/api/image/upload`` return **410**. |
| **Patron (browser)** | React + `socket.io-client` | Joins room via `join_session`, receives **`sd_stylist_message`** (schema `sd.stylist.v1`; actions include `shop_sync`, `catalog_results`, …), plus legacy **`ui_action`** and other non-stylist events as needed. |
| **Standalone stylist agent** | `app/agent/secundus_agent` (reference; you host it) | Holds your `GEMINI_API_KEY`; when **`AGENT_SERVICE_URL`** points here, the **backend** proxies **`POST /api/patron/agent/chat/stream`**. Agent calls backend **HTTP** `/internal/agent/*` for catalog/RAG; optional **Socket.IO** as trusted `agent` for patron-room fan-out via **`agent_emit`** + **`sd_stylist_message`** envelopes, and duplex service room `sd_agent_service` / `sd_bridge` (see §5). |

---

## 2. Session identity (`sd_` rooms)

- **Browser session id**: string passed to **`POST /api/patron/agent/chat/stream`** as `session_id` (Bearer `sdag_…`) and to Socket.IO `join_session` as `session_id`.
- **Socket.IO room name**: `sd_{session_id}` (prefix literal `sd_`).
- All agent-driven UI pushes target **`sd_{session_id}`** so only that patron tab receives them.

---

## 3. Patron — Socket.IO (browser → SD)

- **URL**: same origin as the HTTP API, path **`/socket.io`** (Engine.IO).
- **Connect**: `io(SOCKET_ORIGIN, { path: '/socket.io', transports: ['websocket', 'polling'] })`.
- **After `connect`**: emit **`join_session`** with payload `{ "session_id": "<id>" }`. Server enters the socket into room `sd_<id>` and may emit **`connected`** to that socket.
- **Agents page (optional)**: emit **`join_deployment_stats`** (no payload) to enter room **`sd_deployment_stats_watchers`**. Server emits **`deployment_stats`** to that socket immediately (same JSON as **`GET /api/catalog/stats`**) and broadcasts **`deployment_stats`** to all watchers when a trusted **agent** Socket.IO client connects or disconnects (duplex count / deployment view). Emit **`leave_deployment_stats`** when leaving **`/agents`**.
- **Inbound events** (examples): **`sd_stylist_message`** (schema `sd.stylist.v1`) — the React chat applies `shop_sync`, surfaces live `catalog_results` while streaming, merges `found_products` / `stylist_reply` with dedupe against SSE where both fire; plus **`ui_action`**, **`deployment_stats`**, `notification`, and other relays as deployed.

---

## 3b. Patron agent API keys (per-user tools)

Patrons can mint **personal API keys** (`sdag_…`) from the account UI (`POST /api/auth/agent-api-keys` while signed in). These are **not** the service `AGENT_INTERNAL_SECRET`; they identify a **human patron** for a small HTTP surface:

| Method | Path | Auth | Use |
|--------|------|------|-----|
| GET | `/api/patron/agent/me` | `Authorization: Bearer <sdag_…>` or `X-Patron-Agent-Api-Key` | Resolve patron email + display name. |
| GET | `/api/patron/agent/context` | same | Recent notes posted by tools (`limit` query optional). |
| POST | `/api/patron/agent/context` | same | Body `{ "entries": [ { "text": "…", "source": "agent" } ] }` — append notes for later retrieval. |
| POST | `/api/patron/agent/chat` | same | Non-streaming chat (JSON body like retired `/api/chat`). |
| POST | `/api/patron/agent/chat/stream` | same | SSE chat stream. |
| POST | `/api/patron/agent/image/upload` | same | Multipart image for chat (`image_id` for the chat body). |

Keys are stored hashed on disk; the plaintext is shown **once** at creation. Revoke via `DELETE /api/auth/agent-api-keys/{id}` (session cookie / `session-id` header).

### In-browser patron chat (`sdag_` keys)

The SPA floating panel calls **`POST /api/patron/agent/chat/stream`** and **`POST /api/patron/agent/image/upload`** with **`Authorization: Bearer <sdag_…>`** (or `X-Patron-Agent-Api-Key`). The key is stored in **browser localStorage** from Account → AI agent API keys (“Save for in-browser chat”); it is not the deployment `AGENT_INTERNAL_SECRET`.

Legacy **`POST /api/chat`**, **`POST /api/chat/stream`**, and **`POST /api/image/upload`** return **410 Gone** — use patron routes only. **`sdag_`** keys are also used for **`/api/patron/agent/me`** and **`/api/patron/agent/context`**.

---

## 4. Standalone agent — HTTP to SD (always)

Base URL: **`BACKEND_URL`** (e.g. `http://127.0.0.1:8000`). The agent calls **`/internal/agent/*`** on that origin (no `/api` prefix). Patron browsers use **`/api/...`** on the same origin (Vite or nginx forwards the path unchanged to FastAPI).

**Header on every internal call**: `X-Agent-Secret: <AGENT_INTERNAL_SECRET>` (must match backend `AGENT_INTERNAL_SECRET`).

| Method | Path | Body (JSON) | Use |
|--------|------|--------------|-----|
| POST | `/internal/agent/keyword-search` | `keywords`, optional `gender`, `category`, `n_results` | Catalog keyword search. |
| POST | `/internal/agent/manage-sidebar` | `shop_state`, `action`, `value`, `gender`, `category` | Sidebar observe/select. |
| POST | `/internal/agent/show-product` | `product_id` | Single product (no `image_path`). |
| POST | `/internal/agent/rag-context` | `message`, `session_id`, optional `image_base64`, `mime_type` | Initial RAG / journal context string. |
| POST | `/internal/agent/emit` | `session_id`, `event`, `data` | Push arbitrary event into room `sd_{session_id}` (same as Socket.IO fan-out below). |
| POST | `/internal/agent/socket-to-agents` | `event` (default `sd_bridge`), `data` | Emit to every trusted agent Socket.IO connection (room `sd_agent_service`). Same `X-Agent-Secret` as other internal routes. |

If `AGENT_INTERNAL_SECRET` is unset on the backend, the API resolves it from `{DATA_DIR}/.sd_agent_internal_secret` (auto-created when the data directory is writable). If neither env nor file yields a secret, internal routes return **503**.

---

## 5. Standalone agent — Socket.IO to SD (optional, recommended for fan-out + duplex)

Enable the Socket.IO client when **`SD_SOCKETIO_EMIT=1`** and/or **`SD_AGENT_SOCKET=1`** in the **agent** process (either flag turns on the same connection).

1. Connect with **`python-socketio`** client to `BACKEND_URL`, path **`/socket.io`**.
2. **Auth** payload (Socket.IO handshake), one of:
   - **`{ "agent_secret": "<AGENT_INTERNAL_SECRET>" }`** — deployment trusted agent (multiple connections allowed).
   - **`{ "patron_agent_api_key": "<sdag_…>" }`** (or camelCase **`patronAgentApiKey`**) — external process using a patron minted key. The backend treats it as role **`agent`** (same duplex capabilities). **Only one active Socket.IO connection per key:** a new connection **disconnects** the previous socket for that key with reason `superseded by another agent connection using the same patron API key`.
3. **Backend → agent** (duplex): listen for event **`sd_bridge`** (and any custom `event` you send via `POST /internal/agent/socket-to-agents`). Patron stylist traffic uses **`sd_stylist_message`** (see below).
4. **Agent → backend** (optional control channel): emit **`agent_bridge`** with a JSON object (server logs `type` at debug); emit **`agent_ping`** with optional JSON to receive **`sd_bridge`** `{ "type": "pong", "echo": ... }`.
5. **Stylist patron channel (canonical)** — emit **`agent_emit`** with **`event`** set to **`sd_stylist_message`** and **`data`** set to an **`sd.stylist.v1`** envelope (see below). The API validates the envelope, then emits **`sd_stylist_message`** to room **`sd_{session_id}`** (the browser applies `action` + `payload`).  
   For **non-stylist** legacy pushes you may still use **`agent_emit`** with other `event` names (e.g. raw `ui_action`); those are relayed as-is.

### `sd.stylist.v1` envelope (agent → API → patron)

```json
{
  "schema": "sd.stylist.v1",
  "session_id": "<same as agent_emit.session_id>",
  "source": "tool | agent_reply",
  "tool": "keyword_search | manage_sidebar | show_product | null",
  "action": "shop_sync | catalog_results | found_products | stylist_reply | ui_action",
  "payload": {},
  "meta": {}
}
```

- **`shop_sync`** — `payload` matches the former bare `shop_sync` body (`gender`, `category`, `query` strings).
- **`catalog_results`** — `payload`: `{ "products": [...], "mode": "<string>" }`.
- **`found_products`** — `payload`: `{ "content", "products", "count" }` (mid-turn product spotlight).
- **`stylist_reply`** — `payload`: `{ "reply", "products", "intent", "filter" }` (final turn summary over Socket.IO alongside SSE).

The shipped **Gemini ReAct** tools are **`keyword_search`**, **`manage_sidebar`**, and **`show_product`** only; their real-time side effects use this envelope automatically (no separate `websocket` tool).

If Socket.IO is disabled or connection fails, the agent falls back to **`POST /internal/agent/emit`** with the same `event` / `data` shape; inbound **`sd_bridge`** requires a live Socket.IO session.

---

## 6. Patron chat path (browser → backend → agent)

1. The SPA calls **`POST /api/patron/agent/chat/stream`** with **`Authorization: Bearer <sdag_…>`** and JSON body (`message`, `session_id`, `shop_context`, optional `image_id`, `auth_session_id` for transcript sync when signed in, `history`).
2. The **backend** validates the patron key, merges prompts, then forwards to the **standalone agent** with `X-Agent-Secret` (`POST {AGENT_SERVICE_URL}/v1/chat` or `/v1/chat/stream`).
3. The **agent** runs Gemini and calls the backend’s **`/internal/agent/*`** routes for catalog, RAG, and Socket.IO fan-out.

The **API process does not load the Gemini SDK**. Configure **`AGENT_SERVICE_URL`** (e.g. `http://127.0.0.1:8765`) and **`AGENT_INTERNAL_SECRET`** on the backend. The backend keeps an **`httpx.AsyncClient`** to the agent for:

- **`POST /v1/chat/stream`** — SSE chat (proxied from **`POST /api/patron/agent/chat/stream`**).
- **`POST /v1/chat`** — non-streaming chat JSON (proxied from **`POST /api/patron/agent/chat`**).
- **`POST /v1/internal/embed`** — journal indexing and RAG query embeddings (Chroma stays on the backend).
- **`POST /v1/internal/generate`** — e.g. catering-diary summarization.

All of the above use header **`X-Agent-Secret`**. **`GEMINI_API_KEY`** is only read by the **agent** process.

Agent must expose **`GET /health`** for ops.

---

## 7. Discovery URL

- **`GET /api/agent-manifest.md`** on the backend returns this file (`text/markdown`) for crawlers and tooling.

---

## 8. Security notes

- Treat **`AGENT_INTERNAL_SECRET`** like a service API key (TLS in production, never in client-side code).
- Patron connections do **not** use `agent_secret`; only the trusted agent service does.
- Longer-term roadmap for **arbitrary external eval agents** (NanoClaw / OpenClaw) is sketched in `notebook/AGENT_WEBSOCKET_PLAN.md`; today’s shipped path is **internal agent secret** + HTTP + optional Socket.IO **`agent_emit`** (patron rooms) and **`sd_bridge` / `sd_agent_service`** (agent service duplex).

---

## 9. Minimal curl checks

```bash
# Health (patron API surface)
curl -s http://127.0.0.1:8000/api/health | jq .

# Internal search (replace SECRET)
curl -s -X POST http://127.0.0.1:8000/internal/agent/keyword-search \
  -H "Content-Type: application/json" -H "X-Agent-Secret: SECRET" \
  -d '{"keywords":"cotton","n_results":3}' | jq .

# Internal: push Socket.IO to all connected agent clients (requires agent process connected as role agent)
curl -s -X POST http://127.0.0.1:8000/internal/agent/socket-to-agents \
  -H "Content-Type: application/json" -H "X-Agent-Secret: SECRET" \
  -d '{"event":"sd_bridge","data":{"type":"ping"}}' | jq .

# Manifest
curl -s http://127.0.0.1:8000/api/agent-manifest.md | head
```
