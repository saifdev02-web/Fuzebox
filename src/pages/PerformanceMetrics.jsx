import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ComposedChart, Line, ReferenceLine,
} from 'recharts';
import { Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DataTable from '../components/DataTable';
import { completionRates, latencyByAgent, latencyStats, throughputTimeSeries, agentLeaderboard } from '../utils/metrics';
import { downloadCSV } from '../utils/csv';

export default function PerformanceMetrics() {
  const { data, dateRange } = useApp();
  const { startDate, endDate } = dateRange;
  const [granularity, setGranularity] = useState('day');

  const crData = useMemo(() => completionRates(data, startDate, endDate), [data, startDate, endDate]);
  const latByAgent = useMemo(() => latencyByAgent(data, startDate, endDate), [data, startDate, endDate]);
  const globalLatStats = useMemo(() => latencyStats(data, { startDate, endDate }), [data, startDate, endDate]);
  const tpData = useMemo(() => throughputTimeSeries(data, { startDate, endDate, granularity }), [data, startDate, endDate, granularity]);
  const lb = useMemo(() => agentLeaderboard(data, startDate, endDate), [data, startDate, endDate]);

  // Build histogram data from tasks
  const histogramData = useMemo(() => {
    const latencies = data.tasks
      .filter((t) => {
        if (t.latency_ms == null) return false;
        if (startDate && new Date(t.started_at) < startDate) return false;
        if (endDate && new Date(t.started_at) > endDate) return false;
        return true;
      })
      .map((t) => t.latency_ms);
    if (!latencies.length) return [];

    const bins = 30;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const binWidth = (max - min) / bins;
    const histogram = Array.from({ length: bins }, (_, i) => ({
      range: Math.round(min + i * binWidth),
      label: `${Math.round(min + i * binWidth)}`,
      count: 0,
    }));
    for (const lat of latencies) {
      const idx = Math.min(Math.floor((lat - min) / binWidth), bins - 1);
      histogram[idx].count++;
    }
    return histogram;
  }, [data.tasks, startDate, endDate]);

  const crColor = (rate) => rate >= 0.8 ? '#4CAF50' : rate >= 0.6 ? '#FF9800' : '#F44336';
  const chartDateFormat = (d) => { const p = d.split('-'); return `${p[1]}/${p[2]}`; };

  const lbColumns = [
    { key: '_rank', label: '#', render: (v) => v },
    { key: 'Agent', label: 'Agent', cellStyle: { fontWeight: 600 } },
    { key: 'Group', label: 'Group' },
    { key: 'Tasks', label: 'Tasks' },
    { key: 'Success Rate', label: 'Success Rate', render: (v) => (
      <span style={{
        padding: '2px 8px', borderRadius: 4,
        background: v >= 0.7 ? '#C8E6C9' : v >= 0.5 ? '#FFF9C4' : '#FFCDD2',
      }}>{(v * 100).toFixed(1)}%</span>
    ) },
    { key: 'Avg Quality', label: 'Avg Quality', render: (v) => v.toFixed(2) },
    { key: 'Avg Latency (ms)', label: 'Avg Latency', render: (v) => `${v.toLocaleString()}ms` },
    { key: 'Total Cost ($)', label: 'Total Cost', render: (v) => `$${v.toFixed(4)}` },
    { key: 'Score', label: 'Score', render: (v) => (
      <span style={{
        fontWeight: 700, color: 'var(--accent)', padding: '2px 8px', borderRadius: 4,
        background: v >= 0.7 ? '#C8E6C9' : v >= 0.5 ? '#FFF9C4' : '#FFCDD2',
      }}>{v.toFixed(3)}</span>
    ) },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">Performance Metrics</h1>

      {/* Completion Rates + Latency by Agent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 16 }}>Completion Rates</h3>
          {crData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, crData.length * 36 + 40)}>
              <BarChart data={crData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <YAxis dataKey="Agent" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip formatter={(v) => `${(v * 100).toFixed(1)}%`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <ReferenceLine x={0.8} stroke="#666" strokeDasharray="3 3" />
                <Bar dataKey="Completion Rate" radius={[0, 6, 6, 0]}>
                  {crData.map((entry, i) => <Cell key={i} fill={crColor(entry['Completion Rate'])} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ color: 'var(--text-secondary)', padding: 20 }}>No data</div>}
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 16 }}>Latency by Agent</h3>
          {latByAgent.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, latByAgent.length * 36 + 40)}>
              <BarChart data={latByAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="Agent" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="P50 (ms)" fill="#2196F3" name="P50" />
                <Bar dataKey="P90 (ms)" fill="#FF5722" name="P90" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ color: 'var(--text-secondary)', padding: 20 }}>No data</div>}
        </div>
      </div>

      {/* Latency Distribution */}
      {histogramData.length > 0 && globalLatStats && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Latency Distribution</h3>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 32 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={histogramData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#2196F3" fillOpacity={0.7} name="Count" />
                <ReferenceLine x={String(Math.round(globalLatStats.p50_ms))} stroke="#4CAF50" strokeDasharray="3 3" label={{ value: `P50: ${globalLatStats.p50_ms}ms`, fill: '#4CAF50', fontSize: 10 }} />
                <ReferenceLine x={String(Math.round(globalLatStats.p90_ms))} stroke="#FF9800" strokeDasharray="3 3" label={{ value: `P90: ${globalLatStats.p90_ms}ms`, fill: '#FF9800', fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Throughput Trend */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Throughput Trend</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>Granularity:</label>
        <select
          value={granularity} onChange={(e) => setGranularity(e.target.value)}
          style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', fontSize: '0.82rem', background: 'var(--surface)', cursor: 'pointer' }}
        >
          <option value="day">Day</option>
          <option value="hour">Hour</option>
          <option value="week">Week</option>
        </select>
      </div>
      {tpData.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 32 }}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={tpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={chartDateFormat} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#4CAF50' }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 11, fill: '#FF9800' }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar yAxisId="left" dataKey="task_count" fill="#4CAF50" fillOpacity={0.6} name="Tasks" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" dataKey="success_rate" stroke="#FF9800" strokeWidth={2} dot={{ r: 2 }} name="Success Rate" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Agent Leaderboard */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Agent Leaderboard</h3>
      <DataTable columns={lbColumns} rows={lb.map((r, i) => ({ ...r, _rank: i + 1 }))} />

      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => downloadCSV(lb, 'agent_leaderboard.csv')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          <Download size={16} /> Download Leaderboard CSV
        </button>
      </div>
    </div>
  );
}
