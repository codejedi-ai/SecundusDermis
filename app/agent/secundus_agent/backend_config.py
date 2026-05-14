"""
Load ``app/backend/config.py`` by absolute path.

``import config`` is ambiguous: another dependency or an earlier ``sys.path``
entry can shadow the backend package and cause ``AttributeError`` on startup
(e.g. missing ``AGENT_INTERNAL_SECRET``).
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType

_AGENT_PKG = Path(__file__).resolve().parent
_AGENT_ROOT = _AGENT_PKG.parent
_APP_ROOT = _AGENT_ROOT.parent
_BACKEND_CONFIG_PATH = _APP_ROOT / "backend" / "config.py"
_MODULE_NAME = "secundus_sd_backend_config"


def load_backend_config() -> ModuleType:
    existing = sys.modules.get(_MODULE_NAME)
    if existing is not None:
        return existing
    if not _BACKEND_CONFIG_PATH.is_file():
        raise ImportError(f"Backend config not found: {_BACKEND_CONFIG_PATH}")
    spec = importlib.util.spec_from_file_location(_MODULE_NAME, _BACKEND_CONFIG_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load spec for {_BACKEND_CONFIG_PATH}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[_MODULE_NAME] = mod
    spec.loader.exec_module(mod)
    return mod


api_config: ModuleType = load_backend_config()


def agent_internal_secret() -> str:
    """Backend↔agent shared secret: ``AGENT_INTERNAL_SECRET`` env, else shared file under ``DATA_DIR``.

    Prefer this over ``api_config.AGENT_INTERNAL_SECRET`` for call-time resolution after
    :func:`agent_gemini.load_agent_environment`. The file path matches ``api_config.DATA_DIR``
    so backend and agent stay aligned.
    """
    from agent_secret_file import read_or_create_agent_internal_secret

    v = (os.getenv("AGENT_INTERNAL_SECRET") or "").strip()
    if v:
        return v
    return read_or_create_agent_internal_secret(Path(api_config.DATA_DIR))
