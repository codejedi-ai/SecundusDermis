"""
SecundusDermis — AI Fashion Agent API
=====================================
Catalog, auth, Socket.IO, and HTTP proxy to the **standalone agent** for all Gemini usage.
The API process does not load ``google.genai``; set ``AGENT_SERVICE_URL`` + ``AGENT_INTERNAL_SECRET``.
"""

from pathlib import Path

from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir.parent.parent / ".env")
load_dotenv(_backend_dir.parent / ".env", override=False)
load_dotenv(_backend_dir / ".env", override=True)

import sys

_agent_dir = (_backend_dir.parent / "agent").resolve()
_backend_s = str(_backend_dir)
_agent_s = str(_agent_dir)
# Backend must precede ``app/agent`` on ``sys.path`` so ``import config`` resolves to
# ``app/backend/config.py``. (``app/agent/config/`` is a package named ``config``.)
# Inserting agent then backend only works if backend was not already on sys.path; when
# ``python api.py`` runs from ``app/backend``, the script dir is already [0], so the second
# insert is skipped and agent incorrectly wins — remove both, then prepend backend then agent.
for _p in (_backend_s, _agent_s):
    try:
        while _p in sys.path:
            sys.path.remove(_p)
    except ValueError:
        pass
sys.path.insert(0, _agent_s)
sys.path.insert(0, _backend_s)

import asyncio
import csv
import hashlib
import io
import json
import logging
import os
import random
import re
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

import base64
import httpx
import numpy as np
import socketio
from fastapi import APIRouter, Cookie, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel, Field

import config
from auth import (
    UserCreate, UserLogin, UserResponse, MeResponse, LoginResponse, PasswordReset,
    RegisterResponse, VerifyEmailRequest, ProfileUpdate,
    create_user, try_authenticate, get_user_from_session, logout,
    create_reset_token, verify_reset_token, reset_password,
    verify_email_token, resend_verification_token, get_user_by_email,
    update_user_profile,
    UsersStorageFullError,
)
from cart import CartItem, CartResponse, get_cart, add_to_cart, update_cart_item, remove_from_cart, clear_cart
from conversations import get_messages, append_message, clear_messages as clear_convo
from download_data import download_and_extract
from user_profiles import add_cart_item as profile_add_cart, record_activity as profile_record_activity
from vector_store import get_vector_store, ImageEmbedding, JournalEmbedding
from patron_shop_selection import get_selection as get_patron_shop_selection, put_selection as put_patron_shop_selection

from smtp_mail import (
    gmail_smtp_configured,
    try_send_password_reset_email,
    try_send_verification_email,
)

import agent_api_keys
import agent_invites
import house_agent_key
from agent_socket_bridge import (
    AGENT_SERVICE_ROOM,
    DEPLOYMENT_STATS_ROOM,
    count_room_participants,
    emit_to_agent_connections,
    forget_patron_agent_socket,
    replace_patron_agent_socket_exclusive,
)
from stylist_backend_bridge import InProcessStylistDeps
from shop_tools import (
    build_catalog_stats,
    keyword_search as shop_keyword_search,
    manage_sidebar as shop_manage_sidebar,
)

# Shown on GET /health and GET /catalog/stats (keep in sync).
SEARCH_MODE_LABEL = "keyword + agent LLM"

# ── Socket.IO server ───────────────────────────────────────────────────────────

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


# ── Configuration ─────────────────────────────────────────────────────────────

HIST_BINS = 32

# ── Journal Indexing ─────────────────────────────────────────────────────────

async def _wait_for_agent_http_ready(max_wait_s: float = 45.0, interval_s: float = 0.25) -> bool:
    """Poll agent ``GET /health`` so startup does not race a freshly spawned ``uvicorn``."""
    if state.agent_http is None:
        return False
    deadline = time.monotonic() + max_wait_s
    while time.monotonic() < deadline:
        try:
            resp = await state.agent_http.get("/health")
            if resp.status_code == 200:
                return True
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError, httpx.TimeoutException):
            pass
        except Exception:
            pass
        await asyncio.sleep(interval_s)
    return False


async def index_journal_async():
    """Embed all journal entries and store in ChromaDB for RAG (embeddings from the agent service)."""
    posts = _load_journal()
    vs = get_vector_store()
    if state.agent_http is None:
        logger.warning("Skipping journal vector indexing (configure AGENT_SERVICE_URL + agent process).")
        return
    if not await _wait_for_agent_http_ready():
        logger.warning(
            "Agent not reachable at %s within startup wait — skipping journal vector indexing.",
            config.AGENT_SERVICE_URL,
        )
        return
    logger.info(f"Indexing {len(posts)} journal entries for RAG via agent …")
    from agent_ai_client import embed_document

    for post in posts:
        slug = post.get("slug")
        text_to_embed = f"{post.get('title')}\n{post.get('excerpt')}\n{post.get('body')[:1000]}"
        try:
            embedding = await embed_document(state.agent_http, text_to_embed)
            vs.add_journal_embedding(
                JournalEmbedding(
                    slug=slug,
                    embedding=embedding,
                    title=post.get("title", ""),
                    excerpt=post.get("excerpt", ""),
                    category=post.get("category", ""),
                    tags=post.get("tags", []),
                    date=post.get("date", ""),
                )
            )
        except Exception as e:
            logger.error(f"Failed to index journal {slug}: {e}")

# ── Body-section search config ────────────────────────────────────────────────

BODY_SECTIONS = [
    {
        "id": "torso",
        "label": "Torso — The Centerpiece",
        "description": "Tops, shirts, and upper-body pieces",
        "men_categories": ["Shirts_Polos", "Tees_Tanks", "Sweaters", "Sweatshirts_Hoodies"],
        "women_categories": ["Blouses_Shirts", "Tees_Tanks", "Cardigans", "Graphic_Tees"],
        "regex_pattern": r"shirt|blouse|top|tee|sweater|polo|button.down|knit",
    },
    {
        "id": "outerwear",
        "label": "Outerwear — The Statement Layer",
        "description": "Jackets, coats, and statement outer layers",
        "men_categories": ["Jackets_Vests", "Suiting"],
        "women_categories": ["Jackets_Coats"],
        "regex_pattern": r"jacket|coat|blazer|vest|suit|outerwear",
    },
    {
        "id": "legs",
        "label": "Legs — The Foundation",
        "description": "Trousers, denim, and lower-body pieces",
        "men_categories": ["Pants", "Denim", "Shorts"],
        "women_categories": ["Pants", "Denim", "Shorts", "Skirts", "Leggings"],
        "regex_pattern": r"pants|trousers|jeans|denim|shorts|skirt|chino|leggings",
    },
    {
        "id": "full_body",
        "label": "Full-Body Silhouette",
        "description": "Complete ensembles and dresses",
        "men_categories": [],
        "women_categories": ["Dresses", "Rompers_Jumpsuits"],
        "regex_pattern": r"dress|jumpsuit|romper|gown|maxi|midi",
    },
    {
        "id": "footwear",
        "label": "Footwear — The Anchor",
        "description": "Shoes, boots, and footwear",
        "men_categories": [],
        "women_categories": [],
        "regex_pattern": r"shoe|boot|sneaker|loafer|sandal|heel|flat|oxford|pump",
    },
    {
        "id": "accessories",
        "label": "Accessories — The Finishing Touch",
        "description": "Belts, bags, and finishing details",
        "men_categories": [],
        "women_categories": [],
        "regex_pattern": r"belt|scarf|hat|bag|watch|ring|jewel|necklace|accessory",
    },
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Price table ───────────────────────────────────────────────────────────────

_PRICE_RANGES = {
    "Denim": (39.99, 89.99), "Jackets_Vests": (59.99, 199.99), "Pants": (29.99, 79.99),
    "Shorts": (19.99, 49.99), "Skirts": (24.99, 69.99), "Shirts_Polos": (19.99, 59.99),
    "Tees_Tanks": (14.99, 39.99), "Sweaters": (34.99, 99.99), "Sweatshirts_Hoodies": (29.99, 79.99),
    "Dresses": (34.99, 129.99), "Suiting": (79.99, 299.99), "Blouses_Shirts": (24.99, 69.99),
    "Cardigans": (34.99, 89.99), "Rompers_Jumpsuits": (39.99, 99.99), "Graphic_Tees": (14.99, 34.99),
}

def _price(category: str) -> float:
    lo, hi = _PRICE_RANGES.get(category, (19.99, 79.99))
    return round(random.uniform(lo, hi), 2)

def _extract_attrs(desc: str) -> dict:
    dl = desc.lower()
    attrs = {}
    for s in ["short-sleeve", "long-sleeve", "sleeveless"]:
        if s in dl: attrs["sleeve_length"] = s; break
    for g in ["shirt","t-shirt","dress","jacket","coat","sweater","blouse","pants","trousers","shorts","skirt","vest","hoodie","cardigan","suit","jumpsuit","top","jeans"]:
        if g in dl: attrs["garment_type"] = g; break
    for f in ["cotton","denim","leather","silk","wool","polyester","chiffon","linen","knit","lace","velvet","satin","nylon"]:
        if f in dl: attrs["fabric"] = f; break
    return attrs

def _product_name(gender: str, category: str, attrs: dict) -> str:
    parts = []
    if gender in ("MEN", "WOMEN"): parts.append("Men's" if gender == "MEN" else "Women's")
    if "fabric" in attrs: parts.append(attrs["fabric"].title())
    if "sleeve_length" in attrs: parts.append(attrs["sleeve_length"].title())
    if "garment_type" in attrs: parts.append(attrs["garment_type"].title())
    elif category and category != "unknown": parts.append(category.replace("_", " ").title())
    return " ".join(parts) if parts else "Fashion Item"

# ── Colour histogram ──────────────────────────────────────────────────────────

def color_histogram(img_source, bins: int = HIST_BINS) -> np.ndarray:
    if isinstance(img_source, (str, Path)):
        img = Image.open(img_source).convert("RGB").resize((64, 64))
    else:
        img = Image.open(io.BytesIO(img_source)).convert("RGB").resize((64, 64))
    arr = np.array(img, dtype=np.float32)
    hist = np.concatenate([np.histogram(arr[:, :, c], bins=bins, range=(0.0, 256.0))[0] for c in range(3)]).astype(np.float32)
    norm = float(np.linalg.norm(hist))
    return hist / norm if norm > 0 else hist

def histogram_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))

# ── Catalog loader ────────────────────────────────────────────────────────────

def load_catalog() -> list[dict]:
    logger.info(f"Loading catalog from: {config.LABELS_CSV.absolute()}")
    if not config.LABELS_CSV.exists():
        logger.warning(f"Labels CSV not found at: {config.LABELS_CSV.absolute()}")
        return []
    
    rows = {}
    with config.LABELS_CSV.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            iid = row.get("image_id", "").strip()
            if iid: rows[iid] = row
            
    images_path = Path(config.IMAGES_DIR)
    logger.info(f"Scanning images in: {images_path.absolute()}")
    
    catalog = []
    for img in sorted(images_path.glob("*.jpg")):
        row = rows.get(img.stem, {})
        gender = (row.get("gender", "") or "").strip().upper() or "unknown"
        cat = (row.get("product_type", "") or "").strip() or "unknown"
        desc = (row.get("caption", "") or "").strip()
        attrs = _extract_attrs(desc)
        catalog.append({
            "product_id": img.stem, "image_id": img.stem,
            "product_name": _product_name(gender, cat, attrs), "description": desc,
            "gender": gender, "category": cat, "price": _price(cat),
            "image_url": f"/images/{img.name}", "image_path": str(img),
        })
    logger.info(f"Loaded {len(catalog)} items from catalog.")
    return catalog

def load_prompts() -> dict:
    """Load system prompts from the centralized JSON file."""
    if not config.PROMPTS_FILE.exists():
        logger.warning(f"Prompts file not found at {config.PROMPTS_FILE}. Using empty defaults.")
        return {}
    try:
        with open(config.PROMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load prompts: {e}")
        return {}

# ── Global state ──────────────────────────────────────────────────────────────

class _State:
    agent_http: httpx.AsyncClient | None = None
    catalog: list[dict] = []
    histogram_cache: dict[str, np.ndarray] = {}
    prompts: dict = {}

state = _State()

@asynccontextmanager
async def lifespan(app: FastAPI):
    state.agent_http = None
    if config.AGENT_SERVICE_URL and config.AGENT_INTERNAL_SECRET:
        state.agent_http = httpx.AsyncClient(
            base_url=config.AGENT_SERVICE_URL.rstrip("/"),
            headers={"X-Agent-Secret": config.AGENT_INTERNAL_SECRET},
            timeout=httpx.Timeout(600.0, read=600.0),
        )
        logger.info("AI agent HTTP client → %s", config.AGENT_SERVICE_URL)
    else:
        logger.warning(
            "AGENT_SERVICE_URL and AGENT_INTERNAL_SECRET should both be set — "
            "chat, RAG embeddings, and journal indexing require the standalone agent (Gemini is not loaded in the API process).",
        )

    logger.info("Checking dataset …")
    download_and_extract()
    logger.info("Loading catalog …")
    state.catalog = load_catalog()
    logger.info("Loading system prompts …")
    state.prompts = load_prompts()
    logger.info("Initialising vector store …")
    get_vector_store()
    logger.info("Indexing journal for RAG …")
    await index_journal_async()
    try:
        from atelier_tools.tools import init_tools as _init_atelier_tools

        _init_atelier_tools(state.catalog, _load_journal(), None)
        logger.info("Atelier toolkit initialised (catalog + journal; describe_image disabled without local Gemini).")
    except Exception as _atelier_exc:
        logger.warning("Atelier toolkit init skipped: %s", _atelier_exc)
    logger.info(f"Ready. {len(state.catalog)} products. LLM/embeddings use agent service when configured.")
    yield
    if state.agent_http is not None:
        await state.agent_http.aclose()
        state.agent_http = None
    logger.info("Shutting down.")

# Ensure static directories exist so mounting doesn't fail
config.init_directories()

app = FastAPI(title="SecundusDermis", version="5.0.0", lifespan=lifespan)
if config.CORS_ENABLED:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_allow_origins(),
        allow_origin_regex=config.CORS_ALLOW_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    logging.getLogger(__name__).info(
        "HTTP CORS disabled (CORS_ENABLED=false); browser traffic should use same-origin "
        "paths (e.g. Vite proxy /api and /socket.io → FastAPI)."
    )

# Patron-facing JSON routes live under ``PUBLIC_HTTP_API_PREFIX`` (``/api/...``) — no path stripping.
api_router = APIRouter(prefix=config.PUBLIC_HTTP_API_PREFIX)


def _browser_session_id(
    session_header: Optional[str] = Header(default=None, alias="session-id"),
    cookie_sid: Optional[str] = Cookie(default=None, alias="sd_session_id"),
) -> Optional[str]:
    """Patron browser auth: ``session-id`` header (SPA) or HttpOnly ``sd_session_id`` cookie (login)."""
    h = (session_header or "").strip()
    c = (cookie_sid or "").strip()
    return h or c or None


def _attach_session_cookie(response: JSONResponse, session_id: str) -> None:
    """
    HttpOnly session cookie. SameSite/Secure can be tuned for split-origin deployments
    (``SESSION_COOKIE_SAMESITE``, ``SESSION_COOKIE_SECURE`` in the backend env).
    """
    raw = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower()
    if raw not in ("lax", "strict", "none"):
        raw = "lax"
    secure = os.getenv("SESSION_COOKIE_SECURE", "").strip().lower() in ("1", "true", "yes")
    if raw == "none":
        secure = True
    kwargs: dict[str, Any] = {
        "key": "sd_session_id",
        "value": session_id,
        "max_age": 30 * 24 * 60 * 60,
        "httponly": True,
        "samesite": raw,
        "path": "/",
    }
    if secure:
        kwargs["secure"] = True
    response.set_cookie(**kwargs)


# Mount static files unconditionally
app.mount("/images", StaticFiles(directory=str(config.IMAGES_DIR)), name="product_images")
app.mount("/uploads", StaticFiles(directory=str(config.UPLOADS_DIR)), name="uploads")
# Built SPA lives at ../dist/ (sibling of frontend/). FastAPI mounts app/dist when present.
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
BACKEND_PUBLIC_DIR = Path(__file__).resolve().parent / "public"
if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="frontend_assets")

# ── Models ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ShopContext(BaseModel):
    gender: Optional[str] = None
    category: Optional[str] = None
    query: Optional[str] = None   # human's search bar text — read-only for the AI

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    session_id: str = "default"
    auth_session_id: Optional[str] = None
    image_id: Optional[str] = None
    shop_context: Optional[ShopContext] = None

class ShopFilter(BaseModel):
    gender: Optional[str] = None
    category: Optional[str] = None
    query: Optional[str] = None


class PatronShopSelectionUpdate(BaseModel):
    """Browser shop UI selection — persisted per authenticated session."""

    gender: Optional[str] = None
    category: Optional[str] = None
    query: Optional[str] = None
    input_value: Optional[str] = None
    sidebar_width: Optional[int] = None


class PatronActivityRecord(BaseModel):
    """Browser telemetry for logged-in patrons (MonitorProvider → ``user_profiles.activity``)."""

    event: str
    path: str = ""
    label: str = ""
    seconds: int = 0


class ChatResponse(BaseModel):
    reply: str
    products: list[dict] = []
    intent: str
    filter: Optional[ShopFilter] = None

class ConvoMessage(BaseModel):
    role: str
    content: str
    timestamp: float

async def dump_context_to_journal(session_id: str, email: str):
    """Summarize the current session history and save to journal as a catering diary entry."""
    messages = get_messages(session_id)
    if not messages:
        return

    if state.agent_http is None:
        logger.warning("[DIARY DUMP] Skipped: no agent HTTP client configured.")
        return

    logger.info(f"[DIARY DUMP] Summarizing journey for {email} ({len(messages)} messages)")

    history_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
    prompt = f"""You are the Secundus Dermis AI fashion guardian. 
You are writing a private "Catering Diary" entry about your interaction with patron {email}.
Summarize their style journey, what they were looking for, what they liked, and how you catered to them.
Write in an elegant, reflective, editorial voice.

Format your response as a JSON object:
{{
  "title": "A short elegant title",
  "excerpt": "A one-sentence summary",
  "body": "The full reflection in markdown (3-4 paragraphs)"
}}

Patron history:
{history_text}
"""
    try:
        from agent_ai_client import embed_document, generate_text

        raw = await generate_text(state.agent_http, prompt)
        data = json.loads(re.search(r"\{.*\}", raw, re.DOTALL).group())

        slug = f"journey-{int(time.time())}-{hashlib.md5(email.encode()).hexdigest()[:4]}"
        path = config.JOURNAL_DIR / f"{slug}.json"

        journal_entry = {
            "title": data.get("title", "A New Patron Discovery"),
            "excerpt": data.get("excerpt", "Reflecting on a recent styling session."),
            "author": "Secundus Dermis",
            "date": time.strftime("%Y-%m-%d"),
            "category": "Catering Diary",
            "tags": ["Reflection", "Patron Journey", "Personalization"],
            "featured": False,
            "image": "/image-hero.jpeg",
            "read_time": "3 min read",
            "body": data.get("body", ""),
            "slug": slug,
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(journal_entry, f, indent=2)

        try:
            vs = get_vector_store()
            text_to_embed = f"{journal_entry['title']}\n{journal_entry['excerpt']}\n{journal_entry['body'][:1000]}"
            embedding = await embed_document(state.agent_http, text_to_embed)
            vs.add_journal_embedding(
                JournalEmbedding(
                    slug=slug,
                    embedding=embedding,
                    title=journal_entry["title"],
                    excerpt=journal_entry["excerpt"],
                    category=journal_entry["category"],
                    tags=journal_entry["tags"],
                    date=journal_entry["date"],
                )
            )
        except Exception as idx_err:
            logger.error(f"[DIARY DUMP] Failed to index new entry: {idx_err}")

        logger.info(f"[DIARY DUMP] Saved and indexed journal entry: {slug}")
    except Exception as e:
        logger.error(f"[DIARY DUMP] Failed to summarize journey: {e}")

class ImageUploadResponse(BaseModel):
    image_id: str
    message: str

# ── Keyword search ────────────────────────────────────────────────────────────

_MEN_RE   = re.compile(r"\b(men'?s?|menswear|man|male|gentleman|for him)\b", re.I)
_WOMEN_RE = re.compile(r"\b(women'?s?|womenswear|woman|female|lady|ladies|for her)\b", re.I)

def _detect_gender(message: str) -> Optional[str]:
    if _WOMEN_RE.search(message):
        return "WOMEN"
    if _MEN_RE.search(message):
        return "MEN"
    return None


def regex_search_local(
    pattern: str,
    categories: list[str] = None,
    gender: Optional[str] = None,
    n_results: int = 8,
) -> list[dict]:
    """Search catalog using a compiled regex, optionally within specific categories."""
    try:
        regex = re.compile(pattern, re.IGNORECASE)
    except re.error:
        return []
    results = []
    seen = set()
    for item in state.catalog:
        pid = item["product_id"]
        if pid in seen:
            continue
        if gender and item.get("gender", "").upper() != gender.upper():
            continue
        if categories and item.get("category", "") not in categories:
            continue
        searchable = f"{item.get('description', '')} {item.get('product_name', '')}"
        if regex.search(searchable):
            results.append({k: v for k, v in item.items() if k != "image_path"})
            seen.add(pid)
            if len(results) >= n_results:
                break
    return results


def keyword_search(keywords: str, gender: Optional[str] = None, category: Optional[str] = None, n_results: int = 8) -> list[dict]:
    """Search catalog by keywords - matches ANY word from the query."""
    return shop_keyword_search(state.catalog, keywords, gender=gender, category=category, n_results=n_results)


def verify_agent_secret(x_agent_secret: Optional[str] = Header(default=None, alias="X-Agent-Secret")) -> None:
    if not config.AGENT_INTERNAL_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Agent internal API is not configured (AGENT_INTERNAL_SECRET).",
        )
    if (x_agent_secret or "").strip() != config.AGENT_INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid agent secret.")
    return None


class AgentKeywordSearchBody(BaseModel):
    keywords: str
    gender: Optional[str] = None
    category: Optional[str] = None
    n_results: int = 8


class AgentManageSidebarBody(BaseModel):
    shop_state: dict[str, Any]
    action: Optional[str] = None
    value: Optional[str] = None
    gender: Optional[str] = None
    category: Optional[str] = None


class AgentRagBody(BaseModel):
    message: str
    session_id: str = "default"
    image_base64: Optional[str] = None
    mime_type: str = "image/jpeg"


class AgentShowProductBody(BaseModel):
    product_id: str


class AgentEmitBody(BaseModel):
    session_id: str
    event: str
    data: dict[str, Any] = Field(default_factory=dict)


class AgentSocketBroadcastBody(BaseModel):
    """Push an arbitrary Socket.IO event to all trusted agent connections (duplex bridge)."""

    event: str = "sd_bridge"
    data: dict[str, Any] = Field(default_factory=dict)


class AgentApiKeyCreate(BaseModel):
    """Human-friendly label for an autonomous agent or tool using this key."""

    label: str = ""


class PatronAgentRegisterBody(BaseModel):
    """One-time ``sdreg_…`` code; agent picks a display name when binding."""

    registration_code: str = Field(..., min_length=1, max_length=512)
    agent_name: str = Field("", max_length=120)


class PatronAgentRegisterResponse(BaseModel):
    """Returned once when registration succeeds — store ``agent_api_key`` securely."""

    agent_api_key: str
    id: str
    label: str
    prefix: str
    created_at: float


class PatronAgentContextEntry(BaseModel):
    text: str
    source: str = "agent"


class PatronAgentContextAppend(BaseModel):
    entries: list[PatronAgentContextEntry] = Field(default_factory=list)


async def require_patron_agent_api_key(
    authorization: Optional[str] = Header(default=None),
    x_patron_agent_api_key: Optional[str] = Header(default=None, alias="X-Patron-Agent-Api-Key"),
) -> str:
    """Resolve patron email from ``Bearer sdag_…`` or ``X-Patron-Agent-Api-Key``."""
    raw = (x_patron_agent_api_key or "").strip()
    if not raw and authorization and authorization.lower().startswith("bearer "):
        raw = authorization[7:].strip()
    if not raw:
        raise HTTPException(
            status_code=401,
            detail="Patron agent API key required (Authorization: Bearer … or X-Patron-Agent-Api-Key).",
        )
    email = agent_api_keys.verify_token(raw)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or revoked patron agent API key.")
    return email


@app.post("/internal/agent/keyword-search")
async def internal_agent_keyword_search(
    body: AgentKeywordSearchBody,
    _authorized: None = Depends(verify_agent_secret),
):
    return {"products": keyword_search(body.keywords, body.gender, body.category, body.n_results)}


@app.post("/internal/agent/manage-sidebar")
async def internal_agent_manage_sidebar(
    body: AgentManageSidebarBody,
    _authorized: None = Depends(verify_agent_secret),
):
    shop = dict(body.shop_state)
    obs = shop_manage_sidebar(body.action, body.value, body.gender, body.category, shop_state=shop)
    return {"observation": obs, "shop_state": shop}


@app.post("/internal/agent/show-product")
async def internal_agent_show_product(
    body: AgentShowProductBody,
    _authorized: None = Depends(verify_agent_secret),
):
    item = next((p for p in state.catalog if p["product_id"] == body.product_id), None)
    if not item:
        return {"product": None}
    return {"product": {k: v for k, v in item.items() if k != "image_path"}}


@app.post("/internal/agent/rag-context")
async def internal_agent_rag_context(
    body: AgentRagBody,
    _authorized: None = Depends(verify_agent_secret),
):
    img_bytes = None
    if body.image_base64:
        try:
            img_bytes = base64.b64decode(body.image_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image_base64")
    deps = InProcessStylistDeps(sio, state, agent_http=state.agent_http)
    rag = await deps.build_initial_rag_context(body.message, img_bytes, body.mime_type, body.session_id)
    return {"rag_context": rag}


@app.post("/internal/agent/emit")
async def internal_agent_emit(
    body: AgentEmitBody,
    _authorized: None = Depends(verify_agent_secret),
):
    if not body.session_id or not body.event:
        raise HTTPException(status_code=400, detail="session_id and event required")
    room = f"sd_{body.session_id}"
    await sio.emit(body.event, body.data, room=room)
    return {"ok": True}


@app.post("/internal/agent/socket-to-agents")
async def internal_agent_socket_to_agents(
    body: AgentSocketBroadcastBody,
    _authorized: None = Depends(verify_agent_secret),
):
    """Emit to room ``sd_agent_service`` (every Socket.IO client authenticated as agent)."""
    ev = (body.event or "").strip() or "sd_bridge"
    await emit_to_agent_connections(sio, ev, body.data)
    return {"ok": True, "room": AGENT_SERVICE_ROOM}

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"name": "SecundusDermis", "status": "running", "catalog_size": len(state.catalog)}

@api_router.get("/health")
async def health():
    return {
        "status": "healthy",
        "catalog_size": len(state.catalog),
        "search_mode": SEARCH_MODE_LABEL,
        "agent_proxy": bool(config.AGENT_SERVICE_URL),
    }


_AGENT_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "AGENT_MANIFEST.md"


@api_router.get("/agent-manifest.md")
async def agent_manifest_md():
    """Agent integration contract (SD rooms, internal HTTP, optional Socket.IO)."""
    if not _AGENT_MANIFEST_PATH.is_file():
        raise HTTPException(
            status_code=404,
            detail="AGENT_MANIFEST.md not found at repository root.",
        )
    return FileResponse(
        _AGENT_MANIFEST_PATH,
        media_type="text/markdown; charset=utf-8",
        filename="agent-manifest.md",
    )


PATRON_ONLY_CHAT_RETIRED_DETAIL = (
    "Session-only browser chat and anonymous image upload are retired. Use a patron sdag_… API key with "
    "POST /api/patron/agent/chat/stream and POST /api/patron/agent/image/upload "
    "(Authorization: Bearer … or X-Patron-Agent-Api-Key). See GET /api/agent-manifest.md and /agents."
)


@api_router.post("/chat")
async def chat_retired():
    """Legacy route — browsers must use ``POST /api/patron/agent/chat`` with a patron API key."""
    raise HTTPException(status_code=410, detail=PATRON_ONLY_CHAT_RETIRED_DETAIL)


@api_router.post("/chat/stream")
async def chat_stream_retired():
    """Legacy route — browsers must use ``POST /api/patron/agent/chat/stream`` with a patron API key."""
    raise HTTPException(status_code=410, detail=PATRON_ONLY_CHAT_RETIRED_DETAIL)


@api_router.post("/image/upload")
async def upload_image_retired():
    """Legacy route — use ``POST /api/patron/agent/image/upload`` with a patron API key."""
    raise HTTPException(status_code=410, detail=PATRON_ONLY_CHAT_RETIRED_DETAIL)


# ── Auth, Cart, etc (simplified) ──────────────────────────────────────────────

@api_router.post("/auth/register", response_model=RegisterResponse, status_code=201)
async def register(user: UserCreate):
    try:
        out = create_user(email=user.email, password=user.password, name=user.name)
    except UsersStorageFullError:
        raise HTTPException(
            status_code=503,
            detail="User database is full: no empty Notion row (clear Email on a row to add capacity).",
        )
    if out is None:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_resp, token = out
    verify_url = f"{config.FRONTEND_PUBLIC_URL}/verify-email?token={token}"
    base_message = "Check your email to verify your account before signing in."
    if gmail_smtp_configured():
        ok, err = try_send_verification_email(user_resp.email, user_resp.name or user_resp.email, verify_url)
        if not ok:
            logging.getLogger(__name__).error(
                "Verification email failed for %s: %s", user_resp.email, err or "unknown"
            )
        return RegisterResponse(
            email=user_resp.email,
            name=user_resp.name,
            message=base_message,
        )
    return RegisterResponse(
        email=user_resp.email,
        name=user_resp.name,
        message=f"{base_message} (SMTP not configured — use verify_url for testing.)",
        verification_token=token,
        verify_url=verify_url,
    )


@api_router.post("/auth/verify-email")
async def verify_email_endpoint(body: VerifyEmailRequest):
    if not verify_email_token(body.token):
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    return {"status": "Email verified. You can sign in now."}


@api_router.post("/auth/resend-verification")
async def resend_verification_ep(payload: dict):
    """Send a new verification link if the account exists and is not yet verified."""
    email = (payload.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    token = resend_verification_token(email)
    user = get_user_by_email(email)
    verify_url = f"{config.FRONTEND_PUBLIC_URL}/verify-email?token={token}"
    if token and user and gmail_smtp_configured():
        ok, err = try_send_verification_email(email.lower(), user.name or email, verify_url)
        if not ok:
            logging.getLogger(__name__).error(
                "Resend verification email failed for %s: %s", email, err or "unknown"
            )
    # Do not reveal whether the email exists or is already verified
    out: dict = {"status": "If the account exists and needs verification, a new link has been sent."}
    if token and not gmail_smtp_configured():
        out["verification_token"] = token
        out["verify_url"] = verify_url
    return out


@api_router.post("/auth/login", response_model=LoginResponse)
async def login(user: UserLogin):
    session_id, auth_err = try_authenticate(
        email=(user.email or "").strip(),
        password=user.password or "",
    )
    if auth_err == "email_not_verified":
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in. Check your inbox for the verification link.",
        )
    if auth_err == "user_not_found":
        logging.getLogger(__name__).info(
            "Auth login failed (user_not_found) for email=%s",
            (user.email or "").strip().lower(),
        )
        raise HTTPException(
            status_code=401,
            detail="No account is registered with this email address. Sign up first or check the spelling.",
        )
    if auth_err == "invalid_password":
        logging.getLogger(__name__).info(
            "Auth login failed (invalid_password) for email=%s",
            (user.email or "").strip().lower(),
        )
        raise HTTPException(
            status_code=401,
            detail="Incorrect password for this account. Try again or use Forgot Password.",
        )
    if session_id is None:
        logging.getLogger(__name__).info(
            "Auth login failed (unknown) for email=%s",
            (user.email or "").strip().lower(),
        )
        raise HTTPException(
            status_code=401,
            detail="Sign in failed. Check your email and password.",
        )
    user_resp = get_user_from_session(session_id)
    response = JSONResponse(
        content={
            "session_id": session_id,
            "user": {
                "email": user_resp.email,
                "name": user_resp.name,
                "experience_mode": user_resp.experience_mode,
            },
        }
    )
    _attach_session_cookie(response, session_id)
    return response

@api_router.post("/auth/logout")
async def logout_endpoint(session_id: Optional[str] = Depends(_browser_session_id)):
    if session_id: logout(session_id)
    response = JSONResponse(content={"status": "logged out"})
    response.delete_cookie(key="sd_session_id", path="/")
    return response


@api_router.get("/auth/me", response_model=None)
async def get_current_user(session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    payload = MeResponse(
        email=user.email,
        name=user.name,
        session_id=session_id,
        experience_mode=user.experience_mode,
    ).model_dump()
    response = JSONResponse(content=payload)
    # Re-issue the cookie on every successful read so reload/bootstrap reliably persist
    # (SPA may authenticate via ``session-id`` header backup when the cookie is missing).
    _attach_session_cookie(response, session_id)
    return response


@api_router.put("/auth/me")
async def update_profile(
    profile: "ProfileUpdate",
    session_id: Optional[str] = Depends(_browser_session_id),
):
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    current = get_user_from_session(session_id)
    if not current:
        raise HTTPException(status_code=401, detail="Invalid session")
    updated = update_user_profile(
        email=current.email,
        name=profile.name,
        experience_mode=profile.experience_mode,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


@api_router.post("/auth/request-password-reset")
async def request_password_reset(email_data: dict):
    """
    Request a password reset. If the address is registered, sends a reset link when SMTP is configured.
    Returns 404 when no local user exists so the client can show a clear message.
    """
    log = logging.getLogger(__name__)
    email = email_data.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    token = create_reset_token(email)
    user = get_user_by_email(email)
    
    if not token or not user:
        log.info("Password reset: no local user for %s — returning 404 to client", email.strip())
        raise HTTPException(
            status_code=404,
            detail="No account is registered with this email address. Sign up first or check the spelling.",
        )

    reset_url = f"{config.FRONTEND_PUBLIC_URL}/reset-password?token={token}"

    if gmail_smtp_configured():
        log.info(
            "Password reset: sending SMTP mail to %s (smtp configured)",
            email.strip().lower(),
        )
        ok, err = try_send_password_reset_email(email.strip().lower(), user.name or email, reset_url)
        if ok:
            log.info("Password reset: SMTP reported success for %s", email.strip().lower())
        else:
            log.error(
                "Password reset email failed for %s: %s", email, err or "unknown"
            )
        # Same message whether send succeeded or not (avoid account enumeration)
        return {"status": "If the email exists, a reset link has been sent"}

    log.warning(
        "Password reset: GMAIL_USER/GMAIL_PASSWORD not set in process env — no email sent. "
        "Restart the server after editing .env, or export vars before starting."
    )
    # Dev: SMTP not configured — keep a test-friendly payload (do not use in production)
    return {
        "status": "Reset token generated (SMTP not configured)",
        "token": token,
        "reset_url": reset_url,
        "message": "Set GMAIL_USER and GMAIL_PASSWORD to send email instead of returning this payload",
    }


@api_router.post("/auth/reset-password")
async def reset_password_endpoint(reset_data: PasswordReset):
    """
    Reset password using a valid token.
    """
    success = reset_password(token=reset_data.token, new_password=reset_data.new_password)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    return {"status": "Password reset successful"}


@api_router.post("/auth/agent-api-keys")
async def auth_create_agent_api_key(
    body: AgentApiKeyCreate,
    session_id: Optional[str] = Depends(_browser_session_id),
):
    """Create a per-patron API key (plaintext returned once). Use with ``/patron/agent/*``."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    raw, meta = agent_api_keys.create_key(user.email, body.label)
    return {"token": raw, **meta}


@api_router.get("/auth/agent-api-keys")
async def auth_list_agent_api_keys(session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    keys = agent_api_keys.list_keys(user.email)
    return {"keys": keys}


@api_router.get("/auth/house-agent-key")
async def auth_house_agent_key(session_id: Optional[str] = Depends(_browser_session_id)):
    """
    Return the patron's auto-provisioned **house stylist** ``sdag_…`` (boutique corner chat).
    Created on first request; stored server-side so the SPA does not need the Agents hub.
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    token = house_agent_key.get_or_create_house_agent_key(user.email)
    return {"token": token, "label": house_agent_key.HOUSE_AGENT_LABEL}


@api_router.delete("/auth/agent-api-keys/{key_id}")
async def auth_revoke_agent_api_key(
    key_id: str,
    session_id: Optional[str] = Depends(_browser_session_id),
):
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    if not agent_api_keys.revoke_key(user.email, key_id):
        raise HTTPException(status_code=404, detail="API key not found")
    return {"status": "revoked", "id": key_id}


@api_router.get("/auth/agents")
async def auth_list_registered_agents(session_id: Optional[str] = Depends(_browser_session_id)):
    """Registered agents (patron keys) plus pending one-time registration invites."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    keys = agent_api_keys.list_keys(user.email)
    agents = agent_api_keys.append_agent_socket_online_flags(keys)
    pending = agent_invites.list_pending_invites_public(user.email)
    return {"agents": agents, "pending_invites": pending}


@api_router.post("/auth/agent-invites")
async def auth_create_agent_invite(
    body: AgentApiKeyCreate,
    session_id: Optional[str] = Depends(_browser_session_id),
):
    """Mint a one-time ``sdreg_…`` code for ``POST /patron/agent/register`` (plaintext returned once)."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    raw, meta = agent_invites.create_invite(user.email, body.label)
    return {"registration_code": raw, **meta}


@api_router.get("/cart", response_model=CartResponse)
async def get_user_cart(session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id: return CartResponse(items=[], total=0.0)
    return get_cart(session_id)

@api_router.post("/cart", response_model=CartResponse)
async def add_item_to_cart(product_id: str, product_name: str, price: float, image_url: str, quantity: int = 1, session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    return add_to_cart(session_id, product_id, product_name, price, image_url, quantity)

@api_router.delete("/cart/{product_id}", response_model=CartResponse)
async def remove_cart_item_endpoint(product_id: str, session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    return remove_from_cart(session_id, product_id)


@api_router.get("/patron/shop-selection")
async def patron_get_shop_selection(session_id: Optional[str] = Depends(_browser_session_id)):
    """Return saved shop filters for this patron session, or ``{}`` if none / unauthenticated."""
    if not session_id or not get_user_from_session(session_id):
        return {}
    return get_patron_shop_selection(session_id)


@api_router.put("/patron/shop-selection")
async def patron_put_shop_selection(
    body: PatronShopSelectionUpdate,
    session_id: Optional[str] = Depends(_browser_session_id),
):
    """Persist shop selection (gender, category, search, sidebar width) for cross-page + return visits."""
    if not session_id or not get_user_from_session(session_id):
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = body.model_dump(exclude_unset=True)
    return put_patron_shop_selection(session_id, payload)


@api_router.post("/patron/activity")
async def patron_post_activity(
    body: PatronActivityRecord,
    session_id: Optional[str] = Depends(_browser_session_id),
):
    """Append one activity row for the authenticated patron (best-effort analytics for the stylist)."""
    if not session_id:
        raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    profile_record_activity(user.email, body.event, body.path, body.label, body.seconds)
    return {"ok": True}


@api_router.post("/patron/agent/register", response_model=PatronAgentRegisterResponse)
async def patron_agent_register(body: PatronAgentRegisterBody):
    """
    One-time registration: an agent exchanges ``sdreg_…`` (minted under ``POST /auth/agent-invites``)
    for a long-lived ``sdag_…`` credential. The plaintext ``sdag`` is returned **only** in this response.
    """
    out = agent_invites.try_consume_invite(body.registration_code, body.agent_name)
    if out is None:
        raise HTTPException(status_code=400, detail="Invalid or already-used registration code.")
    raw_sdag, meta = out
    return PatronAgentRegisterResponse(
        agent_api_key=raw_sdag,
        id=str(meta["id"]),
        label=str(meta.get("label") or "Agent"),
        prefix=str(meta.get("prefix") or ""),
        created_at=float(meta.get("created_at") or 0),
    )


@api_router.get("/patron/agent/me")
async def patron_agent_me(patron_email: str = Depends(require_patron_agent_api_key)):
    """Who am I? — for tools and external agents using a patron API key."""
    user = get_user_by_email(patron_email)
    if not user:
        return {"email": patron_email, "name": ""}
    return {"email": user.email, "name": user.name or ""}


@api_router.get("/patron/agent/context")
async def patron_agent_context_get(
    patron_email: str = Depends(require_patron_agent_api_key),
    limit: int = 50,
):
    """Return recent context notes the patron's agents have posted (newest last)."""
    lim = max(1, min(limit, agent_api_keys.MAX_CONTEXT_PER_USER))
    return {"entries": agent_api_keys.get_context(patron_email, lim)}


@api_router.post("/patron/agent/context")
async def patron_agent_context_append(
    body: PatronAgentContextAppend,
    patron_email: str = Depends(require_patron_agent_api_key),
):
    """Append one or more short notes (e.g. agent observations) for later retrieval by the same patron."""
    rows = [{"text": e.text, "source": e.source} for e in (body.entries or [])[:25]]
    if not rows:
        raise HTTPException(status_code=400, detail="entries required")
    n = agent_api_keys.append_context_entries(patron_email, rows)
    return {"ok": True, "stored_total": n}


async def _store_chat_upload_image(file: UploadFile) -> ImageUploadResponse:
    """Save a chat image to ``UPLOADS_DIR`` (shared by API-key and browser-session upload routes)."""
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="File must be JPEG, PNG, or WebP")

    config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    hash_part = hashlib.md5(content).hexdigest()[:8]
    timestamp = int(time.time())
    image_id = f"img_{timestamp}_{hash_part}"

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    file_path = config.UPLOADS_DIR / f"{image_id}.{ext}"
    file_path.write_bytes(content)

    logger.info(f"[chat] uploaded image: {image_id} -> {file_path}")
    return ImageUploadResponse(image_id=image_id, message="Image uploaded successfully")


@api_router.post("/patron/agent/image/upload", response_model=ImageUploadResponse)
async def patron_agent_upload_image(
    file: UploadFile = File(...),
    patron_email: str = Depends(require_patron_agent_api_key),
):
    """Upload image for patron chat (same storage as legacy ``/api/image/upload``); requires ``sdag_``."""
    del patron_email
    return await _store_chat_upload_image(file)


@api_router.post("/browser/agent/image/upload", response_model=ImageUploadResponse)
async def browser_agent_image_upload(
    file: UploadFile = File(...),
    browser_sid: Optional[str] = Depends(_browser_session_id),
):
    """Same image storage as ``/patron/agent/image/upload``; requires a signed-in browser session."""
    if not browser_sid or not get_user_from_session(browser_sid):
        raise HTTPException(status_code=401, detail="Sign in required.")
    return await _store_chat_upload_image(file)


@api_router.post("/patron/agent/chat", response_model=ChatResponse)
async def patron_agent_chat(
    request: ChatRequest,
    patron_email: str = Depends(require_patron_agent_api_key),
):
    """Non-streaming patron chat; JSON body matches the former ``/api/chat`` contract; authenticate with ``sdag_``."""
    del patron_email
    if state.agent_http is None:
        raise HTTPException(
            status_code=503,
            detail="AI agent is not configured. Set AGENT_SERVICE_URL and AGENT_INTERNAL_SECRET and run the agent process.",
        )
    image_bytes = None
    mime_type = "image/jpeg"
    if request.image_id:
        for ext in ["jpg", "jpeg", "png", "webp"]:
            candidate = config.UPLOADS_DIR / f"{request.image_id}.{ext}"
            if candidate.exists():
                image_bytes = candidate.read_bytes()
                mime_type = "image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}"
                break

    try:
        from agent_ai_client import chat_sync
        from agent_prompts import merge_prompts_with_soul
    except ImportError:
        merge_prompts_with_soul = lambda p: dict(p)

    prompts = merge_prompts_with_soul(dict(state.prompts))
    body = {
        "message": request.message,
        "session_id": request.session_id,
        "shop_context": request.shop_context.model_dump() if request.shop_context else None,
        "mime_type": mime_type,
        "image_base64": base64.b64encode(image_bytes).decode("ascii") if image_bytes else None,
        "prompts": prompts,
    }
    result = await chat_sync(state.agent_http, body)
    return ChatResponse(
        reply=result.get("reply") or "",
        products=list(result.get("products") or []),
        intent=result.get("intent") or "chitchat",
        filter=result.get("filter"),
    )


def _agent_service_chat_stream_response(request: ChatRequest) -> StreamingResponse:
    """Proxy ``ChatRequest`` to the configured standalone agent ``POST /v1/chat/stream`` (SSE)."""
    if state.agent_http is None:
        raise HTTPException(
            status_code=503,
            detail="AI agent is not configured. Set AGENT_SERVICE_URL and AGENT_INTERNAL_SECRET and run the agent process.",
        )
    if not config.AGENT_INTERNAL_SECRET:
        raise HTTPException(
            status_code=503,
            detail="AGENT_INTERNAL_SECRET is missing.",
        )

    image_bytes = None
    mime_type = "image/jpeg"
    if request.image_id:
        for ext in ["jpg", "jpeg", "png", "webp"]:
            candidate = config.UPLOADS_DIR / f"{request.image_id}.{ext}"
            if candidate.exists():
                image_bytes = candidate.read_bytes()
                mime_type = "image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}"
                break

    try:
        from agent_prompts import merge_prompts_with_soul
    except ImportError:
        merge_prompts_with_soul = lambda p: dict(p)

    payload = {
        "message": request.message,
        "session_id": request.session_id,
        "shop_context": request.shop_context.model_dump() if request.shop_context else None,
        "mime_type": mime_type,
        "image_base64": base64.b64encode(image_bytes).decode("ascii") if image_bytes else None,
        "prompts": merge_prompts_with_soul(dict(state.prompts)),
    }

    async def proxy_gen():
        async with state.agent_http.stream(
            "POST",
            "/v1/chat/stream",
            json=payload,
            headers={"Accept": "text/event-stream"},
        ) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk

    return StreamingResponse(
        proxy_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@api_router.post("/patron/agent/chat/stream")
async def patron_agent_chat_stream(
    request: ChatRequest,
    patron_email: str = Depends(require_patron_agent_api_key),
):
    """SSE patron chat; JSON body matches the former ``/api/chat/stream`` contract; authenticate with ``sdag_``."""
    del patron_email
    return _agent_service_chat_stream_response(request)


@api_router.post("/browser/agent/chat/stream")
async def browser_agent_chat_stream(
    request: ChatRequest,
    browser_sid: Optional[str] = Depends(_browser_session_id),
):
    """SSE stylist chat for the signed-in SPA (session cookie or ``session-id``); same body as patron stream."""
    if not browser_sid or not get_user_from_session(browser_sid):
        raise HTTPException(status_code=401, detail="Sign in required.")
    return _agent_service_chat_stream_response(request)


async def _deployment_catalog_stats_dict() -> dict[str, Any]:
    """Same JSON as ``GET /api/catalog/stats`` for HTTP and Socket.IO ``deployment_stats``."""
    out = dict(
        build_catalog_stats(
            state.catalog,
            embedding_model=config.EMBED_MODEL,
            embedding_dim=config.EMBEDDING_DIM,
            search_mode=SEARCH_MODE_LABEL,
            agent_proxy=bool(config.AGENT_SERVICE_URL),
        )
    )
    out["agent_socket_online_count"] = count_room_participants(sio, AGENT_SERVICE_ROOM)
    out["stylist_agent_http_reachable"] = None
    if state.agent_http is not None:
        try:
            r = await state.agent_http.get("/health", timeout=2.0)
            out["stylist_agent_http_reachable"] = 200 <= r.status_code < 300
        except Exception:
            out["stylist_agent_http_reachable"] = False
    return out


async def _broadcast_deployment_stats_to_watchers() -> None:
    """Push deployment stats to browsers watching ``/agents`` when duplex agent count may have changed."""
    try:
        if count_room_participants(sio, DEPLOYMENT_STATS_ROOM) == 0:
            return
    except Exception:
        return
    try:
        payload = await _deployment_catalog_stats_dict()
        await sio.emit("deployment_stats", payload, room=DEPLOYMENT_STATS_ROOM)
    except Exception as e:
        logger.warning("[SOCKETIO] deployment_stats broadcast failed: %s", e)


@api_router.get("/catalog/stats")
async def catalog_stats():
    """Ground-truth catalog dimensions + deployment flags for UI copy."""
    return await _deployment_catalog_stats_dict()


@api_router.get("/catalog/browse")
async def catalog_browse(offset: int = 0, limit: int = 24, gender: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None):
    limit = min(max(1, limit), 48)
    # Split query into individual words; show item if ANY word appears in description or name
    words = [w for w in q.lower().split() if w] if q else []
    def _matches(item: dict) -> bool:
        if gender and item["gender"] != gender.upper():
            return False
        if category and item["category"] != category:
            return False
        if not words:
            return True
        haystack = f"{item.get('description', '')} {item.get('product_name', '')}".lower()
        return any(w in haystack for w in words)
    filtered = [item for item in state.catalog if _matches(item)]
    page = filtered[offset:offset + limit]
    return {"products": [{k: v for k, v in p.items() if k != "image_path"} for p in page], "offset": offset, "limit": limit, "total": len(filtered)}

@api_router.get("/catalog/random")
async def catalog_random(n: int = 12):
    """Return n random products for the home page hero."""
    import random as _random
    sample = _random.sample(state.catalog, min(n, len(state.catalog)))
    return {"products": [{k: v for k, v in p.items() if k != "image_path"} for p in sample]}


# ── On-disk journal JSON (agent RAG / tools only; no public editorial CRUD) ─

def _load_journal() -> list[dict]:
    """Load all .json files from config.JOURNAL_DIR. Returns list sorted by date desc."""
    posts = []
    for p in sorted(config.JOURNAL_DIR.glob("*.json")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                post = json.load(f)
                post.setdefault("slug", p.stem)
                post.setdefault("tags", [])
                post.setdefault("featured", False)
                post.setdefault("image", "/image-blog.jpeg")
                post.setdefault("read_time", "3 min read")
                posts.append(post)
        except Exception as e:
            logger.error(f"Failed to load journal entry {p}: {e}")
    
    # Sort by date descending
    return sorted(posts, key=lambda x: x.get("date", ""), reverse=True)


# ── Conversations (Session Sync) ──────────────────────────────────────────────

@api_router.get("/conversations")
async def get_conversations(session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id: return {"messages": []}
    return {"messages": get_messages(session_id)}

@api_router.post("/conversations")
async def add_message(msg: ConvoMessage, session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    messages = append_message(session_id, msg.role, msg.content, msg.timestamp)
    
    # TRIGGER: After 10 messages, dump a reflection to the journal
    if len(messages) == 10:
        user = get_user_from_session(session_id)
        if user:
            # Run in background to not block the request
            asyncio.create_task(dump_context_to_journal(session_id, user.email))
            
    return {"messages": messages}

@api_router.delete("/conversations")
async def clear_conversation_endpoint(session_id: Optional[str] = Depends(_browser_session_id)):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    clear_convo(session_id)
    return {"status": "cleared"}


@api_router.get("/catalog/product/{product_id}")
async def catalog_product(product_id: str):
    item = next((p for p in state.catalog if p["product_id"] == product_id), None)
    if item is None: raise HTTPException(status_code=404, detail="Product not found")
    return {k: v for k, v in item.items() if k != "image_path"}


app.include_router(api_router)


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    backend_public_file = (BACKEND_PUBLIC_DIR / full_path).resolve()
    if (
        BACKEND_PUBLIC_DIR.exists()
        and backend_public_file.is_file()
        and str(backend_public_file).startswith(str(BACKEND_PUBLIC_DIR.resolve()))
    ):
        return FileResponse(backend_public_file)

    static_file = (FRONTEND_DIST_DIR / full_path).resolve()
    if (
        FRONTEND_DIST_DIR.exists()
        and static_file.is_file()
        and str(static_file).startswith(str(FRONTEND_DIST_DIR.resolve()))
    ):
        return FileResponse(static_file)

    api_prefixes = ("api", "auth", "chat", "image", "cart", "catalog", "conversations", "health", "images", "uploads", "socket.io", "assets", "internal", "patron")
    if full_path.startswith(api_prefixes):
        raise HTTPException(status_code=404, detail="Not found")
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found")

# ── Socket.IO event handlers ──────────────────────────────────────────────────

@sio.on("connect")
async def on_connect(sid, environ, auth=None):
    auth = auth if isinstance(auth, dict) else {}
    role = "patron"
    session: dict = {}

    if config.AGENT_INTERNAL_SECRET and auth.get("agent_secret") == config.AGENT_INTERNAL_SECRET:
        role = "agent"
        session["agent_auth"] = "internal"
        logger.info("[SOCKETIO] Agent service connected: %s", sid)
    else:
        raw_key = auth.get("patron_agent_api_key") or auth.get("patronAgentApiKey")
        if isinstance(raw_key, str) and raw_key.strip():
            fp = agent_api_keys.verify_token_with_fingerprint(raw_key.strip())
            if not fp:
                logger.warning("[SOCKETIO] Reject connect sid=%s: invalid patron_agent_api_key", sid)
                return False
            email, key_hash = fp
            await replace_patron_agent_socket_exclusive(sio, sid, key_hash)
            role = "agent"
            session["agent_auth"] = "patron_key"
            session["patron_email"] = email
            session["patron_key_hash"] = key_hash
            logger.info("[SOCKETIO] Patron-key agent connected: sid=%s email=%s", sid, email)
        else:
            logger.info("[SOCKETIO] Client connected: %s", sid)

    session["role"] = role
    await sio.save_session(sid, session)
    if role == "agent":
        await sio.enter_room(sid, AGENT_SERVICE_ROOM)
        await sio.emit(
            "sd_bridge",
            {"type": "welcome", "message": "agent duplex channel ready", "room": AGENT_SERVICE_ROOM},
            to=sid,
        )
        await _broadcast_deployment_stats_to_watchers()


@sio.on("disconnect")
async def on_disconnect(sid):
    logger.info(f"[SOCKETIO] Client disconnected: {sid}")
    try:
        sess = await sio.get_session(sid)
    except Exception:
        sess = {}
    forget_patron_agent_socket(sid)
    if sess.get("role") == "agent":
        await _broadcast_deployment_stats_to_watchers()


@sio.on("join_session")
async def on_join_session(sid, data):
    """Client sends { session_id } to subscribe to its personal event room."""
    session_id = (data or {}).get("session_id", "")
    if session_id:
        room = f"sd_{session_id}"
        await sio.enter_room(sid, room)
        await sio.emit("connected", {"session_id": session_id, "status": "joined"}, to=sid)
        logger.info(f"[SOCKETIO] {sid} joined room {room}")


@sio.on("join_deployment_stats")
async def on_join_deployment_stats(sid, data=None):
    """Browser on ``/agents`` subscribes to ``deployment_stats`` (same payload as ``GET /api/catalog/stats``)."""
    await sio.enter_room(sid, DEPLOYMENT_STATS_ROOM)
    try:
        payload = await _deployment_catalog_stats_dict()
        await sio.emit("deployment_stats", payload, to=sid)
    except Exception as e:
        logger.warning("[SOCKETIO] join_deployment_stats snapshot failed: %s", e)


@sio.on("leave_deployment_stats")
async def on_leave_deployment_stats(sid, data=None):
    try:
        await sio.leave_room(sid, DEPLOYMENT_STATS_ROOM)
    except Exception:
        pass


@sio.on("ping")
async def on_ping(sid, data):
    await sio.emit("pong", {}, to=sid)


@sio.on("agent_ping")
async def on_agent_ping(sid, data):
    """Lightweight agent → server ping; server answers on ``sd_bridge`` (duplex health)."""
    try:
        sess = await sio.get_session(sid)
    except Exception:
        sess = {}
    if not sess or sess.get("role") != "agent":
        return
    payload = data if isinstance(data, dict) else {}
    await sio.emit("sd_bridge", {"type": "pong", "echo": payload}, to=sid)


@sio.on("agent_bridge")
async def on_agent_bridge(sid, data):
    """Generic agent → backend envelope (logging / future server-side handlers)."""
    try:
        sess = await sio.get_session(sid)
    except Exception:
        sess = {}
    if not sess or sess.get("role") != "agent":
        logger.warning("[SOCKETIO] agent_bridge rejected for sid=%s", sid)
        return
    if isinstance(data, dict):
        logger.debug("[SOCKETIO] agent_bridge: %s", data.get("type", data))


@sio.on("agent_emit")
async def on_agent_emit(sid, data):
    """Trusted agent process pushes events into a patron session room (e.g. shop_sync, catalog_results)."""
    try:
        sess = await sio.get_session(sid)
    except Exception:
        sess = {}
    if not sess or sess.get("role") != "agent":
        logger.warning("[SOCKETIO] agent_emit rejected for sid=%s", sid)
        return
    payload = data or {}
    session_id = (payload.get("session_id") or "").strip()
    event = (payload.get("event") or "").strip()
    body = payload.get("data")
    if not session_id or not event:
        return
    if not isinstance(body, dict):
        body = {}
    if event == "sd_stylist_message":
        from stylist_loop.ws_envelope import validate_stylist_ws_message

        ok, err, norm = validate_stylist_ws_message(body)
        if not ok:
            logger.warning("[SOCKETIO] sd_stylist_message rejected: %s", err)
            return
        if norm.get("session_id") != session_id:
            logger.warning("[SOCKETIO] sd_stylist_message session_id does not match agent_emit envelope")
            return
        await sio.emit("sd_stylist_message", norm, room=f"sd_{session_id}")
        return
    await sio.emit(event, body, room=f"sd_{session_id}")


# ── Wrap FastAPI with Socket.IO ───────────────────────────────────────────────
# All /socket.io/* requests are handled by Socket.IO;
# everything else is forwarded to the FastAPI app.

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    import argparse
    import uvicorn
    cert_file = os.getenv("SSL_CERT_FILE", "/app/certs/selfsigned.crt")
    key_file = os.getenv("SSL_KEY_FILE", "/app/certs/selfsigned.key")
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-reload", dest="reload", action="store_false",
                        help="Disable hot reload (used in production)")
    parser.set_defaults(reload=True)
    args = parser.parse_args()
    ssl_kwargs = {}
    if Path(cert_file).exists() and Path(key_file).exists():
        ssl_kwargs = {"ssl_certfile": cert_file, "ssl_keyfile": key_file}
    uvicorn.run("api:socket_app", host="0.0.0.0", port=8000, reload=args.reload, **ssl_kwargs)
