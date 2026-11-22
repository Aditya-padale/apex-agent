import pytest
from backend.sandbox.runner import SandboxEnvironment


def test_command_allowlist():
    sandbox = SandboxEnvironment()
    try:
        # Valid commands shouldn't raise on parsing
        parts = sandbox._parse_allowed_command("python test.py")
        assert parts == ["python", "test.py"]

        parts = sandbox._parse_allowed_command("pytest -v")
        assert parts == ["pytest", "-v"]

        parts = sandbox._parse_allowed_command("node app.js")
        assert parts == ["node", "app.js"]

        parts = sandbox._parse_allowed_command("cargo test")
        assert parts == ["cargo", "test"]

        parts = sandbox._parse_allowed_command("go test ./...")
        assert parts == ["go", "test", "./..."]
    finally:
        sandbox.cleanup()


def test_command_blocklist_disallowed_executables():
    sandbox = SandboxEnvironment()
    try:
        disallowed = ["bash script.sh", "sh run.sh", "curl http://example.com", "wget http://example.com", "cat file.txt", "rm -rf /"]
        for cmd in disallowed:
            with pytest.raises(PermissionError) as exc:
                sandbox._parse_allowed_command(cmd)
            assert "not an allowed workspace command" in str(exc.value)
    finally:
        sandbox.cleanup()


def test_command_blocklist_inline_code():
    sandbox = SandboxEnvironment()
    try:
        inline_cmds = [
            "python -c 'print(1)'",
            "python3 -c 'import os'",
            "node -e 'console.log(1)'",
            "node --eval 'console.log(1)'",
            "python -p 'test'",
            "node -p 'process.version'",
            "node --print '1+1'",
        ]
        for cmd in inline_cmds:
            with pytest.raises(PermissionError) as exc:
                sandbox._parse_allowed_command(cmd)
            assert "inline code execution" in str(exc.value).lower()
    finally:
        sandbox.cleanup()


def test_command_blocklist_combined_short_flags():
    sandbox = SandboxEnvironment()
    try:
        combined_cmds = [
            "python3 -Sc 'print(1)'",
            "python -ic 'print(1)'",
            "node -pe '1+1'",
        ]
        for cmd in combined_cmds:
            with pytest.raises(PermissionError) as exc:
                sandbox._parse_allowed_command(cmd)
            assert "inline code execution" in str(exc.value).lower()
    finally:
        sandbox.cleanup()


def test_command_blocklist_network_servers():
    sandbox = SandboxEnvironment()
    try:
        with pytest.raises(PermissionError) as exc:
            sandbox._parse_allowed_command("python -m http.server 8080")
        assert "network server" in str(exc.value).lower()

        with pytest.raises(PermissionError) as exc:
            sandbox._parse_allowed_command("python3 -m SimpleHTTPServer 8000")
        assert "network server" in str(exc.value).lower()
    finally:
        sandbox.cleanup()


def test_command_blocklist_package_install():
    sandbox = SandboxEnvironment()
    try:
        install_cmds = [
            "pip install requests",
            "pip3 install pytest",
            "npm install express",
            "npm i lodash",
            "npm add react",
            "yarn add axios",
            "pnpm add vue",
        ]
        for cmd in install_cmds:
            with pytest.raises(PermissionError) as exc:
                sandbox._parse_allowed_command(cmd)
            assert "package installation" in str(exc.value).lower()
    finally:
        sandbox.cleanup()


def test_command_empty_and_oversized():
    sandbox = SandboxEnvironment()
    try:
        with pytest.raises(ValueError):
            sandbox._parse_allowed_command("")

        with pytest.raises(ValueError):
            sandbox._parse_allowed_command("   ")

        with pytest.raises(ValueError) as exc:
            sandbox._parse_allowed_command("python " + "a" * 850)
        assert "limited to" in str(exc.value).lower()
    finally:
        sandbox.cleanup()
