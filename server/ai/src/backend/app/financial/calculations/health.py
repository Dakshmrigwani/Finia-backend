"""Deterministic financial health score, 50/30/20 ratios, and rule-based warnings."""

from app.financial.snapshot.financial_snapshot_schema import (
    BudgetsSnapshot,
    CashflowSnapshot,
    FinancialHealthRatio,
    FinancialHealthSnapshot,
    FinancialWarning,
    GoalsSnapshot,
    IncomeSnapshot,
    SavingsSnapshot,
    SpendingSnapshot,
)


def calculate_financial_health_and_warnings(
    income: IncomeSnapshot,
    spending: SpendingSnapshot,
    savings: SavingsSnapshot,
    cashflow: CashflowSnapshot,
    budgets: BudgetsSnapshot,
    goals: GoalsSnapshot,
    currency: str = "INR",
) -> tuple[FinancialHealthSnapshot, list[FinancialWarning]]:
    """Compute 50/30/20 adherence, composite health score, and deterministic alert warnings.

    Args:
        income: Income snapshot.
        spending: Spending snapshot.
        savings: Savings snapshot.
        cashflow: Cashflow snapshot.
        budgets: Budgets snapshot.
        goals: Goals snapshot.
        currency: Currency symbol/code for warnings formatting.

    Returns:
        Tuple of (FinancialHealthSnapshot, list of FinancialWarning).
    """
    effective_inc = income.effective_income
    warnings: list[FinancialWarning] = []

    # 1. 50/30/20 Framework Calculations
    needs_spend = spending.by_type.fixed + spending.by_type.recurring
    wants_spend = spending.by_type.variable
    net_savings = max(0.0, cashflow.net_cashflow)

    if effective_inc > 0:
        needs_pct = round((needs_spend / effective_inc * 100), 1)
        wants_pct = round((wants_spend / effective_inc * 100), 1)
        savings_pct = round((net_savings / effective_inc * 100), 1)
    else:
        needs_pct = 0.0
        wants_pct = 0.0
        savings_pct = 0.0

    ratios_50_30_20 = FinancialHealthRatio(
        needs_percentage=needs_pct,
        wants_percentage=wants_pct,
        savings_percentage=savings_pct,
    )

    # 2. Deterministic Scoring Model (Total 100 points)
    # Factor A: Cashflow health (Max 30 pts)
    cashflow_pts = 0
    if effective_inc > 0:
        if cashflow.net_cashflow >= (0.20 * effective_inc):
            cashflow_pts = 30
        elif cashflow.net_cashflow >= 0:
            cashflow_pts = 20
        elif cashflow.net_cashflow >= -(0.10 * effective_inc):
            cashflow_pts = 10
        else:
            cashflow_pts = 0
    else:
        cashflow_pts = 15

    # Factor B: Budget compliance (Max 30 pts)
    budget_pts = 0
    if not budgets.categories:
        budget_pts = 25  # No budgets set yet, default neutral
        budget_adherence_score = 100.0
    else:
        if budgets.over_budget_count == 0:
            budget_pts = 30
            budget_adherence_score = 100.0
        elif budgets.over_budget_count == 1:
            budget_pts = 18
            budget_adherence_score = 70.0
        elif budgets.over_budget_count == 2:
            budget_pts = 10
            budget_adherence_score = 50.0
        else:
            budget_pts = 5
            budget_adherence_score = 30.0

    # Factor C: Savings rate (Max 20 pts)
    savings_pts = 0
    if savings.monthly_savings_rate >= 20.0:
        savings_pts = 20
    elif savings.monthly_savings_rate >= 10.0:
        savings_pts = 15
    elif savings.monthly_savings_rate > 0.0:
        savings_pts = 10
    else:
        savings_pts = 0

    # Factor D: Goals engagement & progress (Max 20 pts)
    goals_pts = 0
    if goals.active_count > 0:
        if savings.overall_progress_percentage >= 50.0:
            goals_pts = 20
        elif savings.overall_progress_percentage > 0.0:
            goals_pts = 15
        else:
            goals_pts = 10
    else:
        goals_pts = 10  # Neutral if no goals created

    total_score = min(100, max(0, cashflow_pts + budget_pts + savings_pts + goals_pts))

    if total_score >= 80:
        health_status = "EXCELLENT"
    elif total_score >= 65:
        health_status = "GOOD"
    elif total_score >= 50:
        health_status = "FAIR"
    else:
        health_status = "NEEDS_ATTENTION"

    # 3. Deterministic Warning Rules
    # Rule 1: Negative cashflow (Deficit)
    if cashflow.net_cashflow < 0:
        deficit = abs(cashflow.net_cashflow)
        warnings.append(
            FinancialWarning(
                type="NEGATIVE_CASHFLOW",
                severity="CRITICAL",
                message=f"Current expenses exceed income by {currency} {deficit:,.2f}.",
                details={"deficit": deficit, "inflow": cashflow.inflow, "outflow": cashflow.outflow},
            )
        )

    # Rule 2: Over-budget categories
    for cat in budgets.categories:
        if cat.is_over_budget:
            overage = abs(cat.remaining)
            warnings.append(
                FinancialWarning(
                    type="BUDGET_EXCEEDED",
                    severity="WARNING",
                    message=f"{cat.category} budget exceeded by {currency} {overage:,.2f} ({cat.percentage_used:.1f}% used).",
                    details={"category": cat.category, "limit": cat.limit, "spent": cat.spent, "overage": overage},
                )
            )

    # Rule 3: High burn rate projection
    if effective_inc > 0 and spending.projected_monthly_spend > effective_inc:
        proj_deficit = spending.projected_monthly_spend - effective_inc
        warnings.append(
            FinancialWarning(
                type="HIGH_BURN_RATE",
                severity="WARNING",
                message=f"At the current pace, projected monthly spend ({currency} {spending.projected_monthly_spend:,.2f}) will exceed income by {currency} {proj_deficit:,.2f}.",
                details={"projected_monthly_spend": spending.projected_monthly_spend, "income": effective_inc},
            )
        )

    # Rule 4: High fixed cost burden (> 65% of income)
    if effective_inc > 0 and needs_pct > 65.0:
        warnings.append(
            FinancialWarning(
                type="HIGH_FIXED_COSTS",
                severity="INFO",
                message=f"Fixed and recurring obligations consume {needs_pct:.1f}% of your monthly income (recommended standard is <= 50%).",
                details={"needs_percentage": needs_pct, "recommended_max": 50.0},
            )
        )

    health_snapshot = FinancialHealthSnapshot(
        ratios_50_30_20=ratios_50_30_20,
        savings_rate=savings.monthly_savings_rate,
        budget_adherence_score=budget_adherence_score,
        health_score=total_score,
        health_status=health_status,
    )

    return health_snapshot, warnings
