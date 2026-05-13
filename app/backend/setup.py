"""
SecundusDermis — One-time database setup
=========================================
Loads ALL catalog items from CSV into ChromaDB instantly using
color histograms (PIL/numpy) — zero Gemini API calls.

  uv run python setup.py

Re-running is safe — skips if the DB is already populated.
Use --force to rebuild from scratch.

Dataset (under DATA_DIR; default when unset is the `data/` directory next to `backend/`):
  data/kaggle/deep-fashion-multimodal/selected_images/   — JPEG images
  data/kaggle/deep-fashion-multimodal/labels_front.csv   — columns: image_id, caption, path,
                                    gender, product_type, product_id,
                                    image_type
"""

import argparse
import csv
import hashlib
import io
import logging
import os
import random
import sys
from pathlib import Path

import chromadb
import numpy as np
from dotenv import load_dotenv
from PIL import Image
from tqdm import tqdm

load_dotenv(Path(__file__).parent / ".env")

# ── Configuration ─────────────────────────────────────────────────────────────

DATASET_ROOT       = Path(os.getenv("DATASET_ROOT",  "./data"))
IMAGES_DIR         = Path(os.getenv("IMAGES_DIR",    "./data/selected_images"))
LABELS_CSV         = DATASET_ROOT / "labels_front.csv"
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME    = os.getenv("COLLECTION_NAME",    "fashion_catalog")
MAX_ITEMS          = int(os.getenv("MAX_ITEMS", "0")) or None   # 0 = all

# Histogram settings — 32 bins × 3 channels = 96-dim vector
HIST_BINS = 32
HIST_DIM  = HIST_BINS * 3

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_attrs(description: str) -> dict:
    dl = description.lower()
    attrs: dict = {}
    for s in ["short-sleeve", "long-sleeve", "sleeveless"]:
        if s in dl:
            attrs["sleeve_length"] = s; break
    for g in ["shirt","t-shirt","dress","jacket","coat","sweater","blouse",
               "pants","trousers","shorts","skirt","vest","hoodie","cardigan",
               "suit","jumpsuit","top","jeans"]:
        if g in dl:
            attrs["garment_type"] = g; break
    for f in ["cotton","denim","leather","silk","wool","polyester",
               "chiffon","linen","knit","lace","velvet","satin","nylon"]:
        if f in dl:
            attrs["fabric"] = f; break
    for p in ["solid","striped","floral","plaid","graphic","printed",
               "checkered","polka dot","abstract","pure color","geometric"]:
        if p in dl:
            attrs["pattern"] = p; break
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


def _price(category: str) -> float:
    lo, hi = _PRICE_RANGES.get(category, (19.99, 79.99))
    return round(random.uniform(lo, hi), 2)


def color_histogram(img_source, bins: int = HIST_BINS) -> list[float]:
    """
    Compute a normalised RGB histogram vector from an image file path or
    raw bytes.  Returns a (bins*3,)-length list of floats summing to ~1.
    """
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
    return (hist / norm).tolist() if norm > 0 else hist.tolist()


# ── Pipeline stages ───────────────────────────────────────────────────────────

def already_ingested() -> bool:
    try:
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        return client.get_collection(COLLECTION_NAME).count() > 0
    except Exception:
        return False


def build_catalog() -> list[dict]:
    if not IMAGES_DIR.exists():
        sys.exit(f"\n[ERROR] Images directory not found: {IMAGES_DIR}\n"
                 "  Set IMAGES_DIR in backend/.env\n")
    if not LABELS_CSV.exists():
        sys.exit(f"\n[ERROR] Labels CSV not found: {LABELS_CSV}\n")

    rows: dict[str, dict] = {}
    with LABELS_CSV.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            image_id = row.get("image_id", "").strip()
            if image_id:
                rows[image_id] = row
    log.info(f"Loaded {len(rows)} rows from {LABELS_CSV}.")

    image_files = sorted(IMAGES_DIR.glob("*.jpg"))
    if MAX_ITEMS:
        image_files = image_files[:MAX_ITEMS]
    log.info(f"Building catalog from {len(image_files)} images …")

    catalog = []
    for img in image_files:
        stem = img.stem
        row  = rows.get(stem, {})
        gender = (row.get("gender", "") or "").strip().upper() or "unknown"
        cat    = (row.get("product_type", "") or "").strip()   or "unknown"
        desc   = (row.get("caption", "") or "").strip()
        attrs  = _extract_attrs(desc) if desc else {}
        catalog.append({
            "product_id":     hashlib.md5(stem.encode()).hexdigest()[:12],
            "image_path":     str(img),
            "image_filename": img.name,
            "product_name":   _product_name(gender, cat, attrs),
            "description":    desc,
            "gender":         gender,
            "category":       cat,
            "price":          _price(cat),
            "attributes":     attrs,
        })
    log.info(f"Catalog: {len(catalog)} items.")
    return catalog


def compute_histograms(catalog: list[dict]) -> list[list[float]]:
    """
    Build a colour histogram for every item — pure PIL/numpy, zero API calls.
    Skipped images get a zero vector and are marked unreadable.
    """
    log.info(f"Computing colour histograms for {len(catalog)} images "
             f"(bins={HIST_BINS}, dim={HIST_DIM}) …")
    histograms = []
    skipped = 0
    for item in tqdm(catalog, desc="Histograms"):
        try:
            histograms.append(color_histogram(item["image_path"]))
        except Exception as e:
            log.warning(f"Skipping {item['image_path']}: {e}")
            histograms.append([0.0] * HIST_DIM)
            skipped += 1
    if skipped:
        log.warning(f"{skipped} images could not be read and got zero vectors.")
    return histograms


def store(catalog: list[dict], histograms: list[list[float]]):
    log.info("Storing in ChromaDB …")
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    col = client.create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})

    CHUNK = 500
    for start in tqdm(range(0, len(catalog), CHUNK), desc="Storing"):
        chunk = catalog[start : start + CHUNK]
        hists = histograms[start : start + CHUNK]

        metadatas = []
        for item in chunk:
            meta = {
                "product_name":   item["product_name"],
                "gender":         item["gender"],
                "category":       item["category"],
                "price":          item["price"],
                "image_filename": item["image_filename"],
                "image_path":     item["image_path"],
            }
            for k, v in item.get("attributes", {}).items():
                meta[f"attr_{k}"] = v
            metadatas.append(meta)

        col.add(
            ids        = [i["product_id"] for i in chunk],
            embeddings = hists,
            metadatas  = metadatas,
            documents  = [i["description"] for i in chunk],
        )

    log.info(f"Stored {len(catalog)} items at: {CHROMA_PERSIST_DIR}")
    return col


def sanity_check(col: chromadb.Collection):
    log.info("Sanity check …")
    count = col.count()
    log.info(f"  Collection '{COLLECTION_NAME}': {count} items")
    sample = col.peek(limit=3)
    for meta in (sample.get("metadatas") or []):
        log.info(f"  {meta.get('product_name')} — {meta.get('gender')} / "
                 f"{meta.get('category')} — ${meta.get('price')}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SecundusDermis — one-time DB setup")
    parser.add_argument("--force", action="store_true",
                        help="Re-ingest even if the database already exists")
    args = parser.parse_args()

    log.info("=== SecundusDermis Setup (histogram mode — zero API calls) ===")
    log.info(f"  Images  : {IMAGES_DIR}")
    log.info(f"  CSV     : {LABELS_CSV}")
    log.info(f"  DB      : {CHROMA_PERSIST_DIR}")
    log.info(f"  Items   : {MAX_ITEMS or 'all'}")
    log.info(f"  Hist dim: {HIST_DIM}  (bins={HIST_BINS} × 3 channels)")

    if not args.force and already_ingested():
        log.info("Database already populated. Use --force to re-ingest. Exiting.")
        return

    catalog    = build_catalog()
    if not catalog:
        sys.exit("[ERROR] Empty catalog — check IMAGES_DIR / LABELS_CSV in backend/.env")

    histograms = compute_histograms(catalog)
    col        = store(catalog, histograms)
    sanity_check(col)

    log.info("\n=== Setup complete ===")
    log.info(f"  {len(catalog)} products indexed (no API calls used)")
    log.info(f"  Start the API: uv run python api.py")


if __name__ == "__main__":
    main()
