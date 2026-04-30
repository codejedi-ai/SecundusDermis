"""
Gmail SMTP helpers for transactional mail (password reset).
Credentials: GMAIL_USER, GMAIL_PASSWORD (16-char app password; spaces optional).
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("GMAIL_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("GMAIL_SMTP_PORT", "587"))

TEMPLATES_DIR = Path(__file__).parent / "templates" / "email"


def _load_template(name: str, **kwargs) -> str:
    """Load and format an email template."""
    path = TEMPLATES_DIR / name
    if not path.exists():
        logger.error("Email template not found: %s", path)
        return ""
    content = path.read_text(encoding="utf-8")
    for key, value in kwargs.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))
    return content


def _gmail_user() -> str:
    return (os.getenv("GMAIL_USER") or "").strip()


def _gmail_password() -> str:
    # App passwords are often shown with spaces; SMTP uses the concatenated form.
    return "".join((os.getenv("GMAIL_PASSWORD") or "").split())


def gmail_smtp_configured() -> bool:
    return bool(_gmail_user() and _gmail_password())


def send_password_reset_email(
    to_addr: str,
    user_name: str,
    reset_url: str,
    *,
    app_name: str = "Secundus Dermis",
) -> None:
    """Send password reset message. Raises on SMTP failure."""
    sender = _gmail_user()
    password = _gmail_password()
    if not sender or not password:
        raise RuntimeError("Gmail SMTP is not configured (missing GMAIL_USER or GMAIL_PASSWORD)")

    subject = f"Reset your {app_name} password"
    text = _load_template("password_reset.txt", user_name=user_name, reset_url=reset_url, app_name=app_name)
    html = _load_template("password_reset.html", user_name=user_name, reset_url=reset_url, app_name=app_name)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_addr
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
    logger.info(
        "Email sent: type=password_reset from=%s to=%s smtp=%s:%s",
        sender,
        to_addr,
        SMTP_HOST,
        SMTP_PORT,
    )


def send_verification_email(
    to_addr: str,
    user_name: str,
    verify_url: str,
    *,
    app_name: str = "Secundus Dermis",
) -> None:
    """Send signup email verification. Raises on SMTP failure."""
    sender = _gmail_user()
    password = _gmail_password()
    if not sender or not password:
        raise RuntimeError("Gmail SMTP is not configured (missing GMAIL_USER or GMAIL_PASSWORD)")

    subject = f"Welcome to {app_name}"
    text = _load_template("verification.txt", user_name=user_name, verify_url=verify_url, app_name=app_name)
    html = _load_template("verification.html", user_name=user_name, verify_url=verify_url, app_name=app_name)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_addr
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
    logger.info(
        "Email sent: type=email_verification from=%s to=%s smtp=%s:%s",
        sender,
        to_addr,
        SMTP_HOST,
        SMTP_PORT,
    )


def try_send_verification_email(to_addr: str, user_name: str, verify_url: str) -> tuple[bool, Optional[str]]:
    try:
        send_verification_email(to_addr, user_name, verify_url)
        return True, None
    except OSError as e:
        logger.exception("SMTP verification email failed (network or TLS)")
        return False, str(e)
    except smtplib.SMTPException as e:
        logger.exception("SMTP verification email failed")
        return False, str(e)
    except RuntimeError as e:
        logger.warning("%s", e)
        return False, str(e)


def try_send_password_reset_email(to_addr: str, user_name: str, reset_url: str) -> tuple[bool, Optional[str]]:
    """
    Send reset email. Returns (ok, error_message).
    On failure, error_message is a short description for logs (no secrets).
    """
    try:
        send_password_reset_email(to_addr, user_name, reset_url)
        return True, None
    except OSError as e:
        logger.exception("SMTP send failed (network or TLS)")
        return False, str(e)
    except smtplib.SMTPException as e:
        logger.exception("SMTP send failed")
        return False, str(e)
    except RuntimeError as e:
        logger.warning("%s", e)
        return False, str(e)
