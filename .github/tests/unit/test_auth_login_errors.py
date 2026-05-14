"""Login error codes from ``try_authenticate`` (distinct wrong-email vs wrong-password)."""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture
def auth_file_mode(monkeypatch, tmp_path):
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    monkeypatch.setenv("AUTH_USERS_BACKEND", "file")
    import auth

    return importlib.reload(auth)


def test_try_authenticate_user_not_found(auth_file_mode):
    auth = auth_file_mode
    sid, err = auth.try_authenticate("nobody@example.com", "any")
    assert sid is None and err == "user_not_found"


def test_try_authenticate_invalid_password(auth_file_mode):
    auth = auth_file_mode
    out = auth.create_user("patron@example.com", "correct-horse", "Pat")
    assert out is not None
    _user, vtoken = out
    assert auth.verify_email_token(vtoken)
    sid, err = auth.try_authenticate("patron@example.com", "wrong-staple")
    assert sid is None and err == "invalid_password"


def test_try_authenticate_email_not_verified(auth_file_mode):
    auth = auth_file_mode
    out = auth.create_user("newbie@example.com", "pw123456", "N")
    assert out is not None
    sid, err = auth.try_authenticate("newbie@example.com", "pw123456")
    assert sid is None and err == "email_not_verified"


def test_try_authenticate_success(auth_file_mode):
    auth = auth_file_mode
    out = auth.create_user("ok@example.com", "pw123456", "O")
    assert out is not None
    _u, vtoken = out
    assert auth.verify_email_token(vtoken)
    sid, err = auth.try_authenticate("ok@example.com", "pw123456")
    assert err is None and sid and len(sid) >= 16
