"""
Atelier toolkit: catalog / journal tools for ADK or other orchestrators.

``init_tools`` is called from the API lifespan (after catalog load) so in-memory
search helpers share the same state as the FastAPI app. ADK agent factory lives in
``atelier_tools.adk_agent`` (requires ``google-adk``; not imported here so the API
process can load tools without that dependency).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .tools import init_tools, set_patron_context

if TYPE_CHECKING:
    from .adk_agent import INSTRUCTION, create_agent

__all__ = [
    "INSTRUCTION",
    "create_agent",
    "init_tools",
    "set_patron_context",
]


def __getattr__(name: str):
    if name in ("INSTRUCTION", "create_agent"):
        from .adk_agent import INSTRUCTION, create_agent

        return INSTRUCTION if name == "INSTRUCTION" else create_agent
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
