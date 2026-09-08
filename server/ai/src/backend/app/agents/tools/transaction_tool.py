"""Transaction inquiry and spending aggregation tools for Finia Coach AI Agent."""

from datetime import datetime, timedelta
from typing import Any

from pydantic_ai import RunContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import Transaction


async def get_recent_transactions(
    ctx: RunContext[dict], limit: int = 10
) -> list[dict[str, Any]]:
    """Retrieve the user's most recent transactions.

    Use this tool when the user asks about recent purchases, recent expenses,
    or recent activity in their account.

    Args:
        ctx: RunContext containing user_id and db session in ctx.deps.
        limit: Maximum number of transactions to return (default 10, max 50).

    Returns:
        List of transactions with date, title, amount, category, direction, and type.
    """
    user_id = str(ctx.deps["user_id"])
    db: AsyncSession = ctx.deps["db"]
    safe_limit = min(max(1, limit), 50)

    query = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc())
        .limit(safe_limit)
    )
    result = await db.execute(query)
    transactions = result.scalars().all()

    return [
        {
            "id": tx.id,
            "date": tx.date.strftime("%Y-%m-%d"),
            "title": tx.title,
            "amount": float(tx.amount),
            "category": tx.category,
            "direction": tx.direction,
            "type": tx.type,
            "source": tx.source,
        }
        for tx in transactions
    ]


async def get_spending_summary(
    ctx: RunContext[dict], days: int = 30
) -> dict[str, Any]:
    """Get aggregated spending summary for the user over the last N days.

    Calculates total expenses, total income, net savings/deficit, and transaction counts.

    Args:
        ctx: RunContext containing user_id and db session in ctx.deps.
        days: Lookback period in days (default 30 days).

    Returns:
        Dictionary containing total_expense, total_income, net_flow, and transaction_count.
    """
    user_id = str(ctx.deps["user_id"])
    db: AsyncSession = ctx.deps["db"]

    start_date = datetime.utcnow() - timedelta(days=days)

    query = select(
        Transaction.direction,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).where(
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
    ).group_by(Transaction.direction)

    result = await db.execute(query)
    rows = result.all()

    total_expense = 0.0
    total_income = 0.0
    total_count = 0

    for direction, total, count in rows:
        amount_val = float(total or 0.0)
        total_count += count
        if direction == "EXPENSE":
            total_expense += amount_val
        elif direction == "INCOME":
            total_income += amount_val

    return {
        "period_days": days,
        "from_date": start_date.strftime("%Y-%m-%d"),
        "total_expense": round(total_expense, 2),
        "total_income": round(total_income, 2),
        "net_flow": round(total_income - total_expense, 2),
        "total_transactions": total_count,
    }


async def get_category_spending(
    ctx: RunContext[dict], category: str, days: int = 30
) -> dict[str, Any]:
    """Get total amount spent on a specific category over a time period.

    Use this tool when the user asks questions like:
    - 'How much did I spend on food this month?'
    - 'What were my shopping expenses over the last 30 days?'

    Args:
        ctx: RunContext containing user_id and db session in ctx.deps.
        category: Category name e.g. 'FOOD', 'SHOPPING', 'ENTERTAINMENT', 'TRAVEL'.
        days: Lookback period in days (default 30 days).

    Returns:
        Dictionary with category name, total_spent, and list of matching transactions.
    """
    user_id = str(ctx.deps["user_id"])
    db: AsyncSession = ctx.deps["db"]

    cat_upper = category.strip().upper()
    start_date = datetime.utcnow() - timedelta(days=days)

    query = (
        select(Transaction)
        .where(
            Transaction.user_id == user_id,
            func.upper(Transaction.category) == cat_upper,
            Transaction.date >= start_date,
        )
        .order_by(Transaction.date.desc())
    )

    result = await db.execute(query)
    transactions = result.scalars().all()

    total_spent = sum(float(tx.amount) for tx in transactions if tx.direction == "EXPENSE")

    return {
        "category": cat_upper,
        "period_days": days,
        "from_date": start_date.strftime("%Y-%m-%d"),
        "total_spent": round(total_spent, 2),
        "transaction_count": len(transactions),
        "sample_transactions": [
            {
                "date": tx.date.strftime("%Y-%m-%d"),
                "title": tx.title,
                "amount": float(tx.amount),
            }
            for tx in transactions[:5]
        ],
    }
