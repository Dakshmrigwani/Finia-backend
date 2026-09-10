"""Unit tests for the deterministic Financial Engine and Snapshot Service."""

from datetime import datetime

from app.financial.snapshot.financial_snapshot_service import (
    FinancialSnapshotService,
)


def test_balanced_financial_scenario():
    """Test a healthy, balanced financial scenario where income exceeds expenses and goals are progressing."""
    as_of = datetime(2026, 9, 15)  # Mid-month
    profile_income = 100000.0

    transactions = [
        # Fixed expenses (Rent, EMI)
        {"amount": 25000.0, "direction": "EXPENSE", "type": "FIXED", "category": "RENT"},
        {"amount": 10000.0, "direction": "EXPENSE", "type": "FIXED", "category": "EMI"},
        # Recurring expenses (Utilities, Internet)
        {"amount": 5000.0, "direction": "EXPENSE", "type": "RECURRING", "category": "UTILITIES"},
        {"amount": 1000.0, "direction": "EXPENSE", "type": "RECURRING", "category": "INTERNET"},
        # Variable expenses (Food, Shopping, Entertainment)
        {"amount": 15000.0, "direction": "EXPENSE", "type": "VARIABLE", "category": "FOOD"},
        {"amount": 8000.0, "direction": "EXPENSE", "type": "VARIABLE", "category": "SHOPPING"},
        {"amount": 4000.0, "direction": "EXPENSE", "type": "VARIABLE", "category": "ENTERTAINMENT"},
    ]

    budgets = [
        {"category": "FOOD", "limit": 18000.0, "amount": 0.0},
        {"category": "SHOPPING", "limit": 10000.0, "amount": 0.0},
    ]

    goals = [
        {
            "id": "goal-1",
            "goal_name": "Emergency Fund",
            "goal_type": "EMERGENCY_FUND",
            "target_amount": 200000.0,
            "current_saved_amount": 100000.0,
            "status": "ACTIVE",
            "smart_saver_enabled": True,
        }
    ]

    snapshot = FinancialSnapshotService.build_snapshot_from_data(
        user_id="user-healthy",
        currency="INR",
        as_of=as_of,
        profile_income=profile_income,
        transactions=transactions,
        budgets=budgets,
        goals=goals,
    )

    # 1. Period verification
    assert snapshot.period.month == 9
    assert snapshot.period.days_elapsed == 15
    assert snapshot.period.days_in_month == 30

    # 2. Spending verification
    assert snapshot.spending.total_spent == 68000.0
    assert snapshot.spending.by_type.fixed == 35000.0
    assert snapshot.spending.by_type.recurring == 6000.0
    assert snapshot.spending.by_type.variable == 27000.0
    assert snapshot.spending.daily_average == round(68000.0 / 15, 2)
    assert snapshot.spending.projected_monthly_spend == round((68000.0 / 15) * 30, 2)

    # 3. Cashflow verification
    assert snapshot.cashflow.inflow == 100000.0
    assert snapshot.cashflow.outflow == 68000.0
    assert snapshot.cashflow.net_cashflow == 32000.0
    assert snapshot.cashflow.savings_capacity == 100000.0 - 41000.0  # Inflow - Fixed/Recurring

    # 4. Savings verification
    assert snapshot.savings.monthly_savings_rate == 32.0  # 32,000 / 100,000 * 100
    assert snapshot.savings.total_goals_target == 200000.0
    assert snapshot.savings.total_saved == 100000.0
    assert snapshot.savings.overall_progress_percentage == 50.0

    # 5. Budgets verification
    assert snapshot.budgets.total_budget_limit == 28000.0
    assert snapshot.budgets.total_budget_spent == 23000.0  # 15,000 (Food) + 8,000 (Shopping)
    assert snapshot.budgets.over_budget_count == 0

    food_budget = next(b for b in snapshot.budgets.categories if b.category == "FOOD")
    assert food_budget.spent == 15000.0
    assert food_budget.remaining == 3000.0
    assert food_budget.percentage_used == round(15000.0 / 18000.0 * 100, 1)  # 83.3%
    assert food_budget.status == "WARNING"  # >= 80%

    # 6. Health & warnings
    assert snapshot.financial_health.health_score >= 80
    assert snapshot.financial_health.health_status in ["EXCELLENT", "GOOD"]
    # Should not have CRITICAL warnings
    assert not any(w.severity == "CRITICAL" for w in snapshot.warnings)


def test_over_budget_and_deficit_scenario():
    """Test a stressed financial scenario with over-budget categories, negative cashflow, and high burn rate."""
    as_of = datetime(2026, 9, 10)
    profile_income = 40000.0

    transactions = [
        {"amount": 20000.0, "direction": "EXPENSE", "type": "VARIABLE", "category": "FOOD"},
        {"amount": 15000.0, "direction": "EXPENSE", "type": "VARIABLE", "category": "SHOPPING"},
        {"amount": 15000.0, "direction": "EXPENSE", "type": "FIXED", "category": "RENT"},
    ]

    budgets = [
        {"category": "FOOD", "limit": 10000.0, "amount": 0.0},
        {"category": "SHOPPING", "limit": 20000.0, "amount": 0.0},
    ]

    goals = [
        {
            "id": "goal-2",
            "goal_name": "Vacation",
            "goal_type": "VACATION",
            "target_amount": 50000.0,
            "current_saved_amount": 5000.0,
            "status": "ACTIVE",
        }
    ]

    snapshot = FinancialSnapshotService.build_snapshot_from_data(
        user_id="user-stressed",
        currency="INR",
        as_of=as_of,
        profile_income=profile_income,
        transactions=transactions,
        budgets=budgets,
        goals=goals,
    )

    # 1. Total spent and cashflow deficit
    assert snapshot.spending.total_spent == 50000.0
    assert snapshot.cashflow.net_cashflow == -10000.0  # 40k income - 50k spent

    # 2. Budget overage detection
    assert snapshot.budgets.over_budget_count == 1
    food_b = next(b for b in snapshot.budgets.categories if b.category == "FOOD")
    assert food_b.is_over_budget is True
    assert food_b.status == "OVER_BUDGET"
    assert food_b.remaining == -10000.0
    assert food_b.percentage_used == 200.0

    # 3. Deterministic warning checks
    warning_types = [w.type for w in snapshot.warnings]
    assert "NEGATIVE_CASHFLOW" in warning_types
    assert "BUDGET_EXCEEDED" in warning_types
    assert "HIGH_BURN_RATE" in warning_types

    # 4. Health score penalty
    assert snapshot.financial_health.health_score < 65
    assert snapshot.financial_health.health_status in ["NEEDS_ATTENTION", "FAIR"]


def test_empty_financial_state_zero_division():
    """Test new user state with zero transactions to ensure no ZeroDivisionError occurs."""
    as_of = datetime(2026, 9, 1)

    snapshot = FinancialSnapshotService.build_snapshot_from_data(
        user_id="user-new",
        currency="INR",
        as_of=as_of,
        profile_income=50000.0,
        transactions=[],
        budgets=[],
        goals=[],
    )

    assert snapshot.spending.total_spent == 0.0
    assert snapshot.spending.daily_average == 0.0
    assert snapshot.spending.projected_monthly_spend == 0.0
    assert snapshot.cashflow.net_cashflow == 50000.0
    assert snapshot.budgets.over_budget_count == 0
    assert snapshot.savings.overall_progress_percentage == 0.0
    assert len(snapshot.warnings) == 0


def test_compact_summary_generation():
    """Verify that to_compact_summary generates formatted text suitable for LLM context."""
    snapshot = FinancialSnapshotService.build_snapshot_from_data(
        user_id="user-test",
        currency="INR",
        as_of=datetime(2026, 9, 10),
        profile_income=80000.0,
        transactions=[
            {"amount": 12000.0, "direction": "EXPENSE", "type": "VARIABLE", "category": "FOOD"},
        ],
        budgets=[{"category": "FOOD", "limit": 10000.0, "amount": 0.0}],
        goals=[],
    )

    summary = snapshot.to_compact_summary()
    assert "=== FINANCIAL SNAPSHOT" in summary
    assert "Income: INR 80,000.00" in summary
    assert "Spent: INR 12,000.00" in summary
    assert "FOOD: INR 12,000.00 / INR 10,000.00 (120.0%) [OVER_BUDGET]" in summary
    assert "! [WARNING] FOOD budget exceeded" in summary
