"""
download_data.py
================
Downloads a dataset from Kaggle when the local data/ directory is missing or incomplete.
Detection logic:
  1. Check if config.DATASET_ZIP exists in config.KAGGLE_DIR.
  2. If zip exists, check if config.DATASET_ROOT has the content.
  3. If not ready, extract into config.DATASET_ROOT.
"""

from __future__ import annotations

import logging
import os
import zipfile
from pathlib import Path
import config

log = logging.getLogger(__name__)

# Configurable via environment variable
DATASET_SLUG = os.getenv("KAGGLE_DATASET_SLUG", "silverstone1903/deep-fashion-multimodal")


def _inject_credentials() -> bool:
    """Inject Kaggle credentials into environment."""
    token = os.getenv("KAGGLE_API_TOKEN", "").strip()
    if token:
        os.environ["KAGGLE_API_TOKEN"] = token
        return True

    key      = os.getenv("KAGGLE_KEY", "").strip()
    username = os.getenv("KAGGLE_USERNAME", "").strip()
    if key and username:
        os.environ["KAGGLE_KEY"]      = key
        os.environ["KAGGLE_USERNAME"] = username
        return True

    return False


def data_ready() -> bool:
    """Return True if the catalog CSV and images directory already exist in config.DATASET_ROOT."""
    if not config.LABELS_CSV.exists():
        return False
    if not config.IMAGES_DIR.exists():
        return False
    # Check for at least one image
    return any(config.IMAGES_DIR.glob("*.jpg"))


def _extract_zip(zip_path: Path) -> None:
    """Extract zip into config.DATASET_ROOT."""
    log.info(f"Extracting {zip_path.name} to {config.DATASET_ROOT} …")
    config.DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(config.DATASET_ROOT)
    
    # Flatten if everything is inside a single subfolder
    subdirs = [d for d in config.DATASET_ROOT.iterdir() if d.is_dir()]
    if len(subdirs) == 1 and not (config.DATASET_ROOT / "labels_front.csv").exists():
        sub = subdirs[0]
        log.info(f"  Flattening {sub.name}/ contents …")
        for item in sub.iterdir():
            dest = config.DATASET_ROOT / item.name
            if not dest.exists():
                item.rename(dest)
        try: sub.rmdir()
        except OSError: pass

    log.info(f"  Extraction complete.")


def download_and_extract() -> bool:
    """
    Ensure the dataset is present and extracted.
    1. Check if already extracted (data_ready).
    2. If not, check if ZIP exists.
    3. If ZIP doesn't exist, download it.
    4. Extract ZIP.
    """
    config.KAGGLE_DIR.mkdir(parents=True, exist_ok=True)

    if data_ready():
        log.info(f"Dataset already extracted at {config.DATASET_ROOT}. Skipping.")
        return True

    # If zip is not there, we must download
    if not config.DATASET_ZIP.exists():
        log.info(f"Zip file not found at {config.DATASET_ZIP}. Attempting download...")
        if not _inject_credentials():
            log.error("Kaggle credentials missing. Cannot download zip.")
            return False
        
        try:
            import kaggle
            kaggle.api.dataset_download_files(
                DATASET_SLUG,
                path=str(config.KAGGLE_DIR),
                unzip=False,
                quiet=False,
            )
            # Kaggle downloads to slug name usually, ensure it matches our config.DATASET_ZIP path
            # (In reality it might be named deep-fashion-multimodal.zip)
        except Exception as e:
            log.error(f"Download failed: {e}")
            return False

    # Perform extraction
    if config.DATASET_ZIP.exists():
        _extract_zip(config.DATASET_ZIP)
        return data_ready()

    return False


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    ok = download_and_extract()
    raise SystemExit(0 if ok else 1)
