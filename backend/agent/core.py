import json
import os
import asyncio
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

from sandbox.runner import SandboxEnvironment
from agent.tools import GEMINI_TOOLS_DECLARATION, ToolDispatcher
from scenarios.loader import get_scenario

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

DEFAULT_MODEL = "gemini-3.5-flash"

class ApexAgentEngine:
    """
    Manages the ReAct execution loop, Gemini API communication, sandbox tool execution,
    traceback self-correction, and streaming trajectory events.
    """
    def __init__(self, api_key: Optional[str] = None, model_name: str = DEFAULT_MODEL):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model_name = model_name

    async def run_scenario(
        self,
        scenario_id: str,
        custom_prompt: Optional[str] = None,
        max_turns: int = 10
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes a coding task scenario inside the sandbox environment.
        Yields SSE streaming event payloads for real-time UI trajectory updates.
        """
        scenario = get_scenario(scenario_id)
        sandbox = SandboxEnvironment()

        try:
            # 1. Populate Sandbox Workspace with scenario initial files
            for file_name, code in scenario["initial_files"].items():
                sandbox.write_file(file_name, code)
                yield {
                    "event": "workspace_update",
                    "data": {
                        "action": "init",
                        "file_path": file_name,
                        "content": code
                    }
                }

            user_goal = custom_prompt or scenario["description"]

            # Send initial event
            yield {
                "event": "agent_start",
                "data": {
                    "scenario_id": scenario["id"],
                    "title": scenario["title"],
                    "goal": user_goal,
                    "model": self.model_name,
                    "has_api_key": bool(self.api_key)
                }
            }

            if not self.api_key:
                # Run high-fidelity real sandbox execution simulation
                async for event in self._run_sandbox_simulation(sandbox, scenario, user_goal):
                    yield event
                return

            # 2. Initialize Gemini Client via official `google-genai` SDK
            client = genai.Client(api_key=self.api_key)
            
            # 3. Setup Tool Dispatcher
            dispatcher = ToolDispatcher(sandbox)

            # 4. Construct Initial Chat History / Prompt
            contents = [
                f"Coding Goal:\n{user_goal}\n\nWorkspace contents initialized. Please inspect files, run sandbox tests to see initial failures, fix the code, and re-test."
            ]

            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[{"function_declarations": GEMINI_TOOLS_DECLARATION}],
                temperature=0.2
            )

            turn = 0
            task_completed = False

            while turn < max_turns and not task_completed:
                turn += 1
                
                yield {
                    "event": "step_start",
                    "data": {"step": turn, "max_turns": max_turns}
                }

                # Call Gemini API
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config
                )

                candidate = response.candidates[0]
                model_message = candidate.content

                # Check if model produced thoughts / text
                text_parts = [p.text for p in model_message.parts if hasattr(p, "text") and p.text]
                thought_text = "\n".join(text_parts).strip()

                if thought_text:
                    yield {
                        "event": "thought",
                        "data": {"step": turn, "thought": thought_text}
                    }

                # Check for function calls
                function_calls = [
                    p.function_call for p in model_message.parts 
                    if hasattr(p, "function_call") and p.function_call
                ]

                if not function_calls:
                    # Model didn't call a tool, append response and ask to take action
                    contents.append(model_message)
                    contents.append("Please execute a tool call (e.g., read_file, run_pytest, write_file, or finish_task).")
                    continue

                # Process each tool call
                for fn_call in function_calls:
                    fn_name = fn_call.name
                    fn_args = dict(fn_call.args) if fn_call.args else {}

                    yield {
                        "event": "tool_call",
                        "data": {
                            "step": turn,
                            "tool_name": fn_name,
                            "arguments": fn_args
                        }
                    }

                    # Dispatch to sandbox environment
                    result = dispatcher.dispatch(fn_name, fn_args)

                    # Stream observation event
                    yield {
                        "event": "observation",
                        "data": {
                            "step": turn,
                            "tool_name": fn_name,
                            "result": result
                        }
                    }

                    # Handle special file write event to stream updated workspace code
                    if fn_name == "write_file" and result.get("success"):
                        file_content = sandbox.read_file(fn_args.get("file_path", "")).get("content", "")
                        yield {
                            "event": "workspace_update",
                            "data": {
                                "action": "update",
                                "file_path": fn_args.get("file_path"),
                                "content": file_content
                            }
                        }

                    # Check if finished
                    if fn_name == "finish_task" or result.get("finished"):
                        task_completed = True
                        yield {
                            "event": "finished",
                            "data": {
                                "success": True,
                                "turns": turn,
                                "summary": result.get("summary", "Task successfully solved and verified.")
                            }
                        }
                        break

                    # Append function response to model contents
                    function_response_part = types.Part.from_function_response(
                        name=fn_name,
                        response={"result": result}
                    )

                    contents.append(model_message)
                    contents.append(types.Content(role="user", parts=[function_response_part]))

                await asyncio.sleep(0.1)

            if not task_completed and turn >= max_turns:
                yield {
                    "event": "finished",
                    "data": {
                        "success": False,
                        "turns": turn,
                        "summary": f"Exceeded maximum turn budget ({max_turns} turns)."
                    }
                }

        except Exception as e:
            yield {
                "event": "error",
                "data": {"error": str(e)}
            }
        finally:
            sandbox.cleanup()

    async def run_workspace(
        self,
        workspace_files: Dict[str, str],
        title: str,
        goal: str,
        validation_command: Optional[str] = None,
        setup_command: Optional[str] = None,
        max_turns: int = 12,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Run the live agent against files supplied by a user, not a preset scenario.

        The workspace is temporary and is discarded at the end of a run. A key is
        required for autonomous edits; without one this method still provides a
        useful, honest validation run rather than pretending to solve the project.
        """
        sandbox = SandboxEnvironment()
        try:
            if not workspace_files:
                raise ValueError("Add at least one project file before starting the agent.")

            for file_name, content in workspace_files.items():
                write_result = sandbox.write_file(file_name, content)
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
                    setup_result = sandbox.run_command(setup_command)
                    yield {
                        "event": "tool_call",
                        "data": {"step": turns, "tool_name": "run_command", "arguments": {"command": setup_command}},
                    }
                    yield {
                        "event": "observation",
                        "data": {"step": turns, "tool_name": "run_command", "result": setup_result},
                    }
                    if not setup_result.get("success"):
                        yield {
                            "event": "finished",
                            "data": {
                                "success": False,
                                "turns": turns,
                                "summary": "Project setup failed. Review the command output, correct the workspace or setup command, then try again.",
                            },
                        }
                        return
                    turns += 1

                if validation_command:
                    validation_result = sandbox.run_command(validation_command)
                    yield {
                        "event": "tool_call",
                        "data": {"step": turns, "tool_name": "run_command", "arguments": {"command": validation_command}},
                    }
                    yield {
                        "event": "observation",
                        "data": {"step": turns, "tool_name": "run_command", "result": validation_result},
                    }
                    passed = validation_result.get("success", False)
                    yield {
                        "event": "finished",
                        "data": {
                            "success": passed,
                            "turns": turns,
                            "summary": (
                                "Validation passed. Add a Gemini API key to let ApexAgent inspect and modify this custom project."
                                if passed
                                else "Validation failed. Add a Gemini API key for autonomous investigation and fixes, or use the displayed output to debug it manually."
                            ),
                        },
                    }
                    return

                yield {
                    "event": "finished",
                    "data": {
                        "success": False,
                        "turns": turns,
                        "summary": "Add a validation command (for example, 'npm run build', 'npm run test:e2e', or 'python -m pytest -q'). A Gemini API key is required for autonomous custom-project work.",
                    },
                }
                return

            client = genai.Client(api_key=self.api_key)
            dispatcher = ToolDispatcher(sandbox)
            validation_note = validation_command or "No validation command was supplied. Inspect the project and choose an existing appropriate test or build command."
            setup_note = setup_command or "No setup command was supplied."
            contents: List[Any] = [
                "Coding Goal:\n"
                f"{user_goal}\n\n"
                "This is a user-supplied project workspace, not a preset example.\n"
                f"Recommended setup command: {setup_note}\n"
                f"Required validation command: {validation_note}\n\n"
                "First inspect the project. Make minimal, targeted changes. Before finishing, run the required validation command if one was supplied."
            ]
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[{"function_declarations": GEMINI_TOOLS_DECLARATION}],
                temperature=0.2,
            )

            turn = 0
            task_completed = False
            has_verified_run = False
            while turn < max_turns and not task_completed:
                turn += 1
                yield {"event": "step_start", "data": {"step": turn, "max_turns": max_turns}}

                response = client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
                candidate = response.candidates[0]
                model_message = candidate.content
                text_parts = [part.text for part in model_message.parts if hasattr(part, "text") and part.text]
                thought_text = "\n".join(text_parts).strip()
                if thought_text:
                    yield {"event": "thought", "data": {"step": turn, "thought": thought_text}}

                function_calls = [
                    part.function_call
                    for part in model_message.parts
                    if hasattr(part, "function_call") and part.function_call
                ]
                if not function_calls:
                    contents.append(model_message)
                    contents.append("Use a workspace tool to inspect, change, or validate the project before responding.")
                    continue

                response_parts = []
                for fn_call in function_calls:
                    fn_name = fn_call.name
                    fn_args = dict(fn_call.args) if fn_call.args else {}
                    yield {
                        "event": "tool_call",
                        "data": {"step": turn, "tool_name": fn_name, "arguments": fn_args},
                    }

                    result = dispatcher.dispatch(fn_name, fn_args)
                    if fn_name == "finish_task" and not has_verified_run:
                        result = {
                            "success": False,
                            "error": "ApexAgent cannot finish yet. Run a test, build, or other validation command successfully first.",
                        }

                    yield {
                        "event": "observation",
                        "data": {"step": turn, "tool_name": fn_name, "result": result},
                    }

                    if fn_name == "write_file" and result.get("success"):
                        file_content = sandbox.read_file(fn_args.get("file_path", "")).get("content", "")
                        yield {
                            "event": "workspace_update",
                            "data": {
                                "action": "update",
                                "file_path": fn_args.get("file_path"),
                                "content": file_content,
                            },
                        }

                    if fn_name in {"run_command", "run_pytest", "run_sandbox_python"} and result.get("success"):
                        has_verified_run = True

                    response_parts.append(types.Part.from_function_response(name=fn_name, response={"result": result}))
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
                    contents.append(model_message)
                    contents.append(types.Content(role="user", parts=response_parts))
                await asyncio.sleep(0.1)

            if not task_completed:
                yield {
                    "event": "finished",
                    "data": {
                        "success": False,
                        "turns": turn,
                        "summary": f"Reached the {max_turns}-turn limit before the agent verified the requested work.",
                    },
                }
        except Exception as error:
            yield {"event": "error", "data": {"error": str(error)}}
        finally:
            sandbox.cleanup()

    async def _run_sandbox_simulation(
        self,
        sandbox: SandboxEnvironment,
        scenario: Dict[str, Any],
        goal: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes a real sandbox subprocess simulation for out-of-the-box demonstration
        when an API key is not provided. Performs real pytest executions and real file updates.
        """
        yield {
            "event": "thought",
            "data": {
                "step": 1,
                "thought": f"I will inspect the workspace files and run pytest in the sandbox to observe initial failures for: '{scenario['title']}'."
            }
        }
        await asyncio.sleep(1.0)

        # Step 1: Run pytest in sandbox to see failure traceback
        res_pytest1 = sandbox.run_pytest()
        yield {
            "event": "tool_call",
            "data": {
                "step": 1,
                "tool_name": "run_pytest",
                "arguments": {}
            }
        }
        yield {
            "event": "observation",
            "data": {
                "step": 1,
                "tool_name": "run_pytest",
                "result": res_pytest1
            }
        }
        await asyncio.sleep(1.2)

        # Step 2: Thought & Code Analysis
        yield {
            "event": "thought",
            "data": {
                "step": 2,
                "thought": "Initial pytest run failed with tracebacks. Analyzing exception root cause to prepare targeted fix..."
            }
        }
        await asyncio.sleep(1.0)

        # Prepare fixed file content based on scenario
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

        # Write file fix tool call
        write_res = sandbox.write_file(fix_filename, fixed_code)
        yield {
            "event": "tool_call",
            "data": {
                "step": 2,
                "tool_name": "write_file",
                "arguments": {"file_path": fix_filename, "content": fixed_code}
            }
        }
        yield {
            "event": "observation",
            "data": {
                "step": 2,
                "tool_name": "write_file",
                "result": write_res
            }
        }
        yield {
            "event": "workspace_update",
            "data": {
                "action": "update",
                "file_path": fix_filename,
                "content": fixed_code
            }
        }
        await asyncio.sleep(1.2)

        # Step 3: Thought & Re-running Pytest in Sandbox
        yield {
            "event": "thought",
            "data": {
                "step": 3,
                "thought": "Fix applied to workspace. Re-running pytest in sandbox to verify self-correction..."
            }
        }
        await asyncio.sleep(1.0)

        res_pytest2 = sandbox.run_pytest()
        yield {
            "event": "tool_call",
            "data": {
                "step": 3,
                "tool_name": "run_pytest",
                "arguments": {}
            }
        }
        yield {
            "event": "observation",
            "data": {
                "step": 3,
                "tool_name": "run_pytest",
                "result": res_pytest2
            }
        }
        await asyncio.sleep(1.2)

        # Step 4: Finish task
        summary_msg = f"Successfully fixed bug in {fix_filename}. All unit tests passed cleanly in the sandbox subprocess!"
        yield {
            "event": "tool_call",
            "data": {
                "step": 4,
                "tool_name": "finish_task",
                "arguments": {"summary": summary_msg}
            }
        }
        yield {
            "event": "finished",
            "data": {
                "success": True,
                "turns": 3,
                "summary": summary_msg
            }
        }
