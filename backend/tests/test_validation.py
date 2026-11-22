import pytest
from fastapi import HTTPException
from backend.main import validate_workspace_files, MAX_WORKSPACE_FILES, MAX_FILE_BYTES, MAX_WORKSPACE_BYTES


def test_validate_empty_workspace():
    with pytest.raises(HTTPException) as exc:
        validate_workspace_files({})
    assert exc.value.status_code == 422
    assert "at least one" in exc.value.detail.lower()


def test_validate_path_traversal():
    with pytest.raises(HTTPException) as exc:
        validate_workspace_files({"../escaped.py": "print(1)"})
    assert exc.value.status_code == 422
    assert "invalid workspace file path" in exc.value.detail.lower()

    with pytest.raises(HTTPException) as exc:
        validate_workspace_files({"sub/../../escaped.py": "print(1)"})
    assert exc.value.status_code == 422


def test_validate_absolute_path():
    with pytest.raises(HTTPException) as exc:
        validate_workspace_files({"/etc/passwd": "root:x:0:0"})
    assert exc.value.status_code == 422
    assert "invalid workspace file path" in exc.value.detail.lower()


def test_validate_sensitive_file_rejection():
    sensitive_paths = [
        ".env",
        ".env.local",
        "sub/.env",
        "cert.pem",
        "secret.key",
        "client.p12",
        "cert.pfx",
    ]
    for path in sensitive_paths:
        with pytest.raises(HTTPException) as exc:
            validate_workspace_files({path: "secret_data"})
        assert exc.value.status_code == 422
        assert "sensitive file" in exc.value.detail.lower()


def test_validate_file_size_limit():
    large_content = "a" * (MAX_FILE_BYTES + 1)
    with pytest.raises(HTTPException) as exc:
        validate_workspace_files({"large.py": large_content})
    assert exc.value.status_code == 422
    assert "1 mb" in exc.value.detail.lower()


def test_validate_workspace_file_count_limit():
    too_many = {f"file_{i}.py": "x = 1" for i in range(MAX_WORKSPACE_FILES + 1)}
    with pytest.raises(HTTPException) as exc:
        validate_workspace_files(too_many)
    assert exc.value.status_code == 422
    assert "at most" in exc.value.detail.lower()


def test_validate_valid_workspace():
    files = {
        "main.py": "def main(): pass",
        "src/utils.py": "def helper(): return True",
        "tests/test_main.py": "def test_main(): assert True",
    }
    cleaned = validate_workspace_files(files)
    assert cleaned == files
