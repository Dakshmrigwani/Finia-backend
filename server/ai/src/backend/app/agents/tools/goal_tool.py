"""Goal inquiry and savings progress tools for Finia Coach AI Agent."""

from typing import Any

from pydantic_ai import RunContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.goal import Goal


async def get_goals(
    ctx: RunContext[dict], status: str | None = None
) -> list[dict[str, Any]]:
    """Retrieve the user's savings and financial goals with progress.

    Use this tool when the user asks:
    - 'What are my goals?'
    - 'How close am I to my savings goals?'
    - 'Show my progress on buying a car / house / vacation.'
    - 'Can I afford this while still meeting my goal?'

    Args:
        ctx: RunContext containing user_id and db session in ctx.deps.
        status: Optional status filter ('ACTIVE', 'COMPLETED', 'ARCHIVED'). Defaults to all goals if not provided.

    Returns:
        List of goals containing name, type, target_amount, current_saved_amount,
        remaining_amount, progress_percentage, target_date, status, and smart_saver_enabled.
    """
    user_id = str(ctx.deps["user_id"])
    db: AsyncSession = ctx.deps["db"]

    query = select(Goal).where(Goal.user_id == user_id)

    if status:
        query = query.where(Goal.status == status.strip().upper())

    query = query.order_by(Goal.created_at.desc())

    result = await db.execute(query)
    goals = result.scalars().all()

    goal_list = []
    for g in goals:
        target = float(g.target_amount or 0.0)
        saved = float(g.current_saved_amount or 0.0)
        remaining = round(max(0.0, target - saved), 2)
        progress = round((saved / target * 100), 1) if target > 0 else 0.0

        goal_list.append(
            {
                "id": g.id,
                "name": g.goal_name,
                "type": g.goal_type,
                "target_amount": target,
                "current_saved_amount": saved,
                "remaining_amount": remaining,
                "progress_percentage": progress,
                "target_date": g.target_date.strftime("%Y-%m-%d") if g.target_date else None,
                "projected_completion_date": (
                    g.projected_completion_date.strftime("%Y-%m-%d")
                    if g.projected_completion_date
                    else None
                ),
                "status": g.status,
                "smart_saver_enabled": g.smart_saver_enabled,
                "is_completed": saved >= target if target > 0 else False,
            }
        )

    return goal_list
