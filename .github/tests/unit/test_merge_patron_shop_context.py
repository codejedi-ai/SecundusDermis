"""Suite A — patron UI snapshot (shop_context) must seed agent shop_state (frontend → backend bridge)."""

from __future__ import annotations

from types import SimpleNamespace

from stylist_loop.payloads import merge_patron_shop_context, shop_sync_payload


def test_merge_none_is_empty_shop_state():
    s = merge_patron_shop_context(None)
    assert s == {"gender": None, "category": None, "query": None}


def test_merge_dict_full():
    s = merge_patron_shop_context({"gender": "WOMEN", "category": "Dresses", "query": "floral"})
    assert s["gender"] == "WOMEN"
    assert s["category"] == "Dresses"
    assert s["query"] == "floral"


def test_merge_strips_blank_gender_category():
    s = merge_patron_shop_context({"gender": "  ", "category": "", "query": "x"})
    assert s["gender"] is None
    assert s["category"] is None
    assert s["query"] == "x"


def test_merge_model_dump_compat():
    ctx = SimpleNamespace(
        model_dump=lambda: {"gender": "MEN", "category": "Denim", "query": None},
    )
    s = merge_patron_shop_context(ctx)
    assert s == {"gender": "MEN", "category": "Denim", "query": None}


def test_shop_sync_payload_round_trip_from_merge():
    """Suite B shape: agent shop_state normalises to the JSON the React ShopSocketSync consumes."""
    merged = merge_patron_shop_context({"gender": "WOMEN", "category": "Skirts", "query": "midi"})
    payload = shop_sync_payload(merged)
    assert payload == {"gender": "WOMEN", "category": "Skirts", "query": "midi"}


def test_shop_sync_payload_coerces_none_to_empty_strings():
    merged = merge_patron_shop_context(None)
    assert shop_sync_payload(merged) == {"gender": "", "category": "", "query": ""}
