# Secundus Dermis — Backend

FastAPI server powering an AI-driven fashion storefront. Handles conversational agent (Google ADK + Gemini), product catalog search, visual image search, and editorial journal.

---

## Quick Start

### Prerequisites

- **Python 3.11+**
- **uv** — `pip install uv`
- **Gemini API key** — [aistudio.google.com](https://aistudio.google.com)
- **Kaggle API token** — [kaggle.com/settings](https://www.kaggle.com/settings)

### Installation

```bash
cd app/backend
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY and KAGGLE_API_TOKEN

uv sync                       # Install dependencies
uv run python api.py          # Start server on http://localhost:8000
```

The DeepFashion Multimodal dataset (~650 MB, 12,278 items) downloads automatically on first run if `data/labels_front.csv` is missing.

### Interactive API Docs

Visit `http://localhost:8000/docs` for Swagger UI with all endpoints.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✓ | Gemini API key for agent LLM and VLM image search |
| `KAGGLE_API_TOKEN` | ✓ | Kaggle API token (KGAT format) for dataset download |
| `ADMIN_KEY` | ✓ | Protects `POST /journal` — change before deploy |
| `AGENT_MODEL` | — | `gemini-3.1-pro-preview-customtools` (default) |
| `VLM_MODEL` | — | `gemini-3.1-pro-preview` (default) |
| `IMAGES_DIR` | — | `./data/selected_images` (default) |
| `JOURNAL_DIR` | — | Not used for overrides; posts live under `app/data/journal` (`*.json`) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  FastAPI Server (api.py)                                 │
│                                                          │
│  /chat ────── Google ADK Runner ──── Gemini LLM          │
│                     │                                    │
│               search_by_keywords ←── in-memory catalog  │
│               search_journal     ←── app/data/journal JSON │
│               get_catalog_stats                          │
│               get_product_categories                     │
│                                                          │
│  /search/image ── Gemini VLM → keywords → keyword_search │
│                              └─ colour histogram re-rank │
│                                                          │
│  /catalog/*  ── pure in-memory filtering (zero API cost) │
│  /journal/*  ── JSON posts in app/data/journal           │
│  /auth/*     ── in-memory session auth                   │
│  /cart/*     ── in-memory cart per session               │
└──────────────────────────────────────────────────────────┘
```

### Key Modules

| File | Purpose |
|------|---------|
| `api.py` | Main FastAPI app — all REST endpoints, catalog loading, VLM image description |
| `agent/agent.py` | ADK Agent definition with luxury stylist persona and system instructions |
| `agent/tools.py` | Tool functions: `search_by_keywords`, `get_catalog_stats`, `get_product_categories`, `search_journal` |
| `download_data.py` | Kaggle dataset auto-download on first run |
| `auth.py` | In-memory authentication (SHA256 hashing, session management) |
| `cart.py` | In-memory shopping cart per session |
| `conversations.py` | In-memory conversation history store |

---

## API Endpoints

### Agent & Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Conversational agent via Google ADK — returns reply + products + filter state |
| `/search/text` | POST | Direct keyword search (bypasses agent) |
| `/search/image` | POST | Visual search by image upload (VLM + histogram re-ranking) |

### Catalog

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/catalog/browse` | GET | Paginated catalog with filters (gender, category, query) |
| `/catalog/product/{id}` | GET | Single product by ID |
| `/catalog/stats` | GET | Catalog statistics (total, categories, genders) |
| `/catalog/random` | GET | Random products for discovery UI |

### Journal (Editorial)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/journal` | GET/POST | List articles or create new (requires `X-Admin-Key`) |
| `/journal/{slug}` | GET | Single article by slug |
| `/journal/categories` | GET | Available journal categories |

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Register new user |
| `/auth/login` | POST | Login (returns `session_id`) |
| `/auth/logout` | POST | Logout (invalidates session) |
| `/auth/me` | GET | Get current user from session |

### Cart & Conversations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/cart` | GET/POST | Get cart or add item |
| `/cart/{product_id}` | PUT/DELETE | Update or remove cart item |
| `/conversations` | GET/POST/DELETE | Conversation history management |

---

## Agent Tools

The ADK agent has access to these tools:

### `search_by_keywords`

```python
async def search_by_keywords(
    keywords: str,
    gender: Optional[str] = None,
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    n_results: int = 12
) -> list[dict]
```

Primary product retrieval. Scans catalog in-memory for keyword matches.

### `get_catalog_stats`

```python
async def get_catalog_stats() -> dict
```

Returns total product count, all categories, and all genders.

### `get_product_categories`

```python
async def get_product_categories() -> dict[str, list[str]]
```

Returns categories grouped by gender (MEN/WOMEN).

### `search_journal`

```python
async def search_journal(query: str) -> list[dict]
```

Searches editorial articles. Returns title, excerpt, and markdown link.

---

## Search Architecture

### Text Search Flow

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
              (zero API cost, sub-millisecond)
                                │
              LLM composes reply with product list
                                │
        ← reply + products + filter{ gender, category, query }
```

### Image Search Flow

```
Uploaded image
  Step 1 — Gemini VLM → "dress, floral, blue, cotton, casual"   PRIMARY SIGNAL
  Step 2 — keyword_search() for each VLM term → ~200 candidates  PRIMARY RETRIEVAL
  Step 3 — colour histogram cosine similarity → re-rank           VISUAL ORDERING
  Return top N sorted by visual similarity
```

**Key principle:** The histogram only **orders** what keyword search already found — it never retrieves on its own.

---

## Dataset

**Source:** DeepFashion Multimodal by silverstone1903 on Kaggle
- **12,278 items** across MEN + WOMEN
- **16 categories**: Tees_Tanks, Dresses, Jackets_Vests, Denim, etc.
- **~650 MB** of images in `data/selected_images/`
- **CSV labels** in `data/labels_front.csv`

Auto-downloaded on first run via `download_and_extract()`.

---

## Data Storage

**No traditional database** — all data is in-memory or file-based:

| Data Type | Storage |
|-----------|---------|
| Product catalog | In-memory list (loaded from CSV) |
| Journal articles | Markdown files with YAML frontmatter in `/journal/` |
| User sessions | In-memory dict (`session_id → user_id`) |
| Shopping cart | In-memory per-session dict |
| Conversation history | In-memory store keyed by `session_id` |
| Image histograms | Lazy-loaded cache (computed once per product) |

---

## Development

### Run Tests

```bash
uv run pytest
```

### Code Style

```bash
uv run ruff check .
uv run ruff format .
```

## Production Deployment

### Railway

```bash
railway login
railway init
railway up
```

Set environment variables in Railway dashboard:
- `GEMINI_API_KEY`
- `KAGGLE_API_TOKEN`
- `ADMIN_KEY`

## Project Structure

```
app/backend/   (this directory — run api.py from here with uv)
├── api.py                      # Main FastAPI app
├── download_data.py            # Kaggle dataset download
├── auth.py                     # Session auth
├── cart.py                     # Cart
├── conversations.py            # Conversations
├── pyproject.toml              # Dependencies (uv)
├── .env.example                # Environment template
├── agent/
│   ├── agent.py
│   └── tools.py
├── journal/                    # Editorial JSON / assets (see DATA_DIR too)
├── migrations/
├── public/                     # Static files served by the API
├── templates/email/            # SMTP HTML templates
└── …                           # notion_users, vector_store, smtp_mail, etc.
```

Shared runtime data lives in `app/data/` (see `DATA_DIR`). The Vite app is in `app/frontend/`; production build output is `app/dist/` (see `../run.sh` or `npm run build`).

---

## Dependencies

```toml
[project]
name = "secundus-dermis"
version = "2.0.0"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "google-genai>=1.0.0",
    "numpy>=1.24.0",
    "pillow>=10.0.0",
    "kaggle>=1.6.0",
    "python-multipart>=0.0.6",
    "pydantic>=2.0.0",
]
```

---

## No Real Commerce

This is a **technical demonstration**. No products can be purchased, no orders are placed, and no personal data is persistently stored.
