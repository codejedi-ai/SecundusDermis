"""
In-memory conversation history store, keyed by auth session_id.
Clears on process restart — this is intentional for the demo.
"""

# auth_session_id → list of {role, content, timestamp}
_store: dict[str, list[dict]] = {}


def get_messages(session_id: str) -> list[dict]:
    return list(_store.get(session_id, []))


def append_message(session_id: str, role: str, content: str, timestamp: float) -> list[dict]:
    if session_id not in _store:
        _store[session_id] = []
    _store[session_id].append({"role": role, "content": content, "timestamp": timestamp})
    return list(_store[session_id])


def clear_messages(session_id: str) -> None:
    _store.pop(session_id, None)
