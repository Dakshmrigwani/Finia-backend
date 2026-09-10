"""Budget database model matching the Prisma budgets table."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Budget(Base, TimestampMixin):
    """Budget model matching Prisma budgets table in PostgreSQL."""

    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    limit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", backref="budgets")

    def __repr__(self) -> str:
        return f"<Budget(id={self.id}, category='{self.category}', limit={self.limit}, amount={self.amount})>"
