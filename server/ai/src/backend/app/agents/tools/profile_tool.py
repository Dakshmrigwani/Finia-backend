"""User profile tool for financial coaching agent."""

from typing import Annotated

from langchain_core.tools import InjectedToolArg, tool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


@tool
async def get_user_profile(
    user_id: Annotated[str, InjectedToolArg],
    db: Annotated[AsyncSession, InjectedToolArg],
) -> dict:
    """Get user financial profile including income, currency, motive, and spending habits.

    Reads the user profile from the database using the provided user_id and db session.
    """
    user_id_str = str(user_id)

    result = await db.execute(select(User).where(User.id == user_id_str))
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
