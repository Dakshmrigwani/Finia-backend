"""AI financial coaching agent (PydanticAI + Groq)."""

import os
from dataclasses import dataclass, field
from typing import Any

from pydantic_ai import Agent
from app.agents.prompts import SYSTEM_PROMPT
from app.agents.tools.budget_tool import get_budgets
from app.agents.tools.datetime_tool import get_current_datetime
from app.agents.tools.goal_tool import get_goals
from app.agents.tools.profile_tool import get_user_profile
from app.agents.tools.transaction_tool import (
    get_category_spending,
    get_recent_transactions,
    get_spending_summary,
)
from app.core.config import settings

# Ensure GROQ_API_KEY is available in os.environ for PydanticAI Groq provider
if settings.GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
else:
    os.environ.setdefault("GROQ_API_KEY", "gsk_placeholder_for_agent_init")


def _resolve_agent_model() -> str:
    model_name = settings.AI_MODEL or "groq:qwen/qwen3.8-27b"
    if not any(model_name.startswith(p) for p in ("groq:", "openrouter:", "openai:")):
        return f"groq:{model_name}"
    return model_name


# Finia financial coaching agent with profile, transaction, budget, and goal tools
financial_agent: Agent[dict, str] = Agent(
    model=_resolve_agent_model(),
    system_prompt=SYSTEM_PROMPT,
    tools=[
        get_user_profile,
        get_recent_transactions,
        get_spending_summary,
        get_category_spending,
        get_budgets,
        get_goals,
    ],
    retries=2,
)


@dataclass
class Deps:
    """Dependencies injected into agent tools via RunContext."""

    user_id: str | None = None
    user_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
