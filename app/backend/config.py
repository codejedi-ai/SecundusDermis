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

# ── AI Model Configuration ────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL          = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview-customtools")
EMBED_MODEL    = "gemini-embedding-2-preview"
EMBEDDING_DIM  = 3072
THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "low")

# ── Standalone stylist agent (optional) ─────────────────────────────────────
# When AGENT_SERVICE_URL is set, POST /chat/stream is proxied to that service.
# The agent process uses AGENT_INTERNAL_SECRET + BACKEND_URL to call /internal/agent/* and push Socket.IO.
AGENT_INTERNAL_SECRET = os.getenv("AGENT_INTERNAL_SECRET", "").strip()
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "").strip()

# ── Email (Gmail SMTP, optional) ─────────────────────────────────────────────
# Password reset links use this origin (no trailing slash).
FRONTEND_PUBLIC_URL = os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173").rstrip("/")

# ── Initialization ────────────────────────────────────────────────────────────
def init_directories():
    """Ensure all required data directories exist."""
    for path in [KAGGLE_DIR, DATASET_ROOT, IMAGES_DIR, CHROMA_DIR, JOURNAL_DIR, UPLOADS_DIR]:
        path.mkdir(parents=True, exist_ok=True)
