
"""User database model."""

import uuid
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.session import Session


class UserRole(StrEnum):
    """User role enumeration.

    Roles hierarchy (higher includes lower permissions):
    - ADMIN: Full system access, can manage users and settings
    - USER: Standard user access
    """

    ADMIN = "admin"
    USER = "user"


class User(Base, TimestampMixin):
    """User model matching Prisma users table."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default=UserRole.USER.value, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column("isEmailVerified", Boolean, default=False, nullable=False)

    # Financial and profile fields
    income: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(50), default="USD ($)", nullable=False)
    motive: Mapped[str | None] = mapped_column(String(255), nullable=True)
    spend_mostly: Mapped[str | None] = mapped_column("spendMostly", String(255), nullable=True)
    spend_mostly_on: Mapped[str | None] = mapped_column("spendMostlyOn", String(255), nullable=True)
    theme: Mapped[str | None] = mapped_column(String(50), default="dark", nullable=True)
    notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ai_nudges: Mapped[bool] = mapped_column("aiNudges", Boolean, default=True, nullable=False)
    biometric: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    two_factor: Mapped[bool] = mapped_column("twoFactor", Boolean, default=False, nullable=False)

    # Backward compatibility properties
    @property
    def full_name(self) -> str:
        return self.name

    @full_name.setter
    def full_name(self, value: str) -> None:
        self.name = value

    @property
    def hashed_password(self) -> str | None:
        return self.password

    @hashed_password.setter
    def hashed_password(self, value: str | None) -> None:
        self.password = value

    @property
    def is_active(self) -> bool:
        return True

    @property
    def is_superuser(self) -> bool:
        return self.role == UserRole.ADMIN.value

    def __init__(self, **kw):
        if "full_name" in kw and "name" not in kw:
            kw["name"] = kw.pop("full_name")
        if "hashed_password" in kw and "password" not in kw:
            kw["password"] = kw.pop("hashed_password")
        kw.pop("is_active", None)
        kw.pop("is_superuser", None)
        super().__init__(**kw)

    # Relationship to sessions
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def user_role(self) -> UserRole:
        """Get role as enum."""
        return UserRole(self.role)

    def has_role(self, required_role: UserRole) -> bool:
        """Check if user has the required role or higher.

        Admin role has access to everything.
        """
        if self.role == UserRole.ADMIN.value:
            return True
        return self.role == required_role.value

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
