"""Regression guards for ``sd.stylist.v1`` stylist WebSocket envelopes."""

from __future__ import annotations

import pytest

from stylist_loop.ws_envelope import (
    SD_STYLIST_MSG_SCHEMA,
    build_shop_sync_envelope,
    validate_stylist_ws_message,
)


def test_validate_accepts_round_trip_shop_sync():
    env = build_shop_sync_envelope("sess-x", {"gender": "WOMEN", "category": "", "query": "silk"}, tool="keyword_search")
    ok, err, norm = validate_stylist_ws_message(env)
    assert ok and err == ""
    assert norm["schema"] == SD_STYLIST_MSG_SCHEMA
    assert norm["session_id"] == "sess-x"
    assert norm["action"] == "shop_sync"
    assert norm["tool"] == "keyword_search"


@pytest.mark.parametrize(
    "bad",
    [
        {},
        {"schema": "other", "session_id": "a", "action": "shop_sync", "payload": {}},
        {"schema": SD_STYLIST_MSG_SCHEMA, "session_id": "", "action": "shop_sync", "payload": {}},
        {"schema": SD_STYLIST_MSG_SCHEMA, "session_id": "a", "action": "hax", "payload": {}},
        {"schema": SD_STYLIST_MSG_SCHEMA, "session_id": "a", "action": "shop_sync", "payload": "nope"},
    ],
)
def test_validate_rejects_malformed(bad):
    ok, err, norm = validate_stylist_ws_message(bad)
    assert not ok
    assert err
    assert norm == {}
