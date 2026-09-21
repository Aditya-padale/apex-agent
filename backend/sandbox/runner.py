import os
import sys
import subprocess
import shutil
import tempfile
import pathlib
import re
import shlex
from typing import Dict, Any, List, Optional


# These are deliberately command *entry points*, not shell snippets. Commands are
# parsed with shlex and executed with shell=False, so a validation command cannot
# use pipes, redirects, command substitution, or chained shell commands.
ALLOWED_COMMANDS = {
    "python", "python3", "pip", "pip3", "pytest", "node", "npm", "npx", "pnpm", "yarn", "bun", "deno",
    "go", "cargo", "java", "javac", "kotlinc", "kotlin", "dotnet", "php", "ruby", "rspec",
    "mvn", "gradle", "gcc", "g++", "clang", "clang++", "make", "cmake", "ctest", "swift", "Rscript", "julia",
}
MAX_COMMAND_LENGTH = 800
MAX_PROCESS_OUTPUT = 60_000

class SandboxEnvironment:
    """
    Secure subprocess execution sandbox for agentic code runner.
    Provides isolated workspace directory management, script execution,
    pytest execution, traceback capture, and file safety checks.
    """
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir:
            self.workspace_dir = pathlib.Path(base_dir).resolve()
            self.workspace_dir.mkdir(parents=True, exist_ok=True)
            self._is_temp = False
        else:
            self.temp_dir = tempfile.TemporaryDirectory(prefix="apex_sandbox_")
            self.workspace_dir = pathlib.Path(self.temp_dir.name).resolve()
            self._is_temp = True

    def _resolve_safe_path(self, relative_path: str) -> pathlib.Path:
        """Ensure path is within the workspace sandbox directory."""
        target = (self.workspace_dir / relative_path).resolve()
        try:
            target.relative_to(self.workspace_dir)
        except ValueError:
            raise PermissionError(f"Access denied: Path '{relative_path}' escapes sandbox boundary.")
        return target

    def _command_environment(self) -> Dict[str, str]:
        """Expose only the runtime settings that a project test normally needs."""
        home_dir = self.workspace_dir / ".apex-home"
        home_dir.mkdir(exist_ok=True)
        return {
            "PATH": os.environ.get("PATH", ""),
            "HOME": str(home_dir),
            "PYTHONPATH": str(self.workspace_dir),
            "PYTHONDONTWRITEBYTECODE": "1",
            "CI": "true",
            "NO_COLOR": "1",
            "npm_config_cache": str(home_dir / ".npm"),
        }

    @staticmethod
    def _truncate_output(value: str) -> str:
        if len(value) <= MAX_PROCESS_OUTPUT:
            return value
        return value[:MAX_PROCESS_OUTPUT] + "\n… output truncated by ApexAgent …\n"

    def _parse_allowed_command(self, command: str) -> List[str]:
        if not command or not command.strip():
            raise ValueError("A validation command is required.")
        if len(command) > MAX_COMMAND_LENGTH:
            raise ValueError(f"Command is limited to {MAX_COMMAND_LENGTH} characters.")

        try:
            parts = shlex.split(command)
        except ValueError as error:
            raise ValueError(f"Invalid command syntax: {error}") from error

        if not parts:
            raise ValueError("A validation command is required.")
        executable = pathlib.Path(parts[0]).name
        if executable not in ALLOWED_COMMANDS:
            allowed = ", ".join(sorted(ALLOWED_COMMANDS))
            raise PermissionError(f"'{executable}' is not an allowed workspace command. Allowed: {allowed}.")
        if "-c" in parts or "--eval" in parts:
            raise PermissionError("Inline code execution is not allowed. Put the code in a workspace file instead.")
        return parts

    def run_command(
        self,
        command: str,
        working_directory: str = ".",
        timeout: int = 60,
    ) -> Dict[str, Any]:
        """Run a supported test, build, or lint command in the temporary workspace.

        This is intentionally shell-free. Project scripts (for example ``npm run
        test:e2e``) still execute code supplied by that project, so callers should
        only import projects they trust.
        """
        try:
            parts = self._parse_allowed_command(command)
            cwd = self._resolve_safe_path(working_directory)
            if not cwd.is_dir():
                raise NotADirectoryError(f"Working directory not found: {working_directory}")

            result = subprocess.run(
                parts,
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=max(1, min(timeout, 180)),
                env=self._command_environment(),
            )
            return {
                "success": result.returncode == 0,
                "exit_code": result.returncode,
                "stdout": self._truncate_output(result.stdout),
                "stderr": self._truncate_output(result.stderr),
                "command": command,
                "working_directory": working_directory,
            }
        except subprocess.TimeoutExpired as error:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": self._truncate_output(error.stdout or ""),
                "stderr": self._truncate_output(error.stderr or "") + f"\nCommand timed out after {timeout} seconds.",
                "command": command,
                "error": f"Command timed out after {timeout} seconds.",
            }
        except Exception as error:
            return {
                "success": False,
                "exit_code": 1,
                "stdout": "",
                "stderr": str(error),
                "command": command,
                "error": str(error),
            }

    def write_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Write or update a file inside the sandbox."""
        try:
            target = self._resolve_safe_path(file_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            return {
                "success": True,
                "file_path": file_path,
                "bytes_written": len(content.encode("utf-8")),
                "message": f"Successfully wrote {len(content)} characters to {file_path}"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def read_file(self, file_path: str) -> Dict[str, Any]:
        """Read content of a file inside the sandbox."""
        try:
            target = self._resolve_safe_path(file_path)
            if not target.exists():
                return {"success": False, "error": f"File not found: {file_path}"}
            content = target.read_text(encoding="utf-8")
            return {
                "success": True,
                "file_path": file_path,
                "content": content,
                "lines": len(content.splitlines())
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_dir(self, sub_path: str = ".") -> Dict[str, Any]:
        """List contents of a directory inside the sandbox."""
        try:
            target = self._resolve_safe_path(sub_path)
            if not target.exists():
                return {"success": False, "error": f"Directory not found: {sub_path}"}
            
            items = []
            for item in sorted(target.iterdir()):
                rel = item.relative_to(self.workspace_dir)
                items.append({
                    "name": item.name,
                    "path": str(rel),
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else 0
                })
            return {"success": True, "path": sub_path, "items": items}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def search_code(self, query: str) -> Dict[str, Any]:
        """Search for a string pattern across files in the sandbox."""
        matches = []
        try:
            pattern = re.compile(query, re.IGNORECASE)
            for file_path in self.workspace_dir.rglob("*"):
                if file_path.is_file() and not file_path.name.startswith("."):
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="ignore")
                        for idx, line in enumerate(content.splitlines(), start=1):
                            if pattern.search(line):
                                rel = file_path.relative_to(self.workspace_dir)
                                matches.append({
                                    "file": str(rel),
                                    "line": idx,
                                    "content": line.strip()
                                })
                    except Exception:
                        continue
            return {"success": True, "query": query, "matches": matches, "total_matches": len(matches)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def run_python_script(self, script_path: str, args: List[str] = None, timeout: int = 10) -> Dict[str, Any]:
        """
        Execute a Python script inside the sandbox in an isolated subprocess.
        Captures stdout, stderr, exit code, execution time, and error tracebacks.
        """
        if args is None:
            args = []
        try:
            target = self._resolve_safe_path(script_path)
            if not target.exists():
                return {
                    "success": False,
                    "exit_code": 1,
                    "stdout": "",
                    "stderr": f"File not found: {script_path}",
                    "error": f"Target script does not exist: {script_path}"
                }

            cmd = [sys.executable, str(target)] + args
            res = subprocess.run(
                cmd,
                cwd=str(self.workspace_dir),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=self._command_environment()
            )

            is_clean = res.returncode == 0
            return {
                "success": is_clean,
                "exit_code": res.returncode,
                "stdout": res.stdout,
                "stderr": res.stderr,
                "has_traceback": "Traceback (most recent call last):" in res.stderr or "Error" in res.stderr
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Execution timed out after {timeout} seconds.",
                "has_traceback": False,
                "error": f"Execution timed out after {timeout}s"
            }
        except Exception as e:
            return {
                "success": False,
                "exit_code": 1,
                "stdout": "",
                "stderr": str(e),
                "has_traceback": False,
                "error": str(e)
            }

    def run_pytest(self, test_path: Optional[str] = None, timeout: int = 15) -> Dict[str, Any]:
        """
        Execute pytest inside the sandbox workspace.
        """
        try:
            cmd = [sys.executable, "-m", "pytest", "-v"]
            if test_path:
                target = self._resolve_safe_path(test_path)
                cmd.append(str(target))
            else:
                cmd.append(str(self.workspace_dir))

            res = subprocess.run(
                cmd,
                cwd=str(self.workspace_dir),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=self._command_environment()
            )

            is_clean = res.returncode == 0
            return {
                "success": is_clean,
                "exit_code": res.returncode,
                "stdout": res.stdout,
                "stderr": res.stderr,
                "passed": "passed" in res.stdout,
                "failed": "failed" in res.stdout or "ERROR" in res.stdout
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Pytest execution timed out after {timeout} seconds.",
                "passed": False,
                "failed": True
            }
        except Exception as e:
            return {
                "success": False,
                "exit_code": 1,
                "stdout": "",
                "stderr": str(e),
                "passed": False,
                "failed": True
            }

    def cleanup(self):
        if hasattr(self, "temp_dir") and self.temp_dir:
            self.temp_dir.cleanup()
