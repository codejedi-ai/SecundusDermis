"""``user_experience`` — Boutique vs Atelier mode persisted per email."""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture
def exp_store(monkeypatch, tmp_path):
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    import user_experience as ue

    return importlib.reload(ue)


def test_default_boutique(exp_store):
    ue = exp_store
    assert ue.get_experience_mode("Patron@Example.com") == "boutique"


def test_set_atelier_round_trip(exp_store):
    ue = exp_store
    assert ue.set_experience_mode("patron@example.com", "atelier") == "atelier"
    assert ue.get_experience_mode("patron@example.com") == "atelier"


def test_invalid_mode_normalizes_to_boutique(exp_store):
    ue = exp_store
    assert ue.set_experience_mode("x@y.z", "nope") == "boutique"
    assert ue.get_experience_mode("x@y.z") == "boutique"
