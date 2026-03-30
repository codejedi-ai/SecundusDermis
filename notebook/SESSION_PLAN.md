# Session & Context — Design & Persistence Plan

> **Status:** Current in-memory sessions work within a browser tab. This document covers how to make them durable and user-tied.

---

## How Context Works Today

```
Browser                          FastAPI Backend
  │                                    │
  │  sessionId = crypto.randomUUID()   │
  │  (stored in React useRef)          │
  │                                    │
  │── POST /chat { session_id } ──────▶│
  │                                    │  InMemorySessionService
  │                                    │  - creates session on first message
  │                                    │  - ADK Runner appends each turn
  │                                    │  - full history available to agent
  │◀── { reply, products, filter } ───│
```

**What persists:**
- ✅ Conversation history within a tab (survives page navigation — `useRef` never resets)
- ✅ Sidebar filter state (React Context, survives navigation)
- ❌ Chat history across page refreshes (new UUID on mount)
- ❌ Chat history across server restarts (in-memory ADK sessions wiped)
- ❌ User identity tied to sessions

---

## Planned: Durable Sessions (SQLite)

### Backend

Replace `InMemorySessionService` with a custom implementation backed by SQLite:

```python
# backend/session_store.py

import sqlite3, json
from google.adk.sessions import BaseSessionService

class SQLiteSessionService(BaseSessionService):
    """ADK SessionService backed by SQLite. Sessions survive server restarts."""

    def __init__(self, db_path: str = "./sessions.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._init_schema()

    def _init_schema(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                app_name   TEXT,
                user_id    TEXT,
                history    TEXT,   -- JSON array of {role, content} turns
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # Implement get_session, create_session, update_session per ADK interface
```

**Schema is intentionally minimal:** history is stored as a JSON blob per session. The ADK `Runner` writes to the session after each turn automatically.

### Frontend

Replace `crypto.randomUUID()` in `ChatWidget.tsx` with a stable ID from `localStorage`:

```typescript
// Get or create a stable session ID
const sessionId = useRef<string>(
  localStorage.getItem('sd_session_id') ?? (() => {
    const id = crypto.randomUUID()
    localStorage.setItem('sd_session_id', id)
    return id
  })()
)
```

**With this change:**
- Same session ID across page refreshes
- Chat history reloads from server on next message (agent has full context)
- Session survives server restart (SQLite)

### Reload Previous Messages on Mount

Add `GET /session/{session_id}/history` to return stored turns so the chat UI can repopulate on load:

```typescript
// In ChatWidget useEffect on mount:
const stored = await fashionApi.getSessionHistory(sessionId.current)
if (stored.length > 0) {
  setMessages([INITIAL_MESSAGE, ...stored.map(toMessage)])
}
```

---

## Planned: User Preference Profile

Once sessions persist, extract a preference profile after each conversation:

```python
# After each successful search, update user profile
profile = {
    "preferred_gender": "WOMEN",       # from search history
    "typical_price_max": 65.0,         # from max_price filter patterns
    "favourite_categories": ["Dresses", "Skirts"],
    "colour_palette": ["blue", "floral", "neutral"],
}
```

Store in a `user_profiles` table. Inject into the agent's system prompt prefix:

```
You are helping a customer who typically shops for women's dresses and skirts,
prefers blue and floral patterns, and usually keeps under $65.
```

This makes the agent genuinely personalised without any login requirement — just session history.

---

## Privacy Considerations

- Session IDs are random UUIDs — not tied to any personal identity
- No names, emails, or device fingerprints stored
- Sessions can be cleared: `DELETE /session/{id}` (to be added)
- `SESSION_TTL_DAYS` env var controls auto-expiry (default: 30 days)
- For the public demo: add a clear banner that session IDs are stored locally and anonymously

---

## Migration Path

| Phase | Change | Effort |
|-------|--------|--------|
| 1 | `localStorage` session ID (frontend only) | Tiny |
| 2 | `SQLiteSessionService` replacing in-memory | Small |
| 3 | `GET /session/:id/history` + chat reload on mount | Small |
| 4 | User preference profile extraction | Medium |
| 5 | Preference injection into agent prompt | Small |

Phases 1–3 deliver durable context. Phases 4–5 deliver personalisation.
