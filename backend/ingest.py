"""
SecundusDermis — Dataset Ingestion Script
==========================================
Run this ONCE before starting the API server.
Embeds DeepFashion-MultiModal images and stores them in ChromaDB.

Usage:
    python ingest.py --dataset-root /path/to/DeepFashion-MultiModal
    python ingest.py --dataset-root ./DeepFashion-MultiModal --max-items 2000
"""

import os
import re
import hashlib
import random
import logging
import argparse
from pathlib import Path

import numpy as np
import torch
import open_clip
from PIL import Image
from tqdm import tqdm
import chromadb

# ============================================================
# CONFIG
# ============================================================

MODEL_NAME = "hf-hub:Marqo/marqo-fashionSigLIP"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "fashion_catalog"
BATCH_SIZE = 32

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ============================================================
# DATASET PARSING
# ============================================================

def find_descriptions(dataset_root: Path) -> dict[str, str]:
    """
    Load text descriptions. Supports multiple directory structures:
    - textual_descriptions/*.txt  (one file per image)
    - labels/  with attribute files
    """
    descriptions = {}

    # Try textual_descriptions/ directory
    desc_dir = dataset_root / "textual_descriptions"
    if desc_dir.exists():
        for f in desc_dir.glob("*.txt"):
            stem = f.stem
            try:
                descriptions[stem] = f.read_text(encoding="utf-8").strip()
            except Exception:
                pass
        logger.info(f"Loaded {len(descriptions)} text descriptions from {desc_dir}")
        return descriptions

    # Try a single labels file (some versions use this)
    labels_file = dataset_root / "labels.json"
    if labels_file.exists():
        import json
        data = json.loads(labels_file.read_text())
        for k, v in data.items():
            if isinstance(v, str):
                descriptions[k] = v
            elif isinstance(v, dict) and "description" in v:
                descriptions[k] = v["description"]
        logger.info(f"Loaded {len(descriptions)} descriptions from labels.json")
        return descriptions

    logger.warning("No text descriptions found. Will generate from filenames.")
    return descriptions


def parse_attributes_from_description(description: str) -> dict:
    """Extract structured attributes from a text description."""
    attrs = {}
    dl = description.lower()

    sleeve_map = {"short-sleeve": "short-sleeve", "long-sleeve": "long-sleeve",
                  "sleeveless": "sleeveless", "short sleeve": "short-sleeve",
                  "long sleeve": "long-sleeve"}
    for k, v in sleeve_map.items():
        if k in dl:
            attrs["sleeve_length"] = v
            break

    garments = ["shirt", "t-shirt", "dress", "jacket", "coat", "sweater",
                "blouse", "pants", "trousers", "shorts", "skirt", "vest",
                "hoodie", "cardigan", "suit", "jumpsuit", "top", "jeans"]
    for g in garments:
        if g in dl:
            attrs["garment_type"] = g
            break

    fabrics = ["cotton", "denim", "leather", "silk", "wool", "polyester",
               "chiffon", "linen", "knit", "lace", "velvet", "satin", "nylon"]
    for f in fabrics:
        if f in dl:
            attrs["fabric"] = f
            break

    patterns = ["solid", "striped", "floral", "plaid", "graphic", "printed",
                "checkered", "polka dot", "abstract", "pure color", "geometric"]
    for p in patterns:
        if p in dl:
            attrs["pattern"] = p
            break

    necklines = ["crew", "v-neck", "round", "turtle", "collar", "scoop",
                 "off-shoulder", "halter", "boat", "mock"]
    for n in necklines:
        if n in dl:
            attrs["neckline"] = n
            break

    return attrs


def generate_product_name(gender: str, category: str, attrs: dict) -> str:
    """Create a human-readable product name."""
    parts = []
    if gender in ("MEN", "WOMEN"):
        parts.append("Men's" if gender == "MEN" else "Women's")
    if "fabric" in attrs:
        parts.append(attrs["fabric"].title())
    if "sleeve_length" in attrs:
        parts.append(attrs["sleeve_length"].title())
    if "garment_type" in attrs:
        parts.append(attrs["garment_type"].title())
    elif category and category != "unknown":
        parts.append(category.replace("_", " ").title())
    return " ".join(parts) if parts else "Fashion Item"


def generate_price(category: str) -> float:
    """Synthetic price based on category."""
    ranges = {
        "Denim": (39.99, 89.99), "Jackets_Vests": (59.99, 199.99),
        "Pants": (29.99, 79.99), "Shorts": (19.99, 49.99),
        "Skirts": (24.99, 69.99), "Shirts_Polos": (19.99, 59.99),
        "Tees_Tanks": (14.99, 39.99), "Sweaters": (34.99, 99.99),
        "Sweatshirts_Hoodies": (29.99, 79.99), "Dresses": (34.99, 129.99),
        "Suiting": (79.99, 299.99), "Blouses_Shirts": (24.99, 69.99),
        "Cardigans": (34.99, 89.99), "Rompers_Jumpsuits": (39.99, 99.99),
    }
    lo, hi = ranges.get(category, (19.99, 79.99))
    return round(random.uniform(lo, hi), 2)


def build_catalog(dataset_root: Path, max_items: int = None) -> list[dict]:
    """Build the product catalog from the dataset."""
    images_dir = dataset_root / "images"
    if not images_dir.exists():
        raise FileNotFoundError(f"Images directory not found: {images_dir}")

    descriptions = find_descriptions(dataset_root)
    image_files = sorted(images_dir.glob("*.jpg"))

    if max_items:
        image_files = image_files[:max_items]

    logger.info(f"Building catalog from {len(image_files)} images...")
    catalog = []

    for img_path in image_files:
        stem = img_path.stem
        parts = stem.split("-")
        gender = parts[0] if len(parts) > 0 else "unknown"
        category = parts[1] if len(parts) > 1 else "unknown"

        description = descriptions.get(stem, "")
        attrs = parse_attributes_from_description(description) if description else {}
        product_name = generate_product_name(gender, category, attrs)

        catalog.append({
            "product_id": hashlib.md5(stem.encode()).hexdigest()[:12],
            "image_path": str(img_path),
            "image_filename": img_path.name,
            "product_name": product_name,
            "description": description,
            "gender": gender,
            "category": category,
            "price": generate_price(category),
            "attributes": attrs,
        })

    logger.info(f"Catalog: {len(catalog)} items.")
    return catalog


# ============================================================
# EMBEDDING
# ============================================================

def embed_images(model, preprocess, image_paths: list[str]) -> np.ndarray:
    """Embed all images in batches."""
    all_embeddings = []

    for start in tqdm(range(0, len(image_paths), BATCH_SIZE), desc="Embedding"):
        end = min(start + BATCH_SIZE, len(image_paths))
        batch_paths = image_paths[start:end]

        images = []
        for p in batch_paths:
            try:
                img = Image.open(p).convert("RGB")
                images.append(preprocess(img))
            except Exception as e:
                logger.warning(f"Skipping {p}: {e}")
                # Use a zero tensor placeholder — will have low similarity
                images.append(torch.zeros(3, 224, 224))

        batch = torch.stack(images).to(DEVICE)
        with torch.no_grad(), torch.amp.autocast(device_type=DEVICE):
            features = model.encode_image(batch)
            features = features / features.norm(dim=-1, keepdim=True)

        all_embeddings.append(features.cpu().numpy())

    return np.vstack(all_embeddings)


# ============================================================
# STORAGE
# ============================================================

def store_in_chromadb(catalog: list[dict], embeddings: np.ndarray):
    """Store embeddings and metadata in ChromaDB."""
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    # Reset collection
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    CHUNK = 500
    for start in tqdm(range(0, len(catalog), CHUNK), desc="Storing"):
        end = min(start + CHUNK, len(catalog))
        chunk = catalog[start:end]
        chunk_emb = embeddings[start:end]

        ids = [item["product_id"] for item in chunk]
        documents = [item["description"] for item in chunk]
        metadatas = []
        for item in chunk:
            meta = {
                "product_name": item["product_name"],
                "description": item["description"][:500],
                "gender": item["gender"],
                "category": item["category"],
                "price": item["price"],
                "image_filename": item["image_filename"],
                "image_path": item["image_path"],
            }
            for k, v in item.get("attributes", {}).items():
                meta[f"attr_{k}"] = v
            metadatas.append(meta)

        collection.add(
            ids=ids,
            embeddings=chunk_emb.tolist(),
            metadatas=metadatas,
            documents=documents,
        )

    logger.info(f"Stored {len(catalog)} items. DB at: {CHROMA_PERSIST_DIR}")
    return collection


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Ingest DeepFashion-MultiModal into ChromaDB")
    parser.add_argument("--dataset-root", type=str, required=True, help="Path to dataset")
    parser.add_argument("--max-items", type=int, default=None, help="Limit number of items")
    parser.add_argument("--batch-size", type=int, default=32, help="GPU batch size")
    args = parser.parse_args()

    global BATCH_SIZE
    BATCH_SIZE = args.batch_size

    # Load model
    logger.info(f"Loading {MODEL_NAME} on {DEVICE}...")
    model, _, preprocess_val = open_clip.create_model_and_transforms(MODEL_NAME)
    model = model.to(DEVICE)
    model.eval()

    # Build catalog
    dataset_root = Path(args.dataset_root)
    catalog = build_catalog(dataset_root, max_items=args.max_items)

    if not catalog:
        logger.error("Empty catalog. Check your dataset path.")
        return

    # Embed
    image_paths = [item["image_path"] for item in catalog]
    embeddings = embed_images(model, preprocess_val, image_paths)
    logger.info(f"Embeddings shape: {embeddings.shape}")

    # Store
    collection = store_in_chromadb(catalog, embeddings)

    # Sanity check
    tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    test_query = "red summer dress"
    tokens = tokenizer([test_query]).to(DEVICE)
    with torch.no_grad():
        text_emb = model.encode_text(tokens)
        text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)

    results = collection.query(
        query_embeddings=[text_emb.cpu().numpy()[0].tolist()],
        n_results=3,
        include=["metadatas", "distances"],
    )

    logger.info(f"\nSanity check — query: '{test_query}'")
    for i, (id_, meta, dist) in enumerate(
        zip(results["ids"][0], results["metadatas"][0], results["distances"][0])
    ):
        sim = 1 - dist
        logger.info(f"  #{i+1} [{sim:.3f}] {meta['product_name']}")

    logger.info("\n✅ Ingestion complete! Start the API with: python api.py")


if __name__ == "__main__":
    main()
