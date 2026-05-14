"""
Gemini credentials and client construction — **agent process only**.

The FastAPI backend must not load ``google.genai`` or hold ``GEMINI_API_KEY``.
This module is the single place the stylist agent resolves the API key and
builds ``genai.Client``.

Supported env vars (first non-empty wins):

- ``GEMINI_API_KEY`` (preferred name in this repo)
- ``GOOGLE_API_KEY`` (common alias used by Google SDKs and cloud hosts)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import dotenv_values, load_dotenv

_KEY_ENV_NAMES = ("GEMINI_API_KEY", "GOOGLE_API_KEY")


def _apply_agent_env_non_empty(agent_env_path: Path) -> None:
    """Apply ``app/agent/.env`` only for keys with non-empty values.

    Avoids ``AGENT_INTERNAL_SECRET=`` (placeholder from ``.env.example``) wiping a
    secret loaded from ``app/backend/.env``.
    """
    if not agent_env_path.is_file():
        return
    for key, raw in dotenv_values(agent_env_path).items():
        if not key:
            continue
        val = (raw or "").strip()
        if val:
            os.environ[key] = val


def load_agent_environment() -> None:
    """
    Load dotenv files so Gemini and routing secrets resolve.

    Precedence: repo root ``.env`` → ``app/.env`` (fill missing) → ``app/backend/.env``
    (override) → ``app/agent/.env`` (**non-empty values only**, so blank placeholders
    do not erase backend secrets).
    """
    _agent_root = Path(__file__).resolve().parent
    _app = _agent_root.parent
    _repo = _app.parent
    load_dotenv(_repo / ".env")
    load_dotenv(_app / ".env", override=False)
    load_dotenv(_app / "backend" / ".env", override=True)
    _apply_agent_env_non_empty(_agent_root / ".env")


def resolve_gemini_api_key() -> str:
    """Return the first configured API key, or empty string if none set."""
    for name in _KEY_ENV_NAMES:
        v = os.getenv(name, "").strip()
        if v:
            return v
    return ""


def require_gemini_api_key() -> str:
    key = resolve_gemini_api_key()
    if not key:
        raise RuntimeError(
            "Gemini API key missing. Set GEMINI_API_KEY or GOOGLE_API_KEY in the **agent** environment "
            "(e.g. app/agent/.env). The FastAPI backend does not read this key."
        )
    return key


def build_genai_client() -> Any:
    """Construct a Gemini client; call only after ``load_agent_environment()``."""
    from google import genai

    return genai.Client(api_key=require_gemini_api_key())
