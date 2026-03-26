/**
 * Mock data generator — mirrors the Python seed_demo_data() exactly.
 * Generates 8 agents, ~300 tasks, ~1500 spans, ~100 workflows over 30 days.
 */

function uuid(len = 12) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

// ===== AGENT DEFINITIONS (mirrors seed_demo_data) =====
export const agentDefinitions = [
  {
    agent_id: 'agent-coder-01', name: 'CodeGen Alpha',
    description: 'Primary code generation agent',
    skills: ['code_generation', 'code_review', 'refactoring', 'testing'],
    permissions: ['read_repo', 'write_files', 'run_tests', 'create_pr'],
    group: 'engineering', status: 'active',
    cost_per_1k_input: 0.003, cost_per_1k_output: 0.015, model_name: 'claude-sonnet-4-20250514',
  },
  {
    agent_id: 'agent-coder-02', name: 'CodeGen Beta',
    description: 'Secondary code generation agent for parallel tasks',
    skills: ['code_generation', 'debugging', 'testing'],
    permissions: ['read_repo', 'write_files', 'run_tests'],
    group: 'engineering', status: 'active',
    cost_per_1k_input: 0.003, cost_per_1k_output: 0.015, model_name: 'claude-sonnet-4-20250514',
  },
  {
    agent_id: 'agent-reviewer-01', name: 'Review Sentinel',
    description: 'Code review and quality assurance agent',
    skills: ['code_review', 'security_audit', 'performance_analysis'],
    permissions: ['read_repo', 'comment_pr', 'approve_pr'],
    group: 'quality', status: 'active',
    cost_per_1k_input: 0.01, cost_per_1k_output: 0.03, model_name: 'claude-opus-4-20250514',
  },
  {
    agent_id: 'agent-data-01', name: 'Data Wrangler',
    description: 'Data extraction, transformation, and analysis agent',
    skills: ['data_extraction', 'data_transformation', 'summarization', 'sql_queries'],
    permissions: ['read_db', 'read_api', 'write_files'],
    group: 'data', status: 'active',
    cost_per_1k_input: 0.0005, cost_per_1k_output: 0.0015, model_name: 'claude-haiku-4-5-20251001',
  },
  {
    agent_id: 'agent-planner-01', name: 'Orchestrator Prime',
    description: 'Workflow planning and task delegation agent',
    skills: ['planning', 'task_decomposition', 'resource_allocation', 'monitoring'],
    permissions: ['read_repo', 'assign_tasks', 'monitor_agents', 'escalate'],
    group: 'orchestration', status: 'active',
    cost_per_1k_input: 0.01, cost_per_1k_output: 0.03, model_name: 'claude-opus-4-20250514',
  },
  {
    agent_id: 'agent-search-01', name: 'Research Scout',
    description: 'Information retrieval and research agent',
    skills: ['web_search', 'document_analysis', 'summarization'],
    permissions: ['read_api', 'web_access', 'read_docs'],
    group: 'research', status: 'active',
    cost_per_1k_input: 0.0005, cost_per_1k_output: 0.0015, model_name: 'claude-haiku-4-5-20251001',
  },
  {
    agent_id: 'agent-deploy-01', name: 'Deploy Guardian',
    description: 'CI/CD and deployment automation agent',
    skills: ['ci_cd', 'infrastructure', 'monitoring', 'rollback'],
    permissions: ['read_repo', 'run_pipeline', 'deploy_staging', 'deploy_prod'],
    group: 'devops', status: 'active',
    cost_per_1k_input: 0.003, cost_per_1k_output: 0.015, model_name: 'claude-sonnet-4-20250514',
  },
  {
    agent_id: 'agent-legacy-01', name: 'Legacy Processor',
    description: 'Deprecated agent kept for reference',
    skills: ['data_extraction'],
    permissions: ['read_db'],
    group: 'data', status: 'inactive',
    cost_per_1k_input: 0.0005, cost_per_1k_output: 0.0015, model_name: 'claude-haiku-4-5-20251001',
  },
];

const taskTypeDefinitions = {
  code_generation: { skills: ['code_generation'], perms: ['read_repo', 'write_files'], agents: ['agent-coder-01', 'agent-coder-02'] },
  code_review: { skills: ['code_review'], perms: ['read_repo', 'comment_pr'], agents: ['agent-reviewer-01', 'agent-coder-01'] },
  bug_fix: { skills: ['debugging', 'code_generation'], perms: ['read_repo', 'write_files', 'run_tests'], agents: ['agent-coder-01', 'agent-coder-02'] },
  data_extraction: { skills: ['data_extraction', 'sql_queries'], perms: ['read_db'], agents: ['agent-data-01'] },
  data_analysis: { skills: ['data_transformation', 'summarization'], perms: ['read_db', 'write_files'], agents: ['agent-data-01'] },
  research: { skills: ['web_search', 'summarization'], perms: ['web_access', 'read_docs'], agents: ['agent-search-01'] },
  planning: { skills: ['planning', 'task_decomposition'], perms: ['assign_tasks'], agents: ['agent-planner-01'] },
  deployment: { skills: ['ci_cd', 'infrastructure'], perms: ['run_pipeline', 'deploy_staging'], agents: ['agent-deploy-01'] },
  security_audit: { skills: ['security_audit'], perms: ['read_repo'], agents: ['agent-reviewer-01'] },
  test_generation: { skills: ['testing', 'code_generation'], perms: ['read_repo', 'write_files', 'run_tests'], agents: ['agent-coder-01', 'agent-coder-02'] },
};

/**
 * Generate full demo dataset — mirrors seed_demo_data() in db.py
 */
export function generateDemoData() {
  const agents = agentDefinitions.map((a) => ({ ...a, registered_at: new Date().toISOString() }));
  const agentMap = {};
  agents.forEach((a) => { agentMap[a.agent_id] = a; });

  const now = new Date();
  const allTasks = [];
  const allSpans = [];
  const allWorkflows = [];
  const taskTypes = Object.keys(taskTypeDefinitions);

  for (let dayOffset = 30; dayOffset > 0; dayOffset--) {
    const dayStart = new Date(now.getTime() - dayOffset * 86400000);
    const numWorkflows = randomInt(2, 5);

    for (let w = 0; w < numWorkflows; w++) {
      const wfId = uuid(12);
      const wfStart = new Date(dayStart.getTime() + randomFloat(0, 20) * 3600000);
      const wfTaskIds = [];
      const wfAgentIds = new Set();
      let wfCost = 0;
      const traceId = uuid(16);
      let taskOffsetMs = 0;

      // Root planning span
      const planDuration = randomFloat(200, 800);
      const planSpan = {
        trace_id: traceId, span_id: uuid(12),
        parent_span_id: null, agent_id: 'agent-planner-01',
        operation: 'workflow_planning',
        started_at: wfStart.toISOString(),
        ended_at: new Date(wfStart.getTime() + planDuration).toISOString(),
        duration_ms: Math.round(planDuration * 100) / 100,
        status: 'OK',
        attributes: { workflow_id: wfId },
      };
      allSpans.push(planSpan);

      const numTasks = randomInt(2, 6);
      for (let tIdx = 0; tIdx < numTasks; tIdx++) {
        const tt = randomChoice(taskTypes);
        const ttDef = taskTypeDefinitions[tt];
        const agentId = randomChoice(ttDef.agents);
        const agent = agentMap[agentId];
        wfAgentIds.add(agentId);

        const taskStart = new Date(wfStart.getTime() + taskOffsetMs);
        let latency = randomFloat(500, 15000);
        const taskEnd = new Date(taskStart.getTime() + latency);
        taskOffsetMs += latency + randomFloat(100, 500);

        // Determine result
        const r = Math.random();
        let result, quality;
        if (r < 0.72) {
          result = 'success';
          quality = Math.round(randomFloat(0.7, 1.0) * 1000) / 1000;
        } else if (r < 0.85) {
          result = 'partial';
          quality = Math.round(randomFloat(0.3, 0.7) * 1000) / 1000;
        } else if (r < 0.95) {
          result = 'failure';
          quality = Math.round(randomFloat(0.0, 0.3) * 1000) / 1000;
        } else {
          result = 'timeout';
          quality = 0.0;
          latency = 30000;
        }

        const inputTokens = randomInt(500, 8000);
        const outputTokens = randomInt(200, 4000);
        const totalTokens = inputTokens + outputTokens;
        const cost = Math.round((inputTokens / 1000 * agent.cost_per_1k_input + outputTokens / 1000 * agent.cost_per_1k_output) * 1000000) / 1000000;
        wfCost += cost;

        const taskId = uuid(12);
        wfTaskIds.push(taskId);

        allTasks.push({
          task_id: taskId, agent_id: agentId, workflow_id: wfId,
          task_type: tt, description: `Auto-generated ${tt} task`,
          required_skills: ttDef.skills, required_permissions: ttDef.perms,
          result, started_at: taskStart.toISOString(), completed_at: taskEnd.toISOString(),
          latency_ms: Math.round(latency * 100) / 100,
          input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens,
          cost_usd: cost, quality_score: quality,
          metadata: { workflow_id: wfId, task_index: tIdx },
        });

        // Task span
        const taskSpan = {
          trace_id: traceId, span_id: uuid(12),
          parent_span_id: planSpan.span_id, agent_id: agentId,
          operation: `execute_${tt}`,
          started_at: taskStart.toISOString(), ended_at: taskEnd.toISOString(),
          duration_ms: Math.round(latency * 100) / 100,
          status: (result === 'success' || result === 'partial') ? 'OK' : 'ERROR',
          attributes: { task_id: taskId, task_type: tt, result },
        };
        allSpans.push(taskSpan);

        // Sub-spans
        const subOps = ['initialize', 'process', 'validate', 'finalize'];
        let subStart = taskStart;
        for (const sop of subOps) {
          const subDur = (latency / subOps.length) * randomFloat(0.5, 1.5);
          const subEnd = new Date(subStart.getTime() + subDur);
          allSpans.push({
            trace_id: traceId, span_id: uuid(12),
            parent_span_id: taskSpan.span_id, agent_id: agentId,
            operation: `${tt}.${sop}`,
            started_at: subStart.toISOString(), ended_at: subEnd.toISOString(),
            duration_ms: Math.round(subDur * 100) / 100,
            status: 'OK',
            attributes: { sub_operation: sop },
          });
          subStart = subEnd;
        }
      }

      // Workflow result
      const recentResults = allTasks.slice(-numTasks).map((t) => t.result);
      let wfResult;
      if (recentResults.every((r) => r === 'success')) wfResult = 'success';
      else if (recentResults.some((r) => r === 'failure')) wfResult = 'failure';
      else wfResult = 'partial';

      const wfEnd = new Date(wfStart.getTime() + taskOffsetMs);
      allWorkflows.push({
        workflow_id: wfId, name: `Workflow-${String(dayOffset).padStart(2, '0')}-${w}`,
        description: 'Auto-generated workflow',
        agent_ids: [...wfAgentIds], task_ids: wfTaskIds,
        started_at: wfStart.toISOString(), completed_at: wfEnd.toISOString(),
        result: wfResult, total_cost_usd: Math.round(wfCost * 1000000) / 1000000,
        metadata: { day_offset: dayOffset },
      });
    }
  }

  return {
    agents,
    tasks: allTasks,
    spans: allSpans,
    workflows: allWorkflows,
    pipelines: [],
    summary: { agents: agents.length, tasks: allTasks.length, spans: allSpans.length, workflows: allWorkflows.length },
  };
}
