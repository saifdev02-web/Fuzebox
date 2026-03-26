import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import DataTable from '../components/DataTable';
import { getSkillsMatrix, getPermissionsMatrix, checkPermissionViolations } from '../utils/evaluators';

const agentColumns = [
  { key: 'Name', label: 'Name', cellStyle: { fontWeight: 600 } },
  { key: 'Group', label: 'Group' },
  { key: 'Status', label: 'Status', render: (v) => (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
      background: v === 'ACTIVE' ? 'rgba(16,185,129,0.12)' : v === 'ERROR' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
      color: v === 'ACTIVE' ? 'var(--success)' : v === 'ERROR' ? '#ef4444' : '#f59e0b',
    }}>{v}</span>
  ) },
  { key: 'Model', label: 'Model' },
  { key: 'Skills', label: 'Skills' },
  { key: 'Permissions', label: 'Permissions' },
  { key: 'Input $/1K', label: 'Input $/1K', render: (v) => `$${v}` },
  { key: 'Output $/1K', label: 'Output $/1K', render: (v) => `$${v}` },
];

function MatrixTable({ title, headers, rows, trueColor }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>{title}</h3>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', overflow: 'auto', maxHeight: 400 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', borderBottom: '2px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1, minWidth: 100 }}>
                Agent
              </th>
              {headers.map((h) => (
                <th key={h} style={{ textAlign: 'center', padding: '8px 6px', fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-secondary)', borderBottom: '2px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' }}>
                  {h.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agent}>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{row.agent}</td>
                {row.values.map((val, i) => (
                  <td key={i} style={{
                    padding: '6px', borderBottom: '1px solid var(--border)', textAlign: 'center',
                    background: val ? trueColor : '#f3f0eb', color: val ? '#fff' : 'transparent',
                    fontSize: '0.7rem', fontWeight: 600,
                  }}>
                    {val ? '✓' : '·'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AgentRegistry() {
  const { data, selectedAgentIds } = useApp();

  const agentRows = useMemo(() => data.agents.map((a) => ({
    Name: a.name, Group: a.group, Status: a.status.toUpperCase(),
    Model: a.model_name, Skills: a.skills.length, Permissions: a.permissions.length,
    'Input $/1K': a.cost_per_1k_input, 'Output $/1K': a.cost_per_1k_output,
  })), [data.agents]);

  const skillsMatrix = useMemo(() => getSkillsMatrix(data, selectedAgentIds.length ? selectedAgentIds : null), [data, selectedAgentIds]);
  const permsMatrix = useMemo(() => getPermissionsMatrix(data, selectedAgentIds.length ? selectedAgentIds : null), [data, selectedAgentIds]);

  const violations = useMemo(() => {
    const all = [];
    data.agents.forEach((a) => {
      const v = checkPermissionViolations(data, a.agent_id);
      all.push(...v);
    });
    return all;
  }, [data]);

  if (!data.agents.length) {
    return (
      <div className="page-container">
        <h1 className="page-title">Agent Registry</h1>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-card)', color: 'var(--text-secondary)' }}>
          No agents registered. Load demo data to get started.
        </div>
      </div>
    );
  }

  const violationColumns = [
    { key: 'agent', label: 'Agent', cellStyle: { fontWeight: 600 } },
    { key: 'task_id', label: 'Task ID', cellStyle: { fontFamily: 'monospace', fontSize: '0.78rem' } },
    { key: 'task_type', label: 'Task Type' },
    { key: 'result', label: 'Result' },
    { key: 'missing_permissions', label: 'Missing Permissions', render: (v) => v.join(', ') },
    { key: 'missing_skills', label: 'Missing Skills', render: (v) => v.join(', ') },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">Agent Registry</h1>

      <DataTable columns={agentColumns} rows={agentRows} />

      <div style={{ height: 32 }} />

      {/* Skills + Permissions Matrices */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
        {skillsMatrix.rows.length > 0 && (
          <MatrixTable title="Skills Matrix" headers={skillsMatrix.skills} rows={skillsMatrix.rows} trueColor="#4CAF50" />
        )}
        {permsMatrix.rows.length > 0 && (
          <MatrixTable title="Permissions Matrix" headers={permsMatrix.permissions} rows={permsMatrix.rows} trueColor="#2196F3" />
        )}
      </div>

      {/* Permission Violations */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Permission Violations</h3>
      {violations.length > 0 ? (
        <>
          <div style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', color: '#d97706', fontSize: '0.85rem', fontWeight: 500, marginBottom: 12 }}>
            ⚠ Found {violations.length} permission/skill violations
          </div>
          <DataTable columns={violationColumns} rows={violations} />
        </>
      ) : (
        <div style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 500 }}>
          ✓ No permission or skill violations detected
        </div>
      )}
    </div>
  );
}
