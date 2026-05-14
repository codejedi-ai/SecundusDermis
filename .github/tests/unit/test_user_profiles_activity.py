"""Regression: patron activity log used by ``POST /api/patron/activity``."""

from __future__ import annotations

from user_profiles import get_profile, record_activity


def test_record_activity_appends_and_caps():
    email = "activity-test@example.com"
    for i in range(55):
        record_activity(email, "page_view", f"/path-{i}", str(i), 0)
    p = get_profile(email)
    assert len(p["activity"]) == 50
    assert p["activity"][-1]["path"] == "/path-54"
    assert p["activity"][0]["path"] == "/path-5"


def test_record_activity_stores_fields():
    email = "activity-fields@example.com"
    record_activity(email, "search", "/shop", "linen wrap", 0)
    p = get_profile(email)
    assert len(p["activity"]) == 1
    row = p["activity"][0]
    assert row["event"] == "search"
    assert row["path"] == "/shop"
    assert row["label"] == "linen wrap"
    assert row["seconds"] == 0
    assert "ts" in row
