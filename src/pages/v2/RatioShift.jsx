import { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, Users, Bot } from 'lucide-react';
import { getComparison } from '../../api/client';

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 24,
    marginBottom: 24,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 28,
  },
  cardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: 20,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barContainer: {
    marginBottom: 24,
  },
  barLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  barTrack: {
    height: 36,
    borderRadius: 18,
    background: 'var(--bg)',
    overflow: 'hidden',
    display: 'flex',
    position: 'relative',
  },
  barAgent: (pct) => ({
    width: `${pct}%`,
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
    borderRadius: '18px 0 0 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: pct > 5 ? 'auto' : 0,
  }),
  barHuman: (pct) => ({
    width: `${pct}%`,
    height: '100%',
    background: 'var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 700,
    transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: pct > 5 ? 'auto' : 0,
  }),
  ratioDisplay: {
    textAlign: 'center',
    padding: '20px 0',
  },
  ratioNumber: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2.4rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.1,
  },
  ratioLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  narrative: {
    padding: 20,
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.88rem',
    lineHeight: 1.7,
    color: 'var(--text-primary)',
  },
  narrativeTitle: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    fontSize: '0.92rem',
    marginBottom: 8,
    color: 'var(--text-primary)',
  },
  ropCard: {
    background: 'linear-gradient(135deg, rgba(232,132,42,0.08), rgba(232,132,42,0.02))',
    borderRadius: 'var(--radius)',
    padding: 24,
    textAlign: 'center',
    border: '1px solid rgba(232,132,42,0.2)',
  },
  ropTitle: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  ropValue: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--accent)',
    lineHeight: 1.2,
  },
  ropDetail: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  legend: {
    display: 'flex',
    gap: 20,
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  legendDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
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
    marginBottom: 24,
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    color: 'var(--text-secondary)',
    fontSize: '0.92rem',
  },
};

function generateNarrative(v1Ratio, v2Ratio, ropData) {
  if (!v1Ratio || !v2Ratio) return null;

  const v1AgentPct = v1Ratio.total_tasks > 0
    ? ((v1Ratio.tasks_handled_by_agents / v1Ratio.total_tasks) * 100).toFixed(0)
    : 0;
  const v2AgentPct = v2Ratio.total_tasks > 0
    ? ((v2Ratio.tasks_handled_by_agents / v2Ratio.total_tasks) * 100).toFixed(0)
    : 0;

  const improvement = v2AgentPct - v1AgentPct;

  return (
    <>
      <p>
        In the V1 baseline, agents autonomously handled <strong>{v1AgentPct}%</strong> of
        tasks, requiring human intervention for the remaining <strong>{100 - v1AgentPct}%</strong>.
      </p>
      <p style={{ marginTop: 8 }}>
        After V2 tuning with the ReAct pattern, agent autonomy increased to{' '}
        <strong>{v2AgentPct}%</strong> — a <strong>{improvement > 0 ? '+' : ''}{improvement} percentage point</strong> shift.
        This means fewer tasks require human review, freeing team capacity
        for higher-value work.
      </p>
      {ropData && (
        <p style={{ marginTop: 8 }}>
          The estimated cost savings from V2 improvements are{' '}
          <strong>${ropData.v2?.savings?.toFixed(2) || '0'}</strong> compared to
          manual processing, representing a{' '}
          <strong>{ropData.v2?.rop_pct?.toFixed(0) || '0'}%</strong> return on AI investment.
        </p>
      )}
    </>
  );
}

export default function RatioShift() {
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

  const v1Ratio = data?.overall?.ratio_shift?.v1;
  const v2Ratio = data?.overall?.ratio_shift?.v2;
  const ropData = data?.overall?.rop;

  const v1AgentPct = v1Ratio?.total_tasks > 0
    ? (v1Ratio.tasks_handled_by_agents / v1Ratio.total_tasks) * 100
    : 0;
  const v2AgentPct = v2Ratio?.total_tasks > 0
    ? (v2Ratio.tasks_handled_by_agents / v2Ratio.total_tasks) * 100
    : 0;

  return (
    <div className="page-container">
      <h1 className="page-title">
        <TrendingUp size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
        Ratio Shift Dashboard
      </h1>

      <button style={s.refreshBtn} onClick={fetchData} disabled={loading} aria-label="Refresh ratio data">
        <RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}
      </button>

      {/* Loading State */}
      {loading && !data && !error && (
        <>
          <div style={s.card}>
            <div className="skeleton skeleton-text" style={{ width: 200, height: 16, marginBottom: 20 }} />
            <div className="skeleton skeleton-bar" style={{ marginBottom: 24 }} />
            <div className="skeleton skeleton-bar" />
          </div>
          <div style={{ ...s.grid, marginTop: 24 }}>
            <div className="skeleton skeleton-card" style={{ height: 180 }} />
            <div className="skeleton skeleton-card" style={{ height: 180 }} />
          </div>
        </>
      )}

      {error ? (
        <div style={s.empty} role="alert">
          <p>{error}</p>
          <p style={{ marginTop: 8, fontSize: '0.82rem' }}>
            Run both V1 and V2 pipelines to see the ratio shift.
          </p>
        </div>
      ) : data && (
        <>
          {/* Ratio Bars */}
          <div style={s.card}>
            <div style={s.cardTitle}>
              <Users size={18} /> Human-to-Agent Ratio
            </div>

            <div style={s.legend} aria-hidden="true">
              <div style={s.legendItem}>
                <div style={s.legendDot('var(--accent)')} /> Agent-handled
              </div>
              <div style={s.legendItem}>
                <div style={s.legendDot('var(--border)')} /> Human-required
              </div>
            </div>

            {/* V1 Bar */}
            <div style={s.barContainer}>
              <div style={s.barLabel}>
                <span>V1 Baseline</span>
                <span>Ratio: {v1Ratio?.ratio_display || 'N/A'}</span>
              </div>
              <div style={s.barTrack} role="img" aria-label={`V1 ratio: ${v1AgentPct.toFixed(0)}% agent, ${(100 - v1AgentPct).toFixed(0)}% human`}>
                <div style={s.barAgent(v1AgentPct)}>
                  {v1AgentPct > 10 && <><Bot size={12} /> {v1AgentPct.toFixed(0)}%</>}
                </div>
                <div style={s.barHuman(100 - v1AgentPct)}>
                  {(100 - v1AgentPct) > 10 && <><Users size={12} /> {(100 - v1AgentPct).toFixed(0)}%</>}
                </div>
              </div>
            </div>

            {/* V2 Bar */}
            <div style={s.barContainer}>
              <div style={s.barLabel}>
                <span>V2 Tuned</span>
                <span>Ratio: {v2Ratio?.ratio_display || 'N/A'}</span>
              </div>
              <div style={s.barTrack} role="img" aria-label={`V2 ratio: ${v2AgentPct.toFixed(0)}% agent, ${(100 - v2AgentPct).toFixed(0)}% human`}>
                <div style={s.barAgent(v2AgentPct)}>
                  {v2AgentPct > 10 && <><Bot size={12} /> {v2AgentPct.toFixed(0)}%</>}
                </div>
                <div style={s.barHuman(100 - v2AgentPct)}>
                  {(100 - v2AgentPct) > 10 && <><Users size={12} /> {(100 - v2AgentPct).toFixed(0)}%</>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...s.grid, marginTop: 24 }}>
            {/* Narrative Panel */}
            <div style={s.card}>
              <div style={s.cardTitle}>What This Means</div>
              <div style={s.narrative}>
                <div style={s.narrativeTitle}>Business Impact Summary</div>
                {data ? generateNarrative(v1Ratio, v2Ratio, ropData) : (
                  <p>Loading comparison data...</p>
                )}
              </div>
            </div>

            {/* RoP Card */}
            <div>
              <div style={s.ropCard}>
                <div style={s.ropTitle}>Return on Potential (RoP)</div>
                <div style={s.ropValue}>
                  {ropData ? `${ropData.v2?.rop_pct?.toFixed(0) || '0'}%` : '—'}
                </div>
                <div style={s.ropDetail}>
                  {ropData && (
                    <>
                      Agent cost: ${ropData.v2?.agent_cost?.toFixed(4) || '0'}<br />
                      Manual equivalent: ${ropData.v2?.manual_equivalent?.toFixed(2) || '0'}<br />
                      Net savings: ${ropData.v2?.savings?.toFixed(2) || '0'}
                    </>
                  )}
                </div>
              </div>

              <div style={{ ...s.ropCard, marginTop: 16 }}>
                <div style={s.ropTitle}>RoP Improvement (V1 → V2)</div>
                <div style={s.ropValue}>
                  {ropData ? `${ropData.delta > 0 ? '+' : ''}${ropData.delta}%` : '—'}
                </div>
                <div style={s.ropDetail}>
                  V1: {ropData?.v1?.rop_pct?.toFixed(0) || '0'}% → V2: {ropData?.v2?.rop_pct?.toFixed(0) || '0'}%
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
