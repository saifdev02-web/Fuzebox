/**
 * Economic analysis — mirrors economics.py exactly.
 */

function filterTasks(tasks, { startDate, endDate } = {}) {
  let filtered = tasks;
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

export function costPerAgent(data, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return [];

  const agentNames = {};
  data.agents.forEach((a) => { agentNames[a.agent_id] = a.name; });

  const buckets = {};
  for (const t of tasks) {
    if (!buckets[t.agent_id]) {
      buckets[t.agent_id] = { agent: agentNames[t.agent_id] || t.agent_id, total_cost: 0, task_count: 0, total_input_tokens: 0, total_output_tokens: 0 };
    }
    buckets[t.agent_id].total_cost += t.cost_usd;
    buckets[t.agent_id].task_count++;
    buckets[t.agent_id].total_input_tokens += t.input_tokens;
    buckets[t.agent_id].total_output_tokens += t.output_tokens;
  }

  return Object.values(buckets)
    .map((d) => ({
      Agent: d.agent,
      Tasks: d.task_count,
      'Total Cost ($)': Math.round(d.total_cost * 10000) / 10000,
      'Avg Cost/Task ($)': d.task_count > 0 ? Math.round((d.total_cost / d.task_count) * 10000) / 10000 : 0,
      'Input Tokens': d.total_input_tokens,
      'Output Tokens': d.total_output_tokens,
    }))
    .sort((a, b) => b['Total Cost ($)'] - a['Total Cost ($)']);
}

export function costPerTaskType(data, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return [];

  const buckets = {};
  for (const t of tasks) {
    if (!buckets[t.task_type]) buckets[t.task_type] = { costs: [], tokens: [], latencies: [] };
    buckets[t.task_type].costs.push(t.cost_usd);
    buckets[t.task_type].tokens.push(t.total_tokens);
    buckets[t.task_type].latencies.push(t.latency_ms || 0);
  }

  return Object.entries(buckets)
    .map(([type, d]) => ({
      'Task Type': type,
      Count: d.costs.length,
      'Total Cost ($)': Math.round(d.costs.reduce((a, b) => a + b, 0) * 10000) / 10000,
      'Avg Cost ($)': Math.round(d.costs.reduce((a, b) => a + b, 0) / d.costs.length * 10000) / 10000,
      'Avg Tokens': Math.round(d.tokens.reduce((a, b) => a + b, 0) / d.tokens.length),
      'Avg Latency (ms)': Math.round(d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length * 10) / 10,
    }))
    .sort((a, b) => b['Total Cost ($)'] - a['Total Cost ($)']);
}

export function calculateROI(data, manualCostPerTask = 50, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return { total_tasks: 0, roi_pct: 0 };

  const successful = tasks.filter((t) => t.result === 'success');
  const agentCost = tasks.reduce((s, t) => s + t.cost_usd, 0);
  const manualCost = successful.length * manualCostPerTask;
  const savings = manualCost - agentCost;

  return {
    total_tasks: tasks.length,
    successful_tasks: successful.length,
    agent_total_cost: Math.round(agentCost * 100) / 100,
    manual_equivalent_cost: Math.round(manualCost * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    roi_pct: agentCost > 0 ? Math.round((savings / agentCost) * 1000) / 10 : 0,
    cost_per_successful_task: successful.length ? Math.round((agentCost / successful.length) * 10000) / 10000 : 0,
  };
}

export function tokenUsageSummary(data, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return null;

  const totalInput = tasks.reduce((s, t) => s + t.input_tokens, 0);
  const totalOutput = tasks.reduce((s, t) => s + t.output_tokens, 0);
  const total = totalInput + totalOutput;

  const successTasks = tasks.filter((t) => t.result === 'success');
  const failedTasks = tasks.filter((t) => t.result === 'failure');
  const successTokens = successTasks.reduce((s, t) => s + t.total_tokens, 0);
  const failedTokens = failedTasks.reduce((s, t) => s + t.total_tokens, 0);

  return {
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_tokens: total,
    avg_tokens_per_task: tasks.length ? Math.round(total / tasks.length) : 0,
    avg_tokens_per_success: successTasks.length ? Math.round(successTokens / successTasks.length) : 0,
    avg_tokens_per_failure: failedTasks.length ? Math.round(failedTokens / failedTasks.length) : 0,
    input_output_ratio: totalOutput > 0 ? Math.round((totalInput / totalOutput) * 100) / 100 : 0,
    token_efficiency: total > 0 ? Math.round((successTokens / total) * 10000) / 10000 : 0,
  };
}

export function costTimeSeries(data, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { startDate, endDate });
  if (!tasks.length) return [];

  const buckets = {};
  for (const t of tasks) {
    const day = new Date(t.started_at).toISOString().split('T')[0];
    if (!buckets[day]) buckets[day] = { cost: 0, tokens: 0, count: 0 };
    buckets[day].cost += t.cost_usd;
    buckets[day].tokens += t.total_tokens;
    buckets[day].count++;
  }

  let cumulative = 0;
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      cumulative += d.cost;
      return {
        date,
        total_cost: Math.round(d.cost * 10000) / 10000,
        cumulative_cost: Math.round(cumulative * 10000) / 10000,
        total_tokens: d.tokens,
        task_count: d.count,
      };
    });
}

export function workflowEconomics(data, startDate, endDate) {
  const workflows = filterWorkflows(data.workflows, { startDate, endDate });
  if (!workflows.length) return [];

  return workflows.map((wf) => {
    const durationMs = wf.completed_at && wf.started_at
      ? new Date(wf.completed_at).getTime() - new Date(wf.started_at).getTime()
      : 0;
    return {
      Workflow: wf.name,
      Agents: wf.agent_ids.length,
      Tasks: wf.task_ids.length,
      Result: wf.result,
      'Cost ($)': Math.round(wf.total_cost_usd * 10000) / 10000,
      'Duration (s)': Math.round(durationMs / 100) / 10,
      Date: new Date(wf.started_at).toISOString().replace('T', ' ').slice(0, 16),
    };
  });
}
