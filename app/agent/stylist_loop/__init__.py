"""Stylist ReAct loop package (under ``app/agent``)."""

from .deps import StylistAgentDeps

__all__ = ["StylistAgentDeps", "StylistGeminiRuntime", "gemini_chat_stream"]


def __getattr__(name: str):
    """Lazy-import stream loop so ``from stylist_loop.payloads import …`` works without ``google.genai``."""
    if name == "StylistGeminiRuntime":
        from .stream_loop import StylistGeminiRuntime

        return StylistGeminiRuntime
    if name == "gemini_chat_stream":
        from .stream_loop import gemini_chat_stream

        return gemini_chat_stream
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
