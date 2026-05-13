"""
Secundus stylist agent — runs as a separate process from the FastAPI backend.

- Exposes ``POST /v1/chat/stream`` (SSE) for the backend to proxy when ``AGENT_SERVICE_URL`` is set.
- Uses ``httpx`` + ``/internal/agent/*`` to read catalog, RAG, and emit Socket.IO events to patron rooms.
- Own Gemini client for model inference (``GEMINI_API_KEY`` in this process).

Environment (see ``README.md`` in this folder):
  ``GEMINI_API_KEY``, ``AGENT_INTERNAL_SECRET`` (must match backend), ``BACKEND_URL`` (default ``http://127.0.0.1:8000``).
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from google import genai
from pydantic import BaseModel, Field

_AGENT_DIR = Path(__file__).resolve().parents[1]
_APP = _AGENT_DIR.parent
_BACKEND = _APP / "backend"
for _p in (_AGENT_DIR, _BACKEND):
    s = str(_p)
    if s not in sys.path:
        sys.path.insert(0, s)

load_dotenv(_APP.parent / ".env")
load_dotenv(_APP / ".env", override=False)
load_dotenv(_BACKEND / ".env", override=True)

import config as api_config  # noqa: E402 — backend package on PYTHONPATH

from stylist_loop.stream_loop import (  # noqa: E402
    StylistGeminiRuntime,
    gemini_chat_stream as stylist_react_stream,
)
from secundus_agent.remote_deps import RemoteStylistDeps, _ShopContextCompat  # noqa: E402
from agent_prompts import merge_prompts_with_soul  # noqa: E402

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
AGENT_INTERNAL_SECRET = os.getenv("AGENT_INTERNAL_SECRET", "").strip()
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


class StreamBody(BaseModel):
    message: str
    session_id: str = "default"
    shop_context: Optional[dict[str, Any]] = None
    prompts: dict[str, Any] = Field(default_factory=dict)
    mime_type: str = "image/jpeg"
    image_base64: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is required for the standalone agent process.")
    if not AGENT_INTERNAL_SECRET:
        raise RuntimeError("AGENT_INTERNAL_SECRET is required (must match the backend value).")
    app.state.gemini = genai.Client(api_key=GEMINI_API_KEY)
    logger.info("Stylist agent started; backend=%s", BACKEND_URL)
    yield
    logger.info("Stylist agent stopped.")


app = FastAPI(title="SecundusStylistAgent", version="0.1.0", lifespan=lifespan)


def _verify_stream_secret(x_agent_secret: Optional[str]) -> None:
    if (x_agent_secret or "").strip() != AGENT_INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid X-Agent-Secret.")


@app.post("/v1/chat/stream")
async def v1_chat_stream(
    body: StreamBody,
    x_agent_secret: Optional[str] = Header(default=None, alias="X-Agent-Secret"),
):
    _verify_stream_secret(x_agent_secret)

    image_bytes: Optional[bytes] = None
    if body.image_base64:
        try:
            image_bytes = base64.b64decode(body.image_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image_base64")

    deps = RemoteStylistDeps(BACKEND_URL, AGENT_INTERNAL_SECRET, body.session_id)
    rt = StylistGeminiRuntime(
        gemini_client=app.state.gemini,
        model=api_config.MODEL,
        thinking_level=api_config.THINKING_LEVEL,
    )
    _prompts = merge_prompts_with_soul(dict(body.prompts or {}))

    async def gen() -> AsyncGenerator[str, None]:
        try:
            async for ev in stylist_react_stream(
                body.message,
                image_bytes,
                body.mime_type,
                body.session_id,
                _ShopContextCompat(body.shop_context),
                rt=rt,
                prompts=_prompts,
                deps=deps,
            ):
                if ev == "data: [DONE]\n\n":
                    yield ev
                else:
                    yield f"data: {json.dumps(ev)}\n\n"
        finally:
            deps.close()

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.get("/health")
async def health():
    return {"status": "ok", "backend": BACKEND_URL}
