# Integration tests (planned)

This directory is reserved for **pytest** tests that need one or more of:

- A running **ASGI** stack (`socket_app` / FastAPI lifespan),
- **Socket.IO** client connections (patron + agent),
- **HTTP** calls to internal routes with `AGENT_INTERNAL_SECRET`,
- A **real or cached** catalog on disk.

**Do not** run these in the same invocation as ultra-fast unit tests until fixtures are stable; use markers (see `.github/tests/SCOPE.md` §7).

Suggested first file: `test_socket_join_and_emit.py` or `test_health_and_catalog_stats_http.py`.

Setup from repo root (example — exact command TBD with fixtures):

```bash
cd app/backend && uv run pytest ../../.github/tests/integration -v
```
