# WebSocket Agent Integration — Planning Document

> **Status:** Brainstorm / Future Roadmap
> **No code has been written yet.** This document captures the intent, design thinking, and open questions for connecting external AI agents (NanoClaw, OpenClaw, etc.) to the Secundus Dermis demo environment via WebSocket.

---

## 1. The Big Idea

Secundus Dermis is already a working AI-powered storefront demo. The next layer is making it **agent-accessible from outside** — so that an external AI agent (running in its own process, potentially on a different machine) can:

1. Discover what this site can do by reading a markdown manifest file
2. Connect via WebSocket and receive a live session
3. Drive the storefront autonomously: search, browse, ask questions, evaluate responses
4. Log results, scores, or observations back through the same socket

This turns the site from a human-facing demo into a **live evaluation environment** for AI agents testing customer support capabilities.

---

## 2. Intended Agent Clients

| Agent | Notes |
|-------|-------|
| **NanoClaw** | Lightweight agent client; reads the manifest and issues structured commands |
| **OpenClaw** | More capable orchestrator; can run multi-step evaluation scenarios |
| Generic ADK agents | Any Google ADK agent could be adapted to use the WebSocket interface |
| Custom test harnesses | CI/CD scripts that run automated regression tests against the agent |

The protocol should be agent-agnostic — NanoClaw and OpenClaw are first-class targets but the socket API should be open enough that any JSON-capable client can connect.

---

## 3. Agent Discovery via Markdown Manifest

The key insight: **an AI agent should be able to read a single markdown file and know everything it needs to connect and operate.**

### Proposed manifest location

```
GET /agent-manifest.md
```

Or served as a static file at the repo root: `AGENT_MANIFEST.md`

### What the manifest should contain

```markdown
# Secundus Dermis — Agent Manifest

## WebSocket endpoint
ws://localhost:8000/ws/agent

## Authentication
Pass your agent token in the connection header:
  Authorization: Bearer <token>

## Capabilities
- chat: send a user message, receive assistant reply + product list
- search_text: keyword search, returns product array
- search_image: upload image bytes, returns visually similar products
- browse_catalog: paginated catalog with gender/category/keyword filters
- get_product: fetch single product by ID
- journal_search: search editorial articles

## Message format (JSON)
{ "action": "chat", "payload": { "message": "..." }, "request_id": "abc123" }

## Response format
{ "request_id": "abc123", "action": "chat", "data": { ... }, "error": null }

## Evaluation hooks
- Actions can include an "eval" block to log expected vs actual outcomes
- The server streams back a score if an eval rubric is attached

## Rate limits
- Free tier: 15 RPM on AI-backed actions (chat, image search)
- Catalog browse and text search: unlimited (zero API cost)
```

The manifest is the contract. An agent that can read markdown and make WebSocket connections can operate the entire site without any other documentation.

---

## 4. WebSocket Manager Architecture (Backend)

### Location in project

```
backend/
  ws/
    manager.py      ← WebSocket session manager
    protocol.py     ← Message schema (action types, payloads)
    auth.py         ← Token validation for agent connections
    handlers.py     ← One handler per action type
```

### Core responsibilities of `manager.py`

- Maintain a registry of connected agent sessions (`agent_id → WebSocket`)
- Route incoming messages to the correct handler based on `action`
- Broadcast events back to the agent (e.g. server-side notifications)
- Handle disconnection and reconnection gracefully
- Enforce rate limits per agent session

### Connection lifecycle

```
Agent                          Server
  |                              |
  |-- WS connect + Auth header ->|  validate token, create session
  |<-- { "event": "connected" } -|
  |                              |
  |-- { "action": "chat", ... } ->|  route to chat handler
  |<-- { "data": { reply, products } } --|
  |                              |
  |-- { "action": "browse_catalog" } ->|
  |<-- { "data": { products, total } } --|
  |                              |
  |-- WS close                  |  clean up session
```

### Message schema sketch

**Request (agent → server)**
```json
{
  "request_id": "uuid",
  "action": "chat | search_text | search_image | browse_catalog | get_product | journal_search",
  "payload": { ... action-specific fields ... },
  "eval": {                        // optional evaluation block
    "expected_product_ids": [...],
    "rubric": "top_1_match | top_5_match | keyword_present"
  }
}
```

**Response (server → agent)**
```json
{
  "request_id": "uuid",
  "action": "chat",
  "data": { ... },
  "eval_result": {                 // only present if eval block was in request
    "passed": true,
    "score": 0.9,
    "notes": "..."
  },
  "error": null
}
```

---

## 5. Authentication Strategy

Since this is a demo/playground, auth can be lightweight:

- **Option A — Static token:** `AGENT_TOKENS` env var holds a comma-separated list of allowed tokens. Simple and zero-dependency.
- **Option B — Admin-issued tokens:** Same `POST /journal` pattern — admin key creates a new agent token, stored in memory.
- **Option C — Open (no auth):** For local dev / fully public demos, skip auth entirely and just rate-limit by IP.

Recommendation: start with **Option A** for NanoClaw/OpenClaw integration, add Option B when more agents need independent identity.

---

## 6. Evaluation / Scoring Hook

One of the most valuable things an external agent can do is **run evaluation scenarios** — send a known query, check whether the right products come back, score the agent's response quality.

The WebSocket eval hook is the primitive that enables this:

```
Agent sends:   { action: "chat", payload: { message: "show me blue denim jackets for men" },
                 eval: { expected_category: "Jackets_Vests", expected_gender: "MEN", rubric: "category_match" } }

Server replies: { data: { reply: "...", products: [...] },
                  eval_result: { passed: true, score: 1.0, matched: 3 } }
```

Agents like NanoClaw could run a full benchmark suite (100+ queries) and produce a structured report without any human interaction.

---

## 7. What the Agent Reads Before Connecting

Flow from the agent's perspective:

```
1. GET /agent-manifest.md               ← read capabilities and protocol
2. Parse: endpoint, actions, schema     ← LLM reads markdown, extracts structure
3. WS connect → authenticate            ← open socket with token
4. Send actions per manifest schema     ← drive the site
5. Collect responses + eval scores      ← log results
6. WS close                             ← session ends
```

The markdown manifest is what makes this "AI-native" — the agent doesn't need a Swagger spec or SDK, just a readable text file.

---

## 8. Open Questions

- **Should the manifest be versioned?** (`/agent-manifest/v1.md`) — useful if the protocol evolves
- **Streaming responses?** For long chat replies, should the server stream tokens over the socket rather than sending the full reply at once?
- **Multi-turn conversation over WS?** The current chat API maintains session state via `session_id`. WS sessions could map 1:1 to agent sessions, making multi-turn natural.
- **Agent identity in journal?** Should an agent be able to post journal entries (via WS) to document its evaluation runs?
- **NanoClaw vs OpenClaw protocol differences?** Need to understand what each agent expects — do they have their own wire format or can they adapt to ours?
- **Binary image transfer?** `search_image` needs to send image bytes over the socket. Options: base64 in JSON, or a binary WebSocket frame.

---

## 9. Suggested Implementation Order (when ready)

1. Write `AGENT_MANIFEST.md` and serve it at `GET /agent-manifest.md`
2. Implement `ws/protocol.py` — message schema, action enum, pydantic models
3. Implement `ws/manager.py` — session registry, routing, disconnect handling
4. Implement `ws/handlers.py` — thin wrappers around existing `api.py` logic
5. Add `GET /ws/agent` WebSocket endpoint to `api.py`
6. Add static-token auth (`ws/auth.py`)
7. Connect NanoClaw as first client, iterate on manifest and protocol
8. Add eval scoring hook
9. Connect OpenClaw, test multi-agent scenarios

---

## 10. Relationship to Existing Architecture

The WebSocket layer is **additive** — it doesn't replace the REST API or the human-facing chat widget. It sits alongside:

```
External agents  ──── WebSocket (/ws/agent) ────┐
                                                  │
Human users      ──── REST API (/chat, /search) ──┤── FastAPI (api.py)
                                                  │
Frontend (React) ──── REST API ─────────────────┘
```

All three paths share the same in-memory catalog, journal, and ADK agent runner. The WebSocket manager is just a new entry point into the same business logic.
