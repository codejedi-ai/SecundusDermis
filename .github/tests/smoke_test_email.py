"""
Backend-invoking smoke test for email delivery.
Hits ``/api/auth/request-password-reset`` and ``/api/auth/resend-verification``.

Usage:
  uv run python smoke_test_email.py --to you@example.com --url http://localhost:8000
"""

from __future__ import annotations

import argparse
import logging
import requests
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Trigger test emails via backend API.")
    parser.add_argument("--to", required=True, help="Recipient email address.")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend API URL.")
    parser.add_argument(
        "--type",
        choices=("verify", "reset"),
        default="verify",
        help="Type of email to trigger (default: verify).",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    base_url = args.url.rstrip("/")
    
    if args.type == "verify":
        logging.info("Triggering verification email for %s via %s/api/auth/resend-verification", args.to, base_url)
        try:
            res = requests.post(f"{base_url}/api/auth/resend-verification", json={"email": args.to})
            res.raise_for_status()
            logging.info("Backend response: %s", res.json())
        except Exception as e:
            logging.error("Failed to trigger verification email: %s", e)
            return 1
            
    elif args.type == "reset":
        logging.info("Triggering reset email for %s via %s/api/auth/request-password-reset", args.to, base_url)
        try:
            # Note: This will only work if the user exists in the backend.
            res = requests.post(f"{base_url}/api/auth/request-password-reset", json={"email": args.to})
            if res.status_code == 404:
                logging.warning("User %s not found in backend. You might need to sign up first.", args.to)
            res.raise_for_status()
            logging.info("Backend response: %s", res.json())
        except Exception as e:
            logging.error("Failed to trigger reset email: %s", e)
            return 1

    logging.info("Smoke test trigger complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
