from typing import Dict, Any, List
from sandbox.runner import SandboxEnvironment

# Tool Definitions for Gemini API Function Calling
GEMINI_TOOLS_DECLARATION = [
    {
        "name": "write_file",
        "description": "Creates or overwrites a file in the sandbox workspace with specified text content.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "file_path": {
                    "type": "STRING",
                    "description": "Relative file path inside the workspace (e.g., 'solution.py', 'src/utils.py', 'test_solution.py')"
                },
                "content": {
                    "type": "STRING",
                    "description": "Full text content to write into the file"
                }
            },
            "required": ["file_path", "content"]
        }
    },
    {
        "name": "read_file",
        "description": "Reads and returns the contents of a file from the sandbox workspace.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "file_path": {
                    "type": "STRING",
                    "description": "Relative path of the file to inspect"
                }
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "list_dir",
        "description": "Lists files and subdirectories in the sandbox workspace.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "sub_path": {
                    "type": "STRING",
                    "description": "Directory relative path to list (default is '.')"
                }
            },
            "required": []
        }
    },
    {
        "name": "search_code",
        "description": "Searches for a text or pattern across all workspace code files.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Pattern or variable name to grep"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "run_sandbox_python",
        "description": "Executes a Python script in the isolated sandbox subprocess and captures stdout, stderr, exit code, and error tracebacks.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "script_path": {
                    "type": "STRING",
                    "description": "Relative path of the python file to run (e.g., 'solution.py')"
                },
                "args": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                    "description": "Optional command line arguments to pass to the script"
                }
            },
            "required": ["script_path"]
        }
    },
    {
        "name": "run_pytest",
        "description": "Executes pytest test suite in the sandbox workspace to verify implementation against unit tests.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "test_path": {
                    "type": "STRING",
                    "description": "Optional specific test file path (e.g., 'test_solution.py'). If omitted, runs all tests in workspace."
                }
            },
            "required": []
        }
    },
    {
        "name": "run_command",
        "description": "Runs a supported project validation command without a shell. Use this for project-provided build, lint, unit, or UI/browser test commands such as 'npm run test:e2e', 'npm run build', 'python -m pytest -q', 'go test ./...', or 'cargo test'. Only run commands needed to validate the requested work.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "command": {
                    "type": "STRING",
                    "description": "One supported command. Shell operators such as |, &&, >, and ; are not supported."
                },
                "working_directory": {
                    "type": "STRING",
                    "description": "Optional directory relative to the workspace, default '.'."
                }
            },
            "required": ["command"]
        }
    },
    {
        "name": "finish_task",
        "description": "Signals that the coding/debugging task is fully completed and verified.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "summary": {
                    "type": "STRING",
                    "description": "Detailed summary of the fix or implementation, root cause analysis, and execution verification evidence."
                }
            },
            "required": ["summary"]
        }
    }
]

class ToolDispatcher:
    """Executes tool calls requested by Gemini agent against the Sandbox Environment."""
    def __init__(self, sandbox: SandboxEnvironment):
        self.sandbox = sandbox

    def dispatch(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch tool invocation and return structured result."""
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
