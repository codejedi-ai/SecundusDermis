"""
config.py
=========
Centralized configuration for Secundus Dermis backend.
Derives all data paths from a single source of truth.
"""

import os
from pathlib import Path

# ── Base Data Directory ───────────────────────────────────────────────────────
# Set DATA_DIR in backend/.env (local) or in your deployment environment.
# Default when unset: sibling `../data` next to this package (i.e. app/data).
# Recommended: absolute path to app/data, e.g. /path/to/SecundusDermis/app/data
# Kaggle zip path: DATA_DIR/kaggle/deep-fashion-multimodal.zip
#
# If DATA_DIR is relative, it is resolved against this package directory (backend/), not cwd.
_APP_ROOT = Path(__file__).resolve().parent
_APP_HOME = _APP_ROOT.parent
_data_raw = os.getenv("DATA_DIR", "").strip()
if not _data_raw:
    DATA_DIR = (_APP_HOME / "data").resolve()
else:
    _p = Path(_data_raw)
    DATA_DIR = _p.resolve() if _p.is_absolute() else (_APP_ROOT / _p).resolve()

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

# ── Email (Gmail SMTP, optional) ─────────────────────────────────────────────
# Password reset links use this origin (no trailing slash).
FRONTEND_PUBLIC_URL = os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173").rstrip("/")

# ── Initialization ────────────────────────────────────────────────────────────
def init_directories():
    """Ensure all required data directories exist."""
    for path in [KAGGLE_DIR, DATASET_ROOT, IMAGES_DIR, CHROMA_DIR, JOURNAL_DIR, UPLOADS_DIR]:
        path.mkdir(parents=True, exist_ok=True)
