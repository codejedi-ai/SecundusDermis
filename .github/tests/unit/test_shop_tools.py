"""Regression tests for ``shop_tools`` — catalog keyword search and shop sidebar state."""

from __future__ import annotations

import pytest

from shop_tools import (
    ALL_VALID_CATEGORIES,
    build_sidebar_snapshot,
    keyword_search,
    manage_sidebar,
)


def _sample_catalog() -> list[dict]:
    return [
        {
            "product_id": "1",
            "product_name": "White Cotton Tee",
            "description": "Classic crew neck tee in breathable cotton.",
            "category": "Tees_Tanks",
            "gender": "MEN",
            "image_path": "/x/1.jpg",
        },
        {
            "product_id": "2",
            "product_name": "Silk Blouse",
            "description": "Evening blouse with mother-of-pearl buttons.",
            "category": "Blouses_Shirts",
            "gender": "WOMEN",
            "image_path": "/x/2.jpg",
        },
    ]


def test_keyword_search_matches_description_and_strips_image_path():
    cat = _sample_catalog()
    hits = keyword_search(cat, "cotton breathable", n_results=8)
    assert len(hits) == 1
    assert hits[0]["product_id"] == "1"
    assert "image_path" not in hits[0]


def test_keyword_search_respects_gender_filter():
    cat = _sample_catalog()
    men_only = keyword_search(cat, "tee blouse silk", gender="MEN", n_results=8)
    assert all(h.get("gender") == "MEN" for h in men_only)


def test_keyword_search_empty_query_returns_empty():
    assert keyword_search(_sample_catalog(), "   ") == []


def test_keyword_search_short_tokens_only_still_matches_via_empty_terms_branch():
    """Terms shorter than 3 chars are dropped; with no terms left, loop still matches."""
    cat = _sample_catalog()
    hits = keyword_search(cat, "xx yy zz", n_results=8)
    assert len(hits) == 2


def test_manage_sidebar_observe_returns_snapshot():
    state: dict = {"gender": "MEN", "category": "Denim"}
    out = manage_sidebar(action="observe", shop_state=state)
    assert out["mode"] == "observe"
    assert "genders" in out["shop_sidebar"]
    assert out["shop_sidebar"]["selected_gender_id"] == "MEN"
    assert out["shop_sidebar"]["selected_category_id"] == "Denim"


def test_manage_sidebar_select_updates_state():
    state: dict = {}
    out = manage_sidebar(action="select", gender="WOMEN", shop_state=state)
    assert out["mode"] == "select"
    assert state["gender"] == "WOMEN"
    assert state.get("category") in (None, "")


def test_all_valid_categories_nonempty():
    assert "Tees_Tanks" in ALL_VALID_CATEGORIES
    assert "Denim" in ALL_VALID_CATEGORIES


def test_build_sidebar_snapshot_narration_mentions_selection():
    snap = build_sidebar_snapshot({"gender": "MEN", "category": None})
    assert "Men" in snap["narration"] or "gender" in snap["narration"].lower()
