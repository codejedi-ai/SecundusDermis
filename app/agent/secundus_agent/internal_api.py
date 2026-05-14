"""Gemini-only routes for the trusted backend (``X-Agent-Secret``)."""

from __future__ import annotations

import base64
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from secundus_agent.backend_config import agent_internal_secret, api_config

router = APIRouter(prefix="/v1/internal", tags=["internal-gemini"])


def verify_internal_secret(
    x_agent_secret: Optional[str] = Header(default=None, alias="X-Agent-Secret"),
) -> None:
    secret = agent_internal_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="AGENT_INTERNAL_SECRET is not configured on the agent.")
    if (x_agent_secret or "").strip() != secret:
        raise HTTPException(status_code=403, detail="Invalid X-Agent-Secret.")


class EmbedBody(BaseModel):
    mode: Literal["document", "query"]
    text: Optional[str] = None
    message: Optional[str] = None
    mime_type: str = "image/jpeg"
    image_base64: Optional[str] = None


@router.post("/embed")
async def internal_embed(
    body: EmbedBody,
    request: Request,
    _authorized: None = Depends(verify_internal_secret),
):
    client: genai.Client = request.app.state.gemini
    if body.mode == "document":
        if not (body.text or "").strip():
            raise HTTPException(status_code=400, detail="text required for document mode")
        res = client.models.embed_content(
            model=api_config.EMBED_MODEL,
            contents=body.text.strip(),
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )
        return {"values": list(res.embeddings[0].values)}

    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="message required for query mode")
    img_b64 = (body.image_base64 or "").strip()
    if img_b64:
        try:
            raw = base64.b64decode(img_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image_base64")
        contents = genai_types.Content(
            parts=[
                genai_types.Part(text=msg),
                genai_types.Part.from_bytes(data=raw, mime_type=body.mime_type or "image/jpeg"),
            ]
        )
    else:
        contents = msg
    res = client.models.embed_content(
        model=api_config.EMBED_MODEL,
        contents=contents,
        config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
    )
    return {"values": list(res.embeddings[0].values)}


class GenerateBody(BaseModel):
    prompt: str = Field(..., min_length=1)


@router.post("/generate")
async def internal_generate(
    body: GenerateBody,
    request: Request,
    _authorized: None = Depends(verify_internal_secret),
):
    client: genai.Client = request.app.state.gemini
    gen_config = genai_types.GenerateContentConfig(
        thinking_config=genai_types.ThinkingConfig(thinking_level=api_config.THINKING_LEVEL),
        temperature=1.0,
    )
    response = client.models.generate_content(
        model=api_config.MODEL,
        contents=body.prompt,
        config=gen_config,
    )
    return {"text": response.text or ""}
