"""Memory recall tool — lets the agent proactively search its own long-term memory.

The agent can call recall_memory("what does this user spend on food?") and get
semantically matched past conversation snippets injected back as context.
"""

import logging

from langchain_core.tools import tool

from app.agents.context import get_db, get_user_id

logger = logging.getLogger(__name__)


@tool
async def recall_memory(query: str) -> str:
    """Search long-term memory for past conversations relevant to a query.

    Use this tool when you need to remember something about the user that
    might have been discussed in previous sessions. For example:
    - recall_memory("what does the user prefer to be called?")
    - recall_memory("has the user mentioned their salary before?")
    - recall_memory("what financial goals has the user talked about?")

    Args:
        query: Natural language question about what you want to recall.

    Returns:
        Relevant past conversation snippets, or a message that nothing was found.
    """
    user_id = get_user_id()
    try:
        db = get_db()
    except RuntimeError:
        return "Memory not available (no user context)."

    if not user_id:
        return "Memory not available (no user context)."

    try:
        from app.services.memory import MemoryService
        memory_service = MemoryService(db)
        memories = await memory_service.recall_relevant(user_id, query, top_k=5)
        if not memories:
            return "No relevant past conversations found."
        result = "\n".join(f"- {m}" for m in memories)
        return f"Relevant past conversations:\n{result}"
    except Exception as e:
        logger.warning(f"recall_memory tool failed: {e}")
        return "Memory recall temporarily unavailable."
