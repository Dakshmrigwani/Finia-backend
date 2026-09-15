"""Memory service for AI long-term recall and adaptive learning.

This service provides three capabilities:
1. embed_and_store()   - Embed a message and store in pgvector for future recall
2. recall_relevant()   - Semantically search past messages relevant to a query
3. update_user_facts() - Extract and persist facts the AI learns about the user
4. get_user_facts()    - Load all known facts about a user for context injection
"""

import logging
from uuid import UUID

from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.memory import EMBEDDING_DIM, MessageEmbedding, UserMemory

logger = logging.getLogger(__name__)

# ── Lazy-loaded embedding model (loaded once, cached in memory) ────────────────
_embedding_model = None


def _get_embedding_model():
    """Lazy-load the sentence-transformers model (avoids slow import at startup)."""
    global _embedding_model  # noqa: PLW0603
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Loaded sentence-transformers model: all-MiniLM-L6-v2")
        except Exception as e:
            logger.warning(f"Could not load sentence-transformers: {e}. Memory recall disabled.")
            return None
    return _embedding_model


import asyncio

def _embed(text_content: str) -> list[float] | None:
    """Generate a vector embedding for the given text. Returns None on failure."""
    model = _get_embedding_model()
    if model is None:
        return None
    try:
        vector = model.encode(text_content, normalize_embeddings=True)
        return vector.tolist()
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return None


async def _embed_async(text_content: str) -> list[float] | None:
    """Generate a vector embedding off-thread so the asyncio event loop isn't blocked."""
    return await asyncio.to_thread(_embed, text_content)


def prewarm_embedding_model() -> None:
    """Pre-warm the embedding model so subsequent calls don't experience cold-start delay."""
    _get_embedding_model()


class MemoryService:
    """Manages long-term memory and adaptive user learning for the Finia AI agent."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Layer 2: Long-term semantic memory (embeddings) ───────────────────────

    async def embed_and_store(
        self,
        user_id: str,
        role: str,
        content: str,
        conversation_id: UUID | None = None,
        message_id: UUID | None = None,
    ) -> bool:
        """Embed a message and store it for future semantic recall.

        Args:
            user_id: Owner of this memory
            role: 'user' or 'assistant'
            content: Message text to embed
            conversation_id: Optional source conversation UUID
            message_id: Optional source message UUID

        Returns:
            True if stored successfully, False if embedding failed.
        """
        embedding = await _embed_async(content)
        if embedding is None:
            return False

        try:
            entry = MessageEmbedding(
                user_id=user_id,
                conversation_id=conversation_id,
                message_id=message_id,
                role=role,
                content=content,
                embedding=embedding,
            )
            self.db.add(entry)
            await self.db.flush()
            logger.debug(f"Stored embedding for user={user_id} role={role}")
            return True
        except Exception as e:
            logger.warning(f"Failed to store embedding: {e}")
            return False

    async def recall_relevant(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        min_similarity: float = 0.35,
    ) -> list[str]:
        """Recall semantically relevant past messages using cosine similarity.

        Args:
            user_id: Whose memories to search
            query: Current user message to find similar past context for
            top_k: Maximum number of memories to return
            min_similarity: Minimum cosine similarity threshold (0.0–1.0)

        Returns:
            List of relevant past message strings formatted as "role: content"
        """
        query_embedding = await _embed_async(query)
        if query_embedding is None:
            return []

        try:
            result = await self.db.execute(
                select(MessageEmbedding.role, MessageEmbedding.content, MessageEmbedding.embedding)
                .where(MessageEmbedding.user_id == user_id)
                .order_by(MessageEmbedding.created_at.desc())
                .limit(100)
            )
            rows = result.fetchall()
            if not rows:
                return []

            import numpy as np

            q_vec = np.array(query_embedding, dtype=np.float32)
            norm_q = float(np.linalg.norm(q_vec))
            if norm_q == 0:
                return []

            scored: list[tuple[float, str]] = []
            for role, content, emb in rows:
                if not emb:
                    continue
                c_vec = np.array(emb, dtype=np.float32)
                norm_c = float(np.linalg.norm(c_vec))
                if norm_c > 0:
                    sim = float(np.dot(q_vec, c_vec) / (norm_q * norm_c))
                    if sim >= min_similarity:
                        scored.append((sim, f"{role}: {content}"))

            scored.sort(key=lambda x: x[0], reverse=True)
            memories = [item[1] for item in scored[:top_k]]
            logger.debug(f"Recalled {len(memories)} memories for user={user_id}")
            return memories
        except Exception as e:
            logger.warning(f"Memory recall failed: {e}")
            return []

    # ── Layer 3: User fact memory (adaptive learning) ─────────────────────────

    async def get_user_facts(self, user_id: str) -> dict[str, str]:
        """Load all known facts about a user.

        Returns:
            Dict mapping fact_key → fact_value, e.g. {"preferred_name": "Daksh"}
        """
        try:
            result = await self.db.execute(
                select(UserMemory.fact_key, UserMemory.fact_value)
                .where(UserMemory.user_id == user_id)
                .order_by(UserMemory.updated_at.desc())
            )
            return {row.fact_key: row.fact_value for row in result.fetchall()}
        except Exception as e:
            logger.warning(f"Failed to load user facts: {e}")
            return {}

    async def upsert_user_fact(
        self,
        user_id: str,
        fact_type: str,
        fact_key: str,
        fact_value: str,
        confidence: float = 0.9,
        source_content: str | None = None,
    ) -> None:
        """Insert or update a single user fact.

        Uses PostgreSQL ON CONFLICT DO UPDATE so corrections overwrite stale facts.
        """
        try:
            stmt = pg_insert(UserMemory).values(
                id=__import__("uuid").uuid4(),
                user_id=user_id,
                fact_type=fact_type,
                fact_key=fact_key,
                fact_value=fact_value,
                confidence=confidence,
                source_content=source_content,
                updated_at=__import__("datetime").datetime.utcnow(),
            ).on_conflict_do_update(
                constraint="uq_user_memory_user_fact_key",
                set_={
                    "fact_value": fact_value,
                    "fact_type": fact_type,
                    "confidence": confidence,
                    "source_content": source_content,
                    "updated_at": __import__("datetime").datetime.utcnow(),
                },
            )
            await self.db.execute(stmt)
            await self.db.flush()
            logger.info(f"Upserted user fact: user={user_id} key={fact_key} value={fact_value}")
        except Exception as e:
            logger.warning(f"Failed to upsert user fact: {e}")

    async def extract_and_store_facts(
        self,
        user_id: str,
        user_message: str,
        assistant_response: str,
    ) -> None:
        """Extract learnable facts from a conversation turn and persist them.

        Uses rule-based extraction (fast, no extra LLM call) to detect:
        - Name corrections ("call me X", "my name is X")
        - Currency preferences
        - Language preferences
        - Explicit corrections ("that was wrong", "actually X")
        """
        combined = f"User: {user_message}\nAssistant: {assistant_response}"

        # ── Name extraction ────────────────────────────────────────────────────
        import re

        name_patterns = [
            r"(?:call me|my name is|i(?:'m| am)|name['s]* is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            r"(?:don't call me\s+\w+,?\s+(?:call me|i(?:'m| am)))\s+([A-Z][a-z]+)",
        ]
        for pattern in name_patterns:
            match = re.search(pattern, user_message, re.IGNORECASE)
            if match:
                name = match.group(1).strip().title()
                await self.upsert_user_fact(
                    user_id=user_id,
                    fact_type="personal",
                    fact_key="preferred_name",
                    fact_value=name,
                    confidence=0.95,
                    source_content=user_message[:200],
                )
                break

        # ── Currency preference ────────────────────────────────────────────────
        currency_patterns = [
            r"\b(INR|USD|EUR|GBP|JPY|AUD|CAD|rupees?|dollars?|euros?|pounds?)\b",
        ]
        for pattern in currency_patterns:
            match = re.search(pattern, user_message, re.IGNORECASE)
            if match:
                currency = match.group(1).strip().upper()
                # Normalise common words
                currency_map = {"RUPEE": "INR", "RUPEES": "INR", "DOLLAR": "USD",
                                "DOLLARS": "USD", "EURO": "EUR", "EUROS": "EUR",
                                "POUND": "GBP", "POUNDS": "GBP"}
                currency = currency_map.get(currency, currency)
                if len(currency) == 3:  # only store ISO codes
                    await self.upsert_user_fact(
                        user_id=user_id,
                        fact_type="preference",
                        fact_key="currency_preference",
                        fact_value=currency,
                        confidence=0.8,
                        source_content=user_message[:200],
                    )
                break

        # ── Correction detection ───────────────────────────────────────────────
        correction_signals = [
            "that's wrong", "that is wrong", "you're wrong", "you are wrong",
            "incorrect", "actually", "no, i", "not that", "stop saying",
            "i told you", "i already said",
        ]
        lowered = user_message.lower()
        for signal in correction_signals:
            if signal in lowered:
                await self.upsert_user_fact(
                    user_id=user_id,
                    fact_type="correction",
                    fact_key=f"correction_{__import__('uuid').uuid4().hex[:8]}",
                    fact_value=user_message[:300],
                    confidence=0.7,
                    source_content=combined[:500],
                )
                break

    async def delete_user_memories(self, user_id: str) -> int:
        """Delete all memories for a user (GDPR / reset). Returns number of rows deleted."""
        result = await self.db.execute(
            delete(MessageEmbedding).where(MessageEmbedding.user_id == user_id)
        )
        deleted_embeddings = result.rowcount
        result2 = await self.db.execute(
            delete(UserMemory).where(UserMemory.user_id == user_id)
        )
        deleted_facts = result2.rowcount
        await self.db.flush()
        return deleted_embeddings + deleted_facts
