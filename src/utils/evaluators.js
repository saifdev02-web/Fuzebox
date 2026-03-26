/**
 * Task completion & skills/permissions evaluation — mirrors evaluators.py exactly.
 */

const MIN_SUCCESS_RATE = 0.80;
const MAX_FAILURE_RATE = 0.10;
const MAX_TIMEOUT_RATE = 0.05;
const MIN_QUALITY_SCORE = 0.70;

function filterTasks(tasks, { agentId, startDate, endDate } = {}) {
  let filtered = tasks;
  if (agentId) filtered = filtered.filter((t) => t.agent_id === agentId);
  if (startDate) filtered = filtered.filter((t) => new Date(t.started_at) >= startDate);
  if (endDate) filtered = filtered.filter((t) => new Date(t.started_at) <= endDate);
  return filtered;
}

export function evaluateTaskCompletion(data, agentId, startDate, endDate) {
  const tasks = filterTasks(data.tasks, { agentId, startDate, endDate });
  if (!tasks.length) return { agent_id: agentId, total_tasks: 0, pass: false, reason: 'No tasks found' };

  const total = tasks.length;
  const counts = { success: 0, failure: 0, partial: 0, timeout: 0 };
  tasks.forEach((t) => { counts[t.result] = (counts[t.result] || 0) + 1; });

  const successRate = counts.success / total;
  const failureRate = counts.failure / total;
  const timeoutRate = counts.timeout / total;

  const qualityScores = tasks.filter((t) => t.quality_score != null).map((t) => t.quality_score);
  const avgQuality = qualityScores.length ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0;

  const issues = [];
  if (successRate < MIN_SUCCESS_RATE) issues.push(`Success rate ${(successRate * 100).toFixed(1)}% < ${(MIN_SUCCESS_RATE * 100).toFixed(0)}%`);
  if (failureRate > MAX_FAILURE_RATE) issues.push(`Failure rate ${(failureRate * 100).toFixed(1)}% > ${(MAX_FAILURE_RATE * 100).toFixed(0)}%`);
  if (timeoutRate > MAX_TIMEOUT_RATE) issues.push(`Timeout rate ${(timeoutRate * 100).toFixed(1)}% > ${(MAX_TIMEOUT_RATE * 100).toFixed(0)}%`);
  if (avgQuality < MIN_QUALITY_SCORE) issues.push(`Avg quality ${avgQuality.toFixed(2)} < ${MIN_QUALITY_SCORE.toFixed(2)}`);

  return {
    agent_id: agentId, total_tasks: total,
    success_count: counts.success, failure_count: counts.failure,
    partial_count: counts.partial, timeout_count: counts.timeout,
    success_rate: Math.round(successRate * 10000) / 10000,
    failure_rate: Math.round(failureRate * 10000) / 10000,
    timeout_rate: Math.round(timeoutRate * 10000) / 10000,
    avg_quality: Math.round(avgQuality * 10000) / 10000,
    pass: issues.length === 0,
    issues,
  };
}

export function evaluateGroupCompletion(data, group, startDate, endDate) {
  const agents = data.agents.filter((a) => a.group === group);
  if (!agents.length) return { group, agents: 0, pass: false, reason: 'No agents in group' };

  const evals = agents.map((a) => evaluateTaskCompletion(data, a.agent_id, startDate, endDate));
  const totalTasks = evals.reduce((s, e) => s + e.total_tasks, 0);
  const totalSuccess = evals.reduce((s, e) => s + (e.success_count || 0), 0);
  const passing = evals.filter((e) => e.pass).length;

  return {
    group, agents: agents.length, total_tasks: totalTasks,
    group_success_rate: totalTasks > 0 ? Math.round((totalSuccess / totalTasks) * 10000) / 10000 : 0,
    agents_passing: passing, agents_failing: agents.length - passing,
    pass: passing === agents.length,
  };
}

export function getAgentScorecardData(data, startDate, endDate) {
  return data.agents.map((agent) => {
    const ev = evaluateTaskCompletion(data, agent.agent_id, startDate, endDate);
    return {
      Agent: agent.name, Group: agent.group,
      Tasks: ev.total_tasks,
      'Success Rate': ev.success_rate || 0,
      'Failure Rate': ev.failure_rate || 0,
      'Avg Quality': ev.avg_quality || 0,
      Status: ev.pass ? 'PASS' : 'FAIL',
      Issues: (ev.issues || []).join('; '),
    };
  });
}

export function getSkillsMatrix(data, agentIds) {
  let agents = data.agents;
  if (agentIds && agentIds.length) agents = agents.filter((a) => agentIds.includes(a.agent_id));

  const allSkills = [...new Set(agents.flatMap((a) => a.skills))].sort();
  return {
    skills: allSkills,
    rows: agents.map((a) => ({
      agent: a.name,
      agent_id: a.agent_id,
      values: allSkills.map((s) => a.skills.includes(s)),
    })),
  };
}

export function getPermissionsMatrix(data, agentIds) {
  let agents = data.agents;
  if (agentIds && agentIds.length) agents = agents.filter((a) => agentIds.includes(a.agent_id));

  const allPerms = [...new Set(agents.flatMap((a) => a.permissions))].sort();
  return {
    permissions: allPerms,
    rows: agents.map((a) => ({
      agent: a.name,
      agent_id: a.agent_id,
      values: allPerms.map((p) => a.permissions.includes(p)),
    })),
  };
}

export function checkPermissionViolations(data, agentId, startDate, endDate) {
  const agent = data.agents.find((a) => a.agent_id === agentId);
  if (!agent) return [];

  const tasks = filterTasks(data.tasks, { agentId, startDate, endDate });
  const violations = [];
  for (const task of tasks) {
    const missingPerms = (task.required_permissions || []).filter((p) => !agent.permissions.includes(p));
    const missingSkills = (task.required_skills || []).filter((s) => !agent.skills.includes(s));
    if (missingPerms.length || missingSkills.length) {
      violations.push({
        task_id: task.task_id,
        task_type: task.task_type,
        result: task.result,
        missing_permissions: missingPerms,
        missing_skills: missingSkills,
        agent: agent.name,
      });
    }
  }
  return violations;
}
