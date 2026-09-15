"""Per-request async context for agent tool dependencies.

Uses Python ContextVar (asyncio-safe) so each request has its own
user_id and db session without any parameter threading through the tools.
"""

from contextvars import ContextVar
from typing import Any

_user_id_ctx: ContextVar[str] = ContextVar("finia_user_id", default="")
_db_ctx: ContextVar[Any] = ContextVar("finia_db", default=None)


def set_agent_context(user_id: str, db: Any) -> None:
    """Set the agent context for the current async task (call once per request)."""
    _user_id_ctx.set(user_id)
    _db_ctx.set(db)


def get_user_id() -> str:
    """Return the user_id bound to the current async context."""
    return _user_id_ctx.get()


def get_db() -> Any:
    """Return the AsyncSession bound to the current async context."""
    db = _db_ctx.get()
    if db is None:
        raise RuntimeError(
            "DB session not set in agent context. Call set_agent_context(user_id, db) first."
        )
    return db
