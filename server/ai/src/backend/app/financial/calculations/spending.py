"""Deterministic spending calculation functions."""

from typing import Any

from app.financial.snapshot.financial_snapshot_schema import (
    CategorySpend,
    SpendingByType,
    SpendingSnapshot,
    TopCategoryItem,
)


def _get_field(tx: Any, field: str, default: Any = None) -> Any:
    """Helper to get field from either an ORM model or a dict."""
    if isinstance(tx, dict):
        return tx.get(field, default)
    return getattr(tx, field, default)


def calculate_spending(
    transactions: list[Any],
    days_elapsed: int,
    days_in_month: int,
) -> tuple[SpendingSnapshot, list[TopCategoryItem]]:
    """Compute spending aggregations, breakdowns by type, and category rankings.

    Args:
        transactions: List of transaction models or dicts for the period.
        days_elapsed: Days elapsed in current month (min 1).
        days_in_month: Total calendar days in current month.

    Returns:
        Tuple of (SpendingSnapshot, list of TopCategoryItem).
    """
    total_spent = 0.0
    fixed_spent = 0.0
    recurring_spent = 0.0
    variable_spent = 0.0
    wealth_movement_spent = 0.0

    category_counts: dict[str, int] = {}
    category_totals: dict[str, float] = {}

    for tx in transactions:
        direction = str(_get_field(tx, "direction", "")).upper()
        if direction != "EXPENSE":
            continue

        raw_amount = _get_field(tx, "amount", 0.0)
        amount = float(raw_amount or 0.0)
        tx_type = str(_get_field(tx, "type", "VARIABLE")).upper()
        category = str(_get_field(tx, "category", "OTHER")).upper()

        total_spent += amount

        # Breakdown by nature
        if tx_type == "FIXED":
            fixed_spent += amount
        elif tx_type == "RECURRING":
            recurring_spent += amount
        elif tx_type == "WEALTH_MOVEMENT":
            wealth_movement_spent += amount
        else:  # Default to VARIABLE
            variable_spent += amount

        # Category accumulation
        category_totals[category] = category_totals.get(category, 0.0) + amount
        category_counts[category] = category_counts.get(category, 0) + 1

    # Daily run rate and projection
    safe_days_elapsed = max(1, days_elapsed)
    daily_average = round(total_spent / safe_days_elapsed, 2)
    projected_monthly_spend = round((total_spent / safe_days_elapsed) * days_in_month, 2)

    # Category breakdown details
    by_category: dict[str, CategorySpend] = {}
    for cat, cat_amt in category_totals.items():
        pct = round((cat_amt / total_spent * 100), 1) if total_spent > 0 else 0.0
        by_category[cat] = CategorySpend(
            category=cat,
            amount=round(cat_amt, 2),
            transaction_count=category_counts.get(cat, 0),
            percentage_of_total=pct,
        )

    # Top categories sorted by amount descending
    sorted_cats = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    top_categories = [
        TopCategoryItem(
            category=cat,
            amount=round(amt, 2),
            percentage=round((amt / total_spent * 100), 1) if total_spent > 0 else 0.0,
        )
        for cat, amt in sorted_cats
    ]

    spending_snapshot = SpendingSnapshot(
        total_spent=round(total_spent, 2),
        daily_average=daily_average,
        projected_monthly_spend=projected_monthly_spend,
        by_type=SpendingByType(
            fixed=round(fixed_spent, 2),
            recurring=round(recurring_spent, 2),
            variable=round(variable_spent, 2),
            wealth_movement=round(wealth_movement_spent, 2),
        ),
        by_category=by_category,
    )

    return spending_snapshot, top_categories
