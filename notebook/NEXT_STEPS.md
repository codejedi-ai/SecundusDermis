# Secundus Dermis — Next Steps Roadmap

> **Status:** Living document. Items are grouped by area and roughly prioritised top-to-bottom within each section.

---

## 1. Session & Memory

### 1.1 Persistent Chat Sessions
**Current state:** `InMemorySessionService` resets on every server restart. Session ID is a UUID stored in a React `useRef` — survives page navigation but lost on refresh.

**Target:** Store sessions in a lightweight database (SQLite via SQLAlchemy, or Redis) so:
- A returning user picks up the exact conversation thread
- The agent remembers "you told me earlier you prefer minimal styles"
- Session IDs can be tied to a logged-in user identity later

**Work needed:**
- Replace `InMemorySessionService` with a custom ADK `SessionService` backed by SQLite
- Pass a stable `session_id` from the frontend (localStorage, not just in-memory ref)
- Optionally expose `GET /session/{id}/history` so the frontend can reload previous messages on page load

### 1.2 Cross-Session User Preferences
Once sessions persist, the agent can build a lightweight preference profile per user:
- Preferred gender, size range, colour palette, price sensitivity
- Inject profile as context into new sessions: "This customer usually buys women's casual, budget ~$40"

---

## 2. Image Search

See also: [`IMAGE_SEARCH_PLAN.md`](IMAGE_SEARCH_PLAN.md)

### 2.1 Current Flow (correct — document for clarity)
```
Upload image
  │
  ├─ Step 1 — Gemini VLM: extract clothing keywords
  │           (garment type, colour, fabric, pattern, style)
  │
  ├─ Step 2 — keyword_search() on each VLM keyword   ← PRIMARY
  │           (zero-cost in-memory scan of descriptions)
  │
  └─ Step 3 — colour histogram re-ranking            ← SECONDARY ORDER
              (cosine similarity on 96-dim RGB histogram)
              Results sorted: most visually similar first
```

### 2.2 VLM Prompt Improvements
The current VLM prompt produces generic comma-separated keywords. Improvements:
- Ask the VLM to also infer gender ("men's" / "women's") and category name matching catalog categories
- Ask for dominant colour in hex or plain English for better histogram pre-filtering
- Return structured JSON from VLM instead of free-text keywords → more reliable parsing

### 2.3 Agent Image Integration
Currently image search bypasses the conversational agent entirely (`/search/image` endpoint). Better UX:
- Send image into the agent session alongside the user's message
- Agent uses VLM internally as a tool (`describe_image`) and passes extracted terms to `search_by_keywords`
- Keeps image search results in conversation context for follow-up ("show me more like the second one")

### 2.4 Histogram Candidate Pool Size
The histogram re-ranker only scores the VLM keyword candidates (~200 items max). For images with unusual colours, a broader candidate pool would improve visual matching:
- Run a coarse colour filter first (bucket by dominant hue) to get a 500-item pool
- Then run full histogram similarity on that pool

---

## 3. Search Quality

### 3.1 Semantic / Embedding Search
Current keyword search is exact string matching (`kw in description`). This misses synonyms and conceptual matches.

**Option A — Lightweight TF-IDF:** Build an in-memory TF-IDF matrix at startup. Zero extra dependencies, ~50ms per query for 12k items. Good step up from exact matching.

**Option B — Embedding search (Vertex AI / local model):** Generate 384-dim embeddings for all descriptions at startup using a small model (e.g. `all-MiniLM-L6-v2`). Store in-memory numpy array. Cosine similarity at query time. One Gemini embedding call per query if using Gemini Embeddings API.

**Option C — ChromaDB (already in .gitignore hints this was explored):** Persist embeddings in ChromaDB. Survives restarts. More setup but production-ready.

### 3.2 Multi-Keyword AND Logic
Current: each keyword is searched independently and results are union-merged. This allows "blue cotton shirt" to return items matching only "blue" or only "cotton".

Improvement: score items by how many keywords they match, rank higher-match items first.

---

## 4. Agent Capabilities

### 4.1 WebSocket Agent Interface
See [`AGENT_WEBSOCKET_PLAN.md`](AGENT_WEBSOCKET_PLAN.md) for the full design.

Summary: expose a WebSocket endpoint (`/ws/agent`) that external AI agents (NanoClaw, OpenClaw, etc.) can connect to. Agent reads [`AGENT_MANIFEST.md`](AGENT_MANIFEST.md) to discover capabilities, then drives the store autonomously for evaluation scenarios.

**Implementation order (from that doc):**
1. `AGENT_MANIFEST.md` + `GET /agent-manifest.md`
2. `ws/protocol.py` — message schema
3. `ws/manager.py` — session registry
4. `ws/handlers.py` — thin wrappers around existing API
5. Static-token auth

### 4.2 Agent Eval Hooks
Once WebSocket is live, attach eval scoring to every search action:
- Send `eval` block with each request: expected products, gender, category
- Server responds with `eval_result` — pass/fail, match score
- External agents can run 100-query benchmark suites automatically

### 4.3 Outfit Builder Tool
Add a new agent tool: `build_outfit(anchor_product_id, occasion)`.
- Given a base item, suggest complementary pieces from the catalog
- Pure keyword logic (e.g., match on occasion keywords in descriptions)
- Zero extra API cost

### 4.4 Size & Availability Simulation
The dataset has no size/stock data. Simulate it:
- Assign random size availability at startup (seeded by product_id for consistency)
- Agent can answer "is this available in medium?" with `check_availability(product_id, size)`
- Makes customer support scenarios more realistic

---

## 5. Frontend Polish

### 5.1 Chat — Apply Filters Animation
When the AI sets sidebar filters, add a smooth transition: sidebar items animate to their active state rather than snapping. Use a brief scale + background-colour transition on `.sidebar-item.active`.

### 5.2 Product Page — Related Products
Below the product detail, show a row of similar items using the existing keyword search:
- On product load, call `/search/text` with keywords extracted from the product's description
- Show a horizontal scroll strip: "Similar items"
- Zero API cost — pure keyword search

### 5.3 Blog / Journal — AI-Surfaced Articles in Search
When a search query matches journal topics, show a "From the Journal" card above the product grid (e.g., searching "denim care" surfaces the denim care article).

### 5.4 Mobile Sidebar
On mobile, the sidebar stacks above the grid. This is functional but not optimal:
- Add a floating "Filters" pill button on mobile that opens a bottom-sheet drawer
- Drawer contains the same sidebar content
- Dismiss by tapping outside or swiping down

---

## 6. Evaluation Framework

### 6.1 Benchmark Query Set
Write a ground-truth query set (~100 queries) with expected outcomes:
```json
{ "query": "floral summer dress women", "expected_gender": "WOMEN", "expected_category": "Dresses", "expected_top_k": 5 }
```

Store as `eval/queries.json`. Run automated against `/chat` and `/search/text` endpoints.

### 6.2 Agent Response Quality Rubric
Score each agent response on:
- **Grounding**: did the agent cite only retrieved product data?
- **Relevance**: are the returned products relevant to the query?
- **Tone**: friendly, concise, on-brand?
- **Tool usage**: did the agent use `search_by_keywords` when it should have?

### 6.3 Regression Suite
Add a CI step (GitHub Actions) that:
1. Starts the backend in test mode
2. Runs the benchmark query set against `/search/text`
3. Reports precision@5 and precision@1
4. Fails the build if scores drop below baseline

---

## 7. Infrastructure

### 7.1 Image Serving Performance
Currently images are served by FastAPI `StaticFiles` from disk. For production:
- Move images to a CDN (Cloudflare R2, AWS S3 + CloudFront)
- Serve thumbnails (300px wide) for the grid, full-res only on product page

### 7.2 Histogram Cache Persistence
`histogram_cache` is built lazily in-memory. With 12k products it can grow to ~10 MB and resets on restart.
- Serialise to a numpy `.npz` file on shutdown, reload on startup
- Or pre-compute all histograms as a one-time build step

### 7.3 Rate Limiting
The `/chat` endpoint calls Gemini. Without rate limiting, a single client can exhaust the API quota.
- Add `slowapi` rate limiter: 20 RPM per IP on `/chat`, unlimited on `/catalog/*`

---

## Quick-Win Summary

| Item | Effort | Impact |
|------|--------|--------|
| Persist histogram cache to disk | Small | Medium — faster cold start |
| Semantic TF-IDF search | Small | High — much better keyword matching |
| Related products strip on product page | Small | Medium — keeps users browsing |
| Persistent SQLite sessions | Medium | High — real conversation memory |
| AGENT_MANIFEST.md + `/ws/agent` endpoint | Medium | High — unlocks external agent evaluation |
| Benchmark query set + CI | Medium | High — ensures search quality over time |
| VLM structured JSON output for image search | Small | Medium — more reliable image → keyword pipeline |
