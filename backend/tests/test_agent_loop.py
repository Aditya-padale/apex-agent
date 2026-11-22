import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agent.core import ApexAgentEngine


class MockFunction:
    def __init__(self, name: str, arguments: dict):
        self.name = name
        self.arguments = json.dumps(arguments) if isinstance(arguments, dict) else arguments


class MockToolCall:
    def __init__(self, name: str, arguments: dict, call_id: str = "call_1"):
        self.id = call_id
        self.type = "function"
        self.function = MockFunction(name, arguments)


class MockMessage:
    def __init__(self, text: str = None, fn_name: str = None, fn_args: dict = None, reasoning: str = None):
        self.role = "assistant"
        self.content = text
        self.reasoning = reasoning or text
        self.tool_calls = [MockToolCall(fn_name, fn_args or {})] if fn_name else None
        self.model_extra = {}


class MockChoice:
    def __init__(self, message: MockMessage):
        self.message = message


class MockResponse:
    def __init__(self, text: str = None, fn_name: str = None, fn_args: dict = None, reasoning: str = None):
        self.choices = [MockChoice(MockMessage(text=text, fn_name=fn_name, fn_args=fn_args, reasoning=reasoning))]


@pytest.mark.asyncio
async def test_agent_loop_scripted_sequence():
    """Verify event ordering: write_file -> run_pytest -> finish_task."""
    resp1 = MockResponse(
        text="I will write the binary search implementation.",
        fn_name="write_file",
        fn_args={"file_path": "binary_search.py", "content": "def binary_search(arr, t): return -1\n"},
        reasoning="I will write the binary search implementation.",
    )
    resp2 = MockResponse(
        text="I will run pytest to test the code.",
        fn_name="run_pytest",
        fn_args={},
        reasoning="I will run pytest to test the code.",
    )
    resp3 = MockResponse(
        text="All tests verified. Task complete.",
        fn_name="finish_task",
        fn_args={"summary": "Successfully implemented and tested."},
        reasoning="All tests verified. Task complete.",
    )

    mock_create = AsyncMock(side_effect=[resp1, resp2, resp3])

    with patch("backend.agent.core.AsyncGroq") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.chat.completions.create = mock_create
        mock_client_cls.return_value = mock_client

        engine = ApexAgentEngine(api_key="test-fake-key", model_name="openai/gpt-oss-20b")
        events = []
        async for event in engine.run_scenario("scenario_1_binary_search", max_turns=5):
            events.append(event)

    event_names = [e["event"] for e in events]

    # Verify agent starts properly with mode 'live'
    assert "agent_start" in event_names
    start_ev = next(e for e in events if e["event"] == "agent_start")
    assert start_ev["data"]["mode"] == "live"
    assert start_ev["data"]["has_api_key"] is True

    # Verify event ordering
    tool_calls = [e["data"]["tool_name"] for e in events if e["event"] == "tool_call"]
    assert tool_calls == ["write_file", "run_pytest", "finish_task"]

    # Verify finish event
    assert "finished" in event_names
    finish_ev = next(e for e in events if e["event"] == "finished")
    assert finish_ev["data"]["success"] is True
    assert finish_ev["data"]["turns"] == 3


@pytest.mark.asyncio
async def test_agent_loop_turn_limit():
    """Verify that exceeding max_turns terminates the loop with success: False."""
    infinite_resp = MockResponse(
        text="I am inspecting files.",
        fn_name="read_file",
        fn_args={"file_path": "binary_search.py"},
        reasoning="I am inspecting files.",
    )

    mock_create = AsyncMock(return_value=infinite_resp)

    with patch("backend.agent.core.AsyncGroq") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.chat.completions.create = mock_create
        mock_client_cls.return_value = mock_client

        engine = ApexAgentEngine(api_key="test-fake-key", model_name="openai/gpt-oss-20b")
        events = []
        async for event in engine.run_scenario("scenario_1_binary_search", max_turns=3):
            events.append(event)

    finish_ev = next(e for e in events if e["event"] == "finished")
    assert finish_ev["data"]["success"] is False
    assert finish_ev["data"]["turns"] == 3
    assert "limit" in finish_ev["data"]["summary"].lower()


@pytest.mark.asyncio
async def test_agent_loop_timeout_budget():
    """Verify that exceeding MAX_RUN_SECONDS terminates the loop with budget message."""
    slow_resp = MockResponse(
        text="I am thinking.",
        fn_name="read_file",
        fn_args={"file_path": "binary_search.py"},
        reasoning="I am thinking.",
    )

    async def delayed_create(*args, **kwargs):
        await asyncio.sleep(0.05)
        return slow_resp

    with patch("backend.agent.core.AsyncGroq") as mock_client_cls, \
         patch("backend.agent.core.MAX_RUN_SECONDS", 0.02):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=delayed_create)
        mock_client_cls.return_value = mock_client

        engine = ApexAgentEngine(api_key="test-fake-key", model_name="openai/gpt-oss-20b")
        events = []
        async for event in engine.run_scenario("scenario_1_binary_search", max_turns=5):
            events.append(event)

    finish_ev = next(e for e in events if e["event"] == "finished")
    assert finish_ev["data"]["success"] is False
    assert "wall-clock budget" in finish_ev["data"]["summary"].lower()
