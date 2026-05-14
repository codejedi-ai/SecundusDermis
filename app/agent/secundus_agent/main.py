"""
Secundus stylist agent — separate process from the FastAPI backend.

**Traffic shape:** the **backend** receives patron-authenticated **`POST /api/patron/agent/chat/stream`**
(or **`/api/patron/agent/chat`**) and proxies to this service with **`X-Agent-Secret`**. **Gemini credentials live only in this process**
(see ``app/agent/agent_gemini.py``).

- ``POST /v1/chat/stream`` (SSE) — proxied from the backend patron route.
- ``POST /v1/chat`` — non-streaming JSON — proxied from the backend patron route.
- ``httpx`` → backend ``/internal/agent/*`` for catalog, RAG, and Socket.IO fan-out to patron rooms.

Environment: ``app/agent/.env.example``; shared dev files may use ``app/backend/.env`` for
``AGENT_INTERNAL_SECRET`` / ``BACKEND_URL`` (loaded before agent-local overrides).
"""

from __future__ import annotations

import base64
import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

_AGENT_DIR = Path(__file__).resolve().parents[1]
_APP = _AGENT_DIR.parent
_BACKEND = _APP / "backend"
for _p in (_AGENT_DIR, _BACKEND):
    s = str(_p)
    if s not in sys.path:
        sys.path.insert(0, s)

from agent_gemini import build_genai_client, load_agent_environment  # noqa: E402
from agent_runtime import env_truthy, get_backend_url  # noqa: E402

load_agent_environment()

from secundus_agent.backend_config import agent_internal_secret, api_config  # noqa: E402

from stylist_loop.stream_loop import (  # noqa: E402
    StylistGeminiRuntime,
    gemini_chat_stream as stylist_react_stream,
)
from secundus_agent.remote_deps import RemoteStylistDeps, _ShopContextCompat  # noqa: E402
from secundus_agent.sd_socket_client import SdSocketEmitter  # noqa: E402
from secundus_agent.internal_api import router as internal_gemini_router  # noqa: E402
from secundus_agent.sync_chat import run_sync_chat  # noqa: E402
from agent_prompts import merge_prompts_with_soul  # noqa: E402

logger = logging.getLogger(__name__)


def _agent_socket_enabled() -> bool:
    """Duplex agent Socket.IO: patron fan-out (``agent_emit``) plus inbound ``sd_bridge``."""
    return env_truthy("SD_SOCKETIO_EMIT", False) or env_truthy("SD_AGENT_SOCKET", False)


def _log_sd_bridge_from_backend(msg: dict[str, Any]) -> None:
    if msg.get("type") == "welcome":
        logger.info("[SD-SocketIO] backend welcome on sd_bridge: %s", msg.get("message", ""))
    else:
        logger.info("[SD-SocketIO] sd_bridge: %s", msg)


def _create_sd_socket_emitter() -> SdSocketEmitter | None:
    if not _agent_socket_enabled():
        return None
    try:
        emitter = SdSocketEmitter(
            get_backend_url(),
            agent_internal_secret(),
            on_sd_bridge=_log_sd_bridge_from_backend,
        )
        emitter.ensure_connected()
        logger.info(
            "Agent Socket.IO enabled (SD_SOCKETIO_EMIT and/or SD_AGENT_SOCKET): "
            "patron fan-out via agent_emit; inbound sd_bridge wired.",
        )
        return emitter
    except Exception as exc:
        logger.warning(
            "Agent Socket.IO requested but connect failed (%s); using HTTP /internal/agent/emit only.",
            exc,
        )
        return None


class StreamBody(BaseModel):
    message: str
    session_id: str = "default"
    shop_context: Optional[dict[str, Any]] = None
    prompts: dict[str, Any] = Field(default_factory=dict)
    mime_type: str = "image/jpeg"
    image_base64: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_agent_environment()
    if not agent_internal_secret():
        raise RuntimeError(
            "AGENT_INTERNAL_SECRET could not be resolved. Set AGENT_INTERNAL_SECRET in the environment, "
            f"or ensure {api_config.DATA_DIR} is writable so {api_config.DATA_DIR}/.sd_agent_internal_secret can be created."
        )
    app.state.gemini = build_genai_client()
    app.state.sd_socket_emitter = _create_sd_socket_emitter()
    logger.info("Stylist agent started; backend=%s", get_backend_url())
    yield
    emitter = getattr(app.state, "sd_socket_emitter", None)
    if emitter is not None:
        emitter.close()
    logger.info("Stylist agent stopped.")


app = FastAPI(title="SecundusStylistAgent", version="0.1.0", lifespan=lifespan)
app.include_router(internal_gemini_router)


def _verify_stream_secret(x_agent_secret: Optional[str]) -> None:
    if (x_agent_secret or "").strip() != agent_internal_secret():
        raise HTTPException(status_code=403, detail="Invalid X-Agent-Secret.")


@app.post("/v1/chat")
async def v1_chat_sync(
    request: Request,
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
    prompts = merge_prompts_with_soul(dict(body.prompts or {}))
    return await run_sync_chat(
        request.app.state.gemini,
        body.message,
        image_bytes,
        body.mime_type,
        prompts,
    )


@app.post("/v1/chat/stream")
async def v1_chat_stream(
    request: Request,
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

    socket_emitter = getattr(request.app.state, "sd_socket_emitter", None)
    deps = RemoteStylistDeps(
        get_backend_url(),
        agent_internal_secret(),
        body.session_id,
        socket_emitter=socket_emitter,
    )
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
async def health(request: Request):
    emitter = getattr(request.app.state, "sd_socket_emitter", None)
    return {
        "status": "ok",
        "backend": get_backend_url(),
        "sd_socketio_emit": emitter is not None,
    }
