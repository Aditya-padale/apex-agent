import os
import sys
import subprocess
import shutil
import tempfile
import pathlib
import re
import shlex
import resource
import signal
import logging
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# IMPORTANT — honest security disclaimer
# ---------------------------------------------------------------------------
# Subprocess isolation here is NOT a security boundary. It mitigates accidental
# damage (runaway processes, disk fills) but will not stop a determined attacker.
# For untrusted code, use a container, VM, or service like gVisor / Firecracker.
# ---------------------------------------------------------------------------

# Allowed command entry points. Commands are parsed with shlex and executed
# with shell=False, preventing shell pipes, redirects, and chaining.
ALLOWED_COMMANDS = {
    "python", "python3", "pip", "pip3", "pytest", "node", "npm", "npx", "pnpm", "yarn", "bun", "deno",
    "go", "cargo", "java", "javac", "kotlinc", "kotlin", "dotnet", "php", "ruby", "rspec",
    "mvn", "gradle", "gcc", "g++", "clang", "clang++", "make", "cmake", "ctest", "swift", "Rscript", "julia",
}
MAX_COMMAND_LENGTH = 800
MAX_PROCESS_OUTPUT = 60_000

# Dynamic environment checks
def is_code_execution_allowed() -> bool:
    return os.environ.get("ALLOW_CODE_EXECUTION", "false").lower() in ("true", "1", "yes")

def is_package_install_allowed() -> bool:
    return os.environ.get("ALLOW_PACKAGE_INSTALL", "false").lower() in ("true", "1", "yes")

# Environment flags (for backwards compatibility)
ALLOW_CODE_EXECUTION = is_code_execution_allowed()
ALLOW_PACKAGE_INSTALL = is_package_install_allowed()

# POSIX resource limits for child processes
_RLIMIT_CPU = 120                  # CPU seconds
_RLIMIT_AS = 512 * 1024 * 1024     # 512 MB virtual memory
_RLIMIT_NPROC = 64                 # max child processes
_RLIMIT_FSIZE = 50 * 1024 * 1024   # 50 MB max file size
_RLIMIT_NOFILE = 256               # max open file descriptors

# Flags that execute inline code
_INLINE_CODE_FLAGS = {"-c", "-e", "-p", "--print", "--eval"}

# Regex for combined short flags like -Sc, -ce, -ic
_COMBINED_SHORT_FLAG_RE = re.compile(r"^-[A-Za-z]*[cepm][A-Za-z0-9]*$")

# Python modules that start network servers
_HTTP_SERVER_RE = re.compile(r"^(http\.server|SimpleHTTPServer|socketserver)$")

# Package installation subcommands
_INSTALL_SUBCOMMANDS = {"install", "add", "i"}


def _probe_isolation() -> Tuple[Optional[str], Optional[str]]:
    """Probe if bwrap or unshare is present AND functional in this environment."""
    bwrap = shutil.which("bwrap")
    unshare = shutil.which("unshare")

    functional_bwrap: Optional[str] = None
    functional_unshare: Optional[str] = None

    if bwrap:
        try:
            with tempfile.TemporaryDirectory(prefix="apex_probe_") as probe_dir:
                r = subprocess.run(
                    [bwrap, "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
                     "--tmpfs", "/tmp", "--bind", probe_dir, probe_dir,
                     "--unshare-net", "--unshare-pid", "--die-with-parent",
                     "--chdir", probe_dir, "--", "true"],
                    capture_output=True,
                    timeout=2,
                )
                if r.returncode == 0:
                    functional_bwrap = bwrap
                else:
                    logger.info("bwrap on PATH but not functional in this environment: %s", r.stderr.decode(errors="ignore").strip())
        except Exception as e:
            logger.info("bwrap probe failed: %s", e)

    if unshare and not functional_bwrap:
        try:
            r = subprocess.run(
                [unshare, "--net", "--pid", "--fork", "--mount-proc", "--", "true"],
                capture_output=True,
                timeout=2,
            )
            if r.returncode == 0:
                functional_unshare = unshare
            else:
                logger.info("unshare on PATH but not functional in this environment: %s", r.stderr.decode(errors="ignore").strip())
        except Exception as e:
            logger.info("unshare probe failed: %s", e)

    return functional_bwrap, functional_unshare


_FUNCTIONAL_BWRAP, _FUNCTIONAL_UNSHARE = _probe_isolation()
_ISOLATION_WARNING_LOGGED = False


def _log_isolation_warning_once():
    global _ISOLATION_WARNING_LOGGED
    if not _ISOLATION_WARNING_LOGGED:
        if not _FUNCTIONAL_BWRAP and not _FUNCTIONAL_UNSHARE:
            logger.warning(
                "Neither bwrap nor unshare is functional on this system. "
                "Sandbox isolation is degraded: child processes share host filesystem and network."
            )
        _ISOLATION_WARNING_LOGGED = True


def _set_resource_limits():
    """preexec_fn: set POSIX resource limits on the child process."""
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (_RLIMIT_CPU, _RLIMIT_CPU))
        resource.setrlimit(resource.RLIMIT_AS, (_RLIMIT_AS, _RLIMIT_AS))
        resource.setrlimit(resource.RLIMIT_NPROC, (_RLIMIT_NPROC, _RLIMIT_NPROC))
        resource.setrlimit(resource.RLIMIT_FSIZE, (_RLIMIT_FSIZE, _RLIMIT_FSIZE))
        resource.setrlimit(resource.RLIMIT_NOFILE, (_RLIMIT_NOFILE, _RLIMIT_NOFILE))
    except (ValueError, OSError):
        pass


class SandboxEnvironment:
    """
    Subprocess execution sandbox for the agentic code runner.

    SECURITY NOTICE: This is NOT a secure container. It applies resource limits
    and command allowlisting, but does not provide hardware or OS-level virtualization.
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
        _log_isolation_warning_once()

    def _resolve_safe_path(self, relative_path: str) -> pathlib.Path:
        """Ensure path is within the workspace sandbox directory.

        Rejects path traversal and symlinks that point outside the workspace.
        """
        raw_target = self.workspace_dir / relative_path
        target = raw_target.resolve()

        try:
            target.relative_to(self.workspace_dir)
        except ValueError:
            raise PermissionError(f"Access denied: Path '{relative_path}' escapes sandbox boundary.")

        # Check for symlink escaping sandbox boundary
        if raw_target.is_symlink():
            link_dest = raw_target.resolve()
            try:
                link_dest.relative_to(self.workspace_dir)
            except ValueError:
                raise PermissionError(f"Access denied: Symlink '{relative_path}' points outside sandbox boundary.")

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

        # Check each argument for blocked flags and patterns
        for arg in parts[1:]:
            if arg in _INLINE_CODE_FLAGS:
                raise PermissionError(
                    f"Inline code execution flag '{arg}' is not allowed. Put the code in a workspace file instead."
                )
            if arg.startswith("-") and not arg.startswith("--") and len(arg) > 2:
                if _COMBINED_SHORT_FLAG_RE.match(arg):
                    raise PermissionError(
                        f"Combined flag '{arg}' contains an inline code execution option. Put the code in a workspace file instead."
                    )

        # Check for network servers: -m http.server
        if "-m" in parts:
            m_idx = parts.index("-m")
            if m_idx + 1 < len(parts) and _HTTP_SERVER_RE.match(parts[m_idx + 1]):
                raise PermissionError(f"Network server module '{parts[m_idx + 1]}' is not allowed in the sandbox.")

        # Check for package installs
        allow_install = os.environ.get("ALLOW_PACKAGE_INSTALL", "false").lower() in ("true", "1", "yes")
        if not allow_install:
            if executable in {"pip", "pip3", "npm", "npx", "pnpm", "yarn", "bun"}:
                for arg in parts[1:]:
                    if arg in _INSTALL_SUBCOMMANDS:
                        raise PermissionError(
                            f"Package installation ('{executable} {arg}') is blocked. Set ALLOW_PACKAGE_INSTALL=true to enable."
                        )

        return parts

    def _wrap_with_isolation(self, parts: List[str], cwd: str) -> List[str]:
        """Wrap command with bwrap or unshare if functional."""
        if _FUNCTIONAL_BWRAP:
            return [
                _FUNCTIONAL_BWRAP,
                "--ro-bind", "/", "/",
                "--dev", "/dev",
                "--proc", "/proc",
                "--tmpfs", "/tmp",
                "--bind", str(self.workspace_dir), str(self.workspace_dir),
                "--unshare-net",
                "--unshare-pid",
                "--die-with-parent",
                "--chdir", cwd,
                "--",
            ] + parts
        elif _FUNCTIONAL_UNSHARE:
            return [
                _FUNCTIONAL_UNSHARE,
                "--net",
                "--pid",
                "--fork",
                "--mount-proc",
                "--",
            ] + parts
        return parts

    def _run_subprocess(
        self,
        parts: List[str],
        cwd: str,
        timeout: int,
        env: Dict[str, str],
    ) -> subprocess.CompletedProcess:
        """Run subprocess with process group isolation, resource limits, and timeout kill."""
        wrapped = self._wrap_with_isolation(parts, cwd)
        proc = subprocess.Popen(
            wrapped,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            start_new_session=True,
            preexec_fn=_set_resource_limits,
        )
        try:
            stdout, stderr = proc.communicate(timeout=max(1, min(timeout, 180)))
            return subprocess.CompletedProcess(proc.args, proc.returncode, stdout, stderr)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                pass
            stdout, stderr = proc.communicate()
            raise subprocess.TimeoutExpired(proc.args, timeout, output=stdout, stderr=stderr)

    def run_command(
        self,
        command: str,
        working_directory: str = ".",
        timeout: int = 60,
    ) -> Dict[str, Any]:
        """Run a supported test, build, or lint command in the temporary workspace."""
        parts = self._parse_allowed_command(command)
        cwd = self._resolve_safe_path(working_directory)
        if not cwd.is_dir():
            raise NotADirectoryError(f"Working directory not found: {working_directory}")

        try:
            result = self._run_subprocess(
                parts, str(cwd), timeout, self._command_environment()
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
        target = self._resolve_safe_path(file_path)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.is_symlink():
                link_dest = target.resolve()
                try:
                    link_dest.relative_to(self.workspace_dir)
                except ValueError:
                    raise PermissionError(f"Access denied: Symlink '{file_path}' points outside sandbox boundary.")
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
        target = self._resolve_safe_path(file_path)
        try:
            if not target.exists():
                return {"success": False, "error": f"File not found: {file_path}"}
            if target.is_symlink():
                link_dest = target.resolve()
                try:
                    link_dest.relative_to(self.workspace_dir)
                except ValueError:
                    raise PermissionError(f"Access denied: Symlink '{file_path}' points outside sandbox boundary.")
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
        """Execute a Python script inside the sandbox in an isolated subprocess."""
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
            result = self._run_subprocess(
                cmd, str(self.workspace_dir), timeout, self._command_environment()
            )

            is_clean = result.returncode == 0
            return {
                "success": is_clean,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "has_traceback": "Traceback (most recent call last):" in result.stderr,
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
        """Execute pytest inside the sandbox workspace."""
        try:
            cmd = [sys.executable, "-m", "pytest", "-v"]
            if test_path:
                target = self._resolve_safe_path(test_path)
                cmd.append(str(target))
            else:
                cmd.append(str(self.workspace_dir))

            result = self._run_subprocess(
                cmd, str(self.workspace_dir), timeout, self._command_environment()
            )

            is_clean = result.returncode == 0
            return {
                "success": is_clean,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "passed": "passed" in result.stdout,
                "failed": "failed" in result.stdout or "ERROR" in result.stdout
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
