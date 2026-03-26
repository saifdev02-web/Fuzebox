import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import KPICard from '../components/KPICard';
import DataTable from '../components/DataTable';
import { getAgentScorecardData, evaluateGroupCompletion } from '../utils/evaluators';
import { accuracyByType } from '../utils/metrics';
import { downloadCSV } from '../utils/csv';

const scorecardColumns = [
  { key: 'Agent', label: 'Agent', cellStyle: { fontWeight: 600 } },
  { key: 'Group', label: 'Group' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Success Rate', label: 'Success Rate', render: (v) => (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem',
      background: v >= 0.8 ? '#C8E6C9' : v >= 0.6 ? '#FFF9C4' : '#FFCDD2',
    }}>{(v * 100).toFixed(1)}%</span>
  ) },
  { key: 'Failure Rate', label: 'Failure Rate', render: (v) => `${(v * 100).toFixed(1)}%` },
  { key: 'Avg Quality', label: 'Avg Quality', render: (v) => v.toFixed(2) },
  { key: 'Status', label: 'Status', render: (v) => (
    <span style={{
      padding: '3px 12px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, color: '#fff',
      background: v === 'PASS' ? '#4CAF50' : '#F44336',
    }}>{v}</span>
  ) },
  { key: 'Issues', label: 'Issues', cellStyle: { fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 300 } },
];

export default function TaskScorecards() {
  const { data, dateRange, selectedGroup } = useApp();
  const { startDate, endDate } = dateRange;

  const scorecardData = useMemo(() => {
    let rows = getAgentScorecardData(data, startDate, endDate);
    if (selectedGroup !== 'All') rows = rows.filter((r) => r.Group === selectedGroup);
    return rows;
  }, [data, startDate, endDate, selectedGroup]);

  const groupEval = useMemo(() => {
    if (selectedGroup === 'All') return null;
    return evaluateGroupCompletion(data, selectedGroup, startDate, endDate);
  }, [data, selectedGroup, startDate, endDate]);

  const accData = useMemo(() => accuracyByType(data, startDate, endDate), [data, startDate, endDate]);

  if (!scorecardData.length) {
    return (
      <div className="page-container">
        <h1 className="page-title">Task Completion Scorecards</h1>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-card)', color: 'var(--text-secondary)' }}>
          No task data available.
        </div>
      </div>
    );
  }

  const barColor = (rate) => rate >= 0.8 ? '#4CAF50' : rate >= 0.6 ? '#FF9800' : '#F44336';

  return (
    <div className="page-container">
      <h1 className="page-title">Task Completion Scorecards</h1>

      <DataTable columns={scorecardColumns} rows={scorecardData} />

      <div style={{ marginTop: 16, marginBottom: 32 }}>
        <button
          onClick={() => downloadCSV(scorecardData, 'task_scorecards.csv')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          <Download size={16} /> Download Scorecard CSV
        </button>
      </div>

      {/* Group Evaluation */}
      {groupEval && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>
            Group Evaluation: {selectedGroup}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            <KPICard label="Agents" value={groupEval.agents} />
            <KPICard label="Group Success Rate" value={`${(groupEval.group_success_rate * 100).toFixed(1)}%`} />
            <KPICard label="Passing Agents" value={groupEval.agents_passing} />
            <KPICard label="Status" value={groupEval.pass ? 'PASS' : 'FAIL'} />
          </div>
        </>
      )}

      {/* Success Rate by Task Type */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Success Rate by Task Type</h3>
      {accData.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
          <ResponsiveContainer width="100%" height={Math.max(200, accData.length * 40 + 40)}>
            <BarChart data={accData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis dataKey="Task Type" type="category" width={130} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
              <Bar dataKey="Success Rate" radius={[0, 6, 6, 0]} name="Success Rate">
                {accData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry['Success Rate'])} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
