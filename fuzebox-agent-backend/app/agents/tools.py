"""Tool functions for agent pipeline — data pre-fetch, customer context lookup."""

import random


# Simulated customer context database
_CUSTOMER_CONTEXTS = [
    {
        "account_tier": "enterprise",
        "open_tickets": 2,
        "sla_level": "premium",
        "customer_since": "2021-03-15",
        "monthly_spend": 4500,
    },
    {
        "account_tier": "professional",
        "open_tickets": 0,
        "sla_level": "standard",
        "customer_since": "2022-08-01",
        "monthly_spend": 299,
    },
    {
        "account_tier": "starter",
        "open_tickets": 1,
        "sla_level": "basic",
        "customer_since": "2024-01-10",
        "monthly_spend": 49,
    },
    {
        "account_tier": "enterprise",
        "open_tickets": 5,
        "sla_level": "premium",
        "customer_since": "2020-06-20",
        "monthly_spend": 12000,
    },
    {
        "account_tier": "professional",
        "open_tickets": 3,
        "sla_level": "standard",
        "customer_since": "2023-04-12",
        "monthly_spend": 799,
    },
]


def fetch_customer_context(input_text: str) -> dict:
    """Simulate fetching customer context for triage scoring.

    In production this would be a real DB/API lookup keyed by customer ID.
    For the demo, we deterministically select context based on input hash
    so the same input always gets the same context.
    """
    idx = hash(input_text) % len(_CUSTOMER_CONTEXTS)
    return _CUSTOMER_CONTEXTS[idx]
