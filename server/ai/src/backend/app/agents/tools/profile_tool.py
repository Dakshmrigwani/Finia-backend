"""User profile tool for financial coaching agent."""

from pydantic_ai import RunContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


async def get_user_profile(ctx: RunContext[dict]) -> dict:
    """Get user financial profile including income, currency, motive, and spending habits.

    Reads the user profile from the database using the provided user_id and db session.
    """
    user_id = ctx.deps["user_id"]
    db: AsyncSession = ctx.deps["db"]

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
