"""
HTTP calls to the standalone stylist agent for all Gemini-backed operations.

The backend never instantiates ``google.genai``; ``GEMINI_API_KEY`` lives only on the agent process.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx


async def embed_document(client: httpx.AsyncClient, text: str) -> list[float]:
    r = await client.post(
        "/v1/internal/embed",
        json={"mode": "document", "text": text},
    )
    r.raise_for_status()
    data = r.json()
    return list(data.get("values") or [])


async def embed_query(
    client: httpx.AsyncClient,
    message: str,
    image_base64: Optional[str],
    mime_type: str,
) -> list[float]:
    r = await client.post(
        "/v1/internal/embed",
        json={
            "mode": "query",
            "message": message,
            "mime_type": mime_type,
            "image_base64": image_base64,
        },
    )
    r.raise_for_status()
    data = r.json()
    return list(data.get("values") or [])


async def generate_text(client: httpx.AsyncClient, prompt: str) -> str:
    r = await client.post("/v1/internal/generate", json={"prompt": prompt})
    r.raise_for_status()
    data = r.json()
    return str(data.get("text") or "")


async def chat_sync(client: httpx.AsyncClient, body: dict[str, Any]) -> dict[str, Any]:
    """Non-streaming chat JSON (reply, products, intent, filter)."""
    r = await client.post("/v1/chat", json=body)
    r.raise_for_status()
    return dict(r.json())
