import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import KPICard from '../components/KPICard';
import DataTable from '../components/DataTable';
import { performanceSummary, agentLeaderboard, throughputTimeSeries } from '../utils/metrics';
import { costTimeSeries } from '../utils/economics';
import { downloadCSV } from '../utils/csv';

const lbColumns = [
  { key: '_rank', label: '#', render: (_, __, i) => i + 1 },
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
// Fix: need index in render
lbColumns[0].render = (_, row) => undefined;

export default function Overview() {
  const { data, dateRange } = useApp();
  const { startDate, endDate } = dateRange;

  const summary = useMemo(() => performanceSummary(data, startDate, endDate), [data, startDate, endDate]);
  const costData = useMemo(() => costTimeSeries(data, startDate, endDate), [data, startDate, endDate]);
  const tpData = useMemo(() => throughputTimeSeries(data, { startDate, endDate }), [data, startDate, endDate]);
  const lb = useMemo(() => agentLeaderboard(data, startDate, endDate), [data, startDate, endDate]);

  if (!summary.total_tasks) {
    return (
      <div className="page-container">
        <h1 className="page-title">Dashboard Overview</h1>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-card)', color: 'var(--text-secondary)' }}>
          No data available. Click <strong>"Load Demo Data"</strong> in the sidebar to get started.
        </div>
      </div>
    );
  }

  const lbWithRank = lb.map((row, i) => ({ ...row, _rank: i + 1 }));
  const rankCol = { key: '_rank', label: '#', render: (v) => v };

  const chartDateFormat = (d) => {
    const parts = d.split('-');
    return `${parts[1]}/${parts[2]}`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Dashboard Overview</h1>

      {/* KPI Row 1 — 6 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 16 }}>
        <KPICard label="Total Tasks" value={summary.total_tasks.toLocaleString()} />
        <KPICard label="Success Rate" value={`${(summary.success_rate * 100).toFixed(1)}%`} />
        <KPICard label="Avg Quality" value={summary.avg_quality.toFixed(2)} />
        <KPICard label="Avg Latency" value={`${summary.avg_latency_ms.toLocaleString()}ms`} />
        <KPICard label="Total Cost" value={`$${summary.total_cost.toFixed(2)}`} />
        <KPICard label="Active Agents" value={summary.active_agents} />
      </div>

      {/* KPI Row 2 — 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KPICard label="Workflows" value={summary.total_workflows} small />
        <KPICard label="Workflow Success" value={`${(summary.workflow_success_rate * 100).toFixed(1)}%`} small />
        <KPICard label="P90 Latency" value={`${summary.p90_latency_ms.toLocaleString()}ms`} small />
        <KPICard label="Avg Cost/Task" value={`$${summary.avg_cost_per_task.toFixed(4)}`} small />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Cost Trend */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: 16 }}>Cost Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={chartDateFormat} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#2196F3' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#FF5722' }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }} />
              <Area yAxisId="left" dataKey="total_cost" fill="#2196F3" fillOpacity={0.2} stroke="#2196F3" strokeWidth={1.5} name="Daily Cost ($)" />
              <Line yAxisId="right" dataKey="cumulative_cost" stroke="#FF5722" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Cumulative ($)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput & Success Rate */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: 16 }}>Throughput & Success Rate</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={tpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={chartDateFormat} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#4CAF50' }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 11, fill: '#FF9800' }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }} />
              <Bar yAxisId="left" dataKey="task_count" fill="#4CAF50" fillOpacity={0.6} name="Tasks" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" dataKey="success_rate" stroke="#FF9800" strokeWidth={2} dot={{ r: 2 }} name="Success Rate" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Leaderboard */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: 12 }}>Agent Leaderboard</h3>
      <DataTable columns={[rankCol, ...lbColumns.slice(1)]} rows={lbWithRank} />

      {/* Download Summary CSV */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => downloadCSV([summary], 'overview_summary.csv')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          <Download size={16} /> Download Summary CSV
        </button>
      </div>
    </div>
  );
}
