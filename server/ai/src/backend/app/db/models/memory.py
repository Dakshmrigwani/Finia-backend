"""Memory models for AI long-term recall and adaptive learning.

Two tables:
- message_embeddings: stores vector embeddings of every message for semantic recall
- user_memory: stores facts the AI has learned about each user (adaptive learning)
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

# Embedding dimension for sentence-transformers all-MiniLM-L6-v2
EMBEDDING_DIM = 384


class MessageEmbedding(Base, TimestampMixin):
    """Stores vector embeddings of conversation messages for semantic long-term memory.

    Every user/assistant message is embedded and stored here so the agent can
    recall semantically relevant past interactions using pgvector cosine similarity.

    Attributes:
        id: Unique identifier
        user_id: Owner of this memory
        conversation_id: Source conversation
        message_id: Source message (nullable for inline-created embeddings)
        role: 'user' or 'assistant'
        content: Original text content
        embedding: 384-dimensional vector (all-MiniLM-L6-v2)
    """

    __tablename__ = "message_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(JSONB, nullable=False)

    def __repr__(self) -> str:
        return f"<MessageEmbedding(id={self.id}, role={self.role}, user_id={self.user_id})>"


class UserMemory(Base):
    """Stores facts the AI has learned about a user for adaptive behavior.

    Each row is a single key-value fact (e.g. preferred_name=Daksh).
    Facts are upserted so the AI can correct itself when the user provides
    new information.

    Attributes:
        id: Unique identifier
        user_id: Owner of this fact
        fact_type: Category ('preference', 'correction', 'personal', 'financial')
        fact_key: Fact identifier (e.g. 'preferred_name', 'currency_preference')
        fact_value: The learned value (e.g. 'Daksh', 'INR')
        confidence: 0.0–1.0 confidence score
        source_content: Snippet of the message that led to this fact
        updated_at: When this fact was last learned/updated
    """

    __tablename__ = "user_memory"

    __table_args__ = (
        UniqueConstraint("user_id", "fact_key", name="uq_user_memory_user_fact_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fact_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # personal | preference | correction | financial
    fact_key: Mapped[str] = mapped_column(String(100), nullable=False)
    fact_value: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    source_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<UserMemory(user_id={self.user_id}, key={self.fact_key}, value={self.fact_value})>"
