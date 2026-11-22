export const WORKSPACE_PRESETS = [
  {
    id: 'python_tdd',
    label: 'Python TDD Bugfix',
    description: 'Unit test suite with failing edge cases in math_ops.py',
    projectName: 'Calculator TDD',
    goal: 'Fix the zero-division error handling and implement percentage calculation in math_ops.py so that all tests in test_math_ops.py pass.',
    validationCommand: 'python -m pytest test_math_ops.py -q',
    setupCommand: '',
    files: {
      'math_ops.py': `def add(a: float, b: float) -> float:
    return a + b

def subtract(a: float, b: float) -> float:
    return a - b

def multiply(a: float, b: float) -> float:
    return a * b

def divide(a: float, b: float) -> float:
    """Divide a by b. Raises ValueError if b is zero."""
    # BUG: currently raises raw ZeroDivisionError instead of ValueError
    return a / b

def percentage(value: float, total: float) -> float:
    """Calculate what percentage \`value\` is of \`total\`. Raises ValueError if total <= 0."""
    # TODO: implement percentage calculation
    raise NotImplementedError("percentage function is not implemented")
`,
      'test_math_ops.py': `import pytest
from math_ops import add, subtract, multiply, divide, percentage

def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0

def test_subtract():
    assert subtract(10, 4) == 6

def test_multiply():
    assert multiply(3, 5) == 15

def test_divide():
    assert divide(10, 2) == 5.0
    with pytest.raises(ValueError, match="Cannot divide by zero"):
        divide(5, 0)

def test_percentage():
    assert percentage(25, 100) == 25.0
    assert percentage(1, 4) == 25.0
    with pytest.raises(ValueError):
        percentage(10, 0)
`,
    },
  },
  {
    id: 'data_cleaner',
    label: 'Data Pipeline Sanitizer',
    description: 'Deduplication and email normalization pipeline',
    projectName: 'Data Sanitizer',
    goal: 'Fix duplicate removal preserving order and normalize emails with trimmed whitespace in sanitize.py so test_sanitize.py passes.',
    validationCommand: 'python -m pytest test_sanitize.py -q',
    setupCommand: '',
    files: {
      'sanitize.py': `from typing import List, Dict, Any

def normalize_email(email: str) -> str:
    """Strip whitespace and lowercase the email address."""
    if not email:
        return ""
    # BUG: fails to trim surrounding whitespace
    return email.lower()

def deduplicate_records(records: List[Dict[str, Any]], key: str) -> List[Dict[str, Any]]:
    """Deduplicate records by key, preserving the original list ordering."""
    seen = set()
    result = []
    for r in records:
        val = r.get(key)
        if val not in seen:
            seen.add(val)
            result.append(r)
    return result
`,
      'test_sanitize.py': `import pytest
from sanitize import normalize_email, deduplicate_records

def test_normalize_email():
    assert normalize_email("  User@Example.COM  ") == "user@example.com"
    assert normalize_email("") == ""

def test_deduplicate_records():
    data = [
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 1, "name": "Alice Duplicate"},
        {"id": 3, "name": "Charlie"},
    ]
    deduped = deduplicate_records(data, "id")
    assert [r["id"] for r in deduped] == [1, 2, 3]
    assert deduped[0]["name"] == "Alice"
`,
    },
  },
];
