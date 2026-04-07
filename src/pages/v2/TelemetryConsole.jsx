import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Database } from 'lucide-react';
import KPICard from '../../components/KPICard';
import DataTable from '../../components/DataTable';
import { getAgentTelemetry } from '../../api/client';
import shared from './v2-shared.module.css';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const AGENTS = [
  { id: 'intake_classifier', name: 'Intake Classifier', color: 'var(--accent)' },
  { id: 'triage_scorer', name: 'Triage Scorer', color: 'var(--success)' },
  { id: 'response_drafter', name: 'Response Drafter', color: 'var(--warning)' },
];

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    marginBottom: 28,
  },
  agentCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 24,
  },
  agentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  agentDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
  agentName: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--text-primary)',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
    marginBottom: 16,
  },
  miniKpi: {
    textAlign: 'center',
    padding: '10px 6px',
    borderRadius: 'var(--radius-xs)',
    background: 'var(--bg)',
  },
  miniLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
    marginBottom: 2,
  },
  miniValue: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  versionToggle: {
    display: 'flex',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  versionBtn: (active) => ({
    padding: '8px 20px',
    fontSize: '0.82rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  }),
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
};

const tableColumns = [
  { key: 'timestamp', label: 'Time', render: (v) => v ? (
    <span title={new Date(v).toLocaleString()}>{timeAgo(v)}</span>
  ) : '—' },
  { key: 'run_version', label: 'Version' },
  { key: 'iteration', label: 'Iter' },
  { key: 'completion_status', label: 'Status', render: (v) => (
    <span style={{ color: v === 'success' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
      {v === 'success' ? '✓' : '✗'} {v}
    </span>
  )},
  { key: 'accuracy_score', label: 'Accuracy', render: (v) => v != null ? (
    <span style={{ fontWeight: 600, color: v >= 0.7 ? 'var(--success)' : v >= 0.4 ? 'var(--warning)' : 'var(--danger)' }}>
      {(v * 100).toFixed(0)}%
    </span>
  ) : '—' },
  { key: 'auop_score', label: 'AUoP', render: (v) => v != null ? (
    <span style={{ fontWeight: 600, color: v >= 0.7 ? 'var(--success)' : v >= 0.4 ? 'var(--warning)' : 'var(--danger)' }}>
      {(v * 100).toFixed(0)}%
    </span>
  ) : '—' },
  { key: 'latency_ms', label: 'Latency', render: (v) => `${Math.round(v)}ms` },
  { key: 'cost_usd', label: 'Cost', render: (v) => `$${v?.toFixed(4) || '0'}` },
  { key: 'input_tokens', label: 'In Tok' },
  { key: 'output_tokens', label: 'Out Tok' },
];

export default function TelemetryConsole() {
  const [version, setVersion] = useState(null);
  const [agentData, setAgentData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = {};
      for (const agent of AGENTS) {
        results[agent.id] = await getAgentTelemetry(agent.id, version, 100);
      }
      setAgentData(results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [version]);

  return (
    <div className="page-container">
      <h1 className="page-title">
        <Activity size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
        Agent Telemetry Console
      </h1>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.versionToggle} role="group" aria-label="Version filter">
          <button style={s.versionBtn(version === null)} onClick={() => setVersion(null)} aria-pressed={version === null}>All</button>
          <button style={s.versionBtn(version === 'v1')} onClick={() => setVersion('v1')} aria-pressed={version === 'v1'}>V1</button>
          <button style={s.versionBtn(version === 'v2')} onClick={() => setVersion('v2')} aria-pressed={version === 'v2'}>V2</button>
        </div>
        <button style={s.refreshBtn} onClick={fetchAll} disabled={loading} aria-label="Refresh telemetry">
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
        {error && <span style={{ color: 'var(--danger)', fontSize: '0.82rem' }} role="alert">{error}</span>}
      </div>

      {/* Empty State */}
      {!loading && Object.values(agentData).every((d) => !d?.count) && (
        <div className={shared.card} style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 28 }}>
          <Database size={40} style={{ color: 'var(--border)', marginBottom: 12 }} aria-hidden="true" />
          <div className={shared.emptyTitle}>No telemetry data yet</div>
          <div className={shared.emptySub}>
            Run a V1 or V2 pipeline from the Training Cycle or Live Demo page to start generating telemetry data.
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div style={s.grid}>
        {AGENTS.map((agent) => {
          const data = agentData[agent.id];
          const metrics = data?.metrics || {};

          return (
            <div key={agent.id} style={s.agentCard}>
              <div style={s.agentHeader}>
                <div style={s.agentDot(agent.color)} aria-hidden="true" />
                <span style={s.agentName}>{agent.name}</span>
              </div>

              {loading && !data ? (
                <div>
                  <div className="skeleton skeleton-text" style={{ width: '100%', height: 50, marginBottom: 10 }} />
                  <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                </div>
              ) : (
                <>
                  <div style={s.kpiRow}>
                    <div style={s.miniKpi}>
                      <div style={s.miniLabel}>Completion</div>
                      <div style={s.miniValue}>{((metrics.completion_rate || 0) * 100).toFixed(0)}%</div>
                    </div>
                    <div style={s.miniKpi}>
                      <div style={s.miniLabel}>Accuracy</div>
                      <div style={s.miniValue}>{((metrics.accuracy || 0) * 100).toFixed(0)}%</div>
                    </div>
                    <div style={s.miniKpi}>
                      <div style={s.miniLabel}>Escalation</div>
                      <div style={s.miniValue}>{((metrics.escalation_rate || 0) * 100).toFixed(0)}%</div>
                    </div>
                    <div style={s.miniKpi}>
                      <div style={s.miniLabel}>Avg Time</div>
                      <div style={s.miniValue}>{(metrics.avg_task_time || 0).toFixed(1)}s</div>
                    </div>
                    <div style={s.miniKpi}>
                      <div style={s.miniLabel}>AUoP</div>
                      <div style={s.miniValue}>{((metrics.auop || 0) * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {data?.count || 0} telemetry rows
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Telemetry Table */}
      {AGENTS.map((agent) => {
        const data = agentData[agent.id];
        return (
          <div key={agent.id} style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, marginBottom: 10 }}>
              <span style={{ ...s.agentDot(agent.color), display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} aria-hidden="true" />
              {agent.name} — Recent Rows
            </h3>
            <DataTable columns={tableColumns} rows={data?.rows || []} emptyMessage="No telemetry data yet. Run a pipeline to generate data." />
          </div>
        );
      })}
    </div>
  );
}
