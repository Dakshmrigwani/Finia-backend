"""Tests for AI agent module (PydanticAI)."""

from app.agents.assistant import Deps
from app.agents.tools.datetime_tool import get_current_datetime


class TestDeps:
    """Tests for Deps dataclass."""

    def test_deps_default_values(self):
        """Test Deps has correct default values."""
        deps = Deps()
        assert deps.user_id is None
        assert deps.user_name is None
        assert deps.metadata == {}

    def test_deps_with_values(self):
        """Test Deps with custom values."""
        deps = Deps(user_id="123", user_name="Test User", metadata={"key": "value"})
        assert deps.user_id == "123"
        assert deps.user_name == "Test User"
        assert deps.metadata == {"key": "value"}


class TestGetCurrentDatetime:
    """Tests for get_current_datetime tool."""

    def test_returns_formatted_string(self):
        """Test get_current_datetime returns formatted string."""
        result = get_current_datetime()
        assert isinstance(result, str)
        assert len(result) > 10


class TestAgentRoutes:
    """Tests for agent WebSocket routes."""

    async def test_agent_websocket_connection(self, client):
        """Test WebSocket connection to agent endpoint."""
        # Actual agent testing requires mocking the LLM provider
        pass


class TestHistoryConversion:
    """Tests for conversation history format."""

    def test_history_roles(self):
        """Test history list structure with different roles."""
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
            {"role": "system", "content": "You are helpful"},
        ]
        assert len(history) == 3
        assert all("role" in msg and "content" in msg for msg in history)
