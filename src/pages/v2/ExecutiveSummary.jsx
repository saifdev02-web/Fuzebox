import { useState, useEffect, useRef } from 'react';
import { FileText, RefreshCw, Download, TrendingUp, DollarSign, Zap, Shield } from 'lucide-react';
import { getComparison, getAllTelemetry } from '../../api/client';
import shared from './v2-shared.module.css';

export default function ExecutiveSummary() {
  const [data, setData] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [comp, telem] = await Promise.all([
        getComparison(),
        getAllTelemetry(null, 2000),
      ]);
      if (!comp.error) setData(comp);
      if (telem?.rows) setTelemetry(telem);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleExport = () => {
    window.print();
  };

  const overall = data?.overall;
  const v1Rows = telemetry?.rows?.filter((r) => r.run_version === 'v1') || [];
  const v2Rows = telemetry?.rows?.filter((r) => r.run_version === 'v2') || [];

  // Calculate unique runs
  const v1Runs = new Set(v1Rows.map((r) => r.run_id)).size;
  const v2Runs = new Set(v2Rows.map((r) => r.run_id)).size;
  const totalRuns = v1Runs + v2Runs;

  // Costs
  const totalCost = [...v1Rows, ...v2Rows].reduce((s, r) => s + (r.cost_usd || 0), 0);
  const costPerRun = totalRuns > 0 ? totalCost / totalRuns : 0;
  const annualProjection = costPerRun * 10000; // 10k runs/year estimate
  const manualAnnual = 10000 * 50; // $50 per manual task
  const annualSavings = manualAnnual - annualProjection;

  // Tokens
  const totalTokens = [...v1Rows, ...v2Rows].reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);

  const accuracyV1 = overall?.accuracy?.v1 || 0;
  const accuracyV2 = overall?.accuracy?.v2 || 0;
  const auopV1 = overall?.auop?.v1 || 0;
  const auopV2 = overall?.auop?.v2 || 0;

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="page-container" ref={reportRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            <FileText size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Executive Summary
          </h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchData} disabled={loading} style={s.btn} aria-label="Refresh report data">
              <RefreshCw size={14} aria-hidden="true" /> {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button onClick={handleExport} style={{ ...s.btn, background: 'var(--accent)', color: '#fff', border: 'none' }} aria-label="Export report as PDF">
              <Download size={14} aria-hidden="true" /> Export PDF
            </button>
          </div>
        </div>

        {/* Report Header */}
        <div style={s.reportHeader}>
          <div style={{ fontSize: '1.6rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI Agent Performance Report
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            FuzeBox r·Potential Platform &nbsp;|&nbsp; Generated {today}
          </div>
        </div>

        {/* Loading State */}
        {loading && !data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton skeleton-card" style={{ height: 100 }} />
              ))}
            </div>
            <div className="skeleton skeleton-card" style={{ height: 200, marginBottom: 24 }} />
            <div className="skeleton skeleton-card" style={{ height: 160, marginBottom: 24 }} />
            <div className="skeleton skeleton-card" style={{ height: 140 }} />
          </>
        )}

        {/* Key Metrics */}
        {(!loading || data) && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <MetricCard icon={Zap} label="Total Pipeline Runs" value={totalRuns} sub={`V1: ${v1Runs} | V2: ${v2Runs}`} />
          <MetricCard icon={TrendingUp} label="Accuracy Improvement" value={`+${((accuracyV2 - accuracyV1) * 100).toFixed(1)}%`} sub={`V1: ${(accuracyV1 * 100).toFixed(1)}% → V2: ${(accuracyV2 * 100).toFixed(1)}%`} color="var(--success)" />
          <MetricCard icon={Shield} label="AUoP Score" value={`${(auopV2 * 100).toFixed(1)}%`} sub={`V1: ${(auopV1 * 100).toFixed(1)}% → V2: ${(auopV2 * 100).toFixed(1)}%`} color="var(--accent)" />
          <MetricCard icon={DollarSign} label="Cost Per Run" value={`$${costPerRun.toFixed(4)}`} sub={`Total spent: $${totalCost.toFixed(4)}`} />
        </div>

        {/* Performance Comparison */}
        <div style={{ ...s.card, marginBottom: 24 }} role="region" aria-label="Performance comparison">
          <div style={s.sectionTitle}>Performance Comparison: V1 vs V2</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {overall && [
              { label: 'Completion Rate', v1: overall.completion_rate?.v1, v2: overall.completion_rate?.v2, delta: overall.completion_rate?.delta, fmt: 'pct' },
              { label: 'Accuracy', v1: overall.accuracy?.v1, v2: overall.accuracy?.v2, delta: overall.accuracy?.delta, fmt: 'pct' },
              { label: 'Escalation Rate', v1: overall.escalation_rate?.v1, v2: overall.escalation_rate?.v2, delta: overall.escalation_rate?.delta, fmt: 'pct', invert: true },
              { label: 'Avg Task Time', v1: overall.avg_task_time?.v1, v2: overall.avg_task_time?.v2, delta: overall.avg_task_time?.delta, fmt: 'sec', invert: true },
              { label: 'AUoP Score', v1: overall.auop?.v1, v2: overall.auop?.v2, delta: overall.auop?.delta, fmt: 'pct' },
            ].map((m) => (
              <div key={m.label} style={s.compCard}>
                <div style={s.compLabel}>{m.label}</div>
                <div style={s.compRow}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>V1</span>
                  <span style={{ fontWeight: 600 }}>
                    {m.fmt === 'pct' ? `${((m.v1 || 0) * 100).toFixed(1)}%` : `${(m.v1 || 0).toFixed(2)}s`}
                  </span>
                </div>
                <div style={s.compRow}>
                  <span style={{ color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600 }}>V2</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    {m.fmt === 'pct' ? `${((m.v2 || 0) * 100).toFixed(1)}%` : `${(m.v2 || 0).toFixed(2)}s`}
                  </span>
                </div>
                <div style={{
                  textAlign: 'center', marginTop: 8, padding: '4px 0',
                  borderTop: '1px solid var(--border)',
                  fontWeight: 700, fontSize: '0.88rem',
                  color: (m.invert ? (m.delta || 0) < 0 : (m.delta || 0) > 0) ? 'var(--success)' : (m.delta || 0) === 0 ? 'var(--text-secondary)' : 'var(--danger)',
                }}>
                  {m.fmt === 'pct'
                    ? `${(m.delta || 0) > 0 ? '+' : ''}${((m.delta || 0) * 100).toFixed(1)}%`
                    : `${(m.delta || 0) > 0 ? '+' : ''}${(m.delta || 0).toFixed(2)}s`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Analysis */}
        <div style={{ ...s.card, marginBottom: 24 }} role="region" aria-label="Cost analysis">
          <div style={s.sectionTitle}>Cost Analysis & ROI Projection</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            <div style={s.costCard}>
              <div style={s.costLabel}>Current AI Cost</div>
              <div style={s.costValue}>${totalCost.toFixed(4)}</div>
              <div style={s.costSub}>{totalRuns} runs × ${costPerRun.toFixed(4)}/run</div>
            </div>
            <div style={s.costCard}>
              <div style={s.costLabel}>Annual Projection (10K runs)</div>
              <div style={s.costValue}>${annualProjection.toFixed(2)}</div>
              <div style={s.costSub}>vs ${manualAnnual.toLocaleString()} manual processing</div>
            </div>
            <div style={{ ...s.costCard, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={s.costLabel}>Estimated Annual Savings</div>
              <div style={{ ...s.costValue, color: 'var(--success)' }}>${annualSavings.toLocaleString()}</div>
              <div style={s.costSub}>{((annualSavings / manualAnnual) * 100).toFixed(1)}% cost reduction</div>
            </div>
          </div>
        </div>

        {/* Per-Agent Breakdown */}
        {data?.per_agent && (
          <div style={{ ...s.card, marginBottom: 24 }} role="region" aria-label="Per-agent performance">
            <div style={s.sectionTitle}>Per-Agent Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[
                { id: 'intake_classifier', name: 'Intake Classifier', emoji: '🏷️' },
                { id: 'triage_scorer', name: 'Triage Scorer', emoji: '⚖️' },
                { id: 'response_drafter', name: 'Response Drafter', emoji: '✍️' },
              ].map((agent) => {
                const agentData = data.per_agent[agent.id];
                if (!agentData) return null;
                return (
                  <div key={agent.id} style={s.agentCard}>
                    <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{agent.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 12, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </div>
                    <div style={s.agentRow}>
                      <span>Accuracy</span>
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                        {((agentData.accuracy?.v2 || 0) * 100).toFixed(0)}%
                        <span style={{ fontSize: '0.72rem', marginLeft: 4 }}>
                          ({(agentData.accuracy?.delta || 0) > 0 ? '+' : ''}{((agentData.accuracy?.delta || 0) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div style={s.agentRow}>
                      <span>AUoP</span>
                      <span style={{ fontWeight: 600 }}>
                        {((agentData.auop?.v2 || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={s.agentRow}>
                      <span>Avg Time</span>
                      <span style={{ fontWeight: 600 }}>
                        {(agentData.avg_task_time?.v2 || 0).toFixed(2)}s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div style={{ ...s.card, background: 'linear-gradient(135deg, rgba(232,132,42,0.06), rgba(232,132,42,0.02))', border: '1px solid rgba(232,132,42,0.2)' }} role="region" aria-label="Recommendation">
          <div style={s.sectionTitle}>Recommendation</div>
          <div style={{ fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--text-primary)' }}>
            <p>
              The V2 ReAct-tuned pipeline demonstrates a <strong style={{ color: 'var(--success)' }}>
              +{((accuracyV2 - accuracyV1) * 100).toFixed(1)}% accuracy improvement</strong> over the V1 baseline,
              with an AUoP score of <strong>{(auopV2 * 100).toFixed(1)}%</strong>.
              The self-correction reflection loop consistently identifies and fixes classification and triage errors
              that the one-shot V1 pipeline misses.
            </p>
            <p style={{ marginTop: 12 }}>
              At scale (10,000 tasks/year), the AI agent pipeline would cost approximately <strong>${annualProjection.toFixed(2)}</strong> compared
              to <strong>${manualAnnual.toLocaleString()}</strong> for manual processing — a <strong style={{ color: 'var(--success)' }}>
              {((annualSavings / manualAnnual) * 100).toFixed(1)}% cost reduction</strong> representing
              <strong> ${annualSavings.toLocaleString()}</strong> in annual savings.
            </p>
            <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--accent)' }}>
              Recommendation: Deploy V2 tuned pipeline to production. The accuracy and cost improvements
              justify the investment in the ReAct reflection architecture.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          FuzeBox r·Potential &nbsp;|&nbsp; {totalTokens.toLocaleString()} tokens processed &nbsp;|&nbsp; Report generated {today}
        </div>
        </>)}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          aside, button, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 20px !important; }
          .page-container { max-width: 100% !important; }
          * { box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={s.metricCard}>
      <Icon size={20} style={{ color: color || 'var(--accent)', marginBottom: 8 }} />
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={s.metricSub}>{sub}</div>
    </div>
  );
}

const s = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 24,
  },
  btn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
  },
  reportHeader: {
    textAlign: 'center', padding: '28px 0', marginBottom: 24,
    borderBottom: '2px solid var(--accent)',
  },
  sectionTitle: {
    fontFamily: 'var(--font-heading)', fontSize: '1.1rem',
    fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
  },
  metricCard: {
    background: 'var(--surface)', borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)', padding: 20, textAlign: 'center',
  },
  metricLabel: {
    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6,
  },
  metricValue: {
    fontFamily: 'var(--font-heading)', fontSize: '1.6rem',
    fontWeight: 700, lineHeight: 1.2,
  },
  metricSub: {
    fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6,
  },
  compCard: {
    padding: 14, borderRadius: 'var(--radius-sm)',
    background: 'var(--bg)', textAlign: 'center',
  },
  compLabel: {
    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 10,
  },
  compRow: {
    display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
    fontSize: '0.85rem',
  },
  costCard: {
    padding: 20, borderRadius: 'var(--radius-sm)',
    background: 'var(--bg)', textAlign: 'center',
  },
  costLabel: {
    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8,
  },
  costValue: {
    fontFamily: 'var(--font-heading)', fontSize: '1.4rem',
    fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2,
  },
  costSub: {
    fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6,
  },
  agentCard: {
    padding: 20, borderRadius: 'var(--radius-sm)',
    background: 'var(--bg)', textAlign: 'center',
  },
  agentRow: {
    display: 'flex', justifyContent: 'space-between', padding: '6px 0',
    fontSize: '0.85rem', color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
  },
};
