
"""add_pgvector_memory_tables

Adds:
- pgvector extension (CREATE EXTENSION IF NOT EXISTS vector)
- message_embeddings table: stores vector embeddings of chat messages for semantic recall
- user_memory table: stores facts the AI learns about each user (adaptive learning)

Revision ID: bbe198e14784
Revises:
Create Date: 2026-09-16 02:10:13.920461

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = 'bbe198e14784'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2


def upgrade() -> None:
    # 1. Enable pgvector extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. message_embeddings — stores vector embeddings of every message
    op.create_table(
        'message_embeddings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=True),
        sa.Column('message_id', sa.UUID(), nullable=True),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(EMBEDDING_DIM), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('message_embeddings_user_id_fkey'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['conversation_id'], ['conversations.id'],
            name=op.f('message_embeddings_conversation_id_fkey'),
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['message_id'], ['messages.id'],
            name=op.f('message_embeddings_message_id_fkey'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('message_embeddings_pkey')),
    )
    op.create_index('message_embeddings_user_id_idx', 'message_embeddings', ['user_id'], unique=False)
    op.create_index('message_embeddings_conversation_id_idx', 'message_embeddings', ['conversation_id'], unique=False)
    op.create_index('message_embeddings_message_id_idx', 'message_embeddings', ['message_id'], unique=False)

    # IVFFlat index for fast approximate nearest-neighbour search (cosine distance)
    # lists=100 is a good default for up to ~1M vectors
    op.execute(
        "CREATE INDEX IF NOT EXISTS message_embeddings_ivfflat_idx "
        "ON message_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # 3. user_memory — stores facts the AI has learned about each user
    op.create_table(
        'user_memory',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('fact_type', sa.String(length=50), nullable=False),
        sa.Column('fact_key', sa.String(length=100), nullable=False),
        sa.Column('fact_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0.9'),
        sa.Column('source_content', sa.Text(), nullable=True),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('user_memory_user_id_fkey'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('user_memory_pkey')),
        sa.UniqueConstraint('user_id', 'fact_key', name='uq_user_memory_user_fact_key'),
    )
    op.create_index('user_memory_user_id_idx', 'user_memory', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('user_memory')
    op.drop_index('message_embeddings_ivfflat_idx', table_name='message_embeddings')
    op.drop_index('message_embeddings_message_id_idx', table_name='message_embeddings')
    op.drop_index('message_embeddings_conversation_id_idx', table_name='message_embeddings')
    op.drop_index('message_embeddings_user_id_idx', table_name='message_embeddings')
    op.drop_table('message_embeddings')
    # Note: we do NOT drop the vector extension as other things may depend on it
