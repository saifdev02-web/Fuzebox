/**
 * Performance metrics — mirrors metrics.py exactly.
 */

function filterTasks(tasks, { agentId, startDate, endDate } = {}) {
  let filtered = tasks;
  if (agentId) filtered = filtered.filter((t) => t.agent_id === agentId);
  if (startDate) filtered = filtered.filter((t) => new Date(t.started_at) >= startDate);
  if (endDate) filtered = filtered.filter((t) => new Date(t.started_at) <= endDate);
  return filtered;
}

function filterWorkflows(workflows, { startDate, endDate } = {}) {
  let filtered = workflows;
  if (startDate) filtered = filtered.filter((w) => new Date(w.started_at) >= startDate);
  if (endDate) filtered = filtered.filter((w) => new Date(w.started_at) <= endDate);
  return filtered;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export function performanceSummary(data, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return { total_tasks: 0 };

  const total = tasks.length;
  const success = tasks.filter((t) => t.result === 'success').length;
  const totalCost = tasks.reduce((s, t) => s + t.cost_usd, 0);
  const latencies = tasks.filter((t) => t.latency_ms != null).map((t) => t.latency_ms);
  const qualities = tasks.filter((t) => t.quality_score != null).map((t) => t.quality_score);
  const workflows = filterWorkflows(data.workflows, { startDate, endDate });
  const wfSuccess = workflows.filter((w) => w.result === 'success').length;

  return {
    total_tasks: total,
    successful_tasks: success,
    success_rate: total > 0 ? Math.round((success / total) * 10000) / 10000 : 0,
    total_cost: Math.round(totalCost * 100) / 100,
    avg_cost_per_task: total > 0 ? Math.round((totalCost / total) * 10000) / 10000 : 0,
    avg_latency_ms: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 10) / 10 : 0,
    p90_latency_ms: latencies.length ? Math.round(percentile(latencies, 90) * 10) / 10 : 0,
    avg_quality: qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length * 1000) / 1000 : 0,
    total_workflows: workflows.length,
    workflow_success_rate: workflows.length ? Math.round((wfSuccess / workflows.length) * 10000) / 10000 : 0,
    active_agents: new Set(tasks.map((t) => t.agent_id)).size,
  };
}

export function completionRates(data, startDate, endDate) {
  const rows = [];
  for (const agent of data.agents) {
    const tasks = filterTasks(data.tasks, { agentId: agent.agent_id, startDate, endDate });
    if (!tasks.length) continue;
    const total = tasks.length;
    const success = tasks.filter((t) => t.result === 'success').length;
    rows.push({
      Agent: agent.name, Group: agent.group,
      'Total Tasks': total, Successful: success,
      'Completion Rate': Math.round((success / total) * 10000) / 10000,
    });
  }
  return rows;
}

export function accuracyByType(data, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return [];

  const byType = {};
  for (const t of tasks) {
    if (!byType[t.task_type]) byType[t.task_type] = { total: 0, success: 0, qualities: [] };
    byType[t.task_type].total++;
    if (t.result === 'success') byType[t.task_type].success++;
    if (t.quality_score != null) byType[t.task_type].qualities.push(t.quality_score);
  }

  return Object.entries(byType)
    .map(([type, d]) => ({
      'Task Type': type,
      Total: d.total,
      Success: d.success,
      'Success Rate': d.total > 0 ? Math.round((d.success / d.total) * 10000) / 10000 : 0,
      'Avg Quality': d.qualities.length ? Math.round(d.qualities.reduce((a, b) => a + b, 0) / d.qualities.length * 10000) / 10000 : 0,
    }))
    .sort((a, b) => b['Success Rate'] - a['Success Rate']);
}

export function latencyStats(data, { agentId, startDate, endDate } = {}) {
  const tasks = filterTasks(data.tasks, { agentId, startDate, endDate });
  const latencies = tasks.filter((t) => t.latency_ms != null).map((t) => t.latency_ms);
  if (!latencies.length) return null;

  return {
    count: latencies.length,
    mean_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 10) / 10,
    p50_ms: Math.round(percentile(latencies, 50) * 10) / 10,
    p90_ms: Math.round(percentile(latencies, 90) * 10) / 10,
    p95_ms: Math.round(percentile(latencies, 95) * 10) / 10,
    p99_ms: Math.round(percentile(latencies, 99) * 10) / 10,
    min_ms: Math.round(Math.min(...latencies) * 10) / 10,
    max_ms: Math.round(Math.max(...latencies) * 10) / 10,
  };
}

export function latencyByAgent(data, startDate, endDate) {
  const rows = [];
  for (const agent of data.agents) {
    const stats = latencyStats(data, { agentId: agent.agent_id, startDate, endDate });
    if (stats) {
      rows.push({
        Agent: agent.name,
        'Mean (ms)': stats.mean_ms,
        'P50 (ms)': stats.p50_ms,
        'P90 (ms)': stats.p90_ms,
        'P99 (ms)': stats.p99_ms,
        Tasks: stats.count,
      });
    }
  }
  return rows;
}

export function throughputTimeSeries(data, { agentId, startDate, endDate, granularity = 'day' } = {}) {
  const tasks = filterTasks(data.tasks, { agentId, startDate, endDate });
  if (!tasks.length) return [];

  const buckets = {};
  for (const t of tasks) {
    const d = new Date(t.started_at);
    let key;
    if (granularity === 'hour') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    } else if (granularity === 'week') {
      const dayOfWeek = d.getDay();
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - dayOfWeek);
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = d.toISOString().split('T')[0];
    }
    if (!buckets[key]) buckets[key] = { count: 0, success: 0, latencies: [] };
    buckets[key].count++;
    if (t.result === 'success') buckets[key].success++;
    if (t.latency_ms != null) buckets[key].latencies.push(t.latency_ms);
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      task_count: d.count,
      success_count: d.success,
      success_rate: d.count > 0 ? Math.round((d.success / d.count) * 10000) / 10000 : 0,
      avg_latency: d.latencies.length ? Math.round(d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length) : 0,
    }));
}

export function agentLeaderboard(data, startDate, endDate) {
  const rows = [];
  for (const agent of data.agents) {
    const tasks = filterTasks(data.tasks, { agentId: agent.agent_id, startDate, endDate });
    if (!tasks.length) continue;

    const total = tasks.length;
    const success = tasks.filter((t) => t.result === 'success').length;
    const successRate = success / total;
    const latencies = tasks.filter((t) => t.latency_ms != null).map((t) => t.latency_ms);
    const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 30000;
    const qualities = tasks.filter((t) => t.quality_score != null).map((t) => t.quality_score);
    const avgQuality = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0;
    const totalCost = tasks.reduce((s, t) => s + t.cost_usd, 0);
    const costPerSuccess = success > 0 ? totalCost / success : totalCost;

    const speedScore = Math.max(0, 1 - avgLatency / 30000);
    const efficiencyScore = Math.max(0, 1 - costPerSuccess / 1.0);
    const composite = 0.4 * successRate + 0.3 * avgQuality + 0.2 * speedScore + 0.1 * efficiencyScore;

    rows.push({
      Agent: agent.name, Group: agent.group, Model: agent.model_name,
      Tasks: total,
      'Success Rate': Math.round(successRate * 1000) / 1000,
      'Avg Quality': Math.round(avgQuality * 1000) / 1000,
      'Avg Latency (ms)': Math.round(avgLatency),
      'Total Cost ($)': Math.round(totalCost * 10000) / 10000,
      Score: Math.round(composite * 1000) / 1000,
    });
  }

  return rows.sort((a, b) => b.Score - a.Score);
}
