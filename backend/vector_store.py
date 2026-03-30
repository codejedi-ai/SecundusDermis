"""
vector_store.py
===============
Simple file-based vector store for image embeddings.
Stores embeddings with metadata for AI memory of past uploaded images.
"""

import json
import logging
import math
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

VECTOR_DB_PATH = Path(os.getenv("VECTOR_DB_PATH", "./data/vector_db"))
VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)

EMBEDDING_DIM = 512  # Gemini embedding dimension


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
    user_email: Optional[str]  # None if uploaded while anonymous
    session_id: str
    timestamp: float
    image_path: str

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ImageEmbedding":
        return cls(**data)


# ── Vector Store ──────────────────────────────────────────────────────────────

class VectorStore:
    """
    File-based vector store for image embeddings.
    Each user session has its own index file.
    Supports cosine similarity search.
    """

    def __init__(self, db_path: Path = VECTOR_DB_PATH):
        self.db_path = db_path
        self._cache: dict[str, list[ImageEmbedding]] = {}  # session_id → embeddings

    def _get_index_path(self, session_id: str) -> Path:
        """Get the index file path for a session."""
        return self.db_path / f"{session_id}.json"

    def _load_index(self, session_id: str) -> list[ImageEmbedding]:
        """Load embeddings for a session from disk."""
        if session_id in self._cache:
            return self._cache[session_id]

        index_path = self._get_index_path(session_id)
        if not index_path.exists():
            self._cache[session_id] = []
            return []

        try:
            with index_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            embeddings = [ImageEmbedding.from_dict(item) for item in data]
            self._cache[session_id] = embeddings
            return embeddings
        except Exception as e:
            logger.warning(f"Failed to load index for {session_id}: {e}")
            self._cache[session_id] = []
            return []

    def _save_index(self, session_id: str) -> None:
        """Save embeddings for a session to disk."""
        index_path = self._get_index_path(session_id)
        embeddings = self._cache.get(session_id, [])

        try:
            with index_path.open("w", encoding="utf-8") as f:
                json.dump([e.to_dict() for e in embeddings], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save index for {session_id}: {e}")

    def add_embedding(self, embedding: ImageEmbedding) -> None:
        """Add a new image embedding to the store."""
        session_id = embedding.session_id
        if session_id not in self._cache:
            self._load_index(session_id)

        self._cache[session_id].append(embedding)
        self._save_index(session_id)
        logger.info(f"Added embedding for image {embedding.image_id} (session={session_id})")

    def search_by_email(
        self,
        email: str,
        limit: int = 10,
    ) -> list[ImageEmbedding]:
        """Search all embeddings for a specific user email."""
        results = []
        # Scan all index files for this email
        for index_file in self.db_path.glob("*.json"):
            try:
                with index_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    if item.get("user_email") == email:
                        results.append(ImageEmbedding.from_dict(item))
            except Exception as e:
                logger.warning(f"Failed to read index {index_file}: {e}")

        # Sort by timestamp descending (most recent first)
        results.sort(key=lambda x: x.timestamp, reverse=True)
        return results[:limit]

    def search_by_similarity(
        self,
        query_embedding: list[float],
        session_id: Optional[str] = None,
        email: Optional[str] = None,
        limit: int = 5,
        threshold: float = 0.7,
    ) -> list[tuple[float, ImageEmbedding]]:
        """
        Search for similar embeddings using cosine similarity.

        Args:
            query_embedding: The query vector (512-dim).
            session_id: Optional session to search within.
            email: Optional user email to search within.
            limit: Max results to return.
            threshold: Minimum similarity score (0.0-1.0).

        Returns:
            List of (similarity_score, embedding) tuples, sorted by similarity.
        """
        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        query_vec = query_vec / query_norm
        results: list[tuple[float, ImageEmbedding]] = []

        # Determine which sessions to search
        sessions_to_search: list[str] = []
        if session_id:
            sessions_to_search.append(session_id)
        if email:
            # Find all sessions for this email
            for index_file in self.db_path.glob("*.json"):
                sid = index_file.stem
                try:
                    with index_file.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                    if any(item.get("user_email") == email for item in data):
                        sessions_to_search.append(sid)
                except Exception:
                    pass

        if not sessions_to_search:
            # Search all sessions
            sessions_to_search = [f.stem for f in self.db_path.glob("*.json")]

        # Search each session
        for sid in set(sessions_to_search):
            embeddings = self._load_index(sid)
            for emb in embeddings:
                # Filter by email if specified
                if email and emb.user_email != email:
                    continue

                # Compute cosine similarity
                emb_vec = np.array(emb.embedding, dtype=np.float32)
                emb_norm = np.linalg.norm(emb_vec)
                if emb_norm == 0:
                    continue

                emb_vec = emb_vec / emb_norm
                similarity = float(np.dot(query_vec, emb_vec))

                if similarity >= threshold:
                    results.append((similarity, emb))

        # Sort by similarity descending
        results.sort(key=lambda x: x[0], reverse=True)
        return results[:limit]

    def get_all_embeddings(self, session_id: Optional[str] = None) -> list[ImageEmbedding]:
        """Get all embeddings, optionally filtered by session."""
        if session_id:
            return self._load_index(session_id)

        # Get all embeddings from all sessions
        all_embeddings: list[ImageEmbedding] = []
        for index_file in self.db_path.glob("*.json"):
            try:
                with index_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                all_embeddings.extend([ImageEmbedding.from_dict(item) for item in data])
            except Exception as e:
                logger.warning(f"Failed to read index {index_file}: {e}")

        return all_embeddings

    def delete_session(self, session_id: str) -> bool:
        """Delete all embeddings for a session."""
        index_path = self._get_index_path(session_id)
        if index_path.exists():
            try:
                index_path.unlink()
                self._cache.pop(session_id, None)
                logger.info(f"Deleted embeddings for session {session_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete session {session_id}: {e}")
        return False


# ── Global instance ───────────────────────────────────────────────────────────

_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    """Get the global vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store


def init_vector_store() -> VectorStore:
    """Initialize the vector store (call once at startup)."""
    global _vector_store
    _vector_store = VectorStore()
    logger.info(f"Vector store initialized at {_vector_store.db_path}")
    return _vector_store
