"""
SecundusDermis — AI Fashion Agent API
======================================
No setup step required — the catalog loads automatically from CSV on startup.

Search strategy:
  Text/chat  → keyword matching on in-memory catalog (zero API cost)
  Image      → Gemini VLM extracts clothing keywords → keyword search
               + colour histogram re-ranking of candidates

Agent: Google ADK (google-adk) — LLM-only, no embedding API calls.

Run with:  uv run python api.py
"""

import csv
import io
import logging
import os
import random
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types as genai_types
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from PIL import Image
from pydantic import BaseModel

from agent import tools as agent_tools
from agent.agent import create_agent
from auth import (
    UserCreate, UserLogin, UserResponse, LoginResponse,
    create_user, authenticate_user, get_user_from_session, logout,
)
from cart import CartItem, CartResponse, get_cart, add_to_cart, update_cart_item, remove_from_cart, clear_cart
from conversations import get_messages, append_message, clear_messages as clear_convo
from download_data import download_and_extract
from user_profiles import add_cart_item as profile_add_cart, record_activity as profile_record_activity

load_dotenv(Path(__file__).parent / ".env")

# ── Configuration ─────────────────────────────────────────────────────────────

GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")
IMAGES_DIR         = os.getenv("IMAGES_DIR",  "./data/selected_images")
JOURNAL_DIR        = Path(os.getenv("JOURNAL_DIR", "./journal"))
DATASET_ROOT       = os.getenv("DATASET_ROOT", "./data")
LABELS_CSV         = Path(DATASET_ROOT) / "labels_front.csv"
AGENT_MODEL        = os.getenv("AGENT_MODEL", "gemini-3.1-pro-preview-customtools")
VLM_MODEL          = os.getenv("VLM_MODEL",   "gemini-3.1-pro-preview")
APP_NAME           = "secundus_dermis"

HIST_BINS = 32   # 32 bins × 3 channels = 96-dim colour histogram

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ── Price table ───────────────────────────────────────────────────────────────

_PRICE_RANGES = {
    "Denim":               (39.99,  89.99),
    "Jackets_Vests":       (59.99, 199.99),
    "Pants":               (29.99,  79.99),
    "Shorts":              (19.99,  49.99),
    "Skirts":              (24.99,  69.99),
    "Shirts_Polos":        (19.99,  59.99),
    "Tees_Tanks":          (14.99,  39.99),
    "Sweaters":            (34.99,  99.99),
    "Sweatshirts_Hoodies": (29.99,  79.99),
    "Dresses":             (34.99, 129.99),
    "Suiting":             (79.99, 299.99),
    "Blouses_Shirts":      (24.99,  69.99),
    "Cardigans":           (34.99,  89.99),
    "Rompers_Jumpsuits":   (39.99,  99.99),
    "Graphic_Tees":        (14.99,  34.99),
}

def _price(category: str) -> float:
    lo, hi = _PRICE_RANGES.get(category, (19.99, 79.99))
    return round(random.uniform(lo, hi), 2)

def _extract_attrs(desc: str) -> dict:
    dl = desc.lower()
    attrs: dict = {}
    for s in ["short-sleeve", "long-sleeve", "sleeveless"]:
        if s in dl: attrs["sleeve_length"] = s; break
    for g in ["shirt","t-shirt","dress","jacket","coat","sweater","blouse",
               "pants","trousers","shorts","skirt","vest","hoodie","cardigan",
               "suit","jumpsuit","top","jeans"]:
        if g in dl: attrs["garment_type"] = g; break
    for f in ["cotton","denim","leather","silk","wool","polyester",
               "chiffon","linen","knit","lace","velvet","satin","nylon"]:
        if f in dl: attrs["fabric"] = f; break
    return attrs

def _product_name(gender: str, category: str, attrs: dict) -> str:
    parts = []
    if gender in ("MEN", "WOMEN"):
        parts.append("Men's" if gender == "MEN" else "Women's")
    if "fabric"        in attrs: parts.append(attrs["fabric"].title())
    if "sleeve_length" in attrs: parts.append(attrs["sleeve_length"].title())
    if "garment_type"  in attrs:
        parts.append(attrs["garment_type"].title())
    elif category and category != "unknown":
        parts.append(category.replace("_", " ").title())
    return " ".join(parts) if parts else "Fashion Item"


# ── Colour histogram ──────────────────────────────────────────────────────────

def color_histogram(img_source, bins: int = HIST_BINS) -> np.ndarray:
    """Normalised RGB histogram vector. Source = file path or raw bytes."""
    if isinstance(img_source, (str, Path)):
        img = Image.open(img_source).convert("RGB").resize((64, 64))
    else:
        img = Image.open(io.BytesIO(img_source)).convert("RGB").resize((64, 64))
    arr = np.array(img, dtype=np.float32)
    hist = np.concatenate([
        np.histogram(arr[:, :, c], bins=bins, range=(0.0, 256.0))[0]
        for c in range(3)
    ]).astype(np.float32)
    norm = float(np.linalg.norm(hist))
    return hist / norm if norm > 0 else hist


def histogram_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two histogram vectors."""
    return float(np.dot(a, b))


# ── Catalog loader ────────────────────────────────────────────────────────────

def load_catalog() -> list[dict]:
    """Read CSV and return all items as a list of dicts. Zero API calls."""
    if not LABELS_CSV.exists():
        logger.warning(f"Labels CSV not found: {LABELS_CSV} — catalog will be empty.")
        return []

    rows: dict[str, dict] = {}
    with LABELS_CSV.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            iid = row.get("image_id", "").strip()
            if iid:
                rows[iid] = row

    images_path = Path(IMAGES_DIR)
    catalog = []
    for img in sorted(images_path.glob("*.jpg")):
        row    = rows.get(img.stem, {})
        gender = (row.get("gender", "") or "").strip().upper() or "unknown"
        cat    = (row.get("product_type", "") or "").strip() or "unknown"
        desc   = (row.get("caption", "") or "").strip()
        attrs  = _extract_attrs(desc)
        csv_product_id = (row.get("product_id", "") or "").strip() or img.stem
        catalog.append({
            "product_id":     csv_product_id,
            "image_id":       img.stem,
            "product_name":   _product_name(gender, cat, attrs),
            "description":    desc,
            "gender":         gender,
            "category":       cat,
            "price":          _price(cat),
            "image_url":      f"/images/{img.name}",
            "image_path":     str(img),
        })

    logger.info(f"Loaded {len(catalog)} items from catalog.")
    return catalog


# ── Journal loader ────────────────────────────────────────────────────────────

def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Parse simple YAML-style frontmatter from a markdown file."""
    if not text.startswith("---"):
        return {}, text
    lines = text.split("\n")
    try:
        end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
    except StopIteration:
        return {}, text
    meta: dict = {}
    for line in lines[1:end]:
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        val = val.strip().strip('"').strip("'")
        if val.startswith("[") and val.endswith("]"):
            val = [v.strip().strip('"').strip("'") for v in val[1:-1].split(",") if v.strip()]
        elif val.lower() == "true":
            val = True
        elif val.lower() == "false":
            val = False
        meta[key.strip()] = val
    body = "\n".join(lines[end + 1:]).strip()
    return meta, body


def load_journal() -> list[dict]:
    """Load all .md files from JOURNAL_DIR. Returns list sorted by date desc."""
    if not JOURNAL_DIR.exists():
        logger.warning(f"Journal directory not found: {JOURNAL_DIR}")
        return []
    posts = []
    for md_file in sorted(JOURNAL_DIR.glob("*.md")):
        try:
            text = md_file.read_text(encoding="utf-8")
            meta, body = _parse_frontmatter(text)
            posts.append({
                "slug":      md_file.stem,
                "title":     meta.get("title", md_file.stem),
                "excerpt":   meta.get("excerpt", ""),
                "author":    meta.get("author", "Secundus Dermis"),
                "date":      meta.get("date", ""),
                "category":  meta.get("category", ""),
                "tags":      meta.get("tags", []),
                "featured":  meta.get("featured", False),
                "image":     meta.get("image", ""),
                "read_time": meta.get("read_time", ""),
                "body":      body,
            })
        except Exception as exc:
            logger.warning(f"Failed to load journal entry {md_file}: {exc}")
    posts.sort(key=lambda p: p["date"], reverse=True)
    logger.info(f"Loaded {len(posts)} journal entries from {JOURNAL_DIR}")
    return posts


# ── Global state ──────────────────────────────────────────────────────────────

class _State:
    gemini: genai.Client | None = None
    catalog: list[dict] = []
    journal: list[dict] = []
    runner: Runner | None = None
    session_service: InMemorySessionService | None = None
    histogram_cache: dict[str, np.ndarray] = {}   # product_id → histogram (lazy)

state = _State()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")

    logger.info("Initialising Gemini client …")
    state.gemini = genai.Client(api_key=GEMINI_API_KEY)

    logger.info("Checking dataset …")
    download_and_extract()

    logger.info("Loading catalog from CSV …")
    state.catalog = load_catalog()

    logger.info("Loading journal entries …")
    state.journal = load_journal()

    logger.info("Initialising agent tools …")
    agent_tools.init_tools(catalog=state.catalog, journal=state.journal, gemini_client=state.gemini)

    logger.info(f"Creating ADK agent (model={AGENT_MODEL}) …")
    agent = create_agent(model=AGENT_MODEL)
    state.session_service = InMemorySessionService()
    state.runner = Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=state.session_service,
    )
    logger.info(f"Ready. {len(state.catalog)} products in catalog.")

    yield

    logger.info("Shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="SecundusDermis",
    description="AI Fashion Agent — keyword search, VLM image search, conversational agent",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if Path(IMAGES_DIR).exists():
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="product_images")


# ── Request / Response models ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    session_id: str = "default"
    auth_session_id: Optional[str] = None   # auth session for patron profile lookup

class ShopFilter(BaseModel):
    gender: Optional[str] = None
    category: Optional[str] = None
    query: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    products: list[dict] = []
    intent: str
    filter: Optional[ShopFilter] = None

class TextSearchRequest(BaseModel):
    query: str
    n_results: int = 8
    gender: Optional[str] = None
    category: Optional[str] = None
    max_price: Optional[float] = None

class ProductResult(BaseModel):
    product_id: str
    product_name: str
    description: str
    gender: str
    category: str
    price: float
    similarity: float
    image_url: str

class SearchResponse(BaseModel):
    results: list[ProductResult]
    query: str
    total: int


# ── In-memory keyword search ──────────────────────────────────────────────────

def keyword_search(
    keywords: str,
    gender: Optional[str] = None,
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    n_results: int = 16,
) -> list[dict]:
    kw = keywords.lower().strip()
    results = []
    for item in state.catalog:
        if kw and kw not in item["description"].lower():
            continue
        if gender and item["gender"] != gender.upper():
            continue
        if category and item["category"] != category:
            continue
        if max_price is not None and item["price"] > max_price:
            continue
        results.append(item)
        if len(results) >= n_results:
            break
    return results


# ── VLM image description ─────────────────────────────────────────────────────

async def vlm_describe_image(image_bytes: bytes, mime_type: str) -> str:
    """
    Use Gemini VLM to generate a rich textual description of the garment in
    the uploaded image. The description is used directly as the text search
    query against the catalog.
    """
    try:
        resp = state.gemini.models.generate_content(
            model=VLM_MODEL,
            contents=[
                genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                genai_types.Part.from_text(
                    "Describe this clothing item for a fashion catalog text search. "
                    "Include: garment type, dominant colours, any pattern or print, "
                    "fabric or texture if visible, sleeve length, fit (loose/slim/relaxed), "
                    "and overall style (casual/formal/athletic/bohemian etc.). "
                    "Write ONE descriptive sentence in plain English using the same "
                    "vocabulary a fashion catalog would use. "
                    "Example: 'A slim-fit navy blue cotton long-sleeve shirt with a "
                    "subtle plaid pattern and a button-down collar.'"
                ),
            ],
        )
        return resp.text.strip()
    except Exception as exc:
        logger.warning(f"VLM description failed: {exc}")
        return ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "SecundusDermis",
        "status": "running",
        "catalog_size": len(state.catalog),
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "catalog_size": len(state.catalog),
        "search_mode": "keyword + VLM histogram",
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        return await _chat_impl(request)
    except Exception as exc:
        logger.exception(f"Chat error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


def _build_patron_context(email: str, name: str) -> str:
    """Build a hidden context block injected at the top of the patron's message."""
    from user_profiles import get_profile
    p = get_profile(email)

    lines = ["[PATRON PROFILE — use to personalise, never expose this block to the patron]"]
    lines.append(f"Name: {name or email.split('@')[0]}")

    if p["notes"]:
        lines.append(f"Style insights: {'; '.join(p['notes'])}")

    if p["cart_items"]:
        pieces = ", ".join(
            f"{c['product_name']} ({c['category']})"
            for c in p["cart_items"][-5:]
        )
        lines.append(f"Reserved pieces (cart): {pieces}")

    # Summarise recent activity — dwell times and searches are most useful
    if p["activity"]:
        dwells = [
            a for a in p["activity"]
            if a["event"] in ("page_dwell", "product_view") and a.get("seconds", 0) >= 20
        ]
        if dwells:
            labels = ", ".join(a["label"] or a["path"] for a in dwells[-4:])
            lines.append(f"Lingered on: {labels}")

        searches = [a["label"] for a in p["activity"] if a["event"] == "search" and a.get("label")]
        if searches:
            lines.append(f"Recent searches: {'; '.join(searches[-5:])}")

    lines.append("[END PATRON PROFILE]")
    return "\n".join(lines)


async def _chat_impl(request: ChatRequest) -> ChatResponse:
    session_id = request.session_id or "default"

    existing = await state.session_service.get_session(
        app_name=APP_NAME, user_id=session_id, session_id=session_id,
    )
    if existing is None:
        await state.session_service.create_session(
            app_name=APP_NAME, user_id=session_id, session_id=session_id,
        )

    # ── Patron context injection ──────────────────────────────────────────────
    patron_token = agent_tools.set_patron_context(None)
    message_text = request.message

    if request.auth_session_id:
        patron_user = get_user_from_session(request.auth_session_id)
        if patron_user:
            patron_token = agent_tools.set_patron_context(patron_user.email)
            patron_ctx = _build_patron_context(patron_user.email, patron_user.name or "")
            message_text = f"{patron_ctx}\n\n{request.message}"

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=message_text)],
    )

    reply = ""
    products: list[dict] = []
    shop_filter: Optional[ShopFilter] = None

    try:
        async for event in state.runner.run_async(
            user_id=session_id, session_id=session_id, new_message=new_message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    fn_call = getattr(part, "function_call", None)
                    fn_resp = getattr(part, "function_response", None)
                    if fn_call:
                        logger.info(f"[AGENT] tool call: {fn_call.name}({fn_call.args})")
                        if getattr(fn_call, "name", None) == "search_by_keywords":
                            args = fn_call.args or {}
                            shop_filter = ShopFilter(
                                gender=args.get("gender") or None,
                                category=args.get("category") or None,
                                query=args.get("keywords") or None,
                            )
                    if fn_resp:
                        logger.info(f"[AGENT] tool response: {fn_resp.name} → {str(fn_resp.response)[:200]}")
                        if getattr(fn_resp, "name", None) == "search_by_keywords":
                            prods = (fn_resp.response or {}).get("products", [])
                            if prods:
                                products = prods

            if event.is_final_response():
                if event.content and event.content.parts:
                    reply = event.content.parts[0].text or ""
                    logger.info(f"[AGENT] final reply (tool used: {bool(products)}): {reply[:120]}")
    finally:
        agent_tools._patron_email_ctx.reset(patron_token)

    intent = "text_search" if products else "chitchat"
    return ChatResponse(reply=reply, products=products, intent=intent, filter=shop_filter)


@app.post("/search/text", response_model=SearchResponse)
async def search_text(request: TextSearchRequest):
    results = keyword_search(
        keywords=request.query,
        gender=request.gender,
        category=request.category,
        max_price=request.max_price,
        n_results=request.n_results,
    )
    return SearchResponse(
        results=[ProductResult(similarity=1.0, **{k: v for k, v in r.items() if k != "image_path"})
                 for r in results],
        query=request.query,
        total=len(results),
    )


_STOP_WORDS = {
    "a", "an", "the", "with", "and", "or", "of", "in", "on", "for",
    "is", "are", "has", "its", "that", "this", "it", "at", "by",
}


def _text_score_candidates(
    description: str,
    gender: Optional[str],
    category: Optional[str],
    pool_size: int,
) -> list[dict]:
    """
    Score every catalog item by how many terms from `description` appear in
    its text fields. Returns items sorted by match count descending.
    """
    raw_terms = re.split(r"[\s,.\-/()]+", description.lower())
    terms = [t for t in raw_terms if len(t) > 2 and t not in _STOP_WORDS]

    if not terms:
        # No meaningful terms — return a broad filter slice
        return keyword_search("", gender=gender, category=category, n_results=pool_size)

    scored: dict[str, tuple[int, dict]] = {}
    for item in state.catalog:
        if gender and item["gender"] != gender.upper():
            continue
        if category and item["category"] != category:
            continue
        searchable = (
            item.get("description", "").lower()
            + " "
            + item.get("product_name", "").lower()
        )
        match_count = sum(1 for t in terms if t in searchable)
        if match_count > 0:
            pid = item["product_id"]
            if pid not in scored or match_count > scored[pid][0]:
                scored[pid] = (match_count, item)

    sorted_items = sorted(scored.values(), key=lambda x: x[0], reverse=True)
    return [item for _, item in sorted_items[:pool_size]]


@app.post("/search/image", response_model=SearchResponse)
async def search_image(
    file: UploadFile = File(...),
    n_results: int = 8,
    gender: Optional[str] = None,
    category: Optional[str] = None,
):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="File must be JPEG, PNG, or WebP")

    image_bytes = await file.read()

    # ── Step 1: VLM → rich textual description ────────────────────────────────
    vlm_description = await vlm_describe_image(image_bytes, mime_type=file.content_type)
    logger.info(f"VLM description for {file.filename!r}: {vlm_description!r}")

    # ── Step 2: Text search — score catalog by VLM description term matches ───
    # Generous pool so the histogram re-ranker has enough to work with.
    pool_size = max(n_results * 6, 48)
    candidates = _text_score_candidates(vlm_description, gender, category, pool_size)

    # Fallback: if VLM produced nothing useful, use broad gender/category slice
    if not candidates:
        candidates = keyword_search("", gender=gender, category=category, n_results=pool_size)

    # ── Step 3: Histogram re-ranking — applied only on text search candidates ─
    # The histogram never runs independently; it only re-sorts an existing set.
    query_hist = color_histogram(image_bytes)
    re_scored: list[tuple[float, dict]] = []
    for item in candidates:
        pid = item["product_id"]
        try:
            if pid not in state.histogram_cache:
                state.histogram_cache[pid] = color_histogram(item["image_path"])
            hist_sim = histogram_similarity(query_hist, state.histogram_cache[pid])
        except Exception:
            hist_sim = 0.0
        re_scored.append((hist_sim, item))

    re_scored.sort(key=lambda x: x[0], reverse=True)

    results = [
        ProductResult(
            similarity=round(sim, 4),
            **{k: v for k, v in item.items() if k != "image_path"},
        )
        for sim, item in re_scored[:n_results]
    ]
    return SearchResponse(
        results=results,
        query=f"[image] {vlm_description[:120]}",
        total=len(results),
    )


@app.get("/catalog/product/{product_id}")
async def catalog_product(product_id: str):
    """Return a single product by ID directly from the in-memory catalog."""
    item = next((p for p in state.catalog if p["product_id"] == product_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return {k: v for k, v in item.items() if k != "image_path"}


@app.get("/catalog/stats")
async def catalog_stats():
    cats, genders = set(), set()
    for item in state.catalog:
        cats.add(item["category"])
        genders.add(item["gender"])
    return {
        "total_products": len(state.catalog),
        "categories":     sorted(cats),
        "genders":        sorted(genders),
    }


@app.get("/catalog/browse")
async def catalog_browse(
    offset: int = 0,
    limit: int = 24,
    gender: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
):
    limit = min(max(1, limit), 48)
    q_lower = q.lower().strip() if q else ""
    filtered = [
        item for item in state.catalog
        if (not gender   or item["gender"]   == gender.upper())
        and (not category or item["category"] == category)
        and (not q_lower or q_lower in item.get("product_name", "").lower()
                         or q_lower in item.get("description", "").lower())
    ]
    page = filtered[offset : offset + limit]
    return {
        "products": [{k: v for k, v in p.items() if k != "image_path"} for p in page],
        "offset":   offset,
        "limit":    limit,
        "total":    len(filtered),
    }


@app.get("/catalog/random")
async def catalog_random(n: int = 12):
    sample = random.sample(state.catalog, min(n, len(state.catalog)))
    return {"products": [{k: v for k, v in p.items() if k != "image_path"} for p in sample]}


@app.get("/journal")
async def journal_list(category: Optional[str] = None, featured: Optional[bool] = None):
    """List all journal entries (without body). Optionally filter by category or featured."""
    posts = state.journal
    if category:
        posts = [p for p in posts if p["category"] == category]
    if featured is not None:
        posts = [p for p in posts if p["featured"] == featured]
    return {"posts": [{k: v for k, v in p.items() if k != "body"} for p in posts], "total": len(posts)}


@app.get("/journal/categories")
async def journal_categories():
    """Return all unique categories in the journal."""
    cats = sorted({p["category"] for p in state.journal if p["category"]})
    return {"categories": cats}


@app.get("/journal/{slug}")
async def journal_post(slug: str):
    """Return a single journal entry including its markdown body."""
    post = next((p for p in state.journal if p["slug"] == slug), None)
    if post is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return post


class NewJournalPost(BaseModel):
    title: str
    excerpt: str
    author: str
    date: str          # YYYY-MM-DD
    read_time: str
    category: str
    tags: list[str] = []
    featured: bool = False
    image: str = ""
    body: str


@app.post("/journal", status_code=201)
async def journal_create(
    post: NewJournalPost,
    x_admin_key: Optional[str] = Header(default=None),
    session_id: Optional[str] = Header(default=None),
):
    """Create a new journal entry. Requires admin key OR authenticated user session."""
    # Check auth: either valid admin_key OR logged-in user
    admin_key = os.getenv("ADMIN_KEY", "change-me-before-deploy")
    is_admin = x_admin_key == admin_key
    is_authenticated = session_id and get_user_from_session(session_id) is not None
    
    if not is_admin and not is_authenticated:
        raise HTTPException(status_code=401, detail="Admin key or valid session required")

    # Build slug from title
    slug = re.sub(r"[^a-z0-9]+", "-", post.title.lower()).strip("-")
    filename = JOURNAL_DIR / f"{slug}.md"
    if filename.exists():
        raise HTTPException(status_code=409, detail=f"Slug already exists: {slug}")

    # Use logged-in user's name as author if not provided
    author = post.author
    if is_authenticated and not author:
        user = get_user_from_session(session_id)
        if user:
            author = user.name or user.email

    tags_str = ", ".join(f'"{t}"' for t in post.tags) if post.tags else ""
    frontmatter = f"""---
title: "{post.title}"
excerpt: "{post.excerpt}"
author: "{author or 'Secundus Dermis'}"
date: "{post.date}"
read_time: "{post.read_time}"
category: "{post.category}"
tags: [{tags_str}]
featured: {str(post.featured).lower()}
image: "{post.image}"
---

{post.body}
"""
    filename.write_text(frontmatter, encoding="utf-8")
    # Reload journal in memory
    state.journal = load_journal()
    agent_tools.init_tools(state.catalog, journal=state.journal)
    logger.info(f"Created journal entry: {slug}")
    return {"slug": slug, "message": "Created"}


# ── Authentication Endpoints ─────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(user: UserCreate):
    """Register a new user."""
    result = create_user(email=user.email, password=user.password, name=user.name)
    if result is None:
        raise HTTPException(status_code=400, detail="Email already registered")
    return result


@app.post("/auth/login", response_model=LoginResponse)
async def login(user: UserLogin):
    """Login and get session."""
    session_id = authenticate_user(email=user.email, password=user.password)
    if session_id is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_resp = get_user_from_session(session_id)
    return LoginResponse(session_id=session_id, user=user_resp)


@app.post("/auth/logout")
async def logout_endpoint(session_id: str = Header(default=None)):
    """Logout and invalidate session."""
    if session_id:
        logout(session_id)
    return {"status": "logged out"}


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user(session_id: str = Header(default=None)):
    """Get current user from session."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user


# ── Cart Endpoints ───────────────────────────────────────────────────────────

@app.get("/cart", response_model=CartResponse)
async def get_user_cart(session_id: str = Header(default=None)):
    """Get user's cart."""
    if not session_id:
        return CartResponse(items=[], total=0.0)
    return get_cart(session_id)


@app.post("/cart", response_model=CartResponse)
async def add_item_to_cart(
    product_id: str,
    product_name: str,
    price: float,
    image_url: str,
    quantity: int = 1,
    session_id: str = Header(default=None),
):
    """Add item to cart. Also records the piece in the patron's profile."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")

    result = add_to_cart(session_id, product_id, product_name, price, image_url, quantity)

    # Record in patron profile so AI knows what they reserved
    user = get_user_from_session(session_id)
    if user:
        # Look up description and category from catalog
        item = next((p for p in state.catalog if p["product_id"] == product_id), None)
        description = item.get("description", "") if item else ""
        category = item.get("category", "") if item else ""
        profile_add_cart(user.email, product_id, product_name, description, category)
        profile_record_activity(user.email, "cart_add", f"/product/{product_id}", product_name)

    return result


class CartUpdateRequest(BaseModel):
    quantity: int


@app.put("/cart/{product_id}", response_model=CartResponse)
async def update_cart_item_endpoint(
    product_id: str,
    update: CartUpdateRequest,
    session_id: str = Header(default=None),
):
    """Update cart item quantity."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    return update_cart_item(session_id, product_id, update.quantity)


@app.delete("/cart/{product_id}", response_model=CartResponse)
async def remove_cart_item_endpoint(
    product_id: str,
    session_id: str = Header(default=None),
):
    """Remove item from cart."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if user:
        profile_record_activity(user.email, "cart_remove", f"/product/{product_id}", product_id)
    return remove_from_cart(session_id, product_id)


@app.delete("/cart", response_model=CartResponse)
async def clear_user_cart(session_id: str = Header(default=None)):
    """Clear entire cart."""
    if not session_id:
        return CartResponse(items=[], total=0.0)
    return clear_cart(session_id)


# ── Patron Activity Endpoint ─────────────────────────────────────────────────

class ActivityEvent(BaseModel):
    event: str          # "page_view" | "product_view" | "page_dwell" | "search"
    path: str = ""
    label: str = ""     # product name or search query
    seconds: int = 0


@app.post("/patron/activity", status_code=204)
async def record_patron_activity(
    body: ActivityEvent,
    session_id: str = Header(default=None),
):
    """Record a browser activity event for the authenticated patron."""
    if not session_id:
        return
    user = get_user_from_session(session_id)
    if user:
        profile_record_activity(user.email, body.event, body.path, body.label, body.seconds)


# ── Conversation History Endpoints ───────────────────────────────────────────

class ConvoMessage(BaseModel):
    role: str       # 'user' | 'assistant'
    content: str
    timestamp: float


@app.get("/conversations")
async def get_conversation(session_id: str = Header(default=None)):
    """Return stored conversation messages for the authenticated user."""
    if not session_id or not get_user_from_session(session_id):
        raise HTTPException(status_code=401, detail="Auth required")
    return {"messages": get_messages(session_id)}


@app.post("/conversations", status_code=201)
async def post_conversation_message(
    msg: ConvoMessage,
    session_id: str = Header(default=None),
):
    """Append a single message to the authenticated user's conversation history."""
    if not session_id or not get_user_from_session(session_id):
        raise HTTPException(status_code=401, detail="Auth required")
    messages = append_message(session_id, msg.role, msg.content, msg.timestamp)
    return {"messages": messages}


@app.delete("/conversations")
async def delete_conversation(session_id: str = Header(default=None)):
    """Clear all conversation history for the authenticated user."""
    if not session_id or not get_user_from_session(session_id):
        raise HTTPException(status_code=401, detail="Auth required")
    clear_convo(session_id)
    return {"messages": []}


# ── Serve React SPA (when running as single container) ────────────────────────
_FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", "./static"))

if _FRONTEND_DIR.exists():
    _assets = _FRONTEND_DIR / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=_assets), name="spa_assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(_FRONTEND_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)
