"""
In-memory conversation history store, keyed by user email.
Clears on process restart — this is intentional for the demo.

Using email as the key ensures conversations are shared across:
- Local session login
- Auth0 login
- Any other authentication method using the same email
"""

# email → list of {role, content, timestamp}
_store: dict[str, list[dict]] = {}


def get_messages(email: str) -> list[dict]:
    email = email.lower().strip()
    return list(_store.get(email, []))


def append_message(email: str, role: str, content: str, timestamp: float) -> list[dict]:
    email = email.lower().strip()
    if email not in _store:
        _store[email] = []
    _store[email].append({"role": role, "content": content, "timestamp": timestamp})
    return list(_store[email])


def clear_messages(email: str) -> None:
    email = email.lower().strip()
    _store.pop(email, None)
