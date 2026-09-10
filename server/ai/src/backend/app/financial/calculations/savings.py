"""Deterministic savings and goal progress calculation functions."""

from typing import Any

from app.financial.snapshot.financial_snapshot_schema import (
    GoalDetail,
    GoalsSnapshot,
    SavingsSnapshot,
)


def _get_field(obj: Any, field: str, default: Any = None) -> Any:
    """Helper to get field from either an ORM model or a dict."""
    if isinstance(obj, dict):
        return obj.get(field, default)
    return getattr(obj, field, default)


def calculate_savings(
    goals: list[Any],
    net_cashflow: float,
    effective_income: float,
) -> tuple[SavingsSnapshot, GoalsSnapshot]:
    """Calculate savings progress across active and completed goals and monthly savings rate.

    Args:
        goals: List of goal ORM models or dictionaries.
        net_cashflow: Net cashflow for the period (Income - Expenses).
        effective_income: Effective monthly income.

    Returns:
        Tuple of (SavingsSnapshot, GoalsSnapshot).
    """
    total_goals_target = 0.0
    total_saved = 0.0
    active_count = 0
    completed_count = 0
    goal_details: list[GoalDetail] = []

    for g in goals:
        status = str(_get_field(g, "status", "ACTIVE")).upper()
        target = float(_get_field(g, "target_amount", 0.0) or 0.0)
        saved = float(_get_field(g, "current_saved_amount", 0.0) or 0.0)
        name = str(_get_field(g, "goal_name", "Goal"))
        g_type = str(_get_field(g, "goal_type", "CUSTOM"))
        g_id = str(_get_field(g, "id", ""))
        smart_saver = bool(_get_field(g, "smart_saver_enabled", False))


        target_date_raw = _get_field(g, "target_date", _get_field(g, "targetDate", None))
        target_date_str = None
        if target_date_raw:
            target_date_str = (
                target_date_raw.strftime("%Y-%m-%d")
                if hasattr(target_date_raw, "strftime")
                else str(target_date_raw)
            )

        rem = round(max(0.0, target - saved), 2)
        prog = round((saved / target * 100), 1) if target > 0 else 0.0

        if status == "COMPLETED" or (target > 0 and saved >= target):
            completed_count += 1
        elif status == "ACTIVE":
            active_count += 1
            total_goals_target += target
            total_saved += saved

        goal_details.append(
            GoalDetail(
                id=g_id,
                name=name,
                type=g_type,
                target_amount=round(target, 2),
                current_saved_amount=round(saved, 2),
                remaining_amount=rem,
                progress_percentage=prog,
                target_date=target_date_str,
                status=status,
                smart_saver_enabled=smart_saver,
            )
        )

    overall_progress = (
        round((total_saved / total_goals_target * 100), 1) if total_goals_target > 0 else 0.0
    )

    # Monthly savings rate from cashflow
    savings_rate = 0.0
    if effective_income > 0 and net_cashflow > 0:
        savings_rate = round((net_cashflow / effective_income * 100), 1)

    savings_snapshot = SavingsSnapshot(
        total_goals_target=round(total_goals_target, 2),
        total_saved=round(total_saved, 2),
        overall_progress_percentage=overall_progress,
        monthly_savings_rate=savings_rate,
        active_goals_count=active_count,
    )

    goals_snapshot = GoalsSnapshot(
        active_count=active_count,
        completed_count=completed_count,
        goals=goal_details,
    )

    return savings_snapshot, goals_snapshot
