"""Goal database model matching the Prisma Goal table."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User

goal_status_enum = ENUM("ACTIVE", "COMPLETED", "ARCHIVED", name="GoalStatus", create_type=False)
goal_type_enum = ENUM(
    "EMERGENCY_FUND",
    "VACATION",
    "CAR",
    "HOME",
    "GADGET",
    "EDUCATION",
    "INVESTMENT",
    "CUSTOM",
    name="GoalType",
    create_type=False,
)


class Goal(Base):
    """Goal model matching Prisma Goal table in PostgreSQL."""

    __tablename__ = "Goal"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    goal_name: Mapped[str] = mapped_column("goalName", String(255), nullable=False)
    goal_type: Mapped[str] = mapped_column("goalType", goal_type_enum, default="CUSTOM", nullable=False)
    cover_image: Mapped[str | None] = mapped_column("coverImage", String, nullable=True)
    target_amount: Mapped[Decimal] = mapped_column("targetAmount", Numeric(12, 2), nullable=False)
    current_saved_amount: Mapped[Decimal] = mapped_column(
        "currentSavedAmount", Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    target_date: Mapped[datetime | None] = mapped_column("targetDate", DateTime(timezone=False), nullable=True)
    projected_completion_date: Mapped[datetime | None] = mapped_column(
        "projectedCompletionDate", DateTime(timezone=False), nullable=True
    )
    status: Mapped[str] = mapped_column("status", goal_status_enum, default="ACTIVE", nullable=False, index=True)
    smart_saver_enabled: Mapped[bool] = mapped_column("smartSaverEnabled", Boolean, default=False, nullable=False)
    automation_min_balance: Mapped[Decimal | None] = mapped_column(
        "automationMinBalance", Numeric(12, 2), nullable=True
    )
    automation_frequency: Mapped[str | None] = mapped_column("automationFrequency", String(50), nullable=True)
    created_via: Mapped[str] = mapped_column("createdVia", String(50), default="MANUAL", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=False), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="goals")

    def __repr__(self) -> str:
        return f"<Goal(id={self.id}, name='{self.goal_name}', target={self.target_amount}, saved={self.current_saved_amount})>"
