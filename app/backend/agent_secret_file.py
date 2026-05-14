"""
Shared backend↔agent API key when ``AGENT_INTERNAL_SECRET`` is not set in the environment.

Writes a single random value to ``{DATA_DIR}/.sd_agent_internal_secret`` so the FastAPI
process and the standalone agent (both reading the same ``DATA_DIR``) agree without
duplicating secrets in multiple ``.env`` files. Opt out by setting ``AGENT_INTERNAL_SECRET``.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path


def read_or_create_agent_internal_secret(data_dir: Path) -> str:
    """
    Return ``AGENT_INTERNAL_SECRET`` from the environment, or read/create the file
    ``{data_dir}/.sd_agent_internal_secret``.
    """
    env = (os.getenv("AGENT_INTERNAL_SECRET") or "").strip()
    if env:
        return env
    data_dir = data_dir.resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / ".sd_agent_internal_secret"
    if path.is_file():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    token = secrets.token_hex(32)
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    try:
        fd = os.open(path, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(token)
    except FileExistsError:
        return path.read_text(encoding="utf-8").strip()
    return token
