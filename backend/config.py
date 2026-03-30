"""
config.py
=========
Centralized configuration for Secundus Dermis backend.
Derives all data paths from a single source of truth.
"""

import os
from pathlib import Path

# ── Base Data Directory ───────────────────────────────────────────────────────
# The only environment variable needed for data paths
DATA_DIR_STR = os.getenv("DATA_DIR", "./data")
DATA_DIR = Path(DATA_DIR_STR).resolve()

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

# ── AI Model Configuration ────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL          = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview-customtools")
EMBED_MODEL    = "gemini-embedding-2-preview"
EMBEDDING_DIM  = 3072
THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "low")

# ── Initialization ────────────────────────────────────────────────────────────
def init_directories():
    """Ensure all required data directories exist."""
    for path in [KAGGLE_DIR, DATASET_ROOT, IMAGES_DIR, CHROMA_DIR, JOURNAL_DIR, UPLOADS_DIR]:
        path.mkdir(parents=True, exist_ok=True)
