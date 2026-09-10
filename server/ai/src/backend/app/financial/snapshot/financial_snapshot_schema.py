"""Pydantic schemas for the deterministic Financial Snapshot.

Defines the contract for the unified financial state computed by the Financial Engine.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PeriodMetadata(BaseModel):
    """Metadata about the time period covered by the snapshot."""

    month: int = Field(..., description="Month number (1-12)")
    year: int = Field(..., description="Year (e.g. 2026)")
    days_elapsed: int = Field(..., description="Days passed in current month")
    days_in_month: int = Field(..., description="Total days in current month")


class IncomeSnapshot(BaseModel):
    """Calculated user income state."""

    monthly_profile_income: float = Field(default=0.0, description="Income from user profile settings")
    detected_tx_income: float = Field(default=0.0, description="Income detected from transactions this period")
    effective_income: float = Field(
        default=0.0, description="Effective income used for analysis (detected tx income if > 0 else profile income)"
    )


class SpendingByType(BaseModel):
    """Spending grouped by transaction nature."""

    fixed: float = Field(default=0.0, description="Fixed essential expenses (Rent, EMI, Insurance)")
    recurring: float = Field(default=0.0, description="Recurring periodic expenses (Utilities, Subscriptions)")
    variable: float = Field(default=0.0, description="Discretionary variable expenses (Food, Shopping, Entertainment)")
    wealth_movement: float = Field(default=0.0, description="Transfers, investments, deposits")


class CategorySpend(BaseModel):
    """Spending breakdown for a single category."""

    category: str
    amount: float
    transaction_count: int
    percentage_of_total: float


class SpendingSnapshot(BaseModel):
    """Detailed spending aggregation for the period."""

    total_spent: float = Field(default=0.0, description="Total expenses in current period")
    daily_average: float = Field(default=0.0, description="Average spend per day elapsed")
    projected_monthly_spend: float = Field(default=0.0, description="Projected spend by end of month")
    by_type: SpendingByType = Field(default_factory=SpendingByType)
    by_category: dict[str, CategorySpend] = Field(default_factory=dict)


class SavingsSnapshot(BaseModel):
    """Savings progress and rate metrics."""

    total_goals_target: float = Field(default=0.0, description="Total target amount across active goals")
    total_saved: float = Field(default=0.0, description="Total saved amount across active goals")
    overall_progress_percentage: float = Field(default=0.0, description="Progress towards all active goals (0-100%)")
    monthly_savings_rate: float = Field(default=0.0, description="Percentage of income saved this month")
    active_goals_count: int = Field(default=0, description="Number of currently active goals")


class CashflowSnapshot(BaseModel):
    """Cashflow and burn rate analysis."""

    inflow: float = Field(default=0.0, description="Total cash inflow (income)")
    outflow: float = Field(default=0.0, description="Total cash outflow (expenses)")
    net_cashflow: float = Field(default=0.0, description="Inflow minus outflow")
    daily_burn_rate: float = Field(default=0.0, description="Outflow per day elapsed")
    savings_capacity: float = Field(
        default=0.0, description="Discretionary cash remaining after fixed and recurring obligations"
    )


class BudgetCategoryStatus(BaseModel):
    """Budget compliance for a specific category."""

    category: str
    limit: float
    spent: float
    remaining: float
    percentage_used: float
    is_over_budget: bool
    status: str = Field(..., description="ON_TRACK, WARNING, or OVER_BUDGET")


class BudgetsSnapshot(BaseModel):
    """User budget performance overview."""

    total_budget_limit: float = Field(default=0.0, description="Sum of all category budget limits")
    total_budget_spent: float = Field(default=0.0, description="Total spent in budgeted categories")
    overall_adherence_percentage: float = Field(default=0.0, description="Overall budget utilized (0-100%)")
    categories: list[BudgetCategoryStatus] = Field(default_factory=list)
    over_budget_count: int = Field(default=0, description="Number of categories exceeding budget")
    unbudgeted_spend: float = Field(default=0.0, description="Spending in categories without a budget limit")


class GoalDetail(BaseModel):
    """Individual goal progress."""

    id: str
    name: str
    type: str
    target_amount: float
    current_saved_amount: float
    remaining_amount: float
    progress_percentage: float
    target_date: str | None = None
    status: str
    smart_saver_enabled: bool = False


class GoalsSnapshot(BaseModel):
    """Summary of financial goals."""

    active_count: int = 0
    completed_count: int = 0
    goals: list[GoalDetail] = Field(default_factory=list)


class TopCategoryItem(BaseModel):
    """Top spending category item."""

    category: str
    amount: float
    percentage: float


class FinancialHealthRatio(BaseModel):
    """50/30/20 budget framework analysis."""

    needs_percentage: float = Field(default=0.0, description="Needs spending (Fixed + Recurring) vs income (target <= 50%)")
    wants_percentage: float = Field(default=0.0, description="Wants spending (Variable) vs income (target <= 30%)")
    savings_percentage: float = Field(default=0.0, description="Savings vs income (target >= 20%)")


class FinancialHealthSnapshot(BaseModel):
    """Composite health indicators and adherence scoring."""

    ratios_50_30_20: FinancialHealthRatio = Field(default_factory=FinancialHealthRatio)
    savings_rate: float = Field(default=0.0, description="Percentage of income retained")
    budget_adherence_score: float = Field(default=100.0, description="Score based on budget compliance (0-100)")
    health_score: int = Field(default=100, description="Overall financial wellness score (0-100)")
    health_status: str = Field(default="EXCELLENT", description="EXCELLENT, GOOD, FAIR, NEEDS_ATTENTION")


class FinancialWarning(BaseModel):
    """Deterministic alert generated by rule-based evaluation."""

    type: str = Field(..., description="e.g. BUDGET_EXCEEDED, NEGATIVE_CASHFLOW, HIGH_BURN_RATE")
    severity: str = Field(..., description="INFO, WARNING, CRITICAL")
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class FinancialSnapshot(BaseModel):
    """Master deterministic financial state of the user.

    The AI Coach consumes this object directly instead of running multiple tools.
    """

    user_id: str
    currency: str = "INR"
    as_of: datetime
    period: PeriodMetadata
    income: IncomeSnapshot
    spending: SpendingSnapshot
    savings: SavingsSnapshot
    cashflow: CashflowSnapshot
    budgets: BudgetsSnapshot
    goals: GoalsSnapshot
    top_categories: list[TopCategoryItem] = Field(default_factory=list)
    financial_health: FinancialHealthSnapshot
    warnings: list[FinancialWarning] = Field(default_factory=list)

    def to_compact_summary(self) -> str:
        """Render a concise, high-signal text summary for the AI Coach prompt."""
        curr = self.currency
        inc = self.income.effective_income
        spent = self.spending.total_spent
        net = self.cashflow.net_cashflow
        burn = self.cashflow.daily_burn_rate
        proj = self.spending.projected_monthly_spend

        lines = [
            f"=== FINANCIAL SNAPSHOT ({self.period.month}/{self.period.year}, Day {self.period.days_elapsed}/{self.period.days_in_month}) ===",
            f"Currency: {curr}",
            f"Income: {curr} {inc:,.2f} | Spent: {curr} {spent:,.2f} | Net Cashflow: {curr} {net:,.2f}",
            f"Daily Burn Rate: {curr} {burn:,.2f}/day | Projected Month Spend: {curr} {proj:,.2f}",
            f"Spending by Nature: Fixed: {curr} {self.spending.by_type.fixed:,.2f}, Recurring: {curr} {self.spending.by_type.recurring:,.2f}, Variable: {curr} {self.spending.by_type.variable:,.2f}",
            f"50/30/20 Health: Needs {self.financial_health.ratios_50_30_20.needs_percentage:.1f}% (target <=50%), Wants {self.financial_health.ratios_50_30_20.wants_percentage:.1f}% (target <=30%), Savings {self.financial_health.ratios_50_30_20.savings_percentage:.1f}% (target >=20%)",
            f"Health Score: {self.financial_health.health_score}/100 ({self.financial_health.health_status})",
        ]

        if self.budgets.categories:
            lines.append(f"Budgets: {len(self.budgets.categories)} total, {self.budgets.over_budget_count} over budget. Limit: {curr} {self.budgets.total_budget_limit:,.2f}, Spent: {curr} {self.budgets.total_budget_spent:,.2f} ({self.budgets.overall_adherence_percentage:.1f}%)")
            for b in self.budgets.categories:
                lines.append(f"  - {b.category}: {curr} {b.spent:,.2f} / {curr} {b.limit:,.2f} ({b.percentage_used:.1f}%) [{b.status}]")

        if self.goals.goals:
            lines.append(f"Goals: {self.goals.active_count} active. Total Saved: {curr} {self.savings.total_saved:,.2f} / {curr} {self.savings.total_goals_target:,.2f} ({self.savings.overall_progress_percentage:.1f}%)")
            for g in self.goals.goals:
                lines.append(f"  - {g.name}: {curr} {g.current_saved_amount:,.2f} / {curr} {g.target_amount:,.2f} ({g.progress_percentage:.1f}%)")

        if self.top_categories:
            top_str = ", ".join([f"{tc.category}: {curr} {tc.amount:,.2f} ({tc.percentage:.1f}%)" for tc in self.top_categories[:3]])
            lines.append(f"Top Spending Areas: {top_str}")

        if self.warnings:
            lines.append("Warnings:")
            for w in self.warnings:
                lines.append(f"  ! [{w.severity}] {w.message}")

        return "\n".join(lines)
