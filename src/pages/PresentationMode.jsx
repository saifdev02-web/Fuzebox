import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import KPICard from '../components/KPICard';
import DataTable from '../components/DataTable';
import { performanceSummary, agentLeaderboard } from '../utils/metrics';
import { calculateROI } from '../utils/economics';

const lbColumns = [
  { key: '_rank', label: '#', render: (v) => v },
  { key: 'Agent', label: 'Agent', cellStyle: { fontWeight: 600 } },
  { key: 'Group', label: 'Group' },
  { key: 'Model', label: 'Model' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Success Rate', label: 'Success Rate', render: (v) => `${(v * 100).toFixed(1)}%` },
  { key: 'Avg Quality', label: 'Avg Quality', render: (v) => v.toFixed(2) },
  { key: 'Avg Latency (ms)', label: 'Avg Latency', render: (v) => `${v.toLocaleString()}ms` },
  { key: 'Total Cost ($)', label: 'Total Cost', render: (v) => `$${v.toFixed(4)}` },
  { key: 'Score', label: 'Score', render: (v) => <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{v.toFixed(3)}</span> },
];

export default function PresentationMode() {
  const { data, setPresentationMode } = useApp();

  const summary = useMemo(() => performanceSummary(data, null, null), [data]);
  const roi = useMemo(() => calculateROI(data, 50), [data]);
  const lb = useMemo(() => agentLeaderboard(data), [data]);

  if (!summary.total_tasks) {
    return (
      <div style={{ padding: 60, maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => setPresentationMode(false)}
          style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>
          Exit Presentation Mode
        </button>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-card)', color: 'var(--text-secondary)' }}>
          No data available. Exit Presentation Mode and load demo data first.
        </div>
      </div>
    );
  }

  const top = lb.length ? lb[0] : null;

  return (
    <div style={{ padding: '40px 60px', maxWidth: 1200, margin: '0 auto' }}>
      <button onClick={() => setPresentationMode(false)}
        style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>
        Exit Presentation Mode
      </button>

      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: 4 }}>AI Agent Performance Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 32 }}>Generated {new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC</p>

      {/* Top KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KPICard label="Total Tasks" value={summary.total_tasks.toLocaleString()} />
        <KPICard label="Success Rate" value={`${(summary.success_rate * 100).toFixed(1)}%`} />
        <KPICard label="Total Cost" value={`$${summary.total_cost.toFixed(2)}`} />
        <KPICard label="ROI vs Manual" value={`${roi.roi_pct.toFixed(0)}%`} />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

      {/* Agent Leaderboard */}
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: 16 }}>Agent Leaderboard</h2>
      <DataTable columns={lbColumns} rows={lb.map((r, i) => ({ ...r, _rank: i + 1 }))} />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

      {/* Key Insights */}
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: 16 }}>Key Insights</h2>

      <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-sm)', background: 'rgba(33,150,243,0.08)', color: '#1976D2', fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.6 }}>
        <strong>Agent automation reduced manual task cost by {roi.roi_pct.toFixed(0)}%</strong> — AI agents completed {summary.total_tasks.toLocaleString()} tasks at ${summary.total_cost.toFixed(2)} total, compared to an estimated ${roi.manual_equivalent_cost.toFixed(2)} manual equivalent.
      </div>

      {top && (
        <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', color: '#059669', fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.6 }}>
          <strong>Top performing agent: {top.Agent}</strong> with a composite score of {top.Score.toFixed(3)} across {top.Tasks} tasks ({(top['Success Rate'] * 100).toFixed(1)}% success rate, {top['Avg Quality'].toFixed(2)} avg quality).
        </div>
      )}

      <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', color: '#d97706', fontSize: '0.9rem', lineHeight: 1.6 }}>
        <strong>System processed {summary.total_tasks.toLocaleString()} tasks at ${summary.avg_cost_per_task.toFixed(4)} average cost per task</strong> — with {summary.active_agents} active agents and {summary.total_workflows} workflows completed.
      </div>
    </div>
  );
}
