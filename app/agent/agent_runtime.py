"""Non-secret agent process settings read from the environment (after dotenv load)."""

from __future__ import annotations

import os


def get_backend_url() -> str:
    """Base URL of the Secundus FastAPI host (no ``/api`` prefix)."""
    return os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def env_truthy(name: str, default: bool = False) -> bool:
    v = os.getenv(name, "").strip().lower()
    if not v:
        return default
    return v in ("1", "true", "yes", "on")
