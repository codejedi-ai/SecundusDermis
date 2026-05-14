"""Regression tests for in-memory patron shop selection store."""

from __future__ import annotations

from patron_shop_selection import get_selection, put_selection


def test_get_unknown_session_returns_empty():
    assert get_selection("") == {}
    assert get_selection("no-such") == {}


def test_put_get_roundtrip():
    sid = "sess-test-shop-1"
    out = put_selection(
        sid,
        {
            "gender": "WOMEN",
            "category": "Dresses",
            "query": "linen",
            "input_value": "linen",
            "sidebar_width": 260,
        },
    )
    assert out["gender"] == "WOMEN"
    assert out["category"] == "Dresses"
    assert out["query"] == "linen"
    assert out["input_value"] == "linen"
    assert out["sidebar_width"] == 260
    got = get_selection(sid)
    assert got == out


def test_put_clamps_sidebar_width():
    sid = "sess-test-shop-2"
    low = put_selection(sid, {"sidebar_width": 10})
    assert low["sidebar_width"] == 160
    high = put_selection(sid, {"sidebar_width": 9999})
    assert high["sidebar_width"] == 480


def test_put_merges_partial_updates():
    sid = "sess-test-shop-3"
    put_selection(sid, {"gender": "MEN", "category": "Denim", "query": "", "input_value": "", "sidebar_width": 220})
    out = put_selection(sid, {"query": "raw"})
    assert out["gender"] == "MEN"
    assert out["category"] == "Denim"
    assert out["query"] == "raw"
