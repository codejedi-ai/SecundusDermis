"""
SecundusDermis — AI Fashion Agent API (Direct Gemini SDK)
==========================================================
Uses Gemini SDK directly - NO ADK.
"""

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
from pathlib import Path
from typing import Optional, AsyncGenerator

import numpy as np
from dotenv import load_dotenv
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
    UserCreate, UserLogin, UserResponse, LoginResponse,
    create_user, authenticate_user, get_user_from_session, logout,
)
from cart import CartItem, CartResponse, get_cart, add_to_cart, update_cart_item, remove_from_cart, clear_cart
from conversations import get_messages, append_message, clear_messages as clear_convo
from download_data import download_and_extract
from user_profiles import add_cart_item as profile_add_cart, record_activity as profile_record_activity
from vector_store import get_vector_store, ImageEmbedding, JournalEmbedding
import config

load_dotenv(Path(__file__).parent / ".env")

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

# ── Global state ──────────────────────────────────────────────────────────────

class _State:
    gemini: genai.Client | None = None
    catalog: list[dict] = []
    histogram_cache: dict[str, np.ndarray] = {}

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

# ── VLA Chat ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a luxury fashion stylist at Secundus Dermis.
Respond in plain, elegant prose — no lists, no headers, no code blocks, no HTML.
Never output regex patterns, search queries, technical markup, or implementation details of any kind.
Your reply is a short editorial paragraph (2–4 sentences) that speaks directly to the patron.

IMPORTANT: Do NOT invent or name specific products. Do NOT claim specific items exist.
Real catalog pieces are displayed separately as product cards — your job is the editorial voice only."""

async def gemini_chat(message: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> dict:
    """Direct Gemini VLA call - no ADK."""
    logger.info(f"[GEMINI] Chat: {message[:80]}... image={image_bytes is not None}")

    parts = []
    if image_bytes:
        parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
    
    # Prompt that forces product search
    prompt = f"""{SYSTEM_PROMPT}

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
    """Stream Gemini response + catalog search with real-time tool events.

    When a full-body image is provided, runs the 6-section outfit analysis.
    For text-only queries, runs a direct regex search and returns a flat product list.
    """
    logger.info(f"[GEMINI STREAM] Chat: {message[:80]}... image={image_bytes is not None}")

    yield {"type": "thinking_start", "content": "Understanding your request..."}

    if image_bytes:
        yield {"type": "thinking", "content": "Analysing your image with the VLA model..."}

    # ── Step 1: Vector RAG & Memory ──────────────────────────────────────────
    vs = get_vector_store()
    rag_context = ""
    try:
        # Generate embedding (multimodal if image present)
        embed_contents = []
        if image_bytes:
            # Multimodal embedding for Gemini 2.0
            embed_contents.append(genai_types.Content(
                parts=[
                    genai_types.Part(text=message),
                    genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                ]
            ))
        else:
            embed_contents.append(message)

        res = state.gemini.models.embed_content(
            model=config.EMBED_MODEL,
            contents=embed_contents,
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        )
        query_embedding = res.embeddings[0].values
        
        user = get_user_from_session(ws_session_id) if ws_session_id else None
        email = user.email if user else None

        # Memorize query
        vs.add_query_embedding(message, query_embedding, session_id=ws_session_id or "default", email=email)
        
        # If image present, also store in image collection
        if image_bytes:
            img_id = f"chat_img_{int(time.time())}"
            vs.add_image_embedding(ImageEmbedding(
                image_id=img_id,
                embedding=query_embedding,
                description=message,
                keywords=[],
                garment_type=None,
                colors=[],
                gender=None,
                category=None,
                user_email=email,
                session_id=ws_session_id or "default",
                timestamp=time.time(),
                image_path="" # We don't have a direct path here usually, it's in-memory/chat
            ))

        # Search Journal for RAG
        journal_hits = vs.search_journal(query_embedding, limit=3)
        if journal_hits:
            rag_context += "\n\n## Relevant Journal Excerpts (use these for styling advice)\n"
            for hit in journal_hits:
                rag_context += f"- {hit['metadata']['title']}: {hit['metadata']['excerpt']}\n"
        
        # Search visual memory for relevant context
        img_memory_hits = vs.search_images_by_similarity(query_embedding, limit=2)
        if img_memory_hits:
            rag_context += "\n\n## Related Past Visuals from Memory\n"
            for hit in img_memory_hits:
                rag_context += f"- Previously encountered: {hit['metadata']['description']}\n"
    except Exception as e:
        logger.warning(f"RAG step failed: {e}")

    # ── Step 2: Gemini narrative ─────────────────────────────────────────────
    yield {"type": "tool_call", "tool": "gemini_narrative",
           "content": "gemini_narrative — composing response..."}

    parts = []
    if image_bytes:
        parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    # Inject current shop state + RAG context
    ctx_lines = []
    if shop_context:
        if shop_context.gender:
            ctx_lines.append(f"  Sidebar gender selected : {shop_context.gender}")
        if shop_context.category:
            ctx_lines.append(f"  Sidebar category selected: {shop_context.category}")
        if shop_context.query:
            ctx_lines.append(f"  Human's search bar text  : \"{shop_context.query}\"")
    ctx_block = ("\n\n## Current shop context\n" + "\n".join(ctx_lines)) if ctx_lines else \
                "\n\n## Current shop context\n  Nothing selected — full archive is visible."

    image_instruction = (
        "\n\nAn image has been uploaded. "
        "On the very first line of your response write exactly one of these tokens (nothing else on that line):\n"
        "  GENDER:MEN   — if the image shows menswear / a male\n"
        "  GENDER:WOMEN — if the image shows womenswear / a female\n"
        "  GENDER:NONE  — if there is no person or the gender is ambiguous\n"
        "Then, on the following lines, write 2-3 sentences describing the outfit or item in your editorial voice. "
        "Do NOT repeat or mention the GENDER token in your prose."
    ) if image_bytes else ""

    # Final prompt assembly
    full_prompt = f"{SYSTEM_PROMPT}{ctx_block}{rag_context}{image_instruction}\n\nPatron: {message}"
    parts.append(genai_types.Part(text=full_prompt))

    gen_config = genai_types.GenerateContentConfig(
        thinking_config=genai_types.ThinkingConfig(thinking_level=config.THINKING_LEVEL),
        temperature=1.0,
    )

    try:
        response = state.gemini.models.generate_content(model=config.MODEL, contents=parts, config=gen_config)
        raw_text = response.text or ""
        logger.info(f"[GEMINI STREAM] Raw: {raw_text[:150]}...")

        # ── Parse gender token from image response ────────────────────────────
        image_gender: Optional[str] = None
        full_text = raw_text
        if image_bytes:
            first_line, _, rest = raw_text.partition("\n")
            token = first_line.strip().upper()
            if token == "GENDER:MEN":
                image_gender = "MEN"
                full_text = rest.strip()
            elif token == "GENDER:WOMEN":
                image_gender = "WOMEN"
                full_text = rest.strip()
            elif token == "GENDER:NONE":
                full_text = rest.strip()
            # if token doesn't match, keep full raw_text as-is

        yield {"type": "tool_result", "tool": "gemini_narrative",
               "content": "gemini_narrative → response composed"}

        # ── Helper: push named event to Socket.IO room ───────────────────────
        async def ws_push(name: str, payload: dict):
            if ws_session_id:
                room = f"sd_{ws_session_id}"
                try:
                    await sio.emit(name, payload, room=room)
                except Exception as exc:
                    logger.debug(f"[SOCKETIO] push '{name}' to {room} failed: {exc}")

        # ── Detect gender: image takes priority, then text message ────────────
        gender = image_gender or _detect_gender(message)
        gender_label = f"gender={gender}" if gender else "gender=ALL"
        yield {"type": "thinking", "content": f"Detected: {gender_label}"}

        all_sections: list[dict] = []
        all_products: list[dict] = []
        shop_filter: Optional[dict] = None

        if image_bytes:
            # ── IMAGE PATH: section-by-section full outfit search ─────────────
            seen_ids: set[str] = set()

            for section in BODY_SECTIONS:
                if gender == "MEN":
                    cats = section["men_categories"]
                elif gender == "WOMEN":
                    cats = section["women_categories"]
                else:
                    cats = section["men_categories"] + section["women_categories"]

                section_products: list[dict] = []

                is_primary = bool(re.search(section["regex_pattern"], message, re.IGNORECASE))
                cap = 4 if is_primary else 2

                user_terms = [re.escape(t) for t in re.split(r"\s+", message.strip()) if len(t) > 2]
                combined_pattern = "|".join(filter(None, user_terms + [section["regex_pattern"]]))

                scope = f"categories={cats}" if cats else "scope='full catalog'"
                yield {"type": "tool_call", "tool": "regex_search",
                       "content": f"regex_search(pattern=r'{combined_pattern[:60]}', {scope})"}

                rx_results: list[dict] = []
                if cats:
                    for cat in cats:
                        r = regex_search_local(combined_pattern, categories=[cat], gender=gender, n_results=cap)
                        rx_results.extend(r)
                else:
                    rx_results = regex_search_local(combined_pattern, gender=gender, n_results=cap)

                found_label = f"{len(rx_results)} results" if rx_results else "0 results — not in archive"
                yield {"type": "tool_result", "tool": "regex_search",
                       "content": f"regex_search → {found_label} [{section['label'].split('—')[0].strip()}]"}

                for p in rx_results:
                    pid = p["product_id"]
                    if pid not in seen_ids and len(section_products) < cap:
                        section_products.append(p)
                        seen_ids.add(pid)
                        all_products.append(p)

                if section_products:
                    all_sections.append({
                        "id": section["id"],
                        "label": section["label"],
                        "description": section["description"],
                        "products": section_products,
                    })

            sections_with_hits = sum(1 for s in all_sections if s["products"])
            yield {"type": "found_products", "count": len(all_products),
                   "content": f"Found {len(all_products)} pieces across {sections_with_hits} sections"}

            # If fewer than 3 zones have results the image is likely a single product,
            # not a full outfit — collapse to a flat list and discard sections.
            if sections_with_hits < 3:
                all_sections = []

        else:
            # ── TEXT PATH: single direct regex search ─────────────────────────
            user_terms = [re.escape(t) for t in re.split(r"\s+", message.strip()) if len(t) > 2]
            combined_pattern = "|".join(user_terms) if user_terms else message.strip()

            yield {"type": "tool_call", "tool": "regex_search",
                   "content": f"regex_search(pattern=r'{combined_pattern[:80]}', gender={gender or 'ALL'})"}

            all_products = regex_search_local(combined_pattern, gender=gender, n_results=12)

            found_label = f"{len(all_products)} results" if all_products else "0 results"
            yield {"type": "tool_result", "tool": "regex_search",
                   "content": f"regex_search → {found_label}"}

            if all_products:
                yield {"type": "found_products", "count": len(all_products),
                       "content": f"Found {len(all_products)} matching pieces"}

        # ── Build shop filter ────────────────────────────────────────────────
        if all_products:
            genders = [p.get("gender") for p in all_products if p.get("gender") and p.get("gender") != "unknown"]
            shop_filter = {
                "gender": max(set(genders), key=genders.count) if genders else gender,
                "query": message,
            }

        # ── Push ui_action events via Socket.IO ──────────────────────────────
        await ws_push("ui_action", {
            "action": "set_search_hint",
            "payload": {"query": message},
            "description": f"Hinting search bar: {message[:40]}",
        })

        if gender:
            await ws_push("ui_action", {
                "action": "select_sidebar",
                "payload": {"gender": gender},
                "description": f"Selecting sidebar gender: {gender}",
            })
        else:
            await ws_push("ui_action", {
                "action": "clear_filters",
                "payload": {},
                "description": "Clearing sidebar — showing full archive",
            })

        yield {
            "type": "final",
            "reply": full_text,
            "sections": all_sections,
            "products": all_products,
            "intent": "image_search" if image_bytes else ("text_search" if all_products else "chitchat"),
            "filter": shop_filter,
        }

    except Exception as e:
        logger.exception(f"[GEMINI STREAM] Error: {e}")
        yield {"type": "error", "content": str(e)[:100]}
        yield {"type": "final", "reply": f"Error: {str(e)[:200]}", "products": [], "sections": [], "intent": "error"}

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

@app.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(user: UserCreate):
    result = create_user(email=user.email, password=user.password, name=user.name)
    if result is None: raise HTTPException(status_code=400, detail="Email already registered")
    return result

@app.post("/auth/login", response_model=LoginResponse)
async def login(user: UserLogin):
    session_id = authenticate_user(email=user.email, password=user.password)
    if session_id is None: raise HTTPException(status_code=401, detail="Invalid credentials")
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
