"""Unit tests for the evaluation system."""

import pytest

from app.evaluation.evaluator import (
    score_classification,
    score_triage,
    _fallback_draft_score,
)
from app.evaluation.ground_truth import load_ground_truth, load_test_inputs


class TestScoreClassification:
    def test_exact_match_high_confidence(self):
        output = {"classification": "access_auth", "confidence": 0.95}
        gt = {"classification": {"expected": "access_auth", "acceptable": ["access_auth"]}}
        score = score_classification(output, gt)
        assert score == 1.0

    def test_exact_match_low_confidence(self):
        output = {"classification": "access_auth", "confidence": 0.3}
        gt = {"classification": {"expected": "access_auth", "acceptable": ["access_auth"]}}
        score = score_classification(output, gt)
        assert 0.5 < score < 1.0

    def test_acceptable_match(self):
        output = {"classification": "technical_api", "confidence": 0.8}
        gt = {"classification": {"expected": "bug_report", "acceptable": ["bug_report", "technical_api"]}}
        score = score_classification(output, gt)
        assert score > 0.0

    def test_no_match(self):
        output = {"classification": "billing", "confidence": 0.9}
        gt = {"classification": {"expected": "access_auth", "acceptable": ["access_auth"]}}
        score = score_classification(output, gt)
        assert score < 0.5

    def test_array_classification(self):
        output = {"classification": ["access_auth", "billing"], "confidence": 0.85}
        gt = {"classification": {"expected": "access_auth", "acceptable": ["access_auth"]}}
        score = score_classification(output, gt)
        assert score > 0.7


class TestScoreTriage:
    def test_exact_match(self):
        output = {"priority": 4}
        gt = {"triage": {"expected_priority": 4, "acceptable_range": [3, 5]}}
        assert score_triage(output, gt) == 1.0

    def test_in_range(self):
        output = {"priority": 3}
        gt = {"triage": {"expected_priority": 4, "acceptable_range": [3, 5]}}
        assert score_triage(output, gt) == 0.7

    def test_off_by_one(self):
        output = {"priority": 2}
        gt = {"triage": {"expected_priority": 4, "acceptable_range": [3, 5]}}
        assert score_triage(output, gt) == 0.3

    def test_way_off(self):
        output = {"priority": 1}
        gt = {"triage": {"expected_priority": 5, "acceptable_range": [4, 5]}}
        assert score_triage(output, gt) == 0.0


class TestFallbackDraftScore:
    def test_all_keywords_present(self):
        gt = {
            "must_contain": ["password", "reset", "account"],
            "must_not_contain": [],
            "expected_tone": "empathetic",
            "max_words": 200,
        }
        draft = "We will help you reset your password for your account."
        result = _fallback_draft_score(draft, gt)
        assert result["keyword_present"] is True
        assert result["overall_score"] > 0.5

    def test_forbidden_keywords_present(self):
        gt = {
            "must_contain": ["password"],
            "must_not_contain": ["billing", "refund"],
            "expected_tone": "empathetic",
            "max_words": 200,
        }
        draft = "Your password has been reset. We will process a refund for the billing error."
        result = _fallback_draft_score(draft, gt)
        assert result["forbidden_absent"] is False

    def test_too_long_response(self):
        gt = {
            "must_contain": [],
            "must_not_contain": [],
            "expected_tone": "professional",
            "max_words": 10,
        }
        draft = " ".join(["word"] * 50)
        result = _fallback_draft_score(draft, gt)
        assert result["brevity_score"] < 1.0


class TestGroundTruth:
    def test_load_ground_truth(self):
        gt = load_ground_truth()
        assert "REQ-001" in gt
        assert "REQ-010" in gt
        assert "classification" in gt["REQ-001"]

    def test_load_test_inputs(self):
        inputs = load_test_inputs()
        assert len(inputs) >= 10
        assert inputs[0]["id"] == "REQ-001"
        assert "input_text" in inputs[0]
