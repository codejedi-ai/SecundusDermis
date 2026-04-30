"""
DeepFashion-MultiModal Ingestion Pipeline
==========================================
Embeds images from the DeepFashion-MultiModal dataset using Marqo-FashionSigLIP
and stores them in a ChromaDB vector database for text and image search.

Requirements:
    pip install open-clip-torch chromadb pillow tqdm numpy

Dataset setup:
    1. Clone https://github.com/yumingj/DeepFashion-MultiModal
    2. Download images and annotations per their instructions
    3. Set DATASET_ROOT below to your local path

Directory structure expected:
    DeepFashion-MultiModal/
    ├── images/                    # All .jpg images
    ├── textual_descriptions/      # Text descriptions per image
    ├── labels/                    # Fine-grained attribute labels
    └── ...
"""

import os
import json
import hashlib
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import open_clip
from PIL import Image
from tqdm import tqdm
import chromadb
from chromadb.config import Settings

# ============================================================
# CONFIGURATION
# ============================================================

DATASET_ROOT = Path("./DeepFashion-MultiModal")  # <-- Change this
IMAGES_DIR = DATASET_ROOT / "images"
DESCRIPTIONS_DIR = DATASET_ROOT / "textual_descriptions"

CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "fashion_catalog"

# Model config
MODEL_NAME = "hf-hub:Marqo/marqo-fashionSigLIP"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BATCH_SIZE = 32  # Adjust based on GPU memory. 32 is safe for RTX 3070 8GB.

# Catalog limits (set to None to ingest everything)
MAX_ITEMS: Optional[int] = None  # e.g., 3000 for a demo subset

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ============================================================
# 1. LOAD MODEL
# ============================================================

def load_model():
    """Load Marqo-FashionSigLIP model and preprocessing transforms."""
    logger.info(f"Loading model: {MODEL_NAME} on {DEVICE}")
    model, _, preprocess_val = open_clip.create_model_and_transforms(MODEL_NAME)
    tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    model = model.to(DEVICE)
    model.eval()
    logger.info("Model loaded successfully.")
    return model, preprocess_val, tokenizer


# ============================================================
# 2. PARSE DATASET
# ============================================================

def parse_text_description(desc_path: Path) -> str:
    """Read a text description file and return the content."""
    try:
        return desc_path.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def parse_attributes_from_description(description: str) -> dict:
    """
    Extract structured attributes from the textual description.
    Example description:
        "This person is wearing a short-sleeve shirt with solid color patterns.
         The shirt is with cotton fabric. It has a crew neckline.
         The pants this person wears is of short length."

    Returns dict with extracted attributes for metadata filtering.
    """
    attributes = {}
    desc_lower = description.lower()

    # Sleeve length
    for sleeve in ["short-sleeve", "long-sleeve", "sleeveless"]:
        if sleeve in desc_lower:
            attributes["sleeve_length"] = sleeve
            break

    # Garment type
    for garment in ["shirt", "t-shirt", "dress", "jacket", "coat", "sweater",
                     "blouse", "pants", "trousers", "shorts", "skirt", "vest",
                     "hoodie", "cardigan", "suit", "jumpsuit"]:
        if garment in desc_lower:
            attributes["garment_type"] = garment
            break

    # Fabric
    for fabric in ["cotton", "denim", "leather", "silk", "wool", "polyester",
                    "chiffon", "linen", "knit", "lace", "velvet", "satin"]:
        if fabric in desc_lower:
            attributes["fabric"] = fabric
            break

    # Pattern
    for pattern in ["solid", "striped", "floral", "plaid", "graphic", "printed",
                     "checkered", "polka dot", "abstract", "pure color"]:
        if pattern in desc_lower:
            attributes["pattern"] = pattern
            break

    # Neckline
    for neckline in ["crew", "v-neck", "round", "turtle", "collar", "scoop",
                      "off-shoulder", "halter", "boat"]:
        if neckline in desc_lower:
            attributes["neckline"] = neckline
            break

    return attributes


def build_catalog() -> list[dict]:
    """
    Scan the dataset and build a list of product items.
    Each item has: image_path, description, attributes, product_id.
    """
    logger.info("Building product catalog from dataset...")

    catalog = []

    if not IMAGES_DIR.exists():
        raise FileNotFoundError(f"Images directory not found: {IMAGES_DIR}")

    image_files = sorted(IMAGES_DIR.glob("*.jpg"))
    if MAX_ITEMS:
        image_files = image_files[:MAX_ITEMS]

    logger.info(f"Found {len(image_files)} images to process.")

    for img_path in image_files:
        stem = img_path.stem  # e.g., "MEN-Denim-id_00000001-01_1_front"

        # Find corresponding text description
        desc_path = DESCRIPTIONS_DIR / f"{stem}.txt"
        description = parse_text_description(desc_path) if desc_path.exists() else ""

        # Extract attributes from description
        attributes = parse_attributes_from_description(description)

        # Parse category from filename convention: GENDER-Category-id_XXXXX
        parts = stem.split("-")
        gender = parts[0] if len(parts) > 0 else "unknown"
        category = parts[1] if len(parts) > 1 else "unknown"

        # Generate a stable product ID
        product_id = hashlib.md5(stem.encode()).hexdigest()[:12]

        # Generate a synthetic product name from attributes
        product_name = _generate_product_name(gender, category, attributes)

        # Generate a synthetic price
        price = _generate_price(category)

        catalog.append({
            "product_id": product_id,
            "image_path": str(img_path),
            "image_filename": img_path.name,
            "product_name": product_name,
            "description": description,
            "gender": gender,
            "category": category,
            "price": price,
            "attributes": attributes,
        })

    logger.info(f"Catalog built with {len(catalog)} items.")
    return catalog


def _generate_product_name(gender: str, category: str, attributes: dict) -> str:
    """Generate a human-readable product name from attributes."""
    parts = []

    if gender in ("MEN", "WOMEN"):
        parts.append("Men's" if gender == "MEN" else "Women's")

    if "fabric" in attributes:
        parts.append(attributes["fabric"].title())

    if "sleeve_length" in attributes:
        parts.append(attributes["sleeve_length"].title())

    if "garment_type" in attributes:
        parts.append(attributes["garment_type"].title())
    elif category != "unknown":
        parts.append(category.title())

    if not parts:
        parts.append("Fashion Item")

    return " ".join(parts)


def _generate_price(category: str) -> float:
    """Generate a reasonable synthetic price based on category."""
    import random
    price_ranges = {
        "Denim": (39.99, 89.99),
        "Jackets_Vests": (59.99, 199.99),
        "Pants": (29.99, 79.99),
        "Shorts": (19.99, 49.99),
        "Skirts": (24.99, 69.99),
        "Shirts_Polos": (19.99, 59.99),
        "Tees_Tanks": (14.99, 39.99),
        "Sweaters": (34.99, 99.99),
        "Sweatshirts_Hoodies": (29.99, 79.99),
        "Dresses": (34.99, 129.99),
        "Suiting": (79.99, 299.99),
        "Blouses_Shirts": (24.99, 69.99),
        "Cardigans": (34.99, 89.99),
        "Graphic_Tees": (14.99, 34.99),
        "Rompers_Jumpsuits": (39.99, 99.99),
    }
    low, high = price_ranges.get(category, (19.99, 79.99))
    return round(random.uniform(low, high), 2)


# ============================================================
# 3. EMBED IMAGES
# ============================================================

def embed_images_batch(
    model,
    preprocess,
    image_paths: list[str],
) -> np.ndarray:
    """
    Embed a batch of images using the vision encoder.
    Returns normalized embedding vectors as numpy array.
    """
    images = []
    valid_indices = []

    for i, path in enumerate(image_paths):
        try:
            img = Image.open(path).convert("RGB")
            img_tensor = preprocess(img)
            images.append(img_tensor)
            valid_indices.append(i)
        except Exception as e:
            logger.warning(f"Failed to load image {path}: {e}")

    if not images:
        return np.array([])

    image_batch = torch.stack(images).to(DEVICE)

    with torch.no_grad(), torch.amp.autocast(device_type=DEVICE):
        image_features = model.encode_image(image_batch)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    return image_features.cpu().numpy()


def embed_texts_batch(
    model,
    tokenizer,
    texts: list[str],
) -> np.ndarray:
    """
    Embed a batch of text descriptions using the text encoder.
    Returns normalized embedding vectors as numpy array.
    """
    tokens = tokenizer(texts).to(DEVICE)

    with torch.no_grad(), torch.amp.autocast(device_type=DEVICE):
        text_features = model.encode_text(tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    return text_features.cpu().numpy()


# ============================================================
# 4. STORE IN CHROMADB
# ============================================================

def init_chromadb() -> chromadb.Collection:
    """Initialize ChromaDB with persistent storage."""
    logger.info(f"Initializing ChromaDB at: {CHROMA_PERSIST_DIR}")

    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    # Delete existing collection if re-running
    try:
        client.delete_collection(COLLECTION_NAME)
        logger.info(f"Deleted existing collection: {COLLECTION_NAME}")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},  # Use cosine similarity
    )

    logger.info(f"Created collection: {COLLECTION_NAME}")
    return collection


def store_embeddings(
    collection: chromadb.Collection,
    catalog: list[dict],
    image_embeddings: np.ndarray,
):
    """Store image embeddings and metadata in ChromaDB."""
    logger.info("Storing embeddings in ChromaDB...")

    # ChromaDB has a batch limit, so we chunk the inserts
    CHUNK_SIZE = 500

    for start in tqdm(range(0, len(catalog), CHUNK_SIZE), desc="Storing"):
        end = min(start + CHUNK_SIZE, len(catalog))
        chunk_catalog = catalog[start:end]
        chunk_embeddings = image_embeddings[start:end]

        ids = [item["product_id"] for item in chunk_catalog]

        # Build metadata (ChromaDB metadata values must be str, int, float, or bool)
        metadatas = []
        for item in chunk_catalog:
            meta = {
                "product_name": item["product_name"],
                "description": item["description"][:500],  # Truncate for storage
                "gender": item["gender"],
                "category": item["category"],
                "price": item["price"],
                "image_filename": item["image_filename"],
                "image_path": item["image_path"],
            }
            # Flatten attributes into metadata
            for k, v in item.get("attributes", {}).items():
                meta[f"attr_{k}"] = v
            metadatas.append(meta)

        # Documents are the text descriptions (used for ChromaDB's built-in search too)
        documents = [item["description"] for item in chunk_catalog]

        collection.add(
            ids=ids,
            embeddings=chunk_embeddings.tolist(),
            metadatas=metadatas,
            documents=documents,
        )

    logger.info(f"Stored {len(catalog)} items in ChromaDB.")


# ============================================================
# 5. SEARCH UTILITIES (for use by your agent)
# ============================================================

def search_by_text(
    collection: chromadb.Collection,
    model,
    tokenizer,
    query: str,
    n_results: int = 5,
    filters: Optional[dict] = None,
) -> list[dict]:
    """
    Search the catalog using a text query.
    Embeds the query with the text encoder and performs cosine similarity search.
    """
    # Embed the query text
    query_embedding = embed_texts_batch(model, tokenizer, [query])[0]

    # Build ChromaDB where filter if provided
    where_filter = None
    if filters:
        where_filter = {k: v for k, v in filters.items()}

    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=n_results,
        where=where_filter,
        include=["metadatas", "documents", "distances"],
    )

    return _format_results(results)


def search_by_image(
    collection: chromadb.Collection,
    model,
    preprocess,
    image_path: str,
    n_results: int = 5,
    filters: Optional[dict] = None,
) -> list[dict]:
    """
    Search the catalog using an image.
    Embeds the query image with the vision encoder and performs cosine similarity search.
    """
    # Embed the query image
    query_embedding = embed_images_batch(model, preprocess, [image_path])[0]

    where_filter = None
    if filters:
        where_filter = {k: v for k, v in filters.items()}

    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=n_results,
        where=where_filter,
        include=["metadatas", "documents", "distances"],
    )

    return _format_results(results)


def _format_results(results: dict) -> list[dict]:
    """Format ChromaDB results into a clean list of dicts."""
    formatted = []
    if not results["ids"] or not results["ids"][0]:
        return formatted

    for i in range(len(results["ids"][0])):
        item = {
            "product_id": results["ids"][0][i],
            "similarity": 1 - results["distances"][0][i],  # Convert distance to similarity
            "description": results["documents"][0][i] if results["documents"] else "",
            **results["metadatas"][0][i],
        }
        formatted.append(item)

    return formatted


# ============================================================
# MAIN: RUN THE PIPELINE
# ============================================================

def main():
    """Execute the full ingestion pipeline."""

    # Step 1: Load model
    model, preprocess_val, tokenizer = load_model()

    # Step 2: Build catalog from dataset
    catalog = build_catalog()

    if not catalog:
        logger.error("No items found in catalog. Check DATASET_ROOT path.")
        return

    # Step 3: Embed all images
    logger.info(f"Embedding {len(catalog)} images in batches of {BATCH_SIZE}...")
    all_embeddings = []

    image_paths = [item["image_path"] for item in catalog]

    for start in tqdm(range(0, len(image_paths), BATCH_SIZE), desc="Embedding"):
        end = min(start + BATCH_SIZE, len(image_paths))
        batch_paths = image_paths[start:end]
        batch_embeddings = embed_images_batch(model, preprocess_val, batch_paths)

        if len(batch_embeddings) > 0:
            all_embeddings.append(batch_embeddings)

    image_embeddings = np.vstack(all_embeddings)
    logger.info(f"Generated {image_embeddings.shape[0]} embeddings of dim {image_embeddings.shape[1]}")

    # Step 4: Store in ChromaDB
    collection = init_chromadb()
    store_embeddings(collection, catalog, image_embeddings)

    # Step 5: Quick sanity check
    logger.info("\n--- Sanity Check: Text Search ---")
    results = search_by_text(collection, model, tokenizer, "red floral summer dress")
    for r in results[:3]:
        logger.info(f"  [{r['similarity']:.3f}] {r['product_name']} — {r['description'][:80]}...")

    logger.info("\n--- Sanity Check: Image Search ---")
    # Use the first catalog image as a test query
    results = search_by_image(collection, model, preprocess_val, catalog[0]["image_path"])
    for r in results[:3]:
        logger.info(f"  [{r['similarity']:.3f}] {r['product_name']} — {r['description'][:80]}...")

    logger.info("\nIngestion pipeline complete!")
    logger.info(f"ChromaDB persisted at: {CHROMA_PERSIST_DIR}")
    logger.info(f"Collection: {COLLECTION_NAME}")
    logger.info(f"Total items indexed: {image_embeddings.shape[0]}")


if __name__ == "__main__":
    main()
