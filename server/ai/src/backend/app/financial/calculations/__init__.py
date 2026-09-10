"""Calculations package for deterministic financial computations."""

from app.financial.calculations.budget import calculate_budgets
from app.financial.calculations.cashflow import calculate_cashflow
from app.financial.calculations.health import calculate_financial_health_and_warnings
from app.financial.calculations.savings import calculate_savings
from app.financial.calculations.spending import calculate_spending

__all__ = [
    "calculate_budgets",
    "calculate_cashflow",
    "calculate_financial_health_and_warnings",
    "calculate_savings",
    "calculate_spending",
]
