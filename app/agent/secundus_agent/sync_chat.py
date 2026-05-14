"""Non-streaming chat: Gemini on the agent, catalog keyword search via backend internal HTTP."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import httpx
from google import genai
from google.genai import types as genai_types

from agent_runtime import get_backend_url
from secundus_agent.backend_config import agent_internal_secret, api_config

logger = logging.getLogger(__name__)


def _keyword_products(message: str) -> tuple[list[dict[str, Any]], Optional[dict[str, Any]]]:
    secret = agent_internal_secret()
    with httpx.Client(timeout=60.0) as cli:
        r = cli.post(
            f"{get_backend_url()}/internal/agent/keyword-search",
            headers={"X-Agent-Secret": secret},
            json={"keywords": message, "n_results": 8},
        )
        r.raise_for_status()
        products = list(r.json().get("products") or [])
    shop_filter = None
    if products:
        genders = [p.get("gender") for p in products if p.get("gender") and p.get("gender") != "unknown"]
        categories = [p.get("category") for p in products if p.get("category") and p.get("category") != "unknown"]
        if genders or categories:
            shop_filter = {
                "gender": genders[0] if genders else None,
                "category": categories[0] if categories else None,
                "query": message,
            }
    return products, shop_filter


async def run_sync_chat(
    gemini: genai.Client,
    message: str,
    image_bytes: Optional[bytes],
    mime_type: str,
    prompts: dict[str, Any],
) -> dict[str, Any]:
    parts: list[Any] = []
    if image_bytes:
        parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    sys_prompt = (prompts or {}).get("system_stylist", "") or ""
    prompt = f"""{sys_prompt}

User request: {message}

IMPORTANT: Search the catalog for products matching this request and return them.
Focus on finding actual products from the catalog."""
    parts.append(genai_types.Part(text=prompt))

    gen_config = genai_types.GenerateContentConfig(
        thinking_config=genai_types.ThinkingConfig(thinking_level=api_config.THINKING_LEVEL),
        temperature=1.0,
    )

    response = gemini.models.generate_content(
        model=api_config.MODEL,
        contents=parts,
        config=gen_config,
    )
    reply = response.text or ""

    msg_lower = message.lower().strip()
    products: list[dict[str, Any]] = []
    shop_filter = None
    if not any(
        greet in msg_lower
        for greet in ["hello", "hi ", "hey", "good morning", "good evening", "thanks", "thank you"]
    ):
        products, shop_filter = await asyncio.to_thread(_keyword_products, message)

    return {
        "reply": reply,
        "products": products,
        "intent": "text_search" if products else "chitchat",
        "filter": shop_filter,
    }
