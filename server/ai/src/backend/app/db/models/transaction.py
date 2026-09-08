"""Transaction database model matching the Prisma transactions table."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Transaction(Base, TimestampMixin):
    """Transaction model matching Prisma transactions table in PostgreSQL."""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    recurrence: Mapped[str] = mapped_column(String(50), default="NONE", nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    budget_id: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="MANUAL", nullable=False)
    import_fingerprint: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", backref="transactions")

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, title='{self.title}', amount={self.amount})>"
