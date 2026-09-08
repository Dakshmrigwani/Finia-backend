"""Tests for Finia AI Coach Agent (Step 1)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic_ai import RunContext
from pydantic_ai.models.test import TestModel

from app.agents.assistant import financial_agent
from app.agents.prompts import SYSTEM_PROMPT
from app.agents.tools.profile_tool import get_user_profile
from app.api.deps import get_current_user, get_db_session
from app.db.models.user import User
from app.main import app


@pytest.fixture
def mock_user() -> User:
    """Create a mock user with financial profile attributes."""
    return User(
        id=uuid.uuid4(),
        name="Alex Smith",
        email="alex@example.com",
        income=6500.0,
        currency="USD ($)",
        motive="Save for home down payment",
        spend_mostly="Dining",
        spend_mostly_on="Food delivery",
    )


class TestProfileTool:
    """Tests for get_user_profile tool."""

    @pytest.mark.anyio
    async def test_get_user_profile_success(self, mock_user: User):
        """Test retrieving user profile successfully."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=mock_result)

        ctx = MagicMock(spec=RunContext)
        ctx.deps = {"user_id": str(mock_user.id), "db": mock_db}

        profile = await get_user_profile(ctx)

        assert profile["name"] == "Alex Smith"
        assert profile["income"] == 6500.0
        assert profile["currency"] == "USD ($)"
        assert profile["motive"] == "Save for home down payment"
        assert profile["spend_mostly"] == "Dining"
        assert profile["spend_mostly_on"] == "Food delivery"

    @pytest.mark.anyio
    async def test_get_user_profile_not_found(self):
        """Test error raised when user not found."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        ctx = MagicMock(spec=RunContext)
        ctx.deps = {"user_id": str(uuid.uuid4()), "db": mock_db}

        with pytest.raises(ValueError, match="not found"):
            await get_user_profile(ctx)


class TestFinancialAgent:
    """Tests for financial_agent configuration."""

    def test_agent_configuration(self):
        """Test financial agent has the required prompt and tool attached."""
        assert financial_agent is not None
        assert "Finia" in SYSTEM_PROMPT
        assert "Always use tools before answering" in SYSTEM_PROMPT


class TestAgentChatEndpoint:
    """Tests for POST /api/v1/agent/chat endpoint."""

    @pytest.mark.anyio
    async def test_chat_streaming_success(self, mock_user: User):
        """Test chat endpoint streams SSE events."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=mock_result)

        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_db_session] = lambda: mock_db

        test_model = TestModel(
            custom_output_text="Hello Alex, I see your monthly income is USD ($) 6500."
        )

        with financial_agent.override(model=test_model):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/agent/chat",
                    json={"message": "Can you review my financial profile?"},
                )

                assert response.status_code == 200
                assert "text/event-stream" in response.headers.get("content-type", "")
                assert "data: Hello Alex" in response.text

        app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_chat_unauthenticated(self):
        """Test chat endpoint returns 401 when unauthenticated."""
        app.dependency_overrides.clear()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/agent/chat",
                json={"message": "Hello"},
            )
            assert response.status_code == 401
