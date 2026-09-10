"""Deterministic cashflow and liquidity calculation functions."""

from app.financial.snapshot.financial_snapshot_schema import CashflowSnapshot


def calculate_cashflow(
    effective_income: float,
    total_expenses: float,
    fixed_spent: float,
    recurring_spent: float,
    days_elapsed: int,
) -> CashflowSnapshot:
    """Compute inflow, outflow, net cashflow, daily burn rate, and discretionary savings capacity.

    Args:
        effective_income: Total effective monthly inflow.
        total_expenses: Total outflow (expenses) in period.
        fixed_spent: Fixed essential obligations (Rent, EMI).
        recurring_spent: Recurring obligations (Utilities, Subscriptions).
        days_elapsed: Number of days elapsed in period.

    Returns:
        CashflowSnapshot model.
    """
    safe_days = max(1, days_elapsed)
    net_cashflow = round(effective_income - total_expenses, 2)
    daily_burn_rate = round(total_expenses / safe_days, 2)

    # Discretionary savings capacity: money left over after essential baseline commitments
    committed_expenses = fixed_spent + recurring_spent
    savings_capacity = round(max(0.0, effective_income - committed_expenses), 2)

    return CashflowSnapshot(
        inflow=round(effective_income, 2),
        outflow=round(total_expenses, 2),
        net_cashflow=net_cashflow,
        daily_burn_rate=daily_burn_rate,
        savings_capacity=savings_capacity,
    )
