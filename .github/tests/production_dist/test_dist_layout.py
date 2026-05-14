"""
Production bundle checks — run after ``npm run build`` in ``app/frontend``.

Validates the same ``app/dist`` tree FastAPI serves in production
(``api.py``: ``FRONTEND_DIST_DIR = app/backend/../dist`` → ``app/dist``).

Not part of default ``pytest.ini`` testpaths; invoked from ``frontend-ci.yml`` only.
"""

from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DIST_DIR = _REPO_ROOT / "app" / "dist"


def test_dist_directory_exists():
    assert _DIST_DIR.is_dir(), f"Expected app/dist at {_DIST_DIR} (run vite build from app/frontend)"


def test_index_html_and_assets_layout():
    index = _DIST_DIR / "index.html"
    assets = _DIST_DIR / "assets"
    assert index.is_file(), "index.html missing — production root route would 404"
    assert assets.is_dir(), "dist/assets missing — FastAPI mount /assets would fail"
    html = index.read_text(encoding="utf-8")
    assert "<!doctype html>" in html.lower() or "<html" in html.lower()
    # Vite default base: hashed entry under /assets/ (same path FastAPI mounts when dist exists)
    assert "/assets/" in html, "index.html should reference /assets/ for JS/CSS (backend hosts /assets)"
    js_files = list(assets.glob("*.js"))
    assert len(js_files) >= 1, "expected at least one hashed .js chunk under dist/assets/"
    css_files = list(assets.glob("*.css"))
    assert len(css_files) >= 1, "expected at least one .css chunk under dist/assets/"


def test_index_script_src_matches_existing_chunk():
    """Guards against broken index pointing at a missing hashed filename."""
    html = (_DIST_DIR / "index.html").read_text(encoding="utf-8")
    m = re.search(r'src="(/assets/[^"]+\.js)"', html)
    assert m, "no script src=/assets/*.js in index.html"
    rel = m.group(1).lstrip("/")  # assets/index-XXXX.js
    chunk = _DIST_DIR / rel.replace("/", "/")  # dist + assets/...
    assert chunk.is_file(), f"index references missing bundle: {chunk}"
