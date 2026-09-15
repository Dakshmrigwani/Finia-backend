"""AI Agents module using LangChain + LangGraph.

This module contains agents that handle AI-powered interactions.
Tools are defined in the tools/ subdirectory.
Context (user_id, db) is injected per-request via app.agents.context.
"""

from app.agents.assistant import financial_agent
from app.agents.context import set_agent_context

__all__ = ["financial_agent", "set_agent_context"]
