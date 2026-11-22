import os
import pytest
from backend.sandbox.runner import SandboxEnvironment


def test_sandbox_security_inline_code_python_c():
    sandbox = SandboxEnvironment()
    try:
        with pytest.raises(PermissionError):
            sandbox.run_command("python -c 'print(1)'")
    finally:
        sandbox.cleanup()


def test_sandbox_security_inline_code_node_e():
    sandbox = SandboxEnvironment()
    try:
        with pytest.raises(PermissionError):
            sandbox.run_command("node -e 'console.log(1)'")
    finally:
        sandbox.cleanup()


def test_sandbox_security_combined_flag_python3_sc():
    sandbox = SandboxEnvironment()
    try:
        with pytest.raises(PermissionError):
            sandbox.run_command("python3 -Sc 'print(1)'")
    finally:
        sandbox.cleanup()


def test_sandbox_security_path_traversal():
    sandbox = SandboxEnvironment()
    try:
        with pytest.raises(PermissionError):
            sandbox._resolve_safe_path("../../etc/passwd")
    finally:
        sandbox.cleanup()


def test_sandbox_security_symlink_pointing_outside():
    sandbox = SandboxEnvironment()
    try:
        # Create a symlink inside the workspace pointing outside to /etc/passwd
        symlink_path = sandbox.workspace_dir / "external_link"
        os.symlink("/etc/passwd", symlink_path)

        with pytest.raises(PermissionError):
            sandbox._resolve_safe_path("external_link")

        with pytest.raises(PermissionError):
            sandbox.read_file("external_link")

        with pytest.raises(PermissionError):
            sandbox.write_file("external_link", "bad")
    finally:
        sandbox.cleanup()
