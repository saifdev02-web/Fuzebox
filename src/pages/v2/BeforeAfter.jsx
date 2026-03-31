import { useState, useEffect } from 'react';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import KPICard from '../../components/KPICard';
import { getComparison } from '../../api/client';

const AGENTS = [
  { id: 'intake_classifier', name: 'Intake Classifier' },
  { id: 'triage_scorer', name: 'Triage Scorer' },
  { id: 'response_drafter', name: 'Response Drafter' },
];

const METRIC_LABELS = {
  completion_rate: 'Completion Rate',
  accuracy: 'Accuracy',
  escalation_rate: 'Escalation Rate',
  avg_task_time: 'Avg Task Time',
  auop: 'AUoP Score',
};

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    marginBottom: 32,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 20,
  },
  cardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '0.95rem',
    fontWeight: 600,
    marginBottom: 16,
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  compareRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 12,
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  metricLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
    marginBottom: 20,
    textAlign: 'center',
  },
  side: (align) => ({
    textAlign: align,
  }),
  sideLabel: {
    fontSize: '0.68rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
    marginBottom: 2,
  },
  sideValue: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  delta: (improved) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  }),
  deltaValue: (improved) => ({
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: improved ? 'var(--success)' : improved === false ? 'var(--danger)' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }),
  deltaLabel: {
    fontSize: '0.62rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  overallSection: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 28,
    marginBottom: 24,
  },
  overallTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.2rem',
    fontWeight: 700,
    marginBottom: 20,
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  overallGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 16,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
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
  empty: {
    textAlign: 'center',
    padding: 40,
    color: 'var(--text-secondary)',
    fontSize: '0.92rem',
  },
};

function formatMetric(key, value) {
  if (key === 'avg_task_time') return `${value.toFixed(2)}s`;
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(key, delta) {
  if (key === 'avg_task_time') return `${delta > 0 ? '+' : ''}${delta.toFixed(2)}s`;
  return `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
}

function DeltaIcon({ improved }) {
  if (improved === true) return <TrendingUp size={14} aria-label="Improved" />;
  if (improved === false) return <TrendingDown size={14} aria-label="Declined" />;
  return <Minus size={14} aria-label="No change" />;
}

export default function BeforeAfter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getComparison();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (error) {
    return (
      <div className="page-container">
        <h1 className="page-title">
          <ArrowLeftRight size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
          Before / After Comparison
        </h1>
        <div style={s.empty} role="alert">
          <p>{error}</p>
          <p style={{ marginTop: 8, fontSize: '0.82rem' }}>
            Run both V1 and V2 pipelines in the Training Cycle page first.
          </p>
          <button style={{ ...s.refreshBtn, margin: '16px auto' }} onClick={fetchData}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const overall = data?.overall || {};

  return (
    <div className="page-container">
      <h1 className="page-title">
        <ArrowLeftRight size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
        Before / After Comparison
      </h1>

      <div style={s.toolbar}>
        <button style={s.refreshBtn} onClick={fetchData} disabled={loading} aria-label="Refresh comparison data">
          <RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
        {data && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            V1: {data.v1_total_rows} rows | V2: {data.v2_total_rows} rows
          </span>
        )}
      </div>

      {/* Overall Comparison */}
      {data && (
        <div style={s.overallSection}>
          <div style={s.overallTitle}>Full Workflow — V1 vs V2</div>
          <div style={s.overallGrid}>
            {Object.entries(METRIC_LABELS).map(([key, label]) => {
              const metric = overall[key];
              if (!metric) return null;
              return (
                <div key={key} style={{ textAlign: 'center' }}>
                  <div style={s.metricLabel}>{label}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>V1</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem' }}>
                        {formatMetric(key, metric.v1)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>V2</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem' }}>
                        {formatMetric(key, metric.v2)}
                      </div>
                    </div>
                  </div>
                  <div style={s.deltaValue(metric.improved)}>
                    <DeltaIcon improved={metric.improved} />
                    {formatDelta(key, metric.delta)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RoP */}
          {overall.rop && (
            <div style={{ marginTop: 24, textAlign: 'center', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
                AI-ROI Improvement (RoP)
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.6rem', color: 'var(--accent)' }}>
                {overall.rop.delta > 0 ? '+' : ''}{overall.rop.delta}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                V1: {overall.rop.v1.rop_pct}% | V2: {overall.rop.v2.rop_pct}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-Agent Comparison */}
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
        Per-Agent Breakdown
      </h2>
      <div style={s.grid}>
        {AGENTS.map((agent) => {
          const agentDelta = data?.per_agent?.[agent.id];
          if (!agentDelta) {
            return (
              <div key={agent.id} style={s.card}>
                <div style={s.cardTitle}>{agent.name}</div>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: 20 }}>
                  No comparison data
                </div>
              </div>
            );
          }

          return (
            <div key={agent.id} style={s.card}>
              <div style={s.cardTitle}>{agent.name}</div>
              {Object.entries(METRIC_LABELS).map(([key, label]) => {
                const metric = agentDelta[key];
                if (!metric) return null;
                return (
                  <div key={key} style={s.compareRow}>
                    <div style={s.side('left')}>
                      <div style={s.sideLabel}>V1</div>
                      <div style={s.sideValue}>{formatMetric(key, metric.v1)}</div>
                    </div>
                    <div style={s.delta(metric.improved)}>
                      <div style={s.deltaValue(metric.improved)}>
                        <DeltaIcon improved={metric.improved} />
                        {formatDelta(key, metric.delta)}
                      </div>
                      <div style={s.deltaLabel}>{label}</div>
                    </div>
                    <div style={s.side('right')}>
                      <div style={s.sideLabel}>V2</div>
                      <div style={s.sideValue}>{formatMetric(key, metric.v2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
