"""Budget inquiry tools for Finia Coach AI Agent."""

from typing import Any

from pydantic_ai import RunContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.budget import Budget


async def get_budgets(
    ctx: RunContext[dict], category: str | None = None
) -> list[dict[str, Any]]:
    """Retrieve the user's category budgets, limits, and current spend.

    Use this tool when the user asks:
    - 'What are my budgets?'
    - 'Am I exceeding my budget for food/groceries/shopping?'
    - 'How much budget do I have left for this month?'
    - 'Show my category spending limits.'

    Args:
        ctx: RunContext containing user_id and db session in ctx.deps.
        category: Optional category name to filter (e.g. 'FOOD', 'SHOPPING', 'UTILITIES').

    Returns:
        List of budgets containing category, limit, current_spend, remaining,
        percentage_used, and budget status ('ON_TRACK', 'WARNING', 'OVER_BUDGET').
    """
    user_id = str(ctx.deps["user_id"])
    db: AsyncSession = ctx.deps["db"]

    query = select(Budget).where(Budget.user_id == user_id)

    if category:
        cat_clean = category.strip().upper()
        query = query.where(func.upper(Budget.category) == cat_clean)

    query = query.order_by(Budget.category.asc())

    result = await db.execute(query)
    budgets = result.scalars().all()

    budget_list = []
    for b in budgets:
        limit_val = float(b.limit or 0.0)
        amount_val = float(b.amount or 0.0)
        remaining = round(limit_val - amount_val, 2)
        percentage_used = round((amount_val / limit_val * 100), 1) if limit_val > 0 else 0.0

        if limit_val > 0 and amount_val > limit_val:
            status = "OVER_BUDGET"
        elif limit_val > 0 and percentage_used >= 80:
            status = "WARNING"
        else:
            status = "ON_TRACK"

        budget_list.append(
            {
                "id": b.id,
                "category": b.category,
                "limit": limit_val,
                "current_spend": amount_val,
                "remaining": remaining,
                "percentage_used": percentage_used,
                "is_over_budget": amount_val > limit_val if limit_val > 0 else False,
                "status": status,
            }
        )

    return budget_list
