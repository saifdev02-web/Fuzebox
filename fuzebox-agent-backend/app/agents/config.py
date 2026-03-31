"""V1 default and V2 recommended tuning configs per agent."""

# V1 defaults — baseline, no tuning
V1_DEFAULTS = {
    "intake_classifier": {
        "prompt_precision": 40,
        "confidence_threshold": 0.5,
        "fallback_depth": 1,
        "data_prefetch": False,
        "sentiment_weight": 0.0,
        "tone_variant": "professional",
        "temperature": 0.0,
    },
    "triage_scorer": {
        "prompt_precision": 35,
        "confidence_threshold": 0.5,
        "fallback_depth": 1,
        "data_prefetch": False,
        "sentiment_weight": 0.0,
        "tone_variant": "professional",
        "temperature": 0.0,
    },
    "response_drafter": {
        "prompt_precision": 30,
        "confidence_threshold": 0.5,
        "fallback_depth": 1,
        "data_prefetch": False,
        "sentiment_weight": 0.0,
        "tone_variant": "professional",
        "temperature": 0.0,
    },
}

# V2 recommended presets — tuned
V2_PRESETS = {
    "intake_classifier": {
        "prompt_precision": 85,
        "confidence_threshold": 0.75,
        "fallback_depth": 3,
        "data_prefetch": False,
        "sentiment_weight": 0.0,
        "tone_variant": "professional",
        "temperature": 0.2,
    },
    "triage_scorer": {
        "prompt_precision": 75,
        "confidence_threshold": 0.65,
        "fallback_depth": 2,
        "data_prefetch": True,
        "sentiment_weight": 0.3,
        "tone_variant": "professional",
        "temperature": 0.2,
    },
    "response_drafter": {
        "prompt_precision": 80,
        "confidence_threshold": 0.6,
        "fallback_depth": 2,
        "data_prefetch": False,
        "sentiment_weight": 0.7,
        "tone_variant": "dynamic",
        "temperature": 0.3,
    },
}

AGENT_NAMES = {
    "intake_classifier": "Intake Classifier",
    "triage_scorer": "Triage Scorer",
    "response_drafter": "Response Drafter",
}

AGENT_TASK_TYPES = {
    "intake_classifier": "classification",
    "triage_scorer": "triage",
    "response_drafter": "response_draft",
}
