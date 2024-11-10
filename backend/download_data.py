"""
download_data.py
================
Downloads the Deep Fashion Multimodal dataset from Kaggle when the local
data/ directory is missing or incomplete.

Dataset:  silverstone1903/deep-fashion-multimodal
Expected output after extraction:
  data/labels_front.csv
  data/selected_images/*.jpg   (~12 k images)

Usage (standalone):
  uv run python download_data.py

Called automatically by api.py at startup if data is not present.

Kaggle credentials — set in backend/.env:
  KAGGLE_API_TOKEN=KGAT_xxxxxxxxxxxxxxxxxxxx   (new token — no username needed)
  -- OR --
  KAGGLE_KEY=your_32char_key + KAGGLE_USERNAME=yourname   (classic API key)
"""

from __future__ import annotations

import logging
import os
import zipfile
from pathlib import Path

log = logging.getLogger(__name__)

DATASET_SLUG = "silverstone1903/deep-fashion-multimodal"
DATA_DIR     = Path(os.getenv("DATASET_ROOT", "./data"))
LABELS_CSV   = DATA_DIR / "labels_front.csv"
IMAGES_DIR   = Path(os.getenv("IMAGES_DIR",  "./data/selected_images"))


def _inject_credentials() -> bool:
    """
    Set Kaggle credentials in os.environ BEFORE importing the kaggle package
    (kaggle 2.x auto-authenticates on import).

    Priority:
      1. KAGGLE_API_TOKEN=KGAT_...  — new access-token style (no username needed)
      2. KAGGLE_KEY + KAGGLE_USERNAME — classic API key (legacy)

    Returns True if credentials are available, False if none found.
    """
    # New-style KGAT access token (takes priority)
    token = os.getenv("KAGGLE_API_TOKEN", "").strip()
    if token:
        os.environ["KAGGLE_API_TOKEN"] = token
        log.info("Kaggle: using KGAT access token (KAGGLE_API_TOKEN)")
        return True

    # Classic key fallback
    key      = os.getenv("KAGGLE_KEY", "").strip()
    username = os.getenv("KAGGLE_USERNAME", "").strip()
    if key and username:
        os.environ["KAGGLE_KEY"]      = key
        os.environ["KAGGLE_USERNAME"] = username
        log.info("Kaggle: using legacy API key (KAGGLE_KEY / KAGGLE_USERNAME)")
        return True

    log.warning(
        "No Kaggle credentials found — cannot auto-download dataset.\n"
        "  Add  KAGGLE_API_TOKEN=KGAT_...  to backend/.env\n"
        "  (Generate one at https://www.kaggle.com/settings → API → Create New Token)"
    )
    return False


def data_ready() -> bool:
    """Return True if the catalog CSV and at least one image already exist."""
    if not LABELS_CSV.exists():
        return False
    if not IMAGES_DIR.exists():
        return False
    return any(IMAGES_DIR.glob("*.jpg"))


def _extract_zip(zip_path: Path) -> None:
    """Extract zip into DATA_DIR, flattening a single top-level folder if present."""
    log.info(f"Extracting {zip_path.name} …")
    with zipfile.ZipFile(zip_path, "r") as zf:
        members = zf.namelist()
        log.info(f"  {len(members)} entries in archive")
        top_dirs = {m.split("/")[0] for m in members if "/" in m}
        zf.extractall(DATA_DIR)

        # Flatten: move contents of single subfolder up into DATA_DIR
        if len(top_dirs) == 1:
            sub = DATA_DIR / top_dirs.pop()
            if sub.is_dir() and not LABELS_CSV.exists():
                log.info(f"  Flattening {sub.name}/ → data/")
                for item in sub.iterdir():
                    dest = DATA_DIR / item.name
                    if not dest.exists():
                        item.rename(dest)
                try:
                    sub.rmdir()
                except OSError:
                    pass

    zip_path.unlink()
    log.info(f"  Deleted {zip_path.name}")


def download_and_extract() -> bool:
    """
    Download the dataset from Kaggle and extract it into DATA_DIR.
    No-op if the data is already present.
    Returns True on success (or already present), False on failure.
    """
    if data_ready():
        images = list(IMAGES_DIR.glob("*.jpg"))
        log.info(f"Dataset already present — {len(images)} images. Skipping download.")
        return True

    if not _inject_credentials():
        return False

    # Credentials must be in os.environ BEFORE importing kaggle,
    # because kaggle/__init__.py calls api.authenticate() on import.
    try:
        import kaggle as _kaggle  # noqa: F401 — triggers auth

        # kaggle 2.x exposes the pre-authenticated instance as kaggle.api
        from kaggle import api  # type: ignore

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        log.info(f"Downloading dataset: {DATASET_SLUG}")
        log.info("  This may take several minutes on first run …")

        api.dataset_download_files(
            DATASET_SLUG,
            path=str(DATA_DIR),
            unzip=False,
            quiet=False,
        )

        for z in DATA_DIR.glob("*.zip"):
            _extract_zip(z)

        if data_ready():
            images = list(IMAGES_DIR.glob("*.jpg"))
            log.info(f"Dataset ready — {len(images)} images, CSV: {LABELS_CSV}")
            return True

        log.error(
            "Extraction finished but expected files are still missing.\n"
            f"  Expected CSV : {LABELS_CSV}\n"
            f"  Expected imgs: {IMAGES_DIR}/*.jpg\n"
            "  Check the archive structure and update DATASET_ROOT / IMAGES_DIR in .env"
        )
        return False

    except SystemExit:
        # kaggle calls sys.exit(1) on auth failure
        log.error(
            "Kaggle authentication failed.\n"
            "  Check KAGGLE_API_TOKEN in backend/.env\n"
            "  Token must match your Kaggle account."
        )
        return False

    except Exception as exc:
        log.error(f"Kaggle download failed: {exc}")
        msg = str(exc).lower()
        if "401" in msg or "unauthorized" in msg or "forbidden" in msg:
            log.error("  → Authentication error. Check your KAGGLE_API_TOKEN.")
        elif "404" in msg or "not found" in msg:
            log.error(f"  → Dataset not found: {DATASET_SLUG}")
        return False


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    ok = download_and_extract()
    raise SystemExit(0 if ok else 1)
