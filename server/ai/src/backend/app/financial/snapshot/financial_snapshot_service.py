"""Financial Snapshot Service.

Orchestrates database retrieval and deterministic financial calculations
to generate a unified FinancialSnapshot for the AI Coach.
"""

import calendar
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.budget import Budget
from app.db.models.goal import Goal
from app.db.models.transaction import Transaction
from app.db.models.user import User
from app.financial.calculations.budget import calculate_budgets
from app.financial.calculations.cashflow import calculate_cashflow
from app.financial.calculations.health import calculate_financial_health_and_warnings
from app.financial.calculations.savings import calculate_savings
from app.financial.calculations.spending import calculate_spending
from app.financial.snapshot.financial_snapshot_schema import (
    FinancialSnapshot,
    IncomeSnapshot,
    PeriodMetadata,
)

logger = logging.getLogger(__name__)


class FinancialSnapshotService:
    """Service to generate deterministic financial snapshots for users."""

    @staticmethod
    def build_snapshot_from_data(
        user_id: str,
        currency: str,
        as_of: datetime,
        profile_income: float,
        transactions: list[Any],
        budgets: list[Any],
        goals: list[Any],
    ) -> FinancialSnapshot:
        """Pure deterministic builder that constructs a FinancialSnapshot from in-memory data.

        Usable both by the database orchestrator and by isolated unit tests.
        """
        year = as_of.year
        month = as_of.month
        _, total_days_in_month = calendar.monthrange(year, month)
        days_elapsed = max(1, min(as_of.day, total_days_in_month))

        period = PeriodMetadata(
            month=month,
            year=year,
            days_elapsed=days_elapsed,
            days_in_month=total_days_in_month,
        )

        # 1. Income detection from transactions vs user profile
        detected_income = 0.0
        for tx in transactions:
            direction = str(
                tx.get("direction") if isinstance(tx, dict) else getattr(tx, "direction", "")
            ).upper()
            if direction == "INCOME":
                raw_amt = tx.get("amount") if isinstance(tx, dict) else getattr(tx, "amount", 0.0)
                detected_income += float(raw_amt or 0.0)

        effective_income = detected_income if detected_income > 0 else profile_income

        income = IncomeSnapshot(
            monthly_profile_income=round(profile_income, 2),
            detected_tx_income=round(detected_income, 2),
            effective_income=round(effective_income, 2),
        )

        # 2. Spending calculations
        spending, top_categories = calculate_spending(
            transactions=transactions,
            days_elapsed=days_elapsed,
            days_in_month=total_days_in_month,
        )

        # 3. Cashflow calculations
        cashflow = calculate_cashflow(
            effective_income=effective_income,
            total_expenses=spending.total_spent,
            fixed_spent=spending.by_type.fixed,
            recurring_spent=spending.by_type.recurring,
            days_elapsed=days_elapsed,
        )

        # 4. Savings and goals calculations
        savings, goals_snapshot = calculate_savings(
            goals=goals,
            net_cashflow=cashflow.net_cashflow,
            effective_income=effective_income,
        )

        # 5. Budgets calculations
        budgets_snapshot = calculate_budgets(
            budgets=budgets,
            by_category=spending.by_category,
            total_spent=spending.total_spent,
        )

        # 6. Health score and warnings
        health_snapshot, warnings = calculate_financial_health_and_warnings(
            income=income,
            spending=spending,
            savings=savings,
            cashflow=cashflow,
            budgets=budgets_snapshot,
            goals=goals_snapshot,
            currency=currency,
        )

        return FinancialSnapshot(
            user_id=user_id,
            currency=currency,
            as_of=as_of,
            period=period,
            income=income,
            spending=spending,
            savings=savings,
            cashflow=cashflow,
            budgets=budgets_snapshot,
            goals=goals_snapshot,
            top_categories=top_categories,
            financial_health=health_snapshot,
            warnings=warnings,
        )

    async def get_snapshot(
        self,
        user_id: str,
        db: AsyncSession,
        as_of: datetime | None = None,
    ) -> FinancialSnapshot:
        """Fetch real data from the database and build a deterministic FinancialSnapshot.

        Args:
            user_id: User identifier.
            db: Async database session.
            as_of: Snapshot timestamp (defaults to datetime.now()).

        Returns:
            Validated FinancialSnapshot instance.
        """
        now = as_of or datetime.now()
        start_of_month = datetime(now.year, now.month, 1)

        # 1. Fetch user for profile income and currency
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        profile_income = float(user.income or 0.0) if user else 0.0
        CURRENCY_MARKERS = {"USD": ["USD", "$"], "EUR": ["EUR", "€"], "GBP": ["GBP", "£"]}
        user_currency = (user.currency or "") if user else ""
        currency = next(
            (code for code, markers in CURRENCY_MARKERS.items() if any(m in user_currency for m in markers)),
            "INR",
        )


        # 2. Fetch current month's transactions
        tx_query = (
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.date >= start_of_month,
                Transaction.date <= now,
            )
            .order_by(Transaction.date.asc())
        )
        tx_res = await db.execute(tx_query)
        transactions = tx_res.scalars().all()

        # If current month has very few transactions, also fetch past 30 days as fallback context
        if len(transactions) == 0:
            logger.info(f"User {user_id} has 0 transactions for current month {now.month}/{now.year}")

        # 3. Fetch budgets
        b_query = select(Budget).where(Budget.user_id == user_id)
        b_res = await db.execute(b_query)
        budgets = b_res.scalars().all()

        # 4. Fetch goals
        g_query = select(Goal).where(Goal.user_id == user_id, Goal.status != "ARCHIVED")
        g_res = await db.execute(g_query)
        goals = g_res.scalars().all()

        return self.build_snapshot_from_data(
            user_id=user_id,
            currency=currency,
            as_of=now,
            profile_income=profile_income,
            transactions=transactions,
            budgets=budgets,
            goals=goals,
        )


financial_snapshot_service = FinancialSnapshotService()
