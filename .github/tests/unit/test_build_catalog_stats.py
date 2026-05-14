"""Regression guard for catalog stats payload used by GET /catalog/stats and grounded UI copy."""

from __future__ import annotations

from shop_tools import build_catalog_stats


def _sample_catalog() -> list[dict]:
    return [
        {
            "product_id": "1",
            "product_name": "Tee",
            "description": "Cotton.",
            "category": "Tees_Tanks",
            "gender": "MEN",
        },
        {
            "product_id": "2",
            "product_name": "Dress",
            "description": "Silk.",
            "category": "Dresses",
            "gender": "WOMEN",
        },
    ]


def test_build_catalog_stats_counts_and_lists():
    out = build_catalog_stats(
        _sample_catalog(),
        embedding_model="gemini-embedding-test",
        embedding_dim=128,
        search_mode="keyword + agent LLM",
        agent_proxy=True,
    )
    assert out["total_products"] == 2
    assert out["categories"] == ["Dresses", "Tees_Tanks"]
    assert out["genders"] == ["MEN", "WOMEN"]
    assert out["embedding_model"] == "gemini-embedding-test"
    assert out["embedding_dim"] == 128
    assert out["search_mode"] == "keyword + agent LLM"
    assert out["agent_proxy"] is True


def test_build_catalog_stats_empty_catalog():
    out = build_catalog_stats(
        [],
        embedding_model="m",
        embedding_dim=0,
        search_mode="x",
        agent_proxy=False,
    )
    assert out["total_products"] == 0
    assert out["categories"] == []
    assert out["genders"] == []
    assert out["agent_proxy"] is False
