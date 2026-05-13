"""
agent/tools.py
==============
Tool functions exposed to the ADK agent.
Call init_tools() once at startup (from api.py lifespan) before the agent runs.

All search is pure Python keyword matching — zero Gemini API calls.
"""

from __future__ import annotations

import contextvars
import logging
from pathlib import Path
from typing import Optional

import config

log = logging.getLogger(__name__)

# ── Module-level state (set by init_tools) ────────────────────────────────────

_catalog: list[dict] = []
_journal: list[dict] = []
_gemini_client = None

# ── Patron context (set per-request via set_patron_context) ───────────────────

_patron_email_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "patron_email", default=None
)


def set_patron_context(email: Optional[str]) -> contextvars.Token:
    """Set the current patron's email for this async context. Returns a reset token."""
    return _patron_email_ctx.set(email)


def init_tools(catalog: list[dict], journal: list[dict] = None, gemini_client=None, **_kwargs):
    """Inject the in-memory catalog, journal, and Gemini client. Called once during FastAPI startup."""
    global _catalog, _journal, _gemini_client
    _catalog = catalog
    _journal = journal or []
    _gemini_client = gemini_client
    log.info(f"agent/tools: catalog injected — {len(_catalog)} items, {len(_journal)} journal entries")


# ── Tools (called by the ADK agent) ──────────────────────────────────────────

def search_by_keywords(
    keywords: str,
    gender: str = None,
    category: str = None,
    max_price: float = None,
    n_results: int = 8,
) -> dict:
    """
    Fast keyword search — zero API cost.
    Scans product descriptions for the given keywords and returns matching
    items instantly.  Use this for all product searches.

    Args:
        keywords:  One or more words to look for in the description,
                   e.g. "floral" or "leather jacket" or "blue cotton shirt".
        gender:    Optional filter — "MEN" or "WOMEN".
        category:  Optional filter — e.g. "Denim", "Dresses", "Tees_Tanks".
        max_price: Optional upper price limit in USD.
        n_results: Number of results to return (default 8, max 32).

    Returns:
        dict with keys "products" (list) and "total" (int).
        Each product has: product_id, product_name, description,
        gender, category, price, image_url.
    """
    try:
        n_results = min(max(1, n_results), 32)
        kw = keywords.lower().strip()

        out = []
        for item in _catalog:
            # keyword filter
            if kw and kw not in item.get("description", "").lower():
                continue
            # gender filter
            if gender and item.get("gender", "").upper() != gender.upper():
                continue
            # category filter
            if category and item.get("category", "") != category:
                continue
            # price filter
            if max_price is not None and item.get("price", 0.0) > max_price:
                continue

            out.append({
                "product_id":   item.get("product_id", ""),
                "product_name": item.get("product_name", ""),
                "description":  item.get("description", ""),
                "gender":       item.get("gender", ""),
                "category":     item.get("category", ""),
                "price":        float(item.get("price", 0.0)),
                "image_url":    item.get("image_url", ""),
            })
            if len(out) >= n_results:
                break

        return {"products": out, "total": len(out), "keywords": keywords}
    except Exception as exc:
        log.error(f"search_by_keywords error: {exc}")
        return {"products": [], "total": 0, "keywords": keywords, "error": str(exc)}


def get_catalog_stats() -> dict:
    """
    Return statistics about the product catalog:
    total item count, available categories, and available genders.
    """
    try:
        cats, genders = set(), set()
        for item in _catalog:
            cats.add(item.get("category", "unknown"))
            genders.add(item.get("gender", "unknown"))
        return {
            "total_products": len(_catalog),
            "categories":     sorted(cats),
            "genders":        sorted(genders),
        }
    except Exception as exc:
        log.error(f"get_catalog_stats error: {exc}")
        return {"total_products": 0, "categories": [], "genders": []}


def search_journal(keywords: str, n_results: int = 3) -> dict:
    """
    Search the Secundus Dermis Journal (blog) for entries matching the given keywords.
    Use this when the customer asks about fashion advice, how-to guides, category
    explanations, or any topic that might be covered in an editorial article.

    Args:
        keywords: Words to search for in journal titles, excerpts, and body text.
        n_results: Number of results to return (default 3, max 5).

    Returns:
        dict with "articles" list. Each article has: slug, title, excerpt, category, date.
    """
    try:
        n_results = min(max(1, n_results), 5)
        kw = keywords.lower().strip()
        out = []
        for post in _journal:
            searchable = f"{post.get('title','')} {post.get('excerpt','')} {post.get('body','')}".lower()
            if kw and kw not in searchable:
                continue
            out.append({
                "slug":     post.get("slug", ""),
                "title":    post.get("title", ""),
                "excerpt":  post.get("excerpt", ""),
                "category": post.get("category", ""),
                "date":     post.get("date", ""),
            })
            if len(out) >= n_results:
                break
        return {"articles": out, "total": len(out), "keywords": keywords}
    except Exception as exc:
        log.error(f"search_journal error: {exc}")
        return {"articles": [], "total": 0, "keywords": keywords, "error": str(exc)}


def get_product_categories() -> dict:
    """
    Return the list of available product categories and genders
    so you know what filters are valid for search_by_keywords.
    """
    stats = get_catalog_stats()
    return {
        "categories": stats["categories"],
        "genders":    stats["genders"],
    }


def get_patron_profile() -> dict:
    """
    Retrieve the current patron's profile: their style notes, reserved pieces
    (cart history), and recent browser activity (pages visited, products viewed,
    searches, dwell times). Call this at the start of any conversation with a
    logged-in patron to personalise your response — address them by name, reference
    pieces they've reserved, and note what they've been browsing.

    Returns a dict with keys:
      email       — patron email
      notes       — list of AI-extracted style insight strings
      cart_items  — list of {product_name, category, description} they've reserved
      activity    — list of recent {event, path, label, seconds} browser actions
    """
    try:
        from user_profiles import get_profile as _get_profile
        email = _patron_email_ctx.get()
        if not email:
            return {"email": None, "notes": [], "cart_items": [], "activity": []}
        return _get_profile(email)
    except Exception as exc:
        log.error(f"get_patron_profile error: {exc}")
        return {"email": None, "notes": [], "cart_items": [], "activity": []}


def save_patron_note(note: str) -> dict:
    """
    Save a concise insight about the patron's style, preferences, or aesthetic
    discovered during conversation or inferred from their browsing behaviour.

    Call this whenever the patron reveals something meaningful:
      - Preferred palette or textures ("gravitates toward earth tones")
      - Silhouette or fit preferences ("prefers relaxed, oversized silhouettes")
      - Occasion dressing ("shops primarily for business-casual environments")
      - Lifestyle signals ("mentioned travelling frequently, values versatility")
      - Fabric preferences ("avoids synthetic textiles, prefers natural fibres")
      - Things they dislike ("not interested in graphic prints")

    Notes are stored and surfaced in future sessions via get_patron_profile.

    Args:
        note: A concise, third-person insight. E.g. "Prefers structured, minimalist pieces."

    Returns:
        {"saved": true} on success.
    """
    try:
        from user_profiles import add_note as _add_note
        email = _patron_email_ctx.get()
        if email and note:
            _add_note(email, note.strip())
        return {"saved": True}
    except Exception as exc:
        log.error(f"save_patron_note error: {exc}")
        return {"saved": False, "error": str(exc)}


def describe_image(image_id: str) -> dict:
    """
    Use Gemini VLM to analyze an uploaded image and return a structured description.
    Call this when the patron has uploaded an image and you need to understand what
    garments are shown before searching for similar items.

    For full-body images, this tool identifies ALL visible garments (top, bottom, shoes,
    accessories) and returns them organized by body area.

    The image must first be uploaded via POST /image/upload, which returns an image_id.

    Args:
        image_id: The ID returned when the image was uploaded (e.g., "img_1234567890_abc123").

    Returns:
        dict with keys:
          - items: List of garments, each with:
            - description: Full textual description
            - garment_type: e.g., "shirt", "pants", "shoes"
            - body_area: "upper_body", "lower_body", "feet", "accessories"
            - keywords: Search terms
            - colors: Dominant colors
            - gender: "MEN" or "WOMEN"
            - category: Catalog category
          - overall_style: General style description
          - all_keywords: Combined keywords from all items
    """
    try:
        # Find the uploaded image file
        uploads_dir = config.UPLOADS_DIR
        image_path = None
        for ext in ["jpg", "jpeg", "png", "webp"]:
            candidate = uploads_dir / f"{image_id}.{ext}"
            if candidate.exists():
                image_path = candidate
                break

        if image_path is None:
            return {
                "error": f"Image not found: {image_id}",
                "items": [],
                "all_keywords": [],
            }

        if _gemini_client is None:
            return {
                "error": "Gemini client not initialized",
                "items": [],
                "all_keywords": [],
            }

        # VLA Model: Load image bytes and send directly to VLM
        image_bytes = image_path.read_bytes()
        mime_type = "image/jpeg" if image_path.suffix.lower() in [".jpg", ".jpeg"] else f"image/{image_path.suffix[1:]}"

        # The VLA model processes image + prompt together
        resp = _gemini_client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=[
                genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type),  # Image
                genai_types.Part.from_text(  # Text prompt
                    "Analyze this clothing image and identify ALL visible garments. "
                    "For each item, return:\n"
                    "{\n"
                    '  "items": [\n'
                    '    {\n'
                    '      "description": "Detailed description for fashion search",\n'
                    '      "garment_type": "shirt/pants/dress/jacket/skirt/shoes/etc",\n'
                    '      "body_area": "upper_body/lower_body/full_body/feet/accessories",\n'
                    '      "colors": ["color1", "color2"],\n'
                    '      "keywords": ["search", "terms"]\n'
                    '    }\n'
                    '  ],\n'
                    '  "overall_style": "casual/formal/athletic/etc"\n'
                    "}\n"
                    "Identify EVERY clothing item visible. Return valid JSON only."
                ),
            ],
        )

        # Parse the response
        import re
        import json
        response_text = resp.text.strip()
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)

        result = {}
        if json_match:
            result = json.loads(json_match.group())
        else:
            # Fallback: treat as single item
            result = {
                "items": [{"description": response_text, "body_area": "unknown"}],
                "overall_style": "unknown",
            }

        # Ensure we have items
        items = result.get("items", [])
        if not items and result.get("description"):
            items = [{**result, "body_area": "unknown"}]
            result["items"] = items

        # Extract keywords from all items
        all_keywords = []
        for item in items:
            if "keywords" not in item or not item["keywords"]:
                # Extract from description
                stop_words = {
                    "a", "an", "the", "with", "and", "or", "of", "in", "on", "for",
                    "is", "are", "has", "its", "that", "this", "it", "at", "by",
                }
                desc = item.get("description", "")
                raw_terms = re.split(r"[\s,.\-/()]+", desc.lower())
                item["keywords"] = [t for t in raw_terms if len(t) > 2 and t not in stop_words]
            all_keywords.extend(item.get("keywords", []))

        result["all_keywords"] = list(set(all_keywords))

        # Group items by body area for easier searching
        by_body_area = {}
        for item in items:
            area = item.get("body_area", "unknown")
            if area not in by_body_area:
                by_body_area[area] = []
            by_body_area[area].append(item)

        result["by_body_area"] = by_body_area

        log.info(f"describe_image for {image_id}: found {len(items)} items")
        return result

    except Exception as exc:
        log.error(f"describe_image error: {exc}")
        return {
            "error": str(exc),
            "items": [],
            "all_keywords": [],
            "by_body_area": {},
        }


def regex_search(pattern: str, field: str = "description", n_results: int = 8) -> dict:
    """
    Search the catalog using regular expression pattern matching.
    Use this when the patron needs advanced pattern matching that simple
    keyword search cannot handle (e.g., "shirt|blouse", "cotton|linen", etc.).

    Args:
        pattern: Regular expression pattern to match (case-insensitive).
                 Examples: "cotton|linen", "blue.*shirt", "denim.*jacket"
        field: Which field to search: "description" (default), "product_name", or "all"
        n_results: Number of results to return (default 8, max 32).

    Returns:
        dict with keys "products" (list), "total" (int), and "pattern" (str).
        Each product has: product_id, product_name, description, gender, category, price, image_url.
    """
    try:
        n_results = min(max(1, n_results), 32)

        # Compile the regex (case-insensitive)
        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error as e:
            return {
                "products": [],
                "total": 0,
                "pattern": pattern,
                "error": f"Invalid regex pattern: {e}",
            }

        results = []
        for item in _catalog:
            # Determine which fields to search
            if field == "all":
                searchable = f"{item.get('description', '')} {item.get('product_name', '')}"
            else:
                searchable = item.get(field, "")

            if regex.search(searchable):
                results.append({
                    "product_id": item.get("product_id", ""),
                    "product_name": item.get("product_name", ""),
                    "description": item.get("description", ""),
                    "gender": item.get("gender", ""),
                    "category": item.get("category", ""),
                    "price": float(item.get("price", 0.0)),
                    "image_url": item.get("image_url", ""),
                })
                if len(results) >= n_results:
                    break

        return {"products": results, "total": len(results), "pattern": pattern}

    except Exception as exc:
        log.error(f"regex_search error: {exc}")
        return {"products": [], "total": 0, "pattern": pattern, "error": str(exc)}


def search_past_images(
    query: str = None,
    image_id: str = None,
    n_results: int = 5,
) -> dict:
    """
    Search the patron's past uploaded images using vector similarity.
    Call this when the patron wants to find images they previously uploaded
    or when you need to recall what images they've shared.

    Args:
        query: Text description to search for (will be embedded and compared).
        image_id: Find images similar to this previously uploaded image.
        n_results: Number of results to return (default 5, max 10).

    Returns:
        dict with keys "images" (list) and "total" (int).
        Each image has: image_id, description, garment_type, colors, category,
        timestamp, similarity (if searched by vector).
    """
    try:
        n_results = min(max(1, n_results), 10)

        # Get the current patron's email
        email = _patron_email_ctx.get()

        # Get vector store
        try:
            from vector_store import get_vector_store
            vector_store = get_vector_store()
        except Exception as e:
            log.error(f"search_past_images: vector store not available: {e}")
            return {"images": [], "total": 0, "error": "Vector store not available"}

        # Search by vector similarity
        if query and _gemini_client:
            try:
                from google.genai import types as genai_types

                # Generate embedding for the query
                emb_resp = _gemini_client.models.embed_content(
                    model="text-embedding-004",
                    content=query,
                )
                query_embedding = emb_resp.embeddings[0].values

                # Search vector store
                results = vector_store.search_by_similarity(
                    query_embedding=query_embedding,
                    email=email,
                    limit=n_results,
                    threshold=0.5,
                )

                images = [
                    {
                        "image_id": emb.image_id,
                        "description": emb.description,
                        "garment_type": emb.garment_type,
                        "colors": emb.colors,
                        "category": emb.category,
                        "gender": emb.gender,
                        "timestamp": emb.timestamp,
                        "similarity": round(sim, 3),
                    }
                    for sim, emb in results
                ]
                return {"images": images, "total": len(images), "query": query}

            except Exception as e:
                log.error(f"search_past_images embedding error: {e}")
                # Fallback to text search

        # Fallback: search by email (text-based)
        if email:
            images = vector_store.search_by_email(email, limit=n_results)
            return {
                "images": [
                    {
                        "image_id": emb.image_id,
                        "description": emb.description,
                        "garment_type": emb.garment_type,
                        "colors": emb.colors,
                        "category": emb.category,
                        "gender": emb.gender,
                        "timestamp": emb.timestamp,
                    }
                    for emb in images
                ],
                "total": len(images),
            }

        return {"images": [], "total": 0}

    except Exception as exc:
        log.error(f"search_past_images error: {exc}")
        return {"images": [], "total": 0, "error": str(exc)}


def reflect_and_record(
    category: str,
    insight: str,
    confidence: float,
    evidence: list[str],
    follow_up: str = None,
) -> dict:
    """
    Reflect on the conversation and record structured insights about the patron.
    Call this after meaningful interactions to capture style preferences,
    lifestyle insights, or aesthetic sensibilities for future conversations.

    This is how you "write in the patron's diary" — building a rich profile
    of their taste over time.

    Args:
        category: Type of insight — one of:
                  "palette" (color preferences),
                  "silhouette" (fit preferences: structured vs fluid, oversized vs tailored),
                  "fabric" (material preferences: cotton, linen, silk, etc.),
                  "occasion" (what they shop for: work, events, casual),
                  "style_aesthetic" (minimalist, bohemian, classic, edgy, etc.),
                  "brand_affinity" (brands or designers they mention),
                  "fit_preference" (specific fit notes: "likes high-waisted", "prefers long sleeves"),
                  "lifestyle" (life context: "travels frequently", "works in creative industry")
        insight: The structured insight to record. Be specific and actionable.
                 Example: "Gravitates toward earth tones and natural textures"
        confidence: How certain you are (0.0-1.0). Higher if patron stated explicitly,
                    lower if inferred from browsing behavior.
        evidence: List of quotes or observations supporting this insight.
                  Example: ["Patron said: 'I love warm, earthy colors'",
                           "Spent 3 minutes viewing linen pieces"]
        follow_up: Optional action to remember for next conversation.
                   Example: "Ask about upcoming wedding they mentioned"

    Returns:
        dict with "saved": bool, "insight_id": str (if saved)
    """
    try:
        email = _patron_email_ctx.get()
        if not email:
            log.info("reflect_and_record: No authenticated patron, skipping")
            return {"saved": False, "reason": "No authenticated patron"}

        # Validate category
        valid_categories = {
            "palette", "silhouette", "fabric", "occasion",
            "style_aesthetic", "brand_affinity", "fit_preference", "lifestyle"
        }
        if category not in valid_categories:
            log.warning(f"reflect_and_record: Invalid category '{category}'")
            category = "style_aesthetic"  # Default fallback

        # Get diary store and save insight
        try:
            from diary import get_diary_store
            diary = get_diary_store()

            diary.add_insight(
                email=email,
                category=category,
                insight=insight,
                confidence=min(1.0, max(0.0, confidence)),
                evidence=evidence[:10],  # Max 10 pieces of evidence
            )

            if follow_up:
                diary.add_follow_up(email, follow_up)

            log.info(f"reflect_and_record: Saved {category} insight for {email}")
            return {"saved": True, "category": category, "insight": insight}

        except Exception as e:
            log.error(f"reflect_and_record: Diary store error: {e}")
            return {"saved": False, "error": str(e)}

    except Exception as exc:
        log.error(f"reflect_and_record error: {exc}")
        return {"saved": False, "error": str(exc)}


def record_interaction(
    interaction_type: str,
    summary: str,
    context: dict = None,
    mood: str = None,
) -> dict:
    """
    Record an interaction with the patron in their diary.
    Call this after significant conversations or actions.

    Args:
        interaction_type: One of: "chat", "image_upload", "search", "product_view", "cart_action"
        summary: Brief summary of what happened
        context: Optional context dict (products viewed, search terms, etc.)
        mood: Patron's apparent mood — "exploratory", "decisive", "uncertain", "browsing"

    Returns:
        dict with "recorded": bool
    """
    try:
        email = _patron_email_ctx.get()
        if not email:
            return {"recorded": False, "reason": "No authenticated patron"}

        try:
            from diary import get_diary_store
            diary = get_diary_store()

            diary.add_interaction(
                email=email,
                interaction_type=interaction_type,
                summary=summary,
                context=context or {},
                mood=mood,
            )

            log.info(f"record_interaction: Recorded {interaction_type} for {email}")
            return {"recorded": True, "type": interaction_type}

        except Exception as e:
            log.error(f"record_interaction: Diary store error: {e}")
            return {"recorded": False, "error": str(e)}

    except Exception as exc:
        log.error(f"record_interaction error: {exc}")
        return {"recorded": False, "error": str(exc)}


def write_diary_reflection(
    title: str,
    content: str,
    tags: list[str] = None,
) -> dict:
    """
    Write a reflective diary entry about the patron.
    Use this for deeper reflections — synthesizing patterns you've noticed
    across multiple interactions.

    Args:
        title: Title for this reflection
        content: The reflection content — your observations about the patron's
                 evolving style, recurring themes, or notable preferences
        tags: Optional tags for categorization

    Returns:
        dict with "written": bool
    """
    try:
        email = _patron_email_ctx.get()
        if not email:
            return {"written": False, "reason": "No authenticated patron"}

        try:
            from diary import get_diary_store
            diary = get_diary_store()

            diary.write_reflection(
                email=email,
                title=title,
                content=content,
                tags=tags or [],
            )

            log.info(f"write_diary_reflection: Wrote '{title}' for {email}")
            return {"written": True, "title": title}

        except Exception as e:
            log.error(f"write_diary_reflection: Diary store error: {e}")
            return {"written": False, "error": str(e)}

    except Exception as exc:
        log.error(f"write_diary_reflection error: {exc}")
        return {"written": False, "error": str(exc)}


def get_patron_diary_summary() -> dict:
    """
    Get a summary of the patron's diary — their accumulated insights and
    interaction history. Call this at the start of a conversation to
    understand the patron's journey.

    Returns:
        dict with insights_by_category, recent_interactions, follow_up_actions
    """
    try:
        email = _patron_email_ctx.get()
        if not email:
            return {"exists": False, "reason": "No authenticated patron"}

        try:
            from diary import get_diary_store
            diary = get_diary_store()

            summary = diary.get_summary(email)
            return summary

        except Exception as e:
            log.error(f"get_patron_diary_summary: Diary store error: {e}")
            return {"exists": False, "error": str(e)}

    except Exception as exc:
        log.error(f"get_patron_diary_summary error: {exc}")
        return {"exists": False, "error": str(exc)}
