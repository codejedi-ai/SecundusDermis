"""
Stylist ReAct loop (Gemini tool use) — shared between the API process and the standalone agent service.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Optional

from google.genai import types as genai_types

from shop_tools import build_sidebar_snapshot

from .deps import StylistAgentDeps

logger = logging.getLogger(__name__)


@dataclass
class StylistGeminiRuntime:
    """Model + prompts for one stream (injected so the loop stays free of global state)."""

    gemini_client: Any
    model: str
    thinking_level: str
    system_stylist_key: str = "system_stylist"

    def system_prompt(self, prompts: dict[str, Any]) -> str:
        return str(prompts.get(self.system_stylist_key, "") or "")


async def gemini_chat_stream(
    message: str,
    image_bytes: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
    ws_session_id: Optional[str] = None,
    shop_context: Optional[Any] = None,
    *,
    rt: StylistGeminiRuntime,
    prompts: dict[str, Any],
    deps: StylistAgentDeps,
) -> AsyncGenerator[Any, None]:
    """
    Agentic ReAct loop for Secundus Dermis.
    Iterates Thought -> Action -> Observation until a final answer is reached.
    """
    logger.info("[AGENT LOOP] Start: %s... image=%s", message[:80], image_bytes is not None)
    yield {"type": "thinking_start", "content": "Initializing agentic workflow..."}

    shop_state: dict[str, Any] = {"gender": None, "category": None, "query": None}
    if shop_context is not None:
        dumped = shop_context.model_dump() if hasattr(shop_context, "model_dump") else dict(shop_context or {})
        shop_state["gender"] = dumped.get("gender") or None
        shop_state["category"] = dumped.get("category") or None
        shop_state["query"] = dumped.get("query") or None
        if isinstance(shop_state["gender"], str) and not shop_state["gender"].strip():
            shop_state["gender"] = None
        if isinstance(shop_state["category"], str) and not shop_state["category"].strip():
            shop_state["category"] = None

    rag_context = await deps.build_initial_rag_context(message, image_bytes, mime_type, ws_session_id)

    tool_decls = [
        genai_types.FunctionDeclaration(
            name="keyword_search",
            description=(
                "Search the catalog. Current sidebar gender/category are applied automatically if you omit them; "
                "you may override per call. After manage_sidebar, pass the same gender/category here for consistent results."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "keywords": {"type": "string", "description": "Search terms"},
                    "gender": {"type": "string", "description": "Optional override: MEN or WOMEN"},
                    "category": {"type": "string", "description": "Optional override: category id e.g. Dresses, Denim"},
                    "n_results": {"type": "integer", "description": "Max hits (default 8)"},
                },
                "required": ["keywords"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="manage_sidebar",
            description=(
                "Observe or sync the shop sidebar with the patron. The tool returns EVERY gender and category "
                "with selected true/false. When the patron names a department (e.g. women's dresses, men's denim), "
                "call action='select' with BOTH gender (MEN or WOMEN) AND category (exact id e.g. Dresses, Denim, Tees_Tanks) "
                "in one call when possible so primary and secondary filters match the UI. Use action empty or 'observe' to read state only. "
                "Category ids use underscores as in the snapshot (e.g. Graphic_Tees, Jackets_Coats)."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "description": "Omit or 'observe' to read the full tree. 'select' to apply filters.",
                    },
                    "gender": {
                        "type": "string",
                        "description": "MEN, WOMEN, or ALL to clear gender (and reset category).",
                    },
                    "category": {
                        "type": "string",
                        "description": "Catalog category id matching the sidebar (e.g. Dresses, Denim, Tees_Tanks).",
                    },
                    "value": {
                        "type": "string",
                        "description": "Legacy single tag: MEN, WOMEN, ALL, or a category id — prefer gender+category instead.",
                    },
                },
            },
        ),
        genai_types.FunctionDeclaration(
            name="show_product",
            description="Explicitly display a specific product to the patron in the chat.",
            parameters={
                "type": "object",
                "properties": {"product_id": {"type": "string", "description": "The ID of the product to show"}},
                "required": ["product_id"],
            },
        ),
    ]

    sys_prompt = rt.system_prompt(prompts)
    _side_snap = build_sidebar_snapshot(shop_state)
    _sidebar_json = json.dumps(_side_snap, indent=2)
    _query_note = ""
    if shop_state.get("query"):
        _query_note = f'\n\n## Patron search bar (read-only for you)\n"{shop_state["query"]}"'
    history = [
        genai_types.Content(
            role="user",
            parts=[
                genai_types.Part(
                    text=(
                        f"{sys_prompt}\n\n"
                        f"## Shop sidebar — all choices; each has selected true or false\n{_sidebar_json}"
                        f"{_query_note}\n\n"
                        f"## Background Context\n{rag_context}\n\n"
                        f"Patron Request: {message}"
                    )
                )
            ],
        )
    ]
    if image_bytes:
        history[0].parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    gen_config = genai_types.GenerateContentConfig(
        thinking_config=genai_types.ThinkingConfig(thinking_level=rt.thinking_level),
        temperature=1.0,
        tools=[genai_types.Tool(function_declarations=tool_decls)],
    )

    max_iterations = 5
    iteration = 0
    final_prose = ""
    discovered_products: list[dict[str, Any]] = []
    seen_pids: set[str] = set()

    while iteration < max_iterations:
        iteration += 1
        logger.info("[AGENT LOOP] Iteration %s", iteration)

        try:
            response = rt.gemini_client.models.generate_content(
                model=rt.model,
                contents=history,
                config=gen_config,
            )

            if not response.candidates[0].content.parts:
                break

            current_text = ""
            for part in response.candidates[0].content.parts:
                if part.text:
                    current_text += part.text

            if current_text:
                yield {"type": "thinking", "content": f"Stylist is reasoning: {current_text[:100]}..."}

            history.append(response.candidates[0].content)

            tool_calls = [p.function_call for p in response.candidates[0].content.parts if p.function_call]

            if not tool_calls:
                final_prose = current_text
                break

            tool_responses = []
            for fc in tool_calls:
                yield {"type": "thinking", "content": f"Action: {fc.name}..."}

                observation: dict[str, Any] = {}
                if fc.name == "manage_sidebar":
                    args = fc.args or {}
                    observation = deps.manage_sidebar(
                        args.get("action"),
                        args.get("value"),
                        args.get("gender"),
                        args.get("category"),
                        shop_state,
                    )

                    if ws_session_id:
                        await deps.emit_shop_sync(ws_session_id, shop_state)

                    if observation.get("ui_action_required"):
                        payload = observation["action_payload"] or {}

                        hint = ", ".join(
                            f"{k}={payload.get(k)!r}" for k in ("gender", "category") if payload.get(k)
                        )
                        yield {"type": "text", "content": f"*[Agent aligns shop sidebar: {hint}]*\n\n"}

                        g_f = payload.get("gender") or None
                        c_f = payload.get("category") or None
                        search_val = c_f or g_f or args.get("value") or "fashion"
                        res = deps.keyword_search(keywords=str(search_val), gender=g_f, category=c_f)
                        for p in res:
                            if p["product_id"] not in seen_pids:
                                discovered_products.append(p)
                                seen_pids.add(p["product_id"])

                        observation["status"] = f"UI updated. Found {len(res)} items."

                elif fc.name == "keyword_search":
                    kw = fc.args.get("keywords", "")
                    ks_args = {
                        k: fc.args[k] for k in ("keywords", "gender", "category", "n_results") if k in (fc.args or {})
                    }
                    if ks_args.get("gender") in (None, "") and shop_state.get("gender"):
                        ks_args["gender"] = shop_state["gender"]
                    if ks_args.get("category") in (None, "") and shop_state.get("category"):
                        ks_args["category"] = shop_state["category"]

                    if ws_session_id and kw:
                        q = str(kw).strip()
                        shop_state["query"] = q or None
                        await deps.emit_shop_sync(ws_session_id, shop_state)

                        yield {"type": "text", "content": f"*[Agent searches for: \"{kw}\"]*\n\n"}

                    res = deps.keyword_search(**ks_args)
                    for p in res:
                        if p["product_id"] not in seen_pids:
                            discovered_products.append(p)
                            seen_pids.add(p["product_id"])
                    observation = {"results_count": len(res), "status": f"Search for '{kw}' complete."}

                elif fc.name == "show_product":
                    pid = fc.args["product_id"]
                    item = deps.find_catalog_product(pid)
                    if item:
                        if pid not in seen_pids:
                            discovered_products.append({k: v for k, v in item.items() if k != "image_path"})
                            seen_pids.add(pid)
                        yield {
                            "type": "found_products",
                            "count": 1,
                            "content": f"Stylist presents: {item['product_name']}",
                            "products": [{k: v for k, v in item.items() if k != "image_path"}],
                        }
                        observation = {"status": f"Product {pid} shown.", "product_name": item["product_name"]}
                    else:
                        observation = {"status": "Error: Product not found."}

                tool_responses.append(
                    genai_types.Part.from_function_response(name=fc.name, response=observation)
                )
                yield {"type": "thinking", "content": f"Observation: {observation.get('status', 'Task complete')}"}

            history.append(genai_types.Content(role="user", parts=tool_responses))

        except Exception as loop_err:
            logger.error("[AGENT LOOP] Error in iteration %s: %s", iteration, loop_err)
            break

    yield {"type": "thinking", "content": "Curation complete. Composing final response..."}

    if not discovered_products:
        logger.info("[AGENT LOOP] No products discovered, triggering fallback search")
        res = deps.keyword_search(keywords=message, n_results=8)
        for p in res:
            if p["product_id"] not in seen_pids:
                discovered_products.append(p)
                seen_pids.add(p["product_id"])

    if not final_prose:
        final_prose = (
            "I've curated a selection of pieces that I believe will complement your style perfectly. "
            "Please take a look at the choices below."
        )
    if image_bytes and final_prose:
        first_line, _, rest = final_prose.partition("\n")
        if "GENDER:" in first_line:
            final_prose = rest.strip()

    yield {"type": "tool_result", "tool": "gemini_narrative", "content": "Stylist curation complete"}

    if ws_session_id:
        await deps.emit_catalog_results(ws_session_id, discovered_products[:12], "agent_curated")

    yield {"type": "text", "content": final_prose}

    _filt: dict[str, Any] = {
        "gender": shop_state.get("gender") or "",
        "category": shop_state.get("category") or "",
    }
    if shop_state.get("query"):
        _filt["query"] = shop_state["query"]

    yield {
        "type": "final",
        "reply": final_prose,
        "products": discovered_products[:12],
        "intent": "agent_curation",
        "filter": _filt,
    }

    yield "data: [DONE]\n\n"
