from typing import Dict, Any, List

SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "scenario_1_binary_search",
        "title": "Buggy Binary Search Algorithm (IndexError & Edge Cases)",
        "category": "Algorithmic Debugging",
        "difficulty": "Easy",
        "description": "Fix an IndexError and off-by-one bug in binary_search.py that fails when searching empty lists or elements out of range. Run pytest to verify.",
        "initial_files": {
            "binary_search.py": '''def binary_search(arr, target):
    """
    Finds the index of target in sorted array arr.
    Returns -1 if target is not present.
    """
    low = 0
    high = len(arr)  # Bug 1: Should be len(arr) - 1
    
    while low <= high:
        mid = (low + high) // 2
        val = arr[mid]  # Bug 2: IndexError when arr is empty or mid out of bounds
        
        if val == target:
            return mid
        elif val < target:
            low = mid
            # Bug 3: Missing low = mid + 1 (infinite loop risk)
        else:
            high = mid
            # Bug 4: Missing high = mid - 1
            
    return -1
''',
            "test_binary_search.py": '''import pytest
from binary_search import binary_search

def test_binary_search_found():
    arr = [1, 3, 5, 7, 9, 11, 13]
    assert binary_search(arr, 7) == 3
    assert binary_search(arr, 1) == 0
    assert binary_search(arr, 13) == 6

def test_binary_search_not_found():
    arr = [1, 3, 5, 7, 9]
    assert binary_search(arr, 0) == -1
    assert binary_search(arr, 4) == -1
    assert binary_search(arr, 10) == -1

def test_binary_search_empty():
    assert binary_search([], 5) == -1

def test_binary_search_single_element():
    assert binary_search([5], 5) == 0
    assert binary_search([5], 2) == -1
'''
        }
    },
    {
        "id": "scenario_2_log_pipeline",
        "title": "Corrupted Log Parser Pipeline (TypeError Exception)",
        "category": "Data Pipeline Debugging",
        "difficulty": "Medium",
        "description": "The metrics aggregation pipeline in pipeline.py crashes with a TypeError when encountering null response times or malformed log lines. Inspect traceback, fix null-safety and parsing resilience, and make tests pass.",
        "initial_files": {
            "pipeline.py": '''import json
from typing import List, Dict, Any

def process_log_records(raw_logs: List[str]) -> Dict[str, Any]:
    """
    Parses JSON log lines, extracts response times, calculates total requests,
    average response time, and count of 5xx errors.
    """
    total_time = 0.0
    valid_count = 0
    errors_5xx = 0
    
    for raw in raw_logs:
        data = json.loads(raw)  # May raise json.JSONDecodeError on malformed text!
        status = data.get("status")
        duration = data["response_time_ms"]  # Throws KeyError or TypeError if None/missing
        
        if status >= 500:
            errors_5xx += 1
            
        total_time += duration  # Throws TypeError: unsupported operand type(s) for +: 'float' and 'NoneType'
        valid_count += 1
        
    avg_duration = total_time / valid_count  # Throws ZeroDivisionError if valid_count is 0
    
    return {
        "processed": valid_count,
        "avg_response_ms": round(avg_duration, 2),
        "server_errors": errors_5xx
    }
''',
            "test_pipeline.py": '''import pytest
from pipeline import process_log_records

def test_valid_logs():
    logs = [
        '{"status": 200, "response_time_ms": 120.5}',
        '{"status": 500, "response_time_ms": 450.0}',
        '{"status": 200, "response_time_ms": 80.0}'
    ]
    res = process_log_records(logs)
    assert res["processed"] == 3
    assert res["avg_response_ms"] == 216.83
    assert res["server_errors"] == 1

def test_corrupted_and_null_logs():
    logs = [
        '{"status": 200, "response_time_ms": 100.0}',
        '{"status": 200, "response_time_ms": null}',  # Null response time!
        'NOT_VALID_JSON_STRING',                     # Malformed log!
        '{"status": 503}'                             # Missing response_time_ms key!
    ]
    res = process_log_records(logs)
    assert res["processed"] == 1
    assert res["avg_response_ms"] == 100.0
    assert res["server_errors"] == 1  # status 503 count

def test_empty_logs():
    res = process_log_records([])
    assert res["processed"] == 0
    assert res["avg_response_ms"] == 0.0
    assert res["server_errors"] == 0
'''
        }
    },
    {
        "id": "scenario_3_exponential_backoff",
        "title": "Async HTTP Retry Engine with Backoff (Feature & Verification)",
        "category": "Feature Implementation",
        "difficulty": "Hard",
        "description": "Implement fetch_with_retry in http_client.py using exponential backoff (delay * 2^attempt) with a max_retries count and custom exception handling. Run test suite to verify correctness.",
        "initial_files": {
            "http_client.py": '''import time

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

    def fetch_with_retry(self, url: str, max_retries: int = 3, initial_delay: float = 0.1) -> Dict[str, Any]:
        """
        TODO: Implement retry logic with exponential backoff.
        If raw_fetch raises NetworkError, wait (initial_delay * (2 ** attempt)) and retry up to max_retries.
        If all retries fail, raise the final NetworkError.
        Returns dict: {"success": True, "attempts": total_attempts, "data": response_string}
        """
        # Unimplemented stub: immediately throws error on failure
        data = self.raw_fetch(url)
        return {"success": True, "attempts": self.attempts, "data": data}
''',
            "test_http_client.py": '''import pytest

from http_client import HttpClient, NetworkError

def test_successful_fetch_first_try():
    client = HttpClient(mock_failures=0)
    res = client.fetch_with_retry("https://api.example.com/data", max_retries=3, initial_delay=0.01)
    assert res["success"] is True
    assert res["attempts"] == 1

def test_successful_fetch_after_retries():
    client = HttpClient(mock_failures=2)
    res = client.fetch_with_retry("https://api.example.com/data", max_retries=3, initial_delay=0.01)
    assert res["success"] is True
    assert res["attempts"] == 3

def test_exceeded_max_retries():
    client = HttpClient(mock_failures=5)
    with pytest.raises(NetworkError):
        client.fetch_with_retry("https://api.example.com/data", max_retries=2, initial_delay=0.01)
'''
        }
    }
]

def get_scenario(scenario_id: str) -> Dict[str, Any]:
    for sc in SCENARIOS:
        if sc["id"] == scenario_id:
            return sc
    return SCENARIOS[0]
