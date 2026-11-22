import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agent.core import ApexAgentEngine


class MockFunctionCall:
    def __init__(self, name: str, args: dict):
        self.name = name
        self.args = args


class MockPart:
    def __init__(self, text: str = None, function_call: MockFunctionCall = None):
        self.text = text
        self.function_call = function_call


class MockContent:
    def __init__(self, parts):
        self.parts = parts


class MockCandidate:
    def __init__(self, content):
        self.content = content


class MockResponse:
    def __init__(self, text: str = None, fn_name: str = None, fn_args: dict = None):
        parts = []
        if text:
            parts.append(MockPart(text=text))
        if fn_name:
            parts.append(MockPart(function_call=MockFunctionCall(fn_name, fn_args or {})))
        self.candidates = [MockCandidate(MockContent(parts))]


@pytest.mark.asyncio
async def test_agent_loop_scripted_sequence():
    """Verify event ordering: write_file -> run_pytest -> finish_task."""
    resp1 = MockResponse(
        text="I will write the binary search implementation.",
        fn_name="write_file",
        fn_args={"file_path": "binary_search.py", "content": "def binary_search(arr, t): return -1\n"},
    )
    resp2 = MockResponse(
        text="I will run pytest to test the code.",
        fn_name="run_pytest",
        fn_args={},
    )
    resp3 = MockResponse(
        text="All tests verified. Task complete.",
        fn_name="finish_task",
        fn_args={"summary": "Successfully implemented and tested."},
    )

    mock_generate = AsyncMock(side_effect=[resp1, resp2, resp3])

    with patch("backend.agent.core.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = mock_generate
        mock_client_cls.return_value = mock_client

        engine = ApexAgentEngine(api_key="test-fake-key")
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
    )

    mock_generate = AsyncMock(return_value=infinite_resp)

    with patch("backend.agent.core.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = mock_generate
        mock_client_cls.return_value = mock_client

        engine = ApexAgentEngine(api_key="test-fake-key")
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
    )

    async def delayed_generate(*args, **kwargs):
        await asyncio.sleep(0.05)
        return slow_resp

    with patch("backend.agent.core.genai.Client") as mock_client_cls, \
         patch("backend.agent.core.MAX_RUN_SECONDS", 0.02):
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(side_effect=delayed_generate)
        mock_client_cls.return_value = mock_client

        engine = ApexAgentEngine(api_key="test-fake-key")
        events = []
        async for event in engine.run_scenario("scenario_1_binary_search", max_turns=5):
            events.append(event)

    finish_ev = next(e for e in events if e["event"] == "finished")
    assert finish_ev["data"]["success"] is False
    assert "wall-clock budget" in finish_ev["data"]["summary"].lower()
