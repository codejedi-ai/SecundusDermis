"""Ensure ``app/backend`` and ``app/agent`` are on ``sys.path`` (repo root = ``.github/tests/unit`` → ``parents[3]``)."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[3]
for _name in ("backend", "agent"):
    _p = _REPO / "app" / _name
    _s = str(_p)
    if _s not in sys.path:
        sys.path.insert(0, _s)
