import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import DataTable from '../components/DataTable';

const allSkillOptions = [
  'code_generation', 'code_review', 'debugging', 'testing',
  'data_extraction', 'summarization', 'planning', 'web_search',
  'ci_cd', 'infrastructure', 'security_audit', 'refactoring',
  'data_transformation', 'sql_queries', 'resource_allocation',
  'monitoring', 'document_analysis', 'performance_analysis', 'rollback',
];

const allPermissionOptions = [
  'read_repo', 'write_files', 'run_tests', 'create_pr',
  'comment_pr', 'approve_pr', 'read_db', 'read_api',
  'web_access', 'read_docs', 'assign_tasks', 'monitor_agents',
  'escalate', 'run_pipeline', 'deploy_staging', 'deploy_prod',
];

const taskTypeOptions = [
  'code_generation', 'code_review', 'bug_fix', 'data_extraction',
  'data_analysis', 'research', 'planning', 'deployment',
  'security_audit', 'test_generation',
];

const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xs)', fontSize: '0.85rem', background: 'var(--surface)',
  fontFamily: 'var(--font-body)', boxSizing: 'border-box',
};

const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

const multiStyle = {
  ...inputStyle, minHeight: 80, resize: 'vertical',
};

function TabButton({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 24px', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      background: 'none', color: active ? 'var(--accent)' : 'var(--text-secondary)',
      fontWeight: active ? 700 : 500, fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

export default function ScenarioBuilder() {
  const { data, upsertAgent, deleteAgent, upsertPipeline, deletePipeline, resetAllData } = useApp();
  const [activeTab, setActiveTab] = useState('agents');

  // ---- Agent Management State ----
  const [selectedAgentName, setSelectedAgentName] = useState('-- Create New Agent --');
  const [agentForm, setAgentForm] = useState({ name: '', group: 'default', model_name: 'gpt-4', description: '', cost_input: 0.003, cost_output: 0.015, skills: [], permissions: [] });

  const existingAgent = useMemo(() => data.agents.find((a) => a.name === selectedAgentName), [data.agents, selectedAgentName]);

  const handleAgentSelect = (name) => {
    setSelectedAgentName(name);
    const agent = data.agents.find((a) => a.name === name);
    if (agent) {
      setAgentForm({
        name: agent.name, group: agent.group, model_name: agent.model_name,
        description: agent.description, cost_input: agent.cost_per_1k_input,
        cost_output: agent.cost_per_1k_output, skills: [...agent.skills], permissions: [...agent.permissions],
      });
    } else {
      setAgentForm({ name: '', group: 'default', model_name: 'gpt-4', description: '', cost_input: 0.003, cost_output: 0.015, skills: [], permissions: [] });
    }
  };

  const handleSaveAgent = () => {
    if (!agentForm.name.trim()) { alert('Agent name is required.'); return; }
    const agentId = existingAgent ? existingAgent.agent_id : `agent-${Math.random().toString(36).slice(2, 10)}`;
    upsertAgent({
      agent_id: agentId, name: agentForm.name.trim(), description: agentForm.description,
      skills: agentForm.skills, permissions: agentForm.permissions,
      group: agentForm.group, status: 'active',
      cost_per_1k_input: agentForm.cost_input, cost_per_1k_output: agentForm.cost_output,
      model_name: agentForm.model_name, registered_at: new Date().toISOString(),
    });
    alert(`Agent "${agentForm.name}" saved.`);
    setSelectedAgentName('-- Create New Agent --');
    setAgentForm({ name: '', group: 'default', model_name: 'gpt-4', description: '', cost_input: 0.003, cost_output: 0.015, skills: [], permissions: [] });
  };

  const handleDeleteAgent = () => {
    if (existingAgent && confirm(`Delete agent "${existingAgent.name}"?`)) {
      deleteAgent(existingAgent.agent_id);
      setSelectedAgentName('-- Create New Agent --');
    }
  };

  // ---- Pipeline State ----
  const [selectedPipeName, setSelectedPipeName] = useState('-- Create New Pipeline --');
  const [pipeForm, setPipeForm] = useState({ name: '', description: '', agent_ids: [], task_types: [], required_skills: [] });

  const existingPipeline = useMemo(() => data.pipelines.find((p) => p.name === selectedPipeName), [data.pipelines, selectedPipeName]);

  const handlePipeSelect = (name) => {
    setSelectedPipeName(name);
    const pipe = data.pipelines.find((p) => p.name === name);
    if (pipe) {
      setPipeForm({
        name: pipe.name, description: pipe.description,
        agent_ids: [...pipe.agent_ids], task_types: [...pipe.task_types],
        required_skills: [...pipe.required_skills],
      });
    } else {
      setPipeForm({ name: '', description: '', agent_ids: [], task_types: [], required_skills: [] });
    }
  };

  const handleSavePipeline = () => {
    if (!pipeForm.name.trim()) { alert('Pipeline name is required.'); return; }
    const pipeId = existingPipeline ? existingPipeline.pipeline_id : Math.random().toString(36).slice(2, 14);
    upsertPipeline({
      pipeline_id: pipeId, name: pipeForm.name.trim(), description: pipeForm.description,
      agent_ids: pipeForm.agent_ids, task_types: pipeForm.task_types,
      required_skills: pipeForm.required_skills, created_at: new Date().toISOString(),
    });
    alert(`Pipeline "${pipeForm.name}" saved.`);
    setSelectedPipeName('-- Create New Pipeline --');
    setPipeForm({ name: '', description: '', agent_ids: [], task_types: [], required_skills: [] });
  };

  const handleDeletePipeline = () => {
    if (existingPipeline && confirm(`Delete pipeline "${existingPipeline.name}"?`)) {
      deletePipeline(existingPipeline.pipeline_id);
      setSelectedPipeName('-- Create New Pipeline --');
    }
  };

  const handleReset = () => {
    if (confirm('This will permanently delete ALL data. Continue?')) {
      resetAllData();
      alert('All data cleared.');
    }
  };

  const toggleMultiValue = (arr, val) => arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const agentSkills = useMemo(() => {
    const existing = new Set(data.agents.flatMap((a) => a.skills));
    return [...new Set([...allSkillOptions, ...existing])].sort();
  }, [data.agents]);

  const agentPerms = useMemo(() => {
    const existing = new Set(data.agents.flatMap((a) => a.permissions));
    return [...new Set([...allPermissionOptions, ...existing])].sort();
  }, [data.agents]);

  const pipeColumns = [
    { key: 'Name', label: 'Name', cellStyle: { fontWeight: 600 } },
    { key: 'Agents', label: 'Agents' },
    { key: 'Task Types', label: 'Task Types' },
    { key: 'Required Skills', label: 'Required Skills' },
  ];

  const pipeRows = data.pipelines.map((p) => ({
    Name: p.name,
    Agents: p.agent_ids.map((id) => data.agents.find((a) => a.agent_id === id)?.name || id).join(', '),
    'Task Types': p.task_types.join(', '),
    'Required Skills': p.required_skills.join(', '),
  }));

  return (
    <div className="page-container">
      <h1 className="page-title">Scenario Builder</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')}>Agent Management</TabButton>
        <TabButton active={activeTab === 'pipelines'} onClick={() => setActiveTab('pipelines')}>Task Pipeline</TabButton>
        <TabButton active={activeTab === 'reset'} onClick={() => setActiveTab('reset')}>Reset Data</TabButton>
      </div>

      {/* Agent Management Tab */}
      {activeTab === 'agents' && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Create or Edit Agent</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Select Agent</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedAgentName} onChange={(e) => handleAgentSelect(e.target.value)}>
              <option>-- Create New Agent --</option>
              {data.agents.map((a) => <option key={a.agent_id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Agent Name</label>
              <input style={inputStyle} value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={agentForm.description} onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Group</label>
              <input style={inputStyle} value={agentForm.group} onChange={(e) => setAgentForm({ ...agentForm, group: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Model Name</label>
              <input style={inputStyle} value={agentForm.model_name} onChange={(e) => setAgentForm({ ...agentForm, model_name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Cost per 1K Input Tokens ($)</label>
              <input type="number" step="0.001" style={inputStyle} value={agentForm.cost_input} onChange={(e) => setAgentForm({ ...agentForm, cost_input: Number(e.target.value) })} />
            </div>
            <div>
              <label style={labelStyle}>Cost per 1K Output Tokens ($)</label>
              <input type="number" step="0.001" style={inputStyle} value={agentForm.cost_output} onChange={(e) => setAgentForm({ ...agentForm, cost_output: Number(e.target.value) })} />
            </div>
          </div>

          {/* Skills */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {agentSkills.map((s) => (
                <button key={s} onClick={() => setAgentForm({ ...agentForm, skills: toggleMultiValue(agentForm.skills, s) })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                    border: agentForm.skills.includes(s) ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: agentForm.skills.includes(s) ? 'rgba(232,132,42,0.12)' : 'var(--surface)',
                    color: agentForm.skills.includes(s) ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Permissions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {agentPerms.map((p) => (
                <button key={p} onClick={() => setAgentForm({ ...agentForm, permissions: toggleMultiValue(agentForm.permissions, p) })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                    border: agentForm.permissions.includes(p) ? '1px solid #2196F3' : '1px solid var(--border)',
                    background: agentForm.permissions.includes(p) ? 'rgba(33,150,243,0.12)' : 'var(--surface)',
                    color: agentForm.permissions.includes(p) ? '#2196F3' : 'var(--text-secondary)',
                  }}>
                  {p.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Model Sliders */}
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>Cost Model Tuning</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Adjust cost rates per 1K tokens using sliders for quick what-if analysis.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Input Token Cost ($/1K): ${agentForm.cost_input.toFixed(4)}</label>
              <input type="range" min={0} max={0.1} step={0.0005} value={agentForm.cost_input}
                onChange={(e) => setAgentForm({ ...agentForm, cost_input: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
            <div>
              <label style={labelStyle}>Output Token Cost ($/1K): ${agentForm.cost_output.toFixed(4)}</label>
              <input type="range" min={0} max={0.2} step={0.001} value={agentForm.cost_output}
                onChange={(e) => setAgentForm({ ...agentForm, cost_output: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
          </div>

          {/* Save / Delete */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSaveAgent}
              style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              Save Agent
            </button>
            {existingAgent && (
              <button onClick={handleDeleteAgent}
                style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
                Delete Agent
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Tab */}
      {activeTab === 'pipelines' && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Define Task Pipeline</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Select Pipeline</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedPipeName} onChange={(e) => handlePipeSelect(e.target.value)}>
              <option>-- Create New Pipeline --</option>
              {data.pipelines.map((p) => <option key={p.pipeline_id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Pipeline Name</label>
              <input style={inputStyle} value={pipeForm.name} onChange={(e) => setPipeForm({ ...pipeForm, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={pipeForm.description} onChange={(e) => setPipeForm({ ...pipeForm, description: e.target.value })} />
            </div>
          </div>

          {/* Assign Agents */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Assign Agents</label>
            <select multiple style={multiStyle} value={pipeForm.agent_ids}
              onChange={(e) => setPipeForm({ ...pipeForm, agent_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}>
              {data.agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
            </select>
          </div>

          {/* Task Types */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Task Types</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {taskTypeOptions.map((tt) => (
                <button key={tt} onClick={() => setPipeForm({ ...pipeForm, task_types: toggleMultiValue(pipeForm.task_types, tt) })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer',
                    border: pipeForm.task_types.includes(tt) ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: pipeForm.task_types.includes(tt) ? 'rgba(232,132,42,0.12)' : 'var(--surface)',
                    color: pipeForm.task_types.includes(tt) ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  {tt.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Required Skills */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Required Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {agentSkills.map((s) => (
                <button key={s} onClick={() => setPipeForm({ ...pipeForm, required_skills: toggleMultiValue(pipeForm.required_skills, s) })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer',
                    border: pipeForm.required_skills.includes(s) ? '1px solid #4CAF50' : '1px solid var(--border)',
                    background: pipeForm.required_skills.includes(s) ? 'rgba(76,175,80,0.12)' : 'var(--surface)',
                    color: pipeForm.required_skills.includes(s) ? '#4CAF50' : 'var(--text-secondary)',
                  }}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Save / Delete Pipeline */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <button onClick={handleSavePipeline}
              style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              Save Pipeline
            </button>
            {existingPipeline && (
              <button onClick={handleDeletePipeline}
                style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
                Delete Pipeline
              </button>
            )}
          </div>

          {/* Saved Pipelines Table */}
          {pipeRows.length > 0 && (
            <>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 12 }}>Saved Pipelines</h4>
              <DataTable columns={pipeColumns} rows={pipeRows} />
            </>
          )}
        </div>
      )}

      {/* Reset Tab */}
      {activeTab === 'reset' && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Reset All Data</h3>
          <div style={{ padding: '12px 20px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', color: '#d97706', fontSize: '0.85rem', marginBottom: 20 }}>
            ⚠ This will permanently delete ALL agents, tasks, spans, workflows, and pipeline configurations.
          </div>
          <button onClick={handleReset}
            style={{ padding: '12px 28px', borderRadius: 'var(--radius-sm)', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
            Reset All Data
          </button>
        </div>
      )}
    </div>
  );
}
