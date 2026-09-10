"""Deterministic budget adherence and category limit calculation functions."""

from typing import Any

from app.financial.snapshot.financial_snapshot_schema import (
    BudgetCategoryStatus,
    BudgetsSnapshot,
    CategorySpend,
)


def _get_field(obj: Any, field: str, default: Any = None) -> Any:
    """Helper to get field from either an ORM model or a dict."""
    if isinstance(obj, dict):
        return obj.get(field, default)
    return getattr(obj, field, default)


def calculate_budgets(
    budgets: list[Any],
    by_category: dict[str, CategorySpend],
    total_spent: float,
) -> BudgetsSnapshot:
    """Evaluate spending against defined category budgets.

    Args:
        budgets: List of user budget ORM models or dictionaries.
        by_category: Category spend mappings derived from actual transactions.
        total_spent: Total overall expenses in current period.

    Returns:
        BudgetsSnapshot model.
    """
    total_budget_limit = 0.0
    total_budget_spent = 0.0
    over_budget_count = 0
    budget_categories: list[BudgetCategoryStatus] = []
    budgeted_cat_names: set[str] = set()

    for b in budgets:
        raw_cat = str(_get_field(b, "category", "OTHER"))
        cat_clean = raw_cat.strip().upper()
        budgeted_cat_names.add(cat_clean)

        limit = float(_get_field(b, "limit", 0.0) or 0.0)
        # Prefer actual transaction spending for this category; fallback to stored budget.amount
        if cat_clean in by_category:
            spent = by_category[cat_clean].amount
        else:
            spent = float(_get_field(b, "amount", 0.0) or 0.0)

        total_budget_limit += limit
        total_budget_spent += spent

        remaining = round(limit - spent, 2)
        percentage_used = round((spent / limit * 100), 1) if limit > 0 else 0.0
        is_over = spent > limit if limit > 0 else False

        if is_over:
            over_budget_count += 1
            status = "OVER_BUDGET"
        elif limit > 0 and percentage_used >= 80:
            status = "WARNING"
        else:
            status = "ON_TRACK"

        budget_categories.append(
            BudgetCategoryStatus(
                category=cat_clean,
                limit=round(limit, 2),
                spent=round(spent, 2),
                remaining=remaining,
                percentage_used=percentage_used,
                is_over_budget=is_over,
                status=status,
            )
        )

    overall_adherence = (
        round((total_budget_spent / total_budget_limit * 100), 1) if total_budget_limit > 0 else 0.0
    )

    # Compute unbudgeted spend (transactions that don't belong to any budgeted category)
    unbudgeted_spend = sum(
        c.amount for cat_name, c in by_category.items() if cat_name not in budgeted_cat_names
    )

    return BudgetsSnapshot(
        total_budget_limit=round(total_budget_limit, 2),
        total_budget_spent=round(total_budget_spent, 2),
        overall_adherence_percentage=overall_adherence,
        categories=budget_categories,
        over_budget_count=over_budget_count,
        unbudgeted_spend=round(unbudgeted_spend, 2),
    )
