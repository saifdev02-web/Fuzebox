import { useState, useEffect, useRef } from 'react';
import { PlayCircle, CheckCircle, Clock, AlertCircle, BarChart3, RefreshCw, DollarSign } from 'lucide-react';
import { runV1, runV2, getTestInputs } from '../../api/client';

export default function BatchRunner() {
  const [testInputs, setTestInputs] = useState([]);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [summary, setSummary] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    getTestInputs()
      .then((data) => { if (data?.inputs?.length) setTestInputs(data.inputs); })
      .catch(() => {});
  }, []);

  const handleBatchRun = async () => {
    if (running || !testInputs.length) return;
    setRunning(true);
    setResults([]);
    setSummary(null);

    const total = testInputs.length * 2; // V1 + V2 for each
    let current = 0;
    const allResults = [];

    // Run V1 + V2 per input (faster feedback — see results per test case immediately)
    for (let i = 0; i < testInputs.length; i++) {
      const inp = testInputs[i];
      const entry = {
        id: inp.id,
        input: inp.input_text.slice(0, 80) + '...',
        category: inp.category,
        v1: null,
        v2: null,
        v1Status: 'running',
        v2Status: 'pending',
      };
      allResults.push(entry);
      setResults([...allResults]);

      // V1 run
      setProgress({ current: current + 1, total, phase: `V1: ${inp.id}` });
      try {
        const v1 = await runV1(inp.input_text, 1);
        allResults[i].v1 = v1;
        allResults[i].v1Status = 'done';
      } catch (e) {
        allResults[i].v1 = { error: e.message };
        allResults[i].v1Status = 'error';
      }
      current++;
      allResults[i].v2Status = 'running';
      setResults([...allResults]);

      // V2 run (immediately after V1 for same input)
      setProgress({ current: current + 1, total, phase: `V2: ${inp.id}` });
      try {
        const v2 = await runV2(inp.input_text, null, 1);
        allResults[i].v2 = v2;
        allResults[i].v2Status = 'done';
      } catch (e) {
        allResults[i].v2 = { error: e.message };
        allResults[i].v2Status = 'error';
      }
      current++;
      setResults([...allResults]);
      if (scrollRef.current?.scrollIntoView) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }

    // Calculate summary
    const v1Accs = allResults.filter((r) => r.v1?.evaluation).map((r) => r.v1.evaluation.overall_accuracy);
    const v2Accs = allResults.filter((r) => r.v2?.evaluation).map((r) => r.v2.evaluation.overall_accuracy);
    const v1Avg = v1Accs.length ? v1Accs.reduce((a, b) => a + b, 0) / v1Accs.length : 0;
    const v2Avg = v2Accs.length ? v2Accs.reduce((a, b) => a + b, 0) / v2Accs.length : 0;

    const v1Latencies = allResults.filter((r) => r.v1?.telemetry_summary).map((r) => r.v1.telemetry_summary.total_latency_ms);
    const v2Latencies = allResults.filter((r) => r.v2?.telemetry_summary).map((r) => r.v2.telemetry_summary.total_latency_ms);
    const v1AvgLat = v1Latencies.length ? v1Latencies.reduce((a, b) => a + b, 0) / v1Latencies.length : 0;
    const v2AvgLat = v2Latencies.length ? v2Latencies.reduce((a, b) => a + b, 0) / v2Latencies.length : 0;

    const v2Corrections = allResults.filter((r) => r.v2?.telemetry_summary?.reflections).reduce((count, r) => {
      return count + Object.values(r.v2.telemetry_summary.reflections).filter((ref) => ref.was_corrected).length;
    }, 0);

    const totalCost = allResults.reduce((sum, r) => {
      return sum + (r.v1?.telemetry_summary?.total_cost_usd || 0) + (r.v2?.telemetry_summary?.total_cost_usd || 0);
    }, 0);

    setSummary({
      total: testInputs.length,
      v1AvgAccuracy: v1Avg,
      v2AvgAccuracy: v2Avg,
      accuracyDelta: v2Avg - v1Avg,
      v1AvgLatency: v1AvgLat,
      v2AvgLatency: v2AvgLat,
      v2Corrections,
      totalCost,
      v1Errors: allResults.filter((r) => r.v1Status === 'error').length,
      v2Errors: allResults.filter((r) => r.v2Status === 'error').length,
    });

    setProgress({ current: total, total, phase: 'Complete' });
    setRunning(false);
  };

  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="page-container">
      <h1 className="page-title">
        <PlayCircle size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
        Batch Runner
      </h1>

      {/* Controls */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Run All {testInputs.length} Test Cases
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Runs each test input through both V1 and V2 pipelines, then shows a comparison summary
            </div>
          </div>
          <button style={s.runBtn} onClick={handleBatchRun} disabled={running || !testInputs.length}>
            {running ? (
              <><RefreshCw size={16} className="spin" /> Running...</>
            ) : (
              <><PlayCircle size={16} /> Start Batch Run</>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {progress.total > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{progress.phase}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{progress.current}/{progress.total}</span>
            </div>
            <div style={s.progressTrack}>
              <div style={s.progressFill(pct)} />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 20 }}>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>V1 Avg Accuracy</div>
            <div style={s.summaryValue}>{(summary.v1AvgAccuracy * 100).toFixed(1)}%</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>V2 Avg Accuracy</div>
            <div style={{ ...s.summaryValue, color: 'var(--success)' }}>{(summary.v2AvgAccuracy * 100).toFixed(1)}%</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Accuracy Improvement</div>
            <div style={{ ...s.summaryValue, color: summary.accuracyDelta > 0 ? 'var(--success)' : 'var(--danger)' }}>
              {summary.accuracyDelta > 0 ? '+' : ''}{(summary.accuracyDelta * 100).toFixed(1)}%
            </div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>V2 Self-Corrections</div>
            <div style={{ ...s.summaryValue, color: 'var(--accent)' }}>{summary.v2Corrections}</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total Batch Cost</div>
            <div style={s.summaryValue}>
              <DollarSign size={16} style={{ verticalAlign: 'middle' }} />{summary.totalCost.toFixed(4)}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div style={{ ...s.card, marginTop: 20, padding: 0, overflow: 'hidden' }}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>ID</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>V1 Status</th>
                <th style={s.th}>V1 Accuracy</th>
                <th style={s.th}>V2 Status</th>
                <th style={s.th}>V2 Accuracy</th>
                <th style={s.th}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const v1Acc = r.v1?.evaluation?.overall_accuracy;
                const v2Acc = r.v2?.evaluation?.overall_accuracy;
                const delta = v1Acc != null && v2Acc != null ? v2Acc - v1Acc : null;
                return (
                  <tr key={r.id} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={s.td}><strong>{r.id}</strong></td>
                    <td style={s.td}><span style={s.badge}>{r.category}</span></td>
                    <td style={s.td}>{renderStatus(r.v1Status)}</td>
                    <td style={s.td}>
                      {v1Acc != null ? <span style={{ fontWeight: 600 }}>{(v1Acc * 100).toFixed(0)}%</span> : '—'}
                    </td>
                    <td style={s.td}>{renderStatus(r.v2Status)}</td>
                    <td style={s.td}>
                      {v2Acc != null ? <span style={{ fontWeight: 600, color: 'var(--success)' }}>{(v2Acc * 100).toFixed(0)}%</span> : '—'}
                    </td>
                    <td style={s.td}>
                      {delta != null ? (
                        <span style={{ fontWeight: 700, color: delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {delta > 0 ? '+' : ''}{(delta * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div ref={scrollRef} />
        </div>
      )}

    </div>
  );
}

function renderStatus(status) {
  if (status === 'done') return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
  if (status === 'error') return <AlertCircle size={16} style={{ color: 'var(--danger)' }} />;
  if (status === 'running') return <RefreshCw size={16} className="spin" style={{ color: 'var(--accent)' }} />;
  if (status === 'pending') return <Clock size={16} style={{ color: 'var(--text-secondary)' }} />;
  return <Clock size={16} style={{ color: 'var(--text-secondary)' }} />;
}

const s = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 24,
  },
  runBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 28px', border: 'none',
    borderRadius: 'var(--radius-sm)', background: 'var(--accent)',
    color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
  },
  progressTrack: {
    height: 8, borderRadius: 4, background: 'var(--bg)', overflow: 'hidden',
  },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: 'linear-gradient(90deg, var(--accent), var(--accent-light, var(--accent)))',
    borderRadius: 4, transition: 'width 0.5s ease',
  }),
  summaryCard: {
    background: 'var(--surface)', borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)', padding: 20, textAlign: 'center',
  },
  summaryLabel: {
    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6,
  },
  summaryValue: {
    fontFamily: 'var(--font-heading)', fontSize: '1.6rem',
    fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2,
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem',
  },
  thead: {
    background: 'var(--bg)',
  },
  th: {
    padding: '12px 16px', textAlign: 'left', fontWeight: 600,
    fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
  trEven: {},
  trOdd: { background: 'rgba(0,0,0,0.015)' },
  badge: {
    padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem',
    fontWeight: 600, background: 'rgba(232,132,42,0.1)', color: 'var(--accent)',
  },
};
