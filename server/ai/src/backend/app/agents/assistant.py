"""AI financial coaching agent (LangChain + LangGraph + LangSmith)."""

import os

from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from app.agents.prompts import SYSTEM_PROMPT
from app.agents.tools.budget_tool import get_budgets
from app.agents.tools.datetime_tool import get_current_datetime
from app.agents.tools.goal_tool import get_goals
from app.agents.tools.memory_tool import recall_memory
from app.agents.tools.profile_tool import get_user_profile
from app.agents.tools.transaction_tool import (
    get_category_spending,
    get_recent_transactions,
    get_spending_summary,
)
from app.core.config import settings

# ── LangSmith tracing (opt-in via LANGCHAIN_TRACING_V2=true in .env) ─────────
if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
    os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
else:
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")

# ── Groq LLM ─────────────────────────────────────────────────────────────────
if settings.GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
else:
    os.environ.setdefault("GROQ_API_KEY", "gsk_placeholder_for_agent_init")


def _resolve_model_name() -> str:
    """Strip legacy PydanticAI provider prefixes (groq:, openrouter:, openai:) from AI_MODEL."""
    model = settings.AI_MODEL or "llama-3.3-70b-versatile"
    for prefix in ("groq:", "openrouter:", "openai:"):
        if model.startswith(prefix):
            return model[len(prefix):]
    return model


_llm = ChatGroq(
    model=_resolve_model_name(),
    temperature=settings.AI_TEMPERATURE,
    streaming=True,
    max_tokens=900,  # stay under Groq free-tier 1000 OTPM limit
)

# ── Module-level ReAct agent (shared across all requests) ─────────────────────
# Tools read user_id and db from ContextVar (set per-request in the route handler).
# No per-request agent creation needed — ContextVar ensures request isolation.
financial_agent = create_react_agent(
    model=_llm,
    tools=[
        get_user_profile,
        get_recent_transactions,
        get_spending_summary,
        get_category_spending,
        get_budgets,
        get_goals,
        get_current_datetime,
        recall_memory,
    ],
    prompt=SYSTEM_PROMPT,
)
