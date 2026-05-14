---
title: Secundus Dermis
emoji: 👗
colorFrom: purple
colorTo: pink
pinned: false
---

# Secundus Dermis

An AI-powered fashion storefront built as a **customer support agent playground**. The fictional brand is a prop — the real subject is demonstrating how a conversational AI agent handles the full surface area of e-commerce support: product discovery, visual search, editorial content, and multi-turn dialogue.

The site is also designed as a target environment for external AI agents. Agents such as **NanoClaw** and **OpenClaw** can connect via WebSocket, read a machine-readable manifest, and autonomously drive browsing, search, and support scenarios for automated evaluation. See [`AGENT_WEBSOCKET_PLAN.md`](AGENT_WEBSOCKET_PLAN.md).

---

## Configuration

The important variable is **`DATA_DIR`**. **Only `app/data` is used** for Kaggle extract, Chroma, journal files on disk, uploads, and (by default) auth JSON. You may **omit** `DATA_DIR` in `app/backend/.env` and the app resolves to `{repo}/app/data`. If you set `DATA_DIR` or `AUTH_DATA_DIR`, they must resolve to **that same directory**; other paths are ignored with a warning. Optional: repo root `.env` and `app/.env` for shared keys — duplicate keys in `app/backend/.env` win last.

| | **Local development** |
|---|------------------------|
| **Purpose** | `uv`, Vite, optional hot reload |
| **Config** | `app/backend/.env` (and optionally repo root `.env` / `app/.env`; `app/backend/.env` wins last) |
| **`DATA_DIR`** | **Always `app/data`** (omit env, or set to the resolved path of `{repo}/app/data` only) |
| **Kaggle zip** | `{DATA_DIR}/kaggle/deep-fashion-multimodal.zip` |
| **Start backend** | `cd app/backend && uv run python api.py` |
| **Start frontend** | `cd app/frontend && npm run dev` (proxies `/api` → `:8000`) |

After changing `.env` files or secrets, restart the backend process.

### Public URL (optional)

To test from outside your LAN, run [ngrok](https://ngrok.com/) (or similar) against `http://localhost:8000` and set `FRONTEND_PUBLIC_URL` in `.env` to the public HTTPS URL you use for email links.

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| uv | latest (`pip install uv`) |
| Gemini API key | [aistudio.google.com](https://aistudio.google.com) |
| Kaggle API token | [kaggle.com/settings](https://www.kaggle.com/settings) |

### Backend

```bash
cd app/backend
cp .env.example .env          # fill secrets; you can omit DATA_DIR (defaults to ../data → app/data)
uv sync                       # install dependencies
uv run python api.py          # starts on http://localhost:8000
```

`api.py` loads env from the repo root `.env`, then `app/.env` if present, then `app/backend/.env` (**overrides**). Prefer secrets in `app/backend/.env`; **only `app/data`** is used for catalog and auth files unless `DATA_DIR` / `AUTH_DATA_DIR` point at that same path.

The DeepFashion Multimodal dataset (~650 MB) downloads on first run via the Kaggle API when the catalog is not ready under `{DATA_DIR}/kaggle/deep-fashion-multimodal/`. Interactive API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd app/frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` → `localhost:8000`.

### Continuous integration

GitHub Actions **Backend CI** (`.github/workflows/backend-ci.yml`) runs `pytest .github/tests/unit` and, when the repository secret **`KAGGLE_API_TOKEN`** is set, downloads the DeepFashion dataset into `app/data/kaggle` (cached between runs). Fork PRs do not receive that secret; the download step is skipped there.

**Frontend CI** (`.github/workflows/frontend-ci.yml`) runs Vitest, then `npm run build` (writes the SPA to `app/dist/`), then pytest on `.github/tests/production_dist` so the **built bundle matches what the FastAPI app serves in production** (`/` → `index.html`, `/assets/*` static mount). That path is not validated by backend-only CI because `app/dist` is produced by the Vite build, not by Python.

For a full single-process smoke test locally: `npm run build` in `app/frontend`, then start the backend; open `http://localhost:8000/` (not only the Vite dev port) to confirm the hosted SPA and API share one origin.

### Environment variables

Paths below **`DATA_DIR`** are derived in `app/backend/config.py` (do not set legacy `IMAGES_DIR` / `DATASET_ROOT` for the main API).

```env
# app/backend/.env  —  omit DATA_DIR to use {repo}/app/data, or set both to that path only
DATA_DIR=/absolute/path/to/SecundusDermis/app/data
AUTH_DATA_DIR=/absolute/path/to/SecundusDermis/app/data   # optional; must match DATA_DIR (app/data)

GEMINI_API_KEY=...                               # required — LLM + VLM
KAGGLE_API_TOKEN=KGAT_...                        # required — dataset download
ADMIN_KEY=change-me                              # optional — reserved for future admin-only routes
AGENT_MODEL=gemini-3.1-pro-preview-customtools
VLM_MODEL=gemini-3.1-pro-preview
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser — React + Vite SPA                              │
│                                                          │
│  /           About — what this project is                │
│  /shop       Infinite-scroll catalog + sidebar filters   │
│  /product/:id  Product detail                            │
│  /agents     AI agents hub (signed-in only: keys, sockets, deployment) │
│  ChatWidget  Floating AI chat, persists across pages     │
│  Header      Navbar with live AI-controlled search bar   │
└────────────────────────┬─────────────────────────────────┘
                         │  REST  (Vite proxy → :8000)
┌────────────────────────▼─────────────────────────────────┐
│  FastAPI  (app/backend/api.py)                             │
│                                                          │
│  /chat ────── Google ADK Runner ──── Gemini LLM          │
│                     │                                    │
│               search_by_keywords ←── in-memory catalog  │
│               search_journal     ←── markdown files      │
│               get_catalog_stats                          │
│               get_product_categories                     │
│                                                          │
│  /search/image ── Gemini VLM → keywords → keyword_search │
│                              └─ colour histogram re-rank │
│                                                          │
│  /catalog/*  ── pure in-memory filtering (zero API cost) │
│  /api/conversations  ── signed-in chat transcript sync (JSON)              │
└──────────────────────────────────────────────────────────┘
```

### Text search flow

```
User message → ADK Runner → Gemini LLM
                                │
              calls search_by_keywords(
                keywords="floral dress",
                gender="WOMEN",
                category="Dresses"
              )
                                │
              in-memory keyword scan of 12,278 descriptions
                                │
              LLM composes reply with product list
                                │
        ← reply + products + filter{ gender, category, query }
                                │
        ChatWidget mirrors filter into ShopContext
        → sidebar highlights Women's + Dresses
        → navbar search populates
        → shop grid filters to match
```

### Image search flow

```
Uploaded image
  Step 1 — Gemini VLM → "dress, floral, blue, cotton, casual"   PRIMARY SIGNAL
  Step 2 — keyword_search() for each VLM term → ~200 candidates  PRIMARY RETRIEVAL
  Step 3 — colour histogram cosine similarity → re-rank           VISUAL ORDERING
  Return top N sorted by visual similarity
```

The histogram only **orders** what keyword search already found — it never retrieves on its own.

---

## Tech Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| **Agent framework** | Gemini SDK + `app/agent/stylist_loop` | Direct `generate_content` with function declarations; optional standalone agent service under `app/agent` calling the API over HTTP |
| **LLM / VLM** | Gemini (`gemini-3.1-pro-preview-customtools`) | Function-calling for agent tools; same API key for both chat agent and image description — single dependency, single quota |
| **Product search** | In-memory `str in str` keyword scan | 12k descriptions fit in RAM; sub-millisecond queries; zero API cost per search — ideal for a high-query demo |
| **Image similarity** | 96-dim RGB histogram + cosine similarity | No model inference per query; computed once per image and cached lazily; sufficient colour-based visual ranking for a demo |
| **API** | FastAPI | Async, Pydantic validation, OpenAPI auto-docs, `UploadFile` for image handling |
| **Frontend** | React + Vite + TypeScript | HMR for fast iteration; React Router SPA preserves the chat widget across page navigations without remounting; TypeScript catches API contract mismatches early |
| **Global state** | React Context (`ShopContext`) | Sidebar filters and search query shared across all routes — lets the AI chat widget update the shop grid and navbar search without prop drilling |
| **Routing** | React Router nested routes + `<Outlet>` | `ShopLayout` defines the sidebar once; `/shop` and `/product/:id` are nested inside it — sidebar never unmounts or re-renders on navigation |
| **Styling** | Plain CSS modules per component | Full control over the editorial boutique aesthetic; no framework purge config; variables in `variables.css` for theming |
| **Dataset** | DeepFashion Multimodal (Kaggle) | 12,278 labelled images with captions across 16 categories for MEN + WOMEN; auto-downloaded via `KAGGLE_API_TOKEN` on first server start |
| **Chat persistence** | `GET/POST /api/conversations` | Signed-in stylist widget history stored per session for continuity across devices |

---

## Agent API Reference

Base URL: `http://localhost:8000`
All bodies are JSON. Interactive docs at `/docs`.

---

### `POST /chat`

Conversational agent. Routes through Google ADK, calls tools as needed, returns grounded reply.

**Request**
```json
{
  "message": "Show me women's dresses under $80",
  "history": [
    { "role": "user",      "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help you today?" }
  ],
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | string | ✓ | The user's message |
| `history` | array | — | Recent turns `{ role, content }` for context. The ADK session also maintains server-side history independently. |
| `session_id` | string | — | UUID identifying the conversation. Defaults to `"default"`. Use a stable per-user UUID for real context persistence. |

**Response**
```json
{
  "reply": "I found 6 dresses for you! Here are some highlights...",
  "products": [
    {
      "product_id": "id_00001234",
      "product_name": "Women's Floral Cotton Dress",
      "description": "A light floral cotton dress with short sleeves...",
      "gender": "WOMEN",
      "category": "Dresses",
      "price": 64.99,
      "similarity": 0.0,
      "image_url": "/images/WOMEN-Dresses-id_00001234-01_1_front.jpg"
    }
  ],
  "intent": "text_search",
  "filter": {
    "gender": "WOMEN",
    "category": "Dresses",
    "query": "floral"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reply` | string | Markdown-formatted agent response |
| `products` | array | Products retrieved by the agent's `search_by_keywords` tool call. Empty for chitchat. |
| `intent` | `"text_search"` \| `"chitchat"` | Whether the agent searched the catalog |
| `filter` | object \| null | Sidebar filter state from the agent's tool args. Apply directly to the shop UI to mirror what the AI searched. |

**Agent tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `search_by_keywords` | `(keywords, gender?, category?, max_price?, n_results?)` | Primary product retrieval. Called for all product queries. |
| `get_catalog_stats` | `()` | Total product count, all categories, all genders. |
| `get_product_categories` | `()` | Categories grouped by gender. |
| `search_journal` | `(query)` | Searches indexed editorial notes for the stylist; summarize in reply (no public article URLs). |

---

### `POST /search/text`

Direct keyword search, bypassing the conversational agent. Useful for programmatic or evaluation use.

**Request**
```json
{
  "query": "leather jacket",
  "n_results": 8,
  "gender": "MEN",
  "category": "Jackets_Vests",
  "max_price": 150.0
}
```

**Response**
```json
{
  "results": [ /* Product objects */ ],
  "query": "leather jacket",
  "total": 4
}
```

---

### `POST /search/image`

Find visually similar products by uploading a photo.

**Request** — `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | JPEG, PNG, or WebP |
| `n_results` | int | Max results (default 8) |
| `gender` | string | Optional filter |
| `category` | string | Optional filter |

```bash
curl -X POST http://localhost:8000/search/image \
  -F "file=@jacket.jpg" \
  -F "n_results=6"
```

**Response**
```json
{
  "results": [ /* Product objects with similarity scores */ ],
  "query": "[image: jacket.jpg] → jacket, leather, brown, casual",
  "total": 6
}
```

---

### `GET /catalog/browse`

Paginated catalog with filtering. Zero API cost.

| Param | Type | Description |
|-------|------|-------------|
| `offset` | int | Pagination offset (default 0) |
| `limit` | int | Page size, max 48 (default 24) |
| `gender` | string | `"MEN"` or `"WOMEN"` |
| `category` | string | Exact category name |
| `q` | string | Keyword filter on name + description |

**Response**
```json
{ "products": [...], "offset": 0, "limit": 24, "total": 347 }
```

---

### `GET /catalog/product/{product_id}`

Single product by ID.

---

### `GET /catalog/stats`

```json
{
  "total_products": 12278,
  "categories": ["Blouses_Shirts", "Cardigans", "Denim", "..."],
  "genders": ["MEN", "WOMEN"]
}
```

---

### `GET /api/conversations`

Returns `{ "messages": [...] }` for the authenticated session (stylist chat transcript).

### `POST /api/conversations`

Append one message `{ role, content, timestamp }` (used by the chat widget when signed in).

### `DELETE /api/conversations`

Clears stored messages for the session.

### `GET /api/health`

```json
{ "status": "healthy", "catalog_size": 12278, "search_mode": "keyword + VLM histogram" }
```

---

## Categories Reference

**Men's:** `Tees_Tanks` · `Shirts_Polos` · `Sweaters` · `Sweatshirts_Hoodies` · `Suiting` · `Denim` · `Pants` · `Shorts` · `Jackets_Vests`

**Women's:** `Tees_Tanks` · `Graphic_Tees` · `Blouses_Shirts` · `Cardigans` · `Denim` · `Pants` · `Shorts` · `Skirts` · `Leggings` · `Dresses` · `Rompers_Jumpsuits` · `Jackets_Coats`

---

## Project Structure

```
SecundusDermis/
│
├── app/
│   ├── backend/                  # FastAPI, agent, templates, pyproject.toml
│   │   ├── api.py
│   │   ├── .env.example
│   │   └── ...
│   ├── data/                     # Downloaded dataset (gitignored)
│   ├── frontend/                 # React + Vite SPA
│   └── dist/                     # Production SPA build (Vite outDir → parent of frontend/)
│
├── AGENT_WEBSOCKET_PLAN.md       # WebSocket agent integration design
├── IMAGE_SEARCH_PLAN.md          # Image search architecture + roadmap
├── SESSION_PLAN.md               # Session persistence roadmap
└── NEXT_STEPS.md                 # Overall project roadmap
```

Frontend detail (`app/frontend/`):

```
app/frontend/
├── src/
│   ├── main.tsx                  # App root — Router, ShopProvider, ShopLayout
│   ├── lib/
│   │   └── shop-context.tsx      # Global filter + search state (React Context)
│   ├── components/
│   │   ├── Header.tsx            # Navbar — live AI-controlled search input
│   │   ├── ShopSidebar.tsx       # Persistent filter sidebar (defined once in ShopLayout)
│   │   ├── ChatWidget.tsx        # Floating AI chat — mirrors filters to sidebar
│   │   └── Footer.tsx
│   ├── pages/
│   │   ├── About.tsx             # Root — describes the AI playground
│   │   ├── Shop.tsx              # Infinite-scroll product grid
│   │   ├── Product.tsx           # Product detail
│   │   ├── Agents.tsx (AI agents hub)                     │
│   │   └── FAQ.tsx / Contact.tsx
│   ├── services/
│   │   └── fashionApi.ts         # Typed API client
│   └── styles/                   # Per-component CSS
└── vite.config.ts
```

---

## No Real Commerce

No products can be purchased. No orders are placed. No personal data is stored.
This is a technical demonstration of AI-assisted customer support patterns.

**Dataset:** DeepFashion Multimodal by silverstone1903 on Kaggle — 12,278 items, MEN + WOMEN, 16 categories.
**AI:** Google Gemini via Google ADK.
