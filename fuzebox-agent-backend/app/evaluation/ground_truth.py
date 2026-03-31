"""Load and access ground truth labels for accuracy scoring."""

import json
from pathlib import Path
from typing import Any

_GROUND_TRUTH_PATH = Path(__file__).parent.parent.parent / "data" / "ground_truth.json"
_TEST_INPUTS_PATH = Path(__file__).parent.parent.parent / "data" / "test_inputs.json"

_ground_truth: dict[str, Any] | None = None
_test_inputs: list[dict] | None = None


def load_ground_truth() -> dict[str, Any]:
    """Load ground truth labels from disk (cached)."""
    global _ground_truth
    if _ground_truth is None:
        with open(_GROUND_TRUTH_PATH) as f:
            _ground_truth = json.load(f)
    return _ground_truth


def load_test_inputs() -> list[dict]:
    """Load test input service requests (cached)."""
    global _test_inputs
    if _test_inputs is None:
        with open(_TEST_INPUTS_PATH) as f:
            _test_inputs = json.load(f)
    return _test_inputs


def get_truth(request_id: str) -> dict | None:
    """Get ground truth for a specific test request."""
    gt = load_ground_truth()
    return gt.get(request_id)


def get_test_input(request_id: str) -> dict | None:
    """Get a specific test input by ID."""
    inputs = load_test_inputs()
    for inp in inputs:
        if inp["id"] == request_id:
            return inp
    return None
