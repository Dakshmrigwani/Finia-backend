
"""AI Agents module using PydanticAI.

This module contains agents that handle AI-powered interactions.
Tools are defined in the tools/ subdirectory.
"""

from app.agents.assistant import Deps, financial_agent

__all__ = ["Deps", "financial_agent"]

