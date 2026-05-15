"""
config.py
=========
Centralized configuration for Secundus Dermis backend.
Derives all data paths from a single source of truth.
"""

import os
import warnings
from pathlib import Path

# ── Base Data Directory ───────────────────────────────────────────────────────
# All runtime catalog + vector + journal-on-disk + uploads data lives under
# **app/data/** (`../data` from this package). Optional `DATA_DIR` in env is
# honored only when it resolves to that exact directory; otherwise it is ignored
# with a warning so nothing writes outside the `app/` tree.
#
# Kaggle zip path: DATA_DIR/kaggle/deep-fashion-multimodal.zip
_APP_ROOT = Path(__file__).resolve().parent
_APP_HOME = _APP_ROOT.parent.resolve()
APP_DATA_DIR = (_APP_HOME / "data").resolve()


def _paths_equal(a: Path, b: Path) -> bool:
    ra, rb = a.resolve(), b.resolve()
    if ra == rb:
        return True
    try:
        return ra.samefile(rb)
    except OSError:
        return False


_req = os.getenv("DATA_DIR", "").strip()
if not _req:
    DATA_DIR = APP_DATA_DIR
else:
    _p = Path(_req).expanduser()
    _candidate = _p.resolve() if _p.is_absolute() else (_APP_ROOT / _p).resolve()
    if _paths_equal(_candidate, APP_DATA_DIR):
        DATA_DIR = APP_DATA_DIR
    else:
        warnings.warn(
            f"DATA_DIR={_req!r} is not the canonical app data directory {APP_DATA_DIR!r}; "
            "using app/data only.",
            UserWarning,
            stacklevel=1,
        )
        DATA_DIR = APP_DATA_DIR

# ── Derived Subdirectories ────────────────────────────────────────────────────
# Organized as requested: Kaggle, ChromaDB, Journal, and Uploads
KAGGLE_DIR    = DATA_DIR / "kaggle"
DATASET_NAME  = "deep-fashion-multimodal"
DATASET_ZIP   = KAGGLE_DIR / f"{DATASET_NAME}.zip"
DATASET_ROOT  = KAGGLE_DIR / DATASET_NAME

# Specific Data Assets
LABELS_CSV    = DATASET_ROOT / "labels_front.csv"
IMAGES_DIR    = DATASET_ROOT / "selected_images"
CHROMA_DIR    = DATA_DIR / "chroma_db"
JOURNAL_DIR   = DATA_DIR / "journal"
UPLOADS_DIR   = DATA_DIR / "uploads"
PROMPTS_FILE  = DATA_DIR / "prompts.json"

# ── AI Model Configuration (used by documentation; Gemini runs on ``app/agent`` only) ──
MODEL          = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview-customtools")
EMBED_MODEL    = "gemini-embedding-2-preview"
EMBEDDING_DIM  = 3072
THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "low")

# ── Standalone stylist agent (optional) ─────────────────────────────────────
# When AGENT_SERVICE_URL is set, patron ``POST /api/patron/agent/chat/stream`` is proxied to that service.
# The agent process uses AGENT_INTERNAL_SECRET + BACKEND_URL to call /internal/agent/* and push Socket.IO.
from agent_secret_file import read_or_create_agent_internal_secret

AGENT_INTERNAL_SECRET = read_or_create_agent_internal_secret(DATA_DIR)
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "").strip()

# ── Email (Gmail SMTP, optional) ─────────────────────────────────────────────
# Password reset links use this origin (no trailing slash).
FRONTEND_PUBLIC_URL = os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173").rstrip("/")

# Public URL prefix for patron JSON routes (``APIRouter`` prefix). Keep in sync with ``PUBLIC_HTTP_API_PREFIX`` in ``app/frontend/src/lib/api-base.ts``.
PUBLIC_HTTP_API_PREFIX = "/api"


def _env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None or not str(v).strip():
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


# When ``False``, FastAPI does not mount ``CORSMiddleware``. Use with the Vite dev proxy so the
# browser talks same-origin to ``/api`` only (no cross-origin HTTP). Production or direct-to-API
# browsers should set ``CORS_ENABLED=true`` (default) and tune origins below.
CORS_ENABLED = _env_bool("CORS_ENABLED", True)

# When ``False``, patron sign-in/register routes return 503; browser stylist chat works without login.
AUTH_ENABLED = _env_bool("AUTH_ENABLED", True)

# Demo deployment: ``AUTH_ENABLED`` off — no accounts, no server-side conversation store.
EPHEMERAL_MODE = not AUTH_ENABLED

# Shared house ``sdag_…`` when ephemeral (boutique chat without accounts).
GUEST_PATRON_EMAIL = os.getenv("GUEST_PATRON_EMAIL", "guest@secundus.local").strip().lower()

# When CORS is on: never use ``["*"]`` with credentialed fetches (see project notes / prior bug).
# Extra comma-separated origins (scheme+host+port), merged with FRONTEND_PUBLIC_URL.
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
if "CORS_ALLOW_ORIGIN_REGEX" in os.environ:
    _cors_re = os.environ["CORS_ALLOW_ORIGIN_REGEX"].strip()
    CORS_ALLOW_ORIGIN_REGEX: str | None = _cors_re or None
else:
    CORS_ALLOW_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


def cors_allow_origins() -> list[str]:
    """Explicit browser origins for credentialed CORS (never ``*``)."""
    out: list[str] = []
    seen: set[str] = set()
    base = FRONTEND_PUBLIC_URL.rstrip("/")
    if base:
        seen.add(base)
        out.append(base)
    for part in CORS_ALLOWED_ORIGINS.split(","):
        o = part.strip().rstrip("/")
        if o and o not in seen:
            seen.add(o)
            out.append(o)
    if not out:
        out.append("http://localhost:5173")
    return out


# ── Initialization ────────────────────────────────────────────────────────────
def init_directories():
    """Ensure all required data directories exist."""
    for path in [KAGGLE_DIR, DATASET_ROOT, IMAGES_DIR, CHROMA_DIR, JOURNAL_DIR, UPLOADS_DIR]:
        path.mkdir(parents=True, exist_ok=True)
