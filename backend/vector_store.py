"""
vector_store.py
===============
ChromaDB-based vector store for image and journal embeddings.
Supports memory of past interactions and RAG over the catering diary.
"""

import logging
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Union, Any

import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
VECTOR_DB_PATH = DATA_DIR / "chroma_db"
VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)

# Gemini 2.0 Embedding dimension (default is 3072)
EMBEDDING_DIM = 3072 


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class ImageEmbedding:
    """Represents a stored image embedding with metadata."""
    image_id: str
    embedding: list[float]
    description: str
    keywords: list[str]
    garment_type: Optional[str]
    colors: list[str]
    gender: Optional[str]
    category: Optional[str]
    user_email: Optional[str]
    session_id: str
    timestamp: float
    image_path: str

@dataclass
class JournalEmbedding:
    """Represents a stored journal entry embedding."""
    slug: str
    embedding: list[float]
    title: str
    excerpt: str
    category: str
    tags: list[str]
    date: str

# ── Vector Store ──────────────────────────────────────────────────────────────

class VectorStore:
    """
    ChromaDB wrapper for Secundus Dermis.
    Manages two collections: 'images' and 'journal'.
    """

    def __init__(self, db_path: Path = VECTOR_DB_PATH):
        self.db_path = db_path
        self.client = chromadb.PersistentClient(path=str(db_path))
        
        # Initialize collections
        self.image_col = self.client.get_or_create_collection(
            name="images",
            metadata={"hnsw:space": "cosine"}
        )
        self.journal_col = self.client.get_or_create_collection(
            name="journal",
            metadata={"hnsw:space": "cosine"}
        )
        self.query_col = self.client.get_or_create_collection(
            name="queries",
            metadata={"hnsw:space": "cosine"}
        )

    def add_image_embedding(self, item: ImageEmbedding) -> None:
        """Add a new image embedding to the store."""
        metadata = {
            "image_id": item.image_id,
            "description": item.description,
            "garment_type": item.garment_type or "unknown",
            "gender": item.gender or "unknown",
            "category": item.category or "unknown",
            "user_email": item.user_email or "anonymous",
            "session_id": item.session_id,
            "timestamp": item.timestamp,
            "image_path": item.image_path,
            "keywords": ",".join(item.keywords),
            "colors": ",".join(item.colors)
        }
        self.image_col.add(
            ids=[item.image_id],
            embeddings=[item.embedding],
            metadatas=[metadata],
            documents=[item.description]
        )
        logger.info(f"Chroma: Added image {item.image_id}")

    def add_journal_embedding(self, item: JournalEmbedding) -> None:
        """Add or update a journal entry embedding."""
        metadata = {
            "slug": item.slug,
            "title": item.title,
            "excerpt": item.excerpt,
            "category": item.category,
            "date": item.date,
            "tags": ",".join(item.tags)
        }
        self.journal_col.upsert(
            ids=[item.slug],
            embeddings=[item.embedding],
            metadatas=[metadata],
            documents=[f"{item.title}\n{item.excerpt}"]
        )
        logger.info(f"Chroma: Indexed journal {item.slug}")

    def add_query_embedding(self, text: str, embedding: list[float], session_id: str, email: Optional[str] = None) -> None:
        """Memorize a user query."""
        qid = f"q_{int(datetime.now().timestamp())}_{hash(text) % 10000}"
        self.query_col.add(
            ids=[qid],
            embeddings=[embedding],
            metadatas={
                "session_id": session_id,
                "email": email or "anonymous",
                "timestamp": datetime.now().timestamp(),
                "text": text
            },
            documents=[text]
        )

    def search_journal(self, query_embedding: list[float], limit: int = 3) -> list[dict]:
        """Vector search over journal entries (RAG)."""
        results = self.journal_col.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )
        
        outputs = []
        if results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                outputs.append({
                    "slug": results["ids"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": results["distances"][0][i]
                })
        return outputs

    def search_images_by_similarity(self, query_embedding: list[float], limit: int = 5) -> list[dict]:
        """Search past images by visual similarity."""
        results = self.image_col.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )
        outputs = []
        if results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                outputs.append({
                    "image_id": results["ids"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": results["distances"][0][i]
                })
        return outputs

    def get_patron_context(self, email: str, limit: int = 5) -> dict:
        """Retrieve historical context for a specific patron."""
        # Find their past images and queries
        img_results = self.image_col.get(
            where={"user_email": email},
            limit=limit
        )
        query_results = self.query_col.get(
            where={"email": email},
            limit=limit
        )
        
        return {
            "past_images": img_results["metadatas"] if img_results else [],
            "past_queries": [m["text"] for m in query_results["metadatas"]] if query_results else []
        }

# ── Global instance ───────────────────────────────────────────────────────────

_vector_store: Optional[VectorStore] = None

def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store

def init_vector_store() -> VectorStore:
    global _vector_store
    _vector_store = VectorStore()
    logger.info(f"ChromaDB initialized at {_vector_store.db_path}")
    return _vector_store
