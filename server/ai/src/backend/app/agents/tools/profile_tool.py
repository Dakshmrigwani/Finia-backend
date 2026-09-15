"""User profile tool for financial coaching agent."""

from langchain_core.tools import tool

from app.agents.context import get_db, get_user_id
from app.db.models.user import User
from sqlalchemy import select


@tool
async def get_user_profile() -> dict:
    """Get user financial profile including income, currency, motive, and spending habits.

    Reads the user profile from the database for the current user.
    """
    user_id = get_user_id()
    db = get_db()

    result = await db.execute(select(User).where(User.id == str(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise ValueError(f"User with ID '{user_id}' not found.")

    return {
        "name": user.name or user.full_name or "User",
        "income": user.income,
        "currency": user.currency or "USD ($)",
        "motive": user.motive or "financial wellness",
        "spend_mostly": user.spend_mostly or "unknown",
        "spend_mostly_on": user.spend_mostly_on or "unknown",
    }
