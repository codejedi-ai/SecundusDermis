"""
Gmail SMTP helpers for transactional mail (password reset).
Credentials: GMAIL_USER, GMAIL_PASSWORD (16-char app password; spaces optional).
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("GMAIL_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("GMAIL_SMTP_PORT", "587"))


def _gmail_user() -> str:
    return (os.getenv("GMAIL_USER") or "").strip()


def _gmail_password() -> str:
    # App passwords are often shown with spaces; SMTP uses the concatenated form.
    return "".join((os.getenv("GMAIL_PASSWORD") or "").split())


def gmail_smtp_configured() -> bool:
    return bool(_gmail_user() and _gmail_password())


def send_password_reset_email(
    to_addr: str,
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
    text = (
        f"You requested a password reset for {app_name}.\n\n"
        f"Open this link to choose a new password (valid for 1 hour):\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html = f"""\
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>You requested a password reset for <strong>{app_name}</strong>.</p>
  <p><a href="{reset_url}" style="color: #0d47a1;">Reset your password</a></p>
  <p style="font-size: 0.9em; color: #444;">If the button link does not work, copy and paste:<br/>
  <code style="word-break: break-all;">{reset_url}</code></p>
  <p style="font-size: 0.85em; color: #666;">If you did not request this, you can ignore this email.</p>
</body>
</html>
"""

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
    verify_url: str,
    *,
    app_name: str = "Secundus Dermis",
) -> None:
    """Send signup email verification. Raises on SMTP failure."""
    sender = _gmail_user()
    password = _gmail_password()
    if not sender or not password:
        raise RuntimeError("Gmail SMTP is not configured (missing GMAIL_USER or GMAIL_PASSWORD)")

    subject = f"Verify your email for {app_name}"
    text = (
        f"Thanks for signing up with {app_name}.\n\n"
        f"Confirm your email by opening this link (valid for 48 hours):\n{verify_url}\n\n"
        "If you did not create an account, you can ignore this email."
    )
    html = f"""\
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Thanks for signing up with <strong>{app_name}</strong>.</p>
  <p><a href="{verify_url}" style="color: #0d47a1;">Verify your email</a></p>
  <p style="font-size: 0.9em; color: #444;">If the link does not work, copy and paste:<br/>
  <code style="word-break: break-all;">{verify_url}</code></p>
  <p style="font-size: 0.85em; color: #666;">If you did not create an account, ignore this email.</p>
</body>
</html>
"""

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


def try_send_verification_email(to_addr: str, verify_url: str) -> tuple[bool, Optional[str]]:
    try:
        send_verification_email(to_addr, verify_url)
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


def try_send_password_reset_email(to_addr: str, reset_url: str) -> tuple[bool, Optional[str]]:
    """
    Send reset email. Returns (ok, error_message).
    On failure, error_message is a short description for logs (no secrets).
    """
    try:
        send_password_reset_email(to_addr, reset_url)
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
