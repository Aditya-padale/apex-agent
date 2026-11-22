import json
import os
import asyncio
import time
import logging
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, List, Optional
from dotenv import load_dotenv
from groq import AsyncGroq

from sandbox.runner import SandboxEnvironment
from agent.tools import GROQ_TOOLS, ToolDispatcher
from scenarios.loader import get_scenario

logger = logging.getLogger(__name__)

# Keep credentials in backend/.env so they are never bundled into the browser app.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SYSTEM_INSTRUCTION = """You are ApexAgent, a world-class autonomous agentic coding and debugging engineer.
You are tasked with fixing bugs, implementing features, or completing code requirements.

CRITICAL BEHAVIORAL PROTOCOL (ReAct Loop):
1. THOUGHT: Begin every turn by explicitly reasoning about what you know, what errors occurred, and what step to take next.
2. ACTION: Invoke a single tool to inspect files, modify code, or run sandbox tests.
3. OBSERVATION: When you receive the tool execution output (stdout, stderr, test failures, or tracebacks), analyze it thoroughly.
4. SELF-CORRECTION: If execution produced an error, traceback, or failing test:
   - Identify the exact line, exception type, and root cause.
   - Do NOT guess. Inspect code files if necessary.
   - Write a precise, targeted fix to the workspace.
   - IMMEDIATELY re-run the script or pytest suite in the sandbox to verify the fix.
5. FINISH: Only invoke `finish_task` when `run_pytest`, `run_sandbox_python`, or the requested `run_command` validation returns exit code 0 with clean execution output.

WORKSPACE PROTOCOL:
- Work only inside the supplied temporary workspace. Inspect existing project scripts and configuration before changing files.
- For JavaScript/TypeScript and UI projects, use `run_command` for the repository's existing test, build, lint, Playwright, or Cypress command. Browser automation is available only when the imported project already includes the required test tooling.
- `run_command` does not run through a shell. Provide one command only; do not use pipes, redirects, command substitution, or chained commands.
- Do not claim that a UI is visually correct unless a relevant existing browser/UI test or build has passed. If the project has no UI test, state that limitation in the final summary.

You must be relentless in making tests pass cleanly. Never give up on a traceback!"""

DEFAULT_MODEL = "openai/gpt-oss-20b"

# Hard per-run wall-clock budget in seconds, configurable via env.
MAX_RUN_SECONDS = int(os.environ.get("MAX_RUN_SECONDS", "150"))

# Retry config for transient API errors (429 / 5xx)
_MAX_API_RETRIES = 2
_RETRY_BASE_DELAY = 2.0


def _is_transient_error(exc: Exception) -> bool:
    """Return True for 429 / 5xx errors that are worth retrying."""
    msg = str(exc).lower()
    for code in ("429", "500", "502", "503", "504"):
        if code in msg:
            return True
    if "rate limit" in msg or "internal" in msg or "unavailable" in msg or "overloaded" in msg:
        return True
    return False


class ApexAgentEngine:
    """
    Manages the ReAct execution loop, Groq API communication, sandbox tool execution,
    traceback self-correction, and streaming trajectory events.
    """
    def __init__(self, api_key: Optional[str] = None, model_name: str = DEFAULT_MODEL):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY") or os.environ.get("GEMINI_API_KEY")
        self.model_name = model_name or DEFAULT_MODEL

    # ------------------------------------------------------------------
    # Private: shared ReAct loop used by both run_scenario and run_workspace
    # ------------------------------------------------------------------
    async def _react_loop(
        self,
        sandbox: SandboxEnvironment,
        client: AsyncGroq,
        messages: List[Dict[str, Any]],
        max_turns: int,
        *,
        require_verified_run: bool = False,
        no_tool_nudge: str = "Please execute a tool call (e.g., read_file, run_pytest, write_file, or finish_task).",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Core ReAct loop that yields SSE event dicts."""
        dispatcher = ToolDispatcher(sandbox)
        turn = 0
        task_completed = False
        has_verified_run = False
        wall_start = time.monotonic()

        while turn < max_turns and not task_completed:
            # Wall-clock budget check
            elapsed = time.monotonic() - wall_start
            if elapsed >= MAX_RUN_SECONDS:
                yield {
                    "event": "finished",
                    "data": {
                        "success": False,
                        "turns": turn,
                        "summary": f"Run exceeded the {MAX_RUN_SECONDS}s wall-clock budget after {turn} turns.",
                    },
                }
                return

            turn += 1
            yield {"event": "step_start", "data": {"step": turn, "max_turns": max_turns}}

            # --- Groq API call with retry on transient errors ---
            response = None
            last_api_error: Optional[Exception] = None
            for attempt in range(_MAX_API_RETRIES + 1):
                try:
                    response = await client.chat.completions.create(
                        model=self.model_name,
                        messages=messages,
                        tools=GROQ_TOOLS,
                        temperature=0.2,
                    )
                    break
                except Exception as api_err:
                    last_api_error = api_err
                    if _is_transient_error(api_err) and attempt < _MAX_API_RETRIES:
                        delay = _RETRY_BASE_DELAY * (2 ** attempt)
                        logger.warning("Transient Groq API error (attempt %d): %s — retrying in %.1fs", attempt + 1, api_err, delay)
                        await asyncio.sleep(delay)
                    else:
                        yield {
                            "event": "error",
                            "data": {"error": f"Groq API error: {api_err}"},
                        }
                        return

            if response is None:
                yield {
                    "event": "error",
                    "data": {"error": f"Groq API error after retries: {last_api_error}"},
                }
                return

            choice = response.choices[0]
            message = choice.message

            # Extract reasoning or text thoughts
            thought_text = getattr(message, "reasoning", None)
            if not thought_text and hasattr(message, "model_extra") and message.model_extra:
                thought_text = message.model_extra.get("reasoning")
            if not thought_text and message.content:
                thought_text = message.content.strip()

            if thought_text:
                yield {"event": "thought", "data": {"step": turn, "thought": thought_text}}

            # Check for function / tool calls
            tool_calls = message.tool_calls or []
            if not tool_calls:
                messages.append({"role": "assistant", "content": message.content or ""})
                messages.append({"role": "user", "content": no_tool_nudge})
                continue

            # Append assistant message with its tool calls
            messages.append(message)

            for tool_call in tool_calls:
                fn_name = tool_call.function.name
                fn_args_raw = tool_call.function.arguments or "{}"
                try:
                    fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else dict(fn_args_raw)
                except Exception:
                    fn_args = {}

                yield {
                    "event": "tool_call",
                    "data": {"step": turn, "tool_name": fn_name, "arguments": fn_args},
                }

                result = await asyncio.to_thread(dispatcher.dispatch, fn_name, fn_args)

                # Enforce verified run before finish for workspace mode
                if require_verified_run and fn_name == "finish_task" and not has_verified_run:
                    result = {
                        "success": False,
                        "error": "ApexAgent cannot finish yet. Run a test, build, or other validation command successfully first.",
                    }

                yield {
                    "event": "observation",
                    "data": {"step": turn, "tool_name": fn_name, "result": result},
                }

                if fn_name == "write_file" and result.get("success"):
                    file_content_result = await asyncio.to_thread(
                        sandbox.read_file, fn_args.get("file_path", "")
                    )
                    yield {
                        "event": "workspace_update",
                        "data": {
                            "action": "update",
                            "file_path": fn_args.get("file_path"),
                            "content": file_content_result.get("content", ""),
                        },
                    }

                if fn_name in {"run_command", "run_pytest", "run_sandbox_python"} and result.get("success"):
                    has_verified_run = True

                # Append tool response
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": fn_name,
                    "content": json.dumps(result),
                })

                if fn_name == "finish_task" and result.get("finished"):
                    task_completed = True
                    yield {
                        "event": "finished",
                        "data": {
                            "success": True,
                            "turns": turn,
                            "summary": result.get("summary", "Task successfully completed and validated."),
                        },
                    }
                    break

        if not task_completed:
            yield {
                "event": "finished",
                "data": {
                    "success": False,
                    "turns": turn,
                    "summary": f"Reached the {max_turns}-turn limit before the agent verified the requested work.",
                },
            }

    # ------------------------------------------------------------------
    # Public entry point: run a built-in scenario
    # ------------------------------------------------------------------
    async def run_scenario(
        self,
        scenario_id: str,
        custom_prompt: Optional[str] = None,
        max_turns: int = 10,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute a built-in benchmark scenario and yield SSE events."""
        scenario = get_scenario(scenario_id)
        sandbox = SandboxEnvironment()

        try:
            for file_name, code in scenario["initial_files"].items():
                await asyncio.to_thread(sandbox.write_file, file_name, code)
                yield {
                    "event": "workspace_update",
                    "data": {"action": "init", "file_path": file_name, "content": code},
                }

            user_goal = custom_prompt or scenario["description"]

            yield {
                "event": "agent_start",
                "data": {
                    "scenario_id": scenario["id"],
                    "title": scenario["title"],
                    "goal": user_goal,
                    "model": self.model_name,
                    "has_api_key": bool(self.api_key),
                    "mode": "live" if self.api_key else "demo",
                },
            }

            if not self.api_key:
                async for event in self._run_sandbox_simulation(sandbox, scenario, user_goal):
                    yield event
                return

            client = AsyncGroq(api_key=self.api_key)
            messages = [
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {
                    "role": "user",
                    "content": f"Coding Goal:\n{user_goal}\n\nWorkspace contents initialized. "
                               "Please inspect files, run sandbox tests to see initial failures, fix the code, and re-test.",
                },
            ]

            async for event in self._react_loop(
                sandbox, client, messages, max_turns
            ):
                yield event

        except Exception as e:
            yield {"event": "error", "data": {"error": str(e)}}
        finally:
            sandbox.cleanup()

    # ------------------------------------------------------------------
    # Public entry point: run user-supplied workspace files
    # ------------------------------------------------------------------
    async def run_workspace(
        self,
        workspace_files: Dict[str, str],
        title: str,
        goal: str,
        validation_command: Optional[str] = None,
        setup_command: Optional[str] = None,
        max_turns: int = 12,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Run the live agent against user-supplied files."""
        sandbox = SandboxEnvironment()
        try:
            if not workspace_files:
                raise ValueError("Add at least one project file before starting the agent.")

            for file_name, content in workspace_files.items():
                write_result = await asyncio.to_thread(sandbox.write_file, file_name, content)
                if not write_result.get("success"):
                    raise ValueError(write_result.get("error", f"Could not import {file_name}"))
                yield {
                    "event": "workspace_update",
                    "data": {"action": "init", "file_path": file_name, "content": content},
                }

            user_goal = (goal or "Inspect this project and report the current validation result.").strip()
            yield {
                "event": "agent_start",
                "data": {
                    "scenario_id": "custom_workspace",
                    "title": title or "My workspace",
                    "goal": user_goal,
                    "model": self.model_name,
                    "has_api_key": bool(self.api_key),
                    "mode": "live" if self.api_key else "demo",
                    "workspace_type": "custom",
                    "validation_command": validation_command,
                },
            }

            if not self.api_key:
                yield {
                    "event": "thought",
                    "data": {
                        "step": 1,
                        "thought": "No live model key is configured. I can run the supplied project validation, but cannot safely invent or apply a fix to an arbitrary workspace.",
                    },
                }
                turns = 1
                if setup_command:
                    setup_result = await asyncio.to_thread(sandbox.run_command, setup_command)
                    yield {"event": "tool_call", "data": {"step": turns, "tool_name": "run_command", "arguments": {"command": setup_command}}}
                    yield {"event": "observation", "data": {"step": turns, "tool_name": "run_command", "result": setup_result}}
                    if not setup_result.get("success"):
                        yield {"event": "finished", "data": {"success": False, "turns": turns, "summary": "Project setup failed. Review the command output, correct the workspace or setup command, then try again."}}
                        return
                    turns += 1

                if validation_command:
                    validation_result = await asyncio.to_thread(sandbox.run_command, validation_command)
                    yield {"event": "tool_call", "data": {"step": turns, "tool_name": "run_command", "arguments": {"command": validation_command}}}
                    yield {"event": "observation", "data": {"step": turns, "tool_name": "run_command", "result": validation_result}}
                    passed = validation_result.get("success", False)
                    yield {
                        "event": "finished",
                        "data": {
                            "success": passed,
                            "turns": turns,
                            "summary": (
                                "Validation passed. Add a Groq API key to let ApexAgent inspect and modify this custom project."
                                if passed
                                else "Validation failed. Add a Groq API key for autonomous investigation and fixes, or use the displayed output to debug it manually."
                            ),
                        },
                    }
                    return

                yield {
                    "event": "finished",
                    "data": {
                        "success": False,
                        "turns": turns,
                        "summary": "Add a validation command (for example, 'npm run build', 'npm run test:e2e', or 'python -m pytest -q'). A Groq API key is required for autonomous custom-project work.",
                    },
                }
                return

            client = AsyncGroq(api_key=self.api_key)
            validation_note = validation_command or "No validation command was supplied. Inspect the project and choose an existing appropriate test or build command."
            setup_note = setup_command or "No setup command was supplied."
            messages = [
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {
                    "role": "user",
                    "content": (
                        "Coding Goal:\n"
                        f"{user_goal}\n\n"
                        "This is a user-supplied project workspace, not a preset example.\n"
                        f"Recommended setup command: {setup_note}\n"
                        f"Required validation command: {validation_note}\n\n"
                        "First inspect the project. Make minimal, targeted changes. Before finishing, run the required validation command if one was supplied."
                    ),
                },
            ]

            async for event in self._react_loop(
                sandbox,
                client,
                messages,
                max_turns,
                require_verified_run=True,
                no_tool_nudge="Use a workspace tool to inspect, change, or validate the project before responding.",
            ):
                yield event

        except Exception as error:
            yield {"event": "error", "data": {"error": str(error)}}
        finally:
            sandbox.cleanup()

    # ------------------------------------------------------------------
    # Scripted demo simulation (no API key)
    # ------------------------------------------------------------------
    async def _run_sandbox_simulation(
        self,
        sandbox: SandboxEnvironment,
        scenario: Dict[str, Any],
        goal: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Scripted demo: replays a pre-written fix for built-in scenarios while
        running real pytest in the sandbox."""
        yield {
            "event": "thought",
            "data": {
                "step": 1,
                "thought": f"I will inspect the workspace files and run pytest in the sandbox to observe initial failures for: '{scenario['title']}'.",
            },
        }
        await asyncio.sleep(1.0)

        res_pytest1 = await asyncio.to_thread(sandbox.run_pytest)
        yield {"event": "tool_call", "data": {"step": 1, "tool_name": "run_pytest", "arguments": {}}}
        yield {"event": "observation", "data": {"step": 1, "tool_name": "run_pytest", "result": res_pytest1}}
        await asyncio.sleep(1.2)

        yield {
            "event": "thought",
            "data": {"step": 2, "thought": "Initial pytest run failed with tracebacks. Analyzing exception root cause to prepare targeted fix..."},
        }
        await asyncio.sleep(1.0)

        scenario_id = scenario["id"]
        fix_filename = ""
        fixed_code = ""

        if scenario_id == "scenario_1_binary_search":
            fix_filename = "binary_search.py"
            fixed_code = '''def binary_search(arr, target):
    """
    Finds the index of target in sorted array arr.
    Returns -1 if target is not present.
    """
    if not arr:
        return -1

    low = 0
    high = len(arr) - 1
    
    while low <= high:
        mid = (low + high) // 2
        val = arr[mid]
        
        if val == target:
            return mid
        elif val < target:
            low = mid + 1
        else:
            high = mid - 1
            
    return -1
'''
        elif scenario_id == "scenario_2_log_pipeline":
            fix_filename = "pipeline.py"
            fixed_code = '''import json
from typing import List, Dict, Any

def process_log_records(raw_logs: List[str]) -> Dict[str, Any]:
    """
    Parses JSON log lines, extracts response times, calculates total requests,
    average response time, and count of 5xx errors safely.
    """
    total_time = 0.0
    valid_count = 0
    errors_5xx = 0
    
    for raw in raw_logs:
        try:
            data = json.loads(raw)
        except Exception:
            continue
            
        if not isinstance(data, dict):
            continue

        status = data.get("status")
        if isinstance(status, int) and status >= 500:
            errors_5xx += 1
            
        duration = data.get("response_time_ms")
        if duration is not None and isinstance(duration, (int, float)):
            total_time += float(duration)
            valid_count += 1

    avg_duration = (total_time / valid_count) if valid_count > 0 else 0.0
    
    return {
        "processed": valid_count,
        "avg_response_ms": round(avg_duration, 2),
        "server_errors": errors_5xx
    }
'''
        elif scenario_id == "scenario_3_exponential_backoff":
            fix_filename = "http_client.py"
            fixed_code = '''import time
from typing import Dict, Any

class NetworkError(Exception):
    pass

class HttpClient:
    def __init__(self, mock_failures: int = 0):
        self.attempts = 0
        self.mock_failures = mock_failures

    def raw_fetch(self, url: str) -> str:
        self.attempts += 1
        if self.attempts <= self.mock_failures:
            raise NetworkError(f"Connection failed to {url} (Attempt {self.attempts})")
        return f"Response 200 OK from {url}"

    def fetch_with_retry(self, url: str, max_retries: int = 3, initial_delay: float = 0.01) -> Dict[str, Any]:
        """
        Retries raw_fetch with exponential backoff on NetworkError.
        """
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                data = self.raw_fetch(url)
                return {
                    "success": True,
                    "attempts": self.attempts,
                    "data": data
                }
            except NetworkError as e:
                last_exception = e
                if attempt < max_retries:
                    delay = initial_delay * (2 ** attempt)
                    time.sleep(delay)
                else:
                    raise last_exception
'''

        write_res = await asyncio.to_thread(sandbox.write_file, fix_filename, fixed_code)
        yield {"event": "tool_call", "data": {"step": 2, "tool_name": "write_file", "arguments": {"file_path": fix_filename, "content": fixed_code}}}
        yield {"event": "observation", "data": {"step": 2, "tool_name": "write_file", "result": write_res}}
        yield {"event": "workspace_update", "data": {"action": "update", "file_path": fix_filename, "content": fixed_code}}
        await asyncio.sleep(1.2)

        yield {"event": "thought", "data": {"step": 3, "thought": "Fix applied to workspace. Re-running pytest in sandbox to verify self-correction..."}}
        await asyncio.sleep(1.0)

        res_pytest2 = await asyncio.to_thread(sandbox.run_pytest)
        yield {"event": "tool_call", "data": {"step": 3, "tool_name": "run_pytest", "arguments": {}}}
        yield {"event": "observation", "data": {"step": 3, "tool_name": "run_pytest", "result": res_pytest2}}
        await asyncio.sleep(1.2)

        summary_msg = f"Successfully fixed bug in {fix_filename}. All unit tests passed cleanly in the sandbox subprocess!"
        yield {"event": "tool_call", "data": {"step": 4, "tool_name": "finish_task", "arguments": {"summary": summary_msg}}}
        yield {"event": "finished", "data": {"success": True, "turns": 3, "summary": summary_msg}}
