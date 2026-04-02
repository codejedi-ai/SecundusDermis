"""
SecundusDermis — AI Fashion Agent API (Direct Gemini SDK)
==========================================================
Uses Gemini SDK directly - NO ADK.
"""

from pathlib import Path

from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir.parent / ".env")
load_dotenv(_backend_dir / ".env", override=True)

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
from typing import Any, Optional, AsyncGenerator

import numpy as np
import socketio
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types as genai_types
from PIL import Image
from pydantic import BaseModel

from auth import (
    UserCreate, UserLogin, UserResponse, LoginResponse, PasswordReset,
    RegisterResponse, VerifyEmailRequest,
    create_user, try_authenticate, get_user_from_session, logout,
    create_reset_token, verify_reset_token, reset_password,
    verify_email_token, resend_verification_token,
)
from cart import CartItem, CartResponse, get_cart, add_to_cart, update_cart_item, remove_from_cart, clear_cart
from conversations import get_messages, append_message, clear_messages as clear_convo
from download_data import download_and_extract
from user_profiles import add_cart_item as profile_add_cart, record_activity as profile_record_activity
from vector_store import get_vector_store, ImageEmbedding, JournalEmbedding

import config
from smtp_mail import (
    gmail_smtp_configured,
    try_send_password_reset_email,
    try_send_verification_email,
)

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

def index_journal():
    """Embed all journal entries and store in ChromaDB for RAG."""
    posts = _load_journal()
    vs = get_vector_store()
    logger.info(f"Indexing {len(posts)} journal entries for RAG...")
    
    for post in posts:
        slug = post.get("slug")
        # Upsert is fine for Chroma
        text_to_embed = f"{post.get('title')}\n{post.get('excerpt')}\n{post.get('body')[:1000]}"
        try:
            # Check if state.gemini is initialized (it is in lifespan)
            res = state.gemini.models.embed_content(
                model=config.EMBED_MODEL,
                contents=text_to_embed,
                config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            embedding = res.embeddings[0].values
            
            vs.add_journal_embedding(JournalEmbedding(
                slug=slug,
                embedding=embedding,
                title=post.get("title", ""),
                excerpt=post.get("excerpt", ""),
                category=post.get("category", ""),
                tags=post.get("tags", []),
                date=post.get("date", "")
            ))
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
    gemini: genai.Client | None = None
    catalog: list[dict] = []
    histogram_cache: dict[str, np.ndarray] = {}
    prompts: dict = {}

state = _State()

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.GEMINI_API_KEY:
        raise RuntimeError("config.GEMINI_API_KEY is not set")
    logger.info("Initialising Gemini client …")
    state.gemini = genai.Client(api_key=config.GEMINI_API_KEY)
    logger.info("Checking dataset …")
    download_and_extract()
    logger.info("Loading catalog …")
    state.catalog = load_catalog()
    logger.info("Loading system prompts …")
    state.prompts = load_prompts()
    logger.info("Initialising vector store …")
    get_vector_store()
    logger.info("Indexing journal for RAG …")
    index_journal()
    logger.info(f"Ready. {len(state.catalog)} products. Using direct Gemini SDK.")
    yield
    logger.info("Shutting down.")

# Ensure static directories exist so mounting doesn't fail
config.init_directories()

app = FastAPI(title="SecundusDermis", version="5.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Mount static files unconditionally
app.mount("/images", StaticFiles(directory=str(config.IMAGES_DIR)), name="product_images")
app.mount("/uploads", StaticFiles(directory=str(config.UPLOADS_DIR)), name="uploads")

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
    if not messages: return

    logger.info(f"[DIARY DUMP] Summarizing journey for {email} ({len(messages)} messages)")
    
    # Use Gemini to summarize the style journey
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
        response = state.gemini.models.generate_content(model=config.MODEL, contents=prompt)
        data = json.loads(re.search(r"\{.*\}", response.text, re.DOTALL).group())
        
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
            "slug": slug
        }
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(journal_entry, f, indent=2)
            
        # Index immediately for RAG
        try:
            vs = get_vector_store()
            text_to_embed = f"{journal_entry['title']}\n{journal_entry['excerpt']}\n{journal_entry['body'][:1000]}"
            res = state.gemini.models.embed_content(
                model=config.EMBED_MODEL,
                contents=text_to_embed,
                config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            vs.add_journal_embedding(JournalEmbedding(
                slug=slug,
                embedding=res.embeddings[0].values,
                title=journal_entry["title"],
                excerpt=journal_entry["excerpt"],
                category=journal_entry["category"],
                tags=journal_entry["tags"],
                date=journal_entry["date"]
            ))
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
    kw = keywords.lower().strip()
    if not kw:
        return []
    
    # Split into individual words for matching
    search_terms = [t.strip() for t in re.split(r'[\s,]+', kw) if len(t.strip()) > 2]
    
    results = []
    for item in state.catalog:
        desc_lower = item.get("description", "").lower()
        name_lower = item.get("product_name", "").lower()
        cat_lower = item.get("category", "").lower()
        
        # Match if ANY search term is found in description, name, or category
        if search_terms:
            matches = any(term in desc_lower or term in name_lower or term in cat_lower for term in search_terms)
            if not matches:
                continue
        
        if gender and item.get("gender", "").upper() != gender.upper(): continue
        if category and item.get("category", "") != category: continue
        
        results.append({k: v for k, v in item.items() if k != "image_path"})
        if len(results) >= n_results: break
    
    return results


# ── Shop sidebar taxonomy (keep in sync with frontend/src/components/ShopSidebar.tsx) ─

_SIDEBAR_GROUPS_MEN = [
    {"label": "Tops", "cats": ["Tees_Tanks", "Shirts_Polos", "Sweaters", "Sweatshirts_Hoodies", "Suiting"]},
    {"label": "Bottoms", "cats": ["Denim", "Pants", "Shorts"]},
    {"label": "Layers", "cats": ["Jackets_Vests"]},
]
_SIDEBAR_GROUPS_WOMEN = [
    {"label": "Tops", "cats": ["Tees_Tanks", "Graphic_Tees", "Blouses_Shirts", "Cardigans"]},
    {"label": "Bottoms", "cats": ["Denim", "Pants", "Shorts", "Skirts", "Leggings"]},
    {"label": "Dresses & Sets", "cats": ["Dresses", "Rompers_Jumpsuits"]},
    {"label": "Layers", "cats": ["Jackets_Coats"]},
]
_SIDEBAR_GROUPS_ALL = [
    {"label": "Tops", "cats": ["Tees_Tanks", "Graphic_Tees", "Blouses_Shirts", "Shirts_Polos", "Sweaters", "Sweatshirts_Hoodies", "Cardigans", "Suiting"]},
    {"label": "Bottoms", "cats": ["Denim", "Pants", "Shorts", "Skirts", "Leggings"]},
    {"label": "Dresses & Sets", "cats": ["Dresses", "Rompers_Jumpsuits"]},
    {"label": "Layers", "cats": ["Jackets_Vests", "Jackets_Coats"]},
]

ALL_VALID_CATEGORIES = frozenset(
    c for g in _SIDEBAR_GROUPS_ALL for c in g["cats"]
)


def _sidebar_groups_for_gender(gender: Optional[str]) -> list[dict]:
    if gender == "MEN":
        return _SIDEBAR_GROUPS_MEN
    if gender == "WOMEN":
        return _SIDEBAR_GROUPS_WOMEN
    return _SIDEBAR_GROUPS_ALL


def _normalize_gender_arg(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    u = str(raw).strip().upper()
    if u in ("MEN", "MAN", "MENS", "MEN'S"):
        return "MEN"
    if u in ("WOMEN", "WOMAN", "WOMENS", "WOMEN'S"):
        return "WOMEN"
    return None


def _normalize_category_arg(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip().replace(" ", "_")
    if not s:
        return None
    for c in ALL_VALID_CATEGORIES:
        if c.lower() == s.lower():
            return c
    return None


def build_sidebar_snapshot(shop_state: dict) -> dict[str, Any]:
    """Full sidebar tree: every gender and category with selected / not selected (matches Shop UI)."""
    g_sel = _normalize_gender_arg(shop_state.get("gender"))
    c_sel = _normalize_category_arg(shop_state.get("category"))

    genders = [
        {"id": "MEN", "label": "Men", "selected": g_sel == "MEN"},
        {"id": "WOMEN", "label": "Women", "selected": g_sel == "WOMEN"},
    ]
    groups_out: list[dict[str, Any]] = []
    for grp in _sidebar_groups_for_gender(g_sel):
        cats = [
            {
                "id": cid,
                "label": cid.replace("_", " "),
                "selected": c_sel == cid,
            }
            for cid in grp["cats"]
        ]
        groups_out.append({"label": grp["label"], "categories": cats})

    sel_g_label = next((x["label"] for x in genders if x["selected"]), None)
    sel_c_label = None
    for grp in groups_out:
        for cat in grp["categories"]:
            if cat["selected"]:
                sel_c_label = cat["label"]
                break
        if sel_c_label:
            break

    return {
        "genders": genders,
        "category_groups": groups_out,
        "selected_gender_id": g_sel,
        "selected_category_id": c_sel,
        "narration": (
            f"Currently selected: gender={sel_g_label or 'none (all)'}, category={sel_c_label or 'none'}."
            " Every other option above is not selected."
        ),
    }


def _apply_sidebar_selection(
    shop_state: dict,
    action: Optional[str],
    args: dict[str, Any],
) -> tuple[bool, str]:
    """
    Mutates shop_state keys gender, category. Returns (changed, reason_note).
    """
    if not action or str(action).strip().lower() not in ("select", "set"):
        return False, ""

    args = args or {}
    changed = False
    current_g = _normalize_gender_arg(shop_state.get("gender"))
    current_c = _normalize_category_arg(shop_state.get("category"))

    has_g = "gender" in args
    has_c = "category" in args
    legacy_value = args.get("value")

    if has_g:
        g_raw = args["gender"]
        if g_raw is None or str(g_raw).strip().upper() in ("ALL", "NONE", ""):
            if current_g is not None or current_c is not None:
                changed = True
            current_g = None
            current_c = None
        else:
            ng = _normalize_gender_arg(str(g_raw))
            if ng:
                if current_g != ng:
                    changed = True
                current_g = ng
                if not has_c:
                    if current_c is not None:
                        changed = True
                    current_c = None

    if has_c:
        c_raw = args["category"]
        if c_raw is None or str(c_raw).strip() == "":
            if current_c is not None:
                changed = True
            current_c = None
        else:
            nc = _normalize_category_arg(str(c_raw))
            if nc and current_c != nc:
                changed = True
                current_c = nc
            elif nc is None:
                pass

    if not has_g and not has_c and legacy_value:
        v = str(legacy_value).strip()
        vu = v.upper()
        if vu in ("MEN", "WOMEN"):
            ng = vu
            if current_g != ng or current_c is not None:
                changed = True
            current_g = ng
            current_c = None
        elif vu in ("ALL", "NONE"):
            if current_g is not None or current_c is not None:
                changed = True
            current_g = None
            current_c = None
        else:
            nc = _normalize_category_arg(v)
            if nc and current_c != nc:
                changed = True
                current_c = nc

    shop_state["gender"] = current_g
    shop_state["category"] = current_c
    return changed, "sidebar_updated" if changed else ""


def manage_sidebar(
    action: Optional[str] = None,
    value: Optional[str] = None,
    gender: Optional[str] = None,
    category: Optional[str] = None,
    shop_state: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Observe or update the shop sidebar (gender + secondary category), aligned with the React sidebar.
    Pass shop_state dict (mutable); receives full tree with selected / unselected for every option.
    """
    if shop_state is None:
        shop_state = {}

    args: dict[str, Any] = {}
    if gender is not None:
        args["gender"] = gender
    if category is not None:
        args["category"] = category
    if value is not None:
        args["value"] = value

    act = (action or "").strip().lower() if action else ""
    if act in ("", "observe", "peek", "read", "list"):
        snap = build_sidebar_snapshot(shop_state)
        return {
            "mode": "observe",
            "shop_sidebar": snap,
            "ui_action_required": False,
            "action_payload": None,
            "status": "Observation: full sidebar (all options with selected flags).",
        }

    changed, _ = _apply_sidebar_selection(shop_state, action, args)
    snap = build_sidebar_snapshot(shop_state)

    payload = {
        "gender": shop_state.get("gender") or "",
        "category": shop_state.get("category") or "",
    }

    return {
        "mode": "select",
        "shop_sidebar": snap,
        "ui_action_required": changed,
        "action_payload": payload if changed else None,
        "status": "Sidebar updated." if changed else "No change (values already active).",
    }

# ── VLA Chat ──────────────────────────────────────────────────────────────────

async def gemini_chat(message: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> dict:
    """Direct Gemini VLA call - no ADK."""
    logger.info(f"[GEMINI] Chat: {message[:80]}... image={image_bytes is not None}")

    parts = []
    if image_bytes:
        parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
    
    # Prompt that forces product search
    sys_prompt = state.prompts.get("system_stylist", "")
    prompt = f"""{sys_prompt}

User request: {message}

IMPORTANT: Search the catalog for products matching this request and return them.
Focus on finding actual products from the catalog."""
    parts.append(genai_types.Part(text=prompt))

    gen_config = genai_types.GenerateContentConfig(
        thinking_config=genai_types.ThinkingConfig(thinking_level=config.THINKING_LEVEL),
        temperature=1.0,
    )

    try:
        response = state.gemini.models.generate_content(model=config.MODEL, contents=parts, config=gen_config)
        reply = response.text or ""
        logger.info(f"[GEMINI] Reply: {reply[:150]}...")

        # ALWAYS search catalog for any user message (unless it's clearly just greeting)
        msg_lower = message.lower().strip()
        products = []
        shop_filter = None
        
        if not any(greet in msg_lower for greet in ["hello", "hi ", "hey", "good morning", "good evening", "thanks", "thank you"]):
            products = keyword_search(keywords=message, n_results=8)
            logger.info(f"[GEMINI] Found {len(products)} products")
            
            # Determine filter from products - simple approach
            if products:
                genders = [p.get("gender") for p in products if p.get("gender") and p.get("gender") != "unknown"]
                categories = [p.get("category") for p in products if p.get("category") and p.get("category") != "unknown"]
                if genders or categories:
                    shop_filter = {
                        "gender": genders[0] if genders else None,
                        "category": categories[0] if categories else None,
                        "query": message,
                    }
                    logger.info(f"[GEMINI] Filter: {shop_filter}")

        return {"reply": reply, "products": products, "intent": "text_search" if products else "chitchat", "filter": shop_filter}
    except Exception as e:
        logger.exception(f"[GEMINI] Error: {e}")
        return {"reply": f"Error: {str(e)[:100]}", "products": [], "intent": "error", "filter": None}

async def gemini_chat_stream(
    message: str,
    image_bytes: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
    ws_session_id: Optional[str] = None,
    shop_context: Optional[ShopContext] = None,
) -> AsyncGenerator[dict, None]:
    """
    Agentic ReAct loop for Secundus Dermis.
    Iterates Thought -> Action -> Observation until a final answer is reached.
    """
    logger.info(f"[AGENT LOOP] Start: {message[:80]}... image={image_bytes is not None}")
    yield {"type": "thinking_start", "content": "Initializing agentic workflow..."}

    shop_state: dict[str, Any] = {"gender": None, "category": None, "query": None}
    if shop_context is not None:
        dumped = shop_context.model_dump() if hasattr(shop_context, "model_dump") else {}
        shop_state["gender"] = dumped.get("gender") or None
        shop_state["category"] = dumped.get("category") or None
        shop_state["query"] = dumped.get("query") or None
        if isinstance(shop_state["gender"], str) and not shop_state["gender"].strip():
            shop_state["gender"] = None
        if isinstance(shop_state["category"], str) and not shop_state["category"].strip():
            shop_state["category"] = None

    # ── Setup Vector RAG & UI context ─────────────────────────────────────────
    vs = get_vector_store()
    rag_context = ""
    try:
        embed_contents = [message]
        if image_bytes:
            embed_contents = [genai_types.Content(parts=[
                genai_types.Part(text=message),
                genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            ])]

        res = state.gemini.models.embed_content(
            model=config.EMBED_MODEL,
            contents=embed_contents,
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        )
        query_embedding = res.embeddings[0].values
        
        # Memory & RAG hits
        vs.add_query_embedding(message, query_embedding, session_id=ws_session_id or "default")
        
        journal_hits = vs.search_journal(query_embedding, limit=2)
        if journal_hits:
            rag_context += "\n\n## Journal Context\n" + "\n".join([f"- {h['metadata']['title']}: {h['metadata']['excerpt']}" for h in journal_hits])
            
        img_memory = vs.search_images_by_similarity(query_embedding, limit=2)
        if img_memory:
            rag_context += "\n\n## Visual Memory\n" + "\n".join([f"- Past visual: {h['metadata']['description']}" for h in img_memory])

    except Exception as e:
        logger.warning(f"Initial RAG failed: {e}")

    # ── Define Agent Tools ────────────────────────────────────────────────────
    tool_decls = [
        genai_types.FunctionDeclaration(
            name="keyword_search",
            description=(
                "Search the catalog. Current sidebar gender/category are applied automatically if you omit them; "
                "you may override per call. After manage_sidebar, pass the same gender/category here for consistent results."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "keywords": {"type": "string", "description": "Search terms"},
                    "gender": {"type": "string", "description": "Optional override: MEN or WOMEN"},
                    "category": {"type": "string", "description": "Optional override: category id e.g. Dresses, Denim"},
                    "n_results": {"type": "integer", "description": "Max hits (default 8)"},
                },
                "required": ["keywords"]
            }
        ),
        genai_types.FunctionDeclaration(
            name="manage_sidebar",
            description=(
                "Observe or sync the shop sidebar with the patron. The tool returns EVERY gender and category "
                "with selected true/false. When the patron names a department (e.g. women's dresses, men's denim), "
                "call action='select' with BOTH gender (MEN or WOMEN) AND category (exact id e.g. Dresses, Denim, Tees_Tanks) "
                "in one call when possible so primary and secondary filters match the UI. Use action empty or 'observe' to read state only. "
                "Category ids use underscores as in the snapshot (e.g. Graphic_Tees, Jackets_Coats)."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "description": "Omit or 'observe' to read the full tree. 'select' to apply filters.",
                    },
                    "gender": {
                        "type": "string",
                        "description": "MEN, WOMEN, or ALL to clear gender (and reset category).",
                    },
                    "category": {
                        "type": "string",
                        "description": "Catalog category id matching the sidebar (e.g. Dresses, Denim, Tees_Tanks).",
                    },
                    "value": {
                        "type": "string",
                        "description": "Legacy single tag: MEN, WOMEN, ALL, or a category id — prefer gender+category instead.",
                    },
                },
            },
        ),
        genai_types.FunctionDeclaration(
            name="show_product",
            description="Explicitly display a specific product to the patron in the chat.",
            parameters={
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "The ID of the product to show"}
                },
                "required": ["product_id"]
            }
        )
    ]

    # Initialize chat session history
    sys_prompt = state.prompts.get("system_stylist", "")
    _side_snap = build_sidebar_snapshot(shop_state)
    _sidebar_json = json.dumps(_side_snap, indent=2)
    _query_note = ""
    if shop_state.get("query"):
        _query_note = f'\n\n## Patron search bar (read-only for you)\n"{shop_state["query"]}"'
    history = [
        genai_types.Content(role="user", parts=[
            genai_types.Part(text=(
                f"{sys_prompt}\n\n"
                f"## Shop sidebar — all choices; each has selected true or false\n{_sidebar_json}"
                f"{_query_note}\n\n"
                f"## Background Context\n{rag_context}\n\n"
                f"Patron Request: {message}"
            ))
        ])
    ]
    if image_bytes:
        history[0].parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    gen_config = genai_types.GenerateContentConfig(
        thinking_config=genai_types.ThinkingConfig(thinking_level=config.THINKING_LEVEL),
        temperature=1.0,
        tools=[genai_types.Tool(function_declarations=tool_decls)]
    )

    # ── Run the ReAct Loop ──────────────────────────────────────────────────
    max_iterations = 5
    iteration = 0
    final_prose = ""
    discovered_products = []
    seen_pids = set()
    
    while iteration < max_iterations:
        iteration += 1
        logger.info(f"[AGENT LOOP] Iteration {iteration}")
        
        try:
            response = state.gemini.models.generate_content(
                model=config.MODEL,
                contents=history,
                config=gen_config
            )
            
            if not response.candidates[0].content.parts:
                break
                
            # Capture any thought/text from the model
            current_text = ""
            for part in response.candidates[0].content.parts:
                if part.text:
                    current_text += part.text
            
            if current_text:
                yield {"type": "thinking", "content": f"Stylist is reasoning: {current_text[:100]}..."}
            
            history.append(response.candidates[0].content)
            
            # Check for tool calls
            tool_calls = [p.function_call for p in response.candidates[0].content.parts if p.function_call]
            
            if not tool_calls:
                # No more tools -> this is the Final Answer
                final_prose = current_text
                break
            
            # Execute tools and collect results
            tool_responses = []
            for fc in tool_calls:
                yield {"type": "thinking", "content": f"Action: {fc.name}..."}
                
                observation = {}
                if fc.name == "manage_sidebar":
                    args = fc.args or {}
                    observation = manage_sidebar(
                        args.get("action"),
                        args.get("value"),
                        args.get("gender"),
                        args.get("category"),
                        shop_state=shop_state,
                    )

                    if observation.get("ui_action_required"):
                        payload = observation["action_payload"] or {}
                        await sio.emit("ui_action", {
                            "action": "select_category",
                            "payload": payload,
                            "description": f"Agent sidebar: gender={payload.get('gender')!r} category={payload.get('category')!r}",
                        }, room=f"sd_{ws_session_id}")

                        hint = ", ".join(
                            f"{k}={payload.get(k)!r}" for k in ("gender", "category") if payload.get(k)
                        )
                        yield {"type": "text", "content": f"*[Agent aligns shop sidebar: {hint}]*\n\n"}

                        g_f = payload.get("gender") or None
                        c_f = payload.get("category") or None
                        search_val = c_f or g_f or args.get("value") or "fashion"
                        res = keyword_search(keywords=str(search_val), gender=g_f, category=c_f)
                        for p in res:
                            if p["product_id"] not in seen_pids:
                                discovered_products.append(p)
                                seen_pids.add(p["product_id"])

                        observation["status"] = f"UI updated. Found {len(res)} items."

                elif fc.name == "keyword_search":
                    kw = fc.args.get("keywords", "")
                    ks_args = {k: fc.args[k] for k in ("keywords", "gender", "category", "n_results") if k in (fc.args or {})}
                    if ks_args.get("gender") in (None, "") and shop_state.get("gender"):
                        ks_args["gender"] = shop_state["gender"]
                    if ks_args.get("category") in (None, "") and shop_state.get("category"):
                        ks_args["category"] = shop_state["category"]

                    # Push UI update: type into the search bar for the patron
                    if ws_session_id and kw:
                        await sio.emit("ui_action", {
                            "action": "set_search_hint",
                            "payload": {"query": kw},
                            "description": f"Agent searching for: {kw}"
                        }, room=f"sd_{ws_session_id}")
                        
                        yield {"type": "text", "content": f"*[Agent searches for: \"{kw}\"]*\n\n"}

                    res = keyword_search(**ks_args)
                    for p in res:
                        if p["product_id"] not in seen_pids:
                            discovered_products.append(p)
                            seen_pids.add(p["product_id"])
                    observation = {"results_count": len(res), "status": f"Search for '{kw}' complete."}
                
                elif fc.name == "show_product":
                    pid = fc.args["product_id"]
                    item = next((p for p in state.catalog if p["product_id"] == pid), None)
                    if item:
                        if pid not in seen_pids:
                            discovered_products.append({k: v for k, v in item.items() if k != "image_path"})
                            seen_pids.add(pid)
                        yield {
                            "type": "found_products", 
                            "count": 1, 
                            "content": f"Stylist presents: {item['product_name']}",
                            "products": [{k: v for k, v in item.items() if k != "image_path"}]
                        }
                        observation = {"status": f"Product {pid} shown.", "product_name": item["product_name"]}
                    else:
                        observation = {"status": "Error: Product not found."}
                
                tool_responses.append(genai_types.Part.from_function_response(
                    name=fc.name,
                    response=observation
                ))
                yield {"type": "thinking", "content": f"Observation: {observation.get('status', 'Task complete')}"}

            history.append(genai_types.Content(role="user", parts=tool_responses))
            
        except Exception as loop_err:
            logger.error(f"[AGENT LOOP] Error in iteration {iteration}: {loop_err}")
            break

    # ── Step 3: Final Delivery ─────────────────────────────────────────────
    yield {"type": "thinking", "content": "Curation complete. Composing final response..."}
    
    # Fallback: if agent didn't discover any products, try a broad search based on the message
    if not discovered_products:
        logger.info("[AGENT LOOP] No products discovered, triggering fallback search")
        res = keyword_search(keywords=message, n_results=8)
        for p in res:
            if p["product_id"] not in seen_pids:
                discovered_products.append(p)
                seen_pids.add(p["product_id"])

    if not final_prose:
        final_prose = "I've curated a selection of pieces that I believe will complement your style perfectly. Please take a look at the choices below."
    # (Existing gender detection logic preserved)
    image_gender = None
    if image_bytes and final_prose:
        first_line, _, rest = final_prose.partition("\n")
        if "GENDER:" in first_line:
            image_gender = first_line.strip().replace("GENDER:", "").upper()
            final_prose = rest.strip()

    yield {"type": "tool_result", "tool": "gemini_narrative", "content": "Stylist curation complete"}
    
    # Push final results to UI
    if ws_session_id:
        room = f"sd_{ws_session_id}"
        await sio.emit("catalog_results", {"products": discovered_products[:12], "mode": "agent_curated"}, room=room)

    # Yield the final prose part by part (or all at once for simplicity in ReAct)
    yield {"type": "text", "content": final_prose}
    
    # Final consolidated message for UI cards
    _filt: dict[str, Any] = {
        "gender": shop_state.get("gender") or "",
        "category": shop_state.get("category") or "",
    }
    if shop_state.get("query"):
        _filt["query"] = shop_state["query"]

    yield {
        "type": "final",
        "reply": final_prose,
        "products": discovered_products[:12],
        "intent": "agent_curation",
        "filter": _filt,
    }
    
    yield "data: [DONE]\n\n"

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"name": "SecundusDermis", "status": "running", "catalog_size": len(state.catalog)}

@app.get("/health")
async def health():
    return {"status": "healthy", "catalog_size": len(state.catalog), "search_mode": "keyword + VLM"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    image_bytes = None
    mime_type = "image/jpeg"
    if request.image_id:
        for ext in ["jpg", "jpeg", "png", "webp"]:
            candidate = config.UPLOADS_DIR / f"{request.image_id}.{ext}"
            if candidate.exists():
                image_bytes = candidate.read_bytes()
                mime_type = "image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}"
                break
    
    result = await gemini_chat(request.message, image_bytes, mime_type)
    return ChatResponse(reply=result["reply"], products=result["products"], intent=result["intent"])

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    image_bytes = None
    mime_type = "image/jpeg"
    if request.image_id:
        for ext in ["jpg", "jpeg", "png", "webp"]:
            candidate = config.UPLOADS_DIR / f"{request.image_id}.{ext}"
            if candidate.exists():
                image_bytes = candidate.read_bytes()
                mime_type = "image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}"
                break
    
    async def generate():
        async for event in gemini_chat_stream(request.message, image_bytes, mime_type,
                                              ws_session_id=request.session_id,
                                              shop_context=request.shop_context):
            if event == "data: [DONE]\n\n":
                yield event
            else:
                yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})

@app.post("/image/upload", response_model=ImageUploadResponse)
async def upload_image_for_agent(file: UploadFile = File(...)):
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
    
    logger.info(f"Uploaded image: {image_id} -> {file_path}")
    return ImageUploadResponse(image_id=image_id, message="Image uploaded successfully")

# ── Auth, Cart, etc (simplified) ──────────────────────────────────────────────

@app.post("/auth/register", response_model=RegisterResponse, status_code=201)
async def register(user: UserCreate):
    out = create_user(email=user.email, password=user.password, name=user.name)
    if out is None:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_resp, token = out
    verify_url = f"{config.FRONTEND_PUBLIC_URL}/verify-email?token={token}"
    base_message = "Check your email to verify your account before signing in."
    if gmail_smtp_configured():
        ok, err = try_send_verification_email(user_resp.email, verify_url)
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


@app.post("/auth/verify-email")
async def verify_email_endpoint(body: VerifyEmailRequest):
    if not verify_email_token(body.token):
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    return {"status": "Email verified. You can sign in now."}


@app.post("/auth/resend-verification")
async def resend_verification_ep(payload: dict):
    """Send a new verification link if the account exists and is not yet verified."""
    email = (payload.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    token = resend_verification_token(email)
    verify_url = f"{config.FRONTEND_PUBLIC_URL}/verify-email?token={token}"
    if token and gmail_smtp_configured():
        ok, err = try_send_verification_email(email.lower(), verify_url)
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


@app.post("/auth/login", response_model=LoginResponse)
async def login(user: UserLogin):
    session_id, auth_err = try_authenticate(email=user.email, password=user.password)
    if auth_err == "email_not_verified":
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in. Check your inbox for the verification link.",
        )
    if session_id is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user_resp = get_user_from_session(session_id)
    response = JSONResponse(content={"session_id": session_id, "user": {"email": user_resp.email, "name": user_resp.name}})
    response.set_cookie(key="sd_session_id", value=session_id, max_age=30*24*60*60, httponly=True, samesite="lax", path="/")
    return response

@app.post("/auth/logout")
async def logout_endpoint(session_id: Optional[str] = Header(default=None, alias="session-id")):
    if session_id: logout(session_id)
    response = JSONResponse(content={"status": "logged out"})
    response.delete_cookie(key="sd_session_id", path="/")
    return response

@app.get("/auth/me")
async def get_current_user(session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    user = get_user_from_session(session_id)
    if not user: raise HTTPException(status_code=401, detail="Invalid session")
    return user


@app.post("/auth/request-password-reset")
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
    
    if not token:
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
        ok, err = try_send_password_reset_email(email.strip().lower(), reset_url)
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


@app.post("/auth/reset-password")
async def reset_password_endpoint(reset_data: PasswordReset):
    """
    Reset password using a valid token.
    """
    success = reset_password(token=reset_data.token, new_password=reset_data.new_password)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    return {"status": "Password reset successful"}

@app.get("/cart", response_model=CartResponse)
async def get_user_cart(session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: return CartResponse(items=[], total=0.0)
    return get_cart(session_id)

@app.post("/cart", response_model=CartResponse)
async def add_item_to_cart(product_id: str, product_name: str, price: float, image_url: str, quantity: int = 1, session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    return add_to_cart(session_id, product_id, product_name, price, image_url, quantity)

@app.delete("/cart/{product_id}", response_model=CartResponse)
async def remove_cart_item_endpoint(product_id: str, session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    return remove_from_cart(session_id, product_id)

@app.get("/catalog/browse")
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

@app.get("/catalog/random")
async def catalog_random(n: int = 12):
    """Return n random products for the home page hero."""
    import random as _random
    sample = _random.sample(state.catalog, min(n, len(state.catalog)))
    return {"products": [{k: v for k, v in p.items() if k != "image_path"} for p in sample]}


# ── Journal endpoints ─────────────────────────────────────────────────────────

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


@app.get("/journal")
async def journal_list(category: Optional[str] = None, featured: Optional[bool] = None):
    posts = _load_journal()
    if category:
        posts = [p for p in posts if p.get("category", "").lower() == category.lower()]
    if featured is not None:
        posts = [p for p in posts if bool(p.get("featured")) == featured]
    previews = [{k: v for k, v in p.items() if k != "body"} for p in posts]
    return {"posts": previews, "total": len(previews)}


@app.get("/journal/categories")
async def journal_categories():
    posts = _load_journal()
    cats = sorted({p.get("category", "") for p in posts if p.get("category")})
    return {"categories": cats}


@app.get("/journal/{slug}")
async def journal_post(slug: str):
    path = config.JOURNAL_DIR / f"{slug}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Post not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            post = json.load(f)
            post.setdefault("slug", slug)
            return post
    except Exception as e:
        logger.error(f"Failed to read journal JSON {path}: {e}")
        raise HTTPException(status_code=500, detail="Could not read post")


@app.post("/journal")
async def create_journal_post(post: dict, session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id or not get_user_from_session(session_id):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    slug = re.sub(r"[^a-z0-9]+", "-", post.get("title", "untitled").lower()).strip("-")
    path = config.JOURNAL_DIR / f"{slug}.json"
    
    # AI-authored by default as requested
    post.setdefault("author", "Secundus Dermis")
    post.setdefault("slug", slug)
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(post, f, indent=2)
        
    return {"slug": slug, "message": "Post created"}

# ── Conversations (Session Sync) ──────────────────────────────────────────────

@app.get("/conversations")
async def get_conversations(session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: return {"messages": []}
    return {"messages": get_messages(session_id)}

@app.post("/conversations")
async def add_message(msg: ConvoMessage, session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    messages = append_message(session_id, msg.role, msg.content, msg.timestamp)
    
    # TRIGGER: After 10 messages, dump a reflection to the journal
    if len(messages) == 10:
        user = get_user_from_session(session_id)
        if user:
            # Run in background to not block the request
            asyncio.create_task(dump_context_to_journal(session_id, user.email))
            
    return {"messages": messages}

@app.delete("/conversations")
async def clear_conversation_endpoint(session_id: Optional[str] = Header(default=None, alias="session-id")):
    if not session_id: raise HTTPException(status_code=401, detail="No session")
    clear_convo(session_id)
    return {"status": "cleared"}


@app.get("/catalog/product/{product_id}")
async def catalog_product(product_id: str):
    item = next((p for p in state.catalog if p["product_id"] == product_id), None)
    if item is None: raise HTTPException(status_code=404, detail="Product not found")
    return {k: v for k, v in item.items() if k != "image_path"}

# ── Socket.IO event handlers ──────────────────────────────────────────────────

@sio.on("connect")
async def on_connect(sid, environ):
    logger.info(f"[SOCKETIO] Client connected: {sid}")


@sio.on("disconnect")
async def on_disconnect(sid):
    logger.info(f"[SOCKETIO] Client disconnected: {sid}")


@sio.on("join_session")
async def on_join_session(sid, data):
    """Client sends { session_id } to subscribe to its personal event room."""
    session_id = (data or {}).get("session_id", "")
    if session_id:
        room = f"sd_{session_id}"
        await sio.enter_room(sid, room)
        await sio.emit("connected", {"session_id": session_id, "status": "joined"}, to=sid)
        logger.info(f"[SOCKETIO] {sid} joined room {room}")


@sio.on("ping")
async def on_ping(sid, data):
    await sio.emit("pong", {}, to=sid)


# ── Wrap FastAPI with Socket.IO ───────────────────────────────────────────────
# All /socket.io/* requests are handled by Socket.IO;
# everything else is forwarded to the FastAPI app.

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    import argparse
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-reload", dest="reload", action="store_false",
                        help="Disable hot reload (used in production/Docker)")
    parser.set_defaults(reload=True)
    args = parser.parse_args()
    uvicorn.run("api:socket_app", host="0.0.0.0", port=8000, reload=args.reload)
