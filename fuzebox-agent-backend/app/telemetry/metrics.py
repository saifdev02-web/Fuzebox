"""Metric calculations from telemetry rows — AUoP, RoP, ratio shift."""


def completion_rate(rows: list[dict]) -> float:
    """Fraction of rows with completion_status == 'success'."""
    if not rows:
        return 0.0
    success = sum(1 for r in rows if r["completion_status"] == "success")
    return round(success / len(rows), 4)


def accuracy(rows: list[dict]) -> float:
    """Average accuracy_score (excluding nulls)."""
    scores = [r["accuracy_score"] for r in rows if r.get("accuracy_score") is not None]
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)


def escalation_rate(rows: list[dict]) -> float:
    """Fraction of rows with escalation_flag == True."""
    if not rows:
        return 0.0
    escalated = sum(1 for r in rows if r.get("escalation_flag"))
    return round(escalated / len(rows), 4)


def avg_task_time(rows: list[dict]) -> float:
    """Average latency in seconds."""
    latencies = [r["latency_ms"] for r in rows if r.get("latency_ms") is not None]
    if not latencies:
        return 0.0
    return round(sum(latencies) / len(latencies) / 1000, 2)


def auop_score(rows: list[dict]) -> float:
    """Composite AUoP score (0–1) per architecture doc formula."""
    cr = completion_rate(rows)
    acc = accuracy(rows)
    esc = escalation_rate(rows)

    latencies = [r["latency_ms"] for r in rows if r.get("latency_ms") is not None]
    avg_latency = sum(latencies) / len(latencies) if latencies else 30000
    speed_score = max(0.0, 1 - avg_latency / 30000)

    costs = [r["cost_usd"] for r in rows if r.get("cost_usd") is not None]
    avg_cost = sum(costs) / len(costs) if costs else 1.0
    cost_efficiency = max(0.0, 1 - avg_cost / 1.0)

    auop = (
        0.35 * cr
        + 0.25 * acc
        + 0.20 * (1 - esc)
        + 0.10 * speed_score
        + 0.10 * cost_efficiency
    )
    return round(auop, 4)


def human_to_agent_ratio(rows: list[dict]) -> dict:
    """Calculate human-to-agent ratio from telemetry rows."""
    cr = completion_rate(rows)
    esc = escalation_rate(rows)
    total = len(rows)

    tasks_by_agents = total * cr * (1 - esc)
    tasks_by_humans = total - tasks_by_agents

    if tasks_by_agents > 0:
        ratio = tasks_by_humans / tasks_by_agents
    else:
        ratio = float("inf")

    return {
        "total_tasks": total,
        "tasks_handled_by_agents": round(tasks_by_agents, 1),
        "tasks_requiring_humans": round(tasks_by_humans, 1),
        "ratio": round(ratio, 2),
        "ratio_display": f"1:{round(1 / ratio, 1)}" if ratio > 0 else "N/A",
    }


def rop(rows: list[dict], manual_cost_per_task: float = 50.0) -> dict:
    """Return on Potential calculation."""
    cr = completion_rate(rows)
    esc = escalation_rate(rows)
    total = len(rows)

    tasks_by_agents = total * cr * (1 - esc)
    agent_cost = sum(r.get("cost_usd", 0) for r in rows)
    manual_equivalent = tasks_by_agents * manual_cost_per_task
    savings = manual_equivalent - agent_cost

    rop_pct = (savings / agent_cost * 100) if agent_cost > 0 else 0

    return {
        "agent_cost": round(agent_cost, 2),
        "manual_equivalent": round(manual_equivalent, 2),
        "savings": round(savings, 2),
        "rop_pct": round(rop_pct, 1),
    }


def compute_delta(v1_rows: list[dict], v2_rows: list[dict]) -> dict:
    """Compute V1 vs V2 metric deltas."""
    v1 = {
        "completion_rate": completion_rate(v1_rows),
        "accuracy": accuracy(v1_rows),
        "escalation_rate": escalation_rate(v1_rows),
        "avg_task_time": avg_task_time(v1_rows),
        "auop": auop_score(v1_rows),
    }
    v2 = {
        "completion_rate": completion_rate(v2_rows),
        "accuracy": accuracy(v2_rows),
        "escalation_rate": escalation_rate(v2_rows),
        "avg_task_time": avg_task_time(v2_rows),
        "auop": auop_score(v2_rows),
    }
    delta = {}
    for key in v1:
        diff = v2[key] - v1[key]
        # For escalation_rate and avg_task_time, negative is better
        if key in ("escalation_rate", "avg_task_time"):
            improved = diff < 0
        else:
            improved = diff > 0
        delta[key] = {
            "v1": v1[key],
            "v2": v2[key],
            "delta": round(diff, 4),
            "improved": improved,
        }

    v1_ratio = human_to_agent_ratio(v1_rows)
    v2_ratio = human_to_agent_ratio(v2_rows)
    delta["ratio_shift"] = {
        "v1": v1_ratio,
        "v2": v2_ratio,
    }

    v1_rop = rop(v1_rows)
    v2_rop = rop(v2_rows)
    delta["rop"] = {
        "v1": v1_rop,
        "v2": v2_rop,
        "delta": round(v2_rop["rop_pct"] - v1_rop["rop_pct"], 1),
    }

    return delta
