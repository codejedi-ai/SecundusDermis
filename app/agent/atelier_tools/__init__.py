"""
Atelier toolkit: catalog / journal tools for ADK or other orchestrators, plus ADK agent factory.

``init_tools`` should be called from the API lifespan (after catalog and Gemini client exist)
so ``describe_image`` and in-memory search helpers share the same state as the FastAPI app.
"""

from .adk_agent import INSTRUCTION, create_agent
from .tools import init_tools, set_patron_context

__all__ = [
    "INSTRUCTION",
    "create_agent",
    "init_tools",
    "set_patron_context",
]
