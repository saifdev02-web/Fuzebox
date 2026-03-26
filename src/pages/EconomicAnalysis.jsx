import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import KPICard from '../components/KPICard';
import DataTable from '../components/DataTable';
import { costPerAgent, costPerTaskType, calculateROI, tokenUsageSummary, costTimeSeries, workflowEconomics } from '../utils/economics';
import { performanceSummary } from '../utils/metrics';
import { downloadCSV } from '../utils/csv';

const PIE_COLORS = ['#2196F3', '#FF5722'];
const BAR_COLORS = ['#4CAF50', '#F44336'];

const wfColumns = [
  { key: 'Workflow', label: 'Workflow', cellStyle: { fontWeight: 500, fontSize: '0.78rem' } },
  { key: 'Agents', label: 'Agents' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Result', label: 'Result', render: (v) => (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
      background: v === 'success' ? 'rgba(16,185,129,0.12)' : v === 'failure' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
      color: v === 'success' ? 'var(--success)' : v === 'failure' ? '#ef4444' : '#f59e0b',
    }}>{v}</span>
  ) },
  { key: 'Cost ($)', label: 'Cost ($)', render: (v) => `$${v.toFixed(4)}` },
  { key: 'Duration (s)', label: 'Duration (s)' },
  { key: 'Date', label: 'Date' },
];

export default function EconomicAnalysis() {
  const { data, dateRange } = useApp();
  const { startDate, endDate } = dateRange;
  const [manualCost, setManualCost] = useState(50);

  const roi = useMemo(() => calculateROI(data, manualCost, startDate, endDate), [data, manualCost, startDate, endDate]);
  const cpa = useMemo(() => costPerAgent(data, startDate, endDate), [data, startDate, endDate]);
  const cpt = useMemo(() => costPerTaskType(data, startDate, endDate), [data, startDate, endDate]);
  const tokens = useMemo(() => tokenUsageSummary(data, startDate, endDate), [data, startDate, endDate]);
  const costTS = useMemo(() => costTimeSeries(data, startDate, endDate), [data, startDate, endDate]);
  const wfEcon = useMemo(() => workflowEconomics(data, startDate, endDate), [data, startDate, endDate]);

  const chartDateFormat = (d) => { const p = d.split('-'); return `${p[1]}/${p[2]}`; };

  return (
    <div className="page-container">
      <h1 className="page-title">Economic Analysis</h1>

      {/* ROI Calculator */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>ROI Calculator</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 24px', boxShadow: 'var(--shadow-card)' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>Manual cost per task ($)</label>
        <input
          type="range" min={10} max={200} step={5} value={manualCost}
          onChange={(e) => setManualCost(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem', minWidth: 40, textAlign: 'right' }}>${manualCost}</span>
      </div>

      {roi.total_tasks > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KPICard label="Agent Total Cost" value={`$${roi.agent_total_cost.toFixed(2)}`} />
          <KPICard label="Manual Equivalent" value={`$${roi.manual_equivalent_cost.toFixed(2)}`} />
          <KPICard label="Savings" value={`$${roi.savings.toFixed(2)}`} />
          <KPICard label="ROI" value={`${roi.roi_pct.toFixed(0)}%`} />
        </div>
      )}

      {/* Cost by Agent + Cost by Task Type side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Cost by Agent</h3>
          {cpa.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 12 }}>
              <ResponsiveContainer width="100%" height={Math.max(200, cpa.length * 36 + 40)}>
                <BarChart data={cpa} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis dataKey="Agent" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }} formatter={(v) => `$${v.toFixed(4)}`} />
                  <Bar dataKey="Total Cost ($)" fill="#2196F3" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <DataTable
            columns={[
              { key: 'Agent', label: 'Agent', cellStyle: { fontWeight: 600 } },
              { key: 'Tasks', label: 'Tasks' },
              { key: 'Total Cost ($)', label: 'Total Cost', render: (v) => `$${v.toFixed(4)}` },
              { key: 'Avg Cost/Task ($)', label: 'Avg Cost/Task', render: (v) => `$${v.toFixed(4)}` },
            ]}
            rows={cpa}
          />
        </div>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Cost by Task Type</h3>
          {cpt.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 12 }}>
              <ResponsiveContainer width="100%" height={Math.max(200, cpt.length * 36 + 40)}>
                <BarChart data={cpt} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis dataKey="Task Type" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }} formatter={(v) => `$${v.toFixed(4)}`} />
                  <Bar dataKey="Total Cost ($)" fill="#FF9800" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <DataTable
            columns={[
              { key: 'Task Type', label: 'Task Type', cellStyle: { fontWeight: 600 } },
              { key: 'Count', label: 'Count' },
              { key: 'Total Cost ($)', label: 'Total Cost', render: (v) => `$${v.toFixed(4)}` },
              { key: 'Avg Cost ($)', label: 'Avg Cost', render: (v) => `$${v.toFixed(4)}` },
            ]}
            rows={cpt}
          />
        </div>
      </div>

      {/* Download buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        {cpa.length > 0 && (
          <button
            onClick={() => downloadCSV([...cpa, ...cpt], 'economics_report.csv')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <Download size={16} /> Download Economics CSV
          </button>
        )}
        <button
          onClick={() => {
            const summary = performanceSummary(data, startDate, endDate);
            const report = { summary, costByAgent: cpa, costByType: cpt, roi, tokens };
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'agent_performance_report.json'; a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <Download size={16} /> Download Report
        </button>
      </div>

      {/* Token Usage Summary */}
      {tokens && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Token Usage Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <KPICard label="Total Tokens" value={tokens.total_tokens.toLocaleString()} />
            <KPICard label="Avg Tokens/Task" value={tokens.avg_tokens_per_task.toLocaleString()} />
            <KPICard label="Input:Output Ratio" value={tokens.input_output_ratio.toFixed(2)} />
            <KPICard label="Token Efficiency" value={`${(tokens.token_efficiency * 100).toFixed(1)}%`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* Pie chart */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12 }}>Token Distribution</h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={[{ name: 'Input', value: tokens.total_input_tokens }, { name: 'Output', value: tokens.total_output_tokens }]}
                    cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${((e.value / tokens.total_tokens) * 100).toFixed(1)}%`}
                    dataKey="value" fontSize={12}>
                    {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart tokens by outcome */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12 }}>Tokens by Outcome</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: 'Per Success', value: tokens.avg_tokens_per_success },
                  { name: 'Per Failure', value: tokens.avg_tokens_per_failure },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {BAR_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Cumulative Cost Trend */}
      {costTS.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Cumulative Cost Trend</h3>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 32 }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={costTS}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={chartDateFormat} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Area dataKey="cumulative_cost" fill="#2196F3" fillOpacity={0.15} stroke="#2196F3" strokeWidth={2} name="Cumulative Cost ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Workflow Economics */}
      {wfEcon.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Workflow Economics</h3>
          <DataTable columns={wfColumns} rows={wfEcon} />
        </>
      )}
    </div>
  );
}
