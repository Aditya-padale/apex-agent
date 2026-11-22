from typing import Dict, Any, List
from sandbox.runner import SandboxEnvironment

# Tool Definitions for Groq / OpenAI Function Calling API
GROQ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Creates or overwrites a file in the sandbox workspace with specified text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Relative file path inside the workspace (e.g., 'solution.py', 'src/utils.py', 'test_solution.py')"
                    },
                    "content": {
                        "type": "string",
                        "description": "Full text content to write into the file"
                    }
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Reads and returns the contents of a file from the sandbox workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Relative path of the file to inspect"
                    }
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "Lists files and subdirectories in the sandbox workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sub_path": {
                        "type": "string",
                        "description": "Directory relative path to list (default is '.')"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Searches for a text or pattern across all workspace code files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Pattern or variable name to grep"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_sandbox_python",
            "description": "Executes a Python script in the isolated sandbox subprocess and captures stdout, stderr, exit code, and error tracebacks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "script_path": {
                        "type": "string",
                        "description": "Relative path of the python file to run (e.g., 'solution.py')"
                    },
                    "args": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional command line arguments to pass to the script"
                    }
                },
                "required": ["script_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_pytest",
            "description": "Executes pytest test suite in the sandbox workspace to verify implementation against unit tests.",
            "parameters": {
                "type": "object",
                "properties": {
                    "test_path": {
                        "type": "string",
                        "description": "Optional specific test file path (e.g., 'test_solution.py'). If omitted, runs all tests in workspace."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Runs a supported project validation command without a shell. Use this for project-provided build, lint, unit, or UI/browser test commands such as 'npm run test:e2e', 'npm run build', 'python -m pytest -q', 'go test ./...', or 'cargo test'. Only run commands needed to validate the requested work.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "One supported command. Shell operators such as |, &&, >, and ; are not supported."
                    },
                    "working_directory": {
                        "type": "string",
                        "description": "Optional directory relative to the workspace, default '.'."
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "finish_task",
            "description": "Signals that the coding/debugging task is fully completed and verified.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Detailed summary of the fix or implementation, root cause analysis, and execution verification evidence."
                    }
                },
                "required": ["summary"]
            }
        }
    }
]

# Backward compatibility alias
GEMINI_TOOLS_DECLARATION = GROQ_TOOLS


class ToolDispatcher:
    """Executes tool calls requested by Groq agent against the Sandbox Environment."""
    def __init__(self, sandbox: SandboxEnvironment):
        self.sandbox = sandbox

    def dispatch(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch tool invocation and return structured result."""
        try:
            if tool_name == "write_file":
                return self.sandbox.write_file(
                    file_path=arguments.get("file_path", ""),
                    content=arguments.get("content", "")
                )
            elif tool_name == "read_file":
                return self.sandbox.read_file(
                    file_path=arguments.get("file_path", "")
                )
            elif tool_name == "list_dir":
                return self.sandbox.list_dir(
                    sub_path=arguments.get("sub_path", ".")
                )
            elif tool_name == "search_code":
                return self.sandbox.search_code(
                    query=arguments.get("query", "")
                )
            elif tool_name == "run_sandbox_python":
                return self.sandbox.run_python_script(
                    script_path=arguments.get("script_path", ""),
                    args=arguments.get("args", [])
                )
            elif tool_name == "run_pytest":
                return self.sandbox.run_pytest(
                    test_path=arguments.get("test_path")
                )
            elif tool_name == "run_command":
                return self.sandbox.run_command(
                    command=arguments.get("command", ""),
                    working_directory=arguments.get("working_directory", ".")
                )
            elif tool_name == "finish_task":
                return {
                    "success": True,
                    "finished": True,
                    "summary": arguments.get("summary", "Task complete.")
                }
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: '{tool_name}'"
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
