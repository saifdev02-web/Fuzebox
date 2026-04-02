import { useState, useCallback, useEffect, useRef } from 'react';
import { Monitor, Play, CheckCircle, Clock, Zap, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { runV1, runV2, getTestInputs } from '../../api/client';

const PIPELINE_STEPS_V1 = [
  { key: 'classify', label: 'Agent 1: Classify', desc: 'Intake Classifier categorizes the request', icon: Zap },
  { key: 'triage', label: 'Agent 2: Triage', desc: 'Triage Scorer assigns priority', icon: Zap },
  { key: 'draft', label: 'Agent 3: Draft', desc: 'Response Drafter creates reply', icon: Zap },
];

const PIPELINE_STEPS_V2 = [
  { key: 'classify', label: 'Agent 1: Classify', desc: 'Intake Classifier categorizes the request', icon: Zap },
  { key: 'reflect_1', label: 'Reflect: Classify', desc: 'ReAct validates classification', icon: RefreshCw },
  { key: 'triage', label: 'Agent 2: Triage', desc: 'Triage Scorer assigns priority', icon: Zap },
  { key: 'reflect_2', label: 'Reflect: Triage', desc: 'ReAct validates triage score', icon: RefreshCw },
  { key: 'draft', label: 'Agent 3: Draft', desc: 'Response Drafter creates reply', icon: Zap },
  { key: 'reflect_3', label: 'Reflect: Draft', desc: 'ReAct validates draft quality', icon: RefreshCw },
];

export default function LiveDemo() {
  const [input, setInput] = useState('');
  const [version, setVersion] = useState('v2');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [stepState, setStepState] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const [testInputs, setTestInputs] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    getTestInputs()
      .then((data) => { if (data?.inputs?.length) setTestInputs(data.inputs); })
      .catch(() => {});
  }, []);

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const steps = version === 'v1' ? PIPELINE_STEPS_V1 : PIPELINE_STEPS_V2;

  const handleRun = useCallback(async () => {
    if (!input.trim() || running) return;
    setRunning(true);
    setResult(null);
    setStepState({});

    // Animate steps
    const currentSteps = version === 'v1' ? PIPELINE_STEPS_V1 : PIPELINE_STEPS_V2;
    const stepPromise = (async () => {
      for (const step of currentSteps) {
        setStepState((prev) => ({ ...prev, [step.key]: 'running' }));
        await new Promise((r) => setTimeout(r, 400));
      }
    })();

    try {
      const res = version === 'v1'
        ? await runV1(input, 1)
        : await runV2(input, null, 1);
      await stepPromise;
      const done = {};
      currentSteps.forEach((s) => { done[s.key] = 'done'; });
      setStepState(done);
      setResult(res);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setRunning(false);
    }
  }, [input, version, running]);

  const loadRandomInput = () => {
    if (testInputs.length) {
      const rand = testInputs[Math.floor(Math.random() * testInputs.length)];
      setInput(rand.input_text);
    }
  };

  return (
    <div
      ref={containerRef}
      className="page-container"
      style={fullscreen ? {
        position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)',
        padding: '40px 60px', overflow: 'auto',
      } : {}}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-title" style={{ margin: 0, fontSize: fullscreen ? '2rem' : undefined }}>
          <Monitor size={fullscreen ? 32 : 24} style={{ verticalAlign: 'middle', marginRight: 10, color: 'var(--accent)' }} />
          Live Agent Demo
        </h1>
        <button onClick={toggleFullscreen} style={s.fsBtn} aria-label="Toggle fullscreen">
          {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          {fullscreen ? 'Exit Fullscreen' : 'Presentation Mode'}
        </button>
      </div>

      {/* Input Area */}
      <div style={{ ...s.card, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={s.versionToggle}>
            <button
              style={version === 'v1' ? s.versionActive : s.versionBtn}
              onClick={() => setVersion('v1')}
            >V1 Baseline</button>
            <button
              style={version === 'v2' ? s.versionActive : s.versionBtn}
              onClick={() => setVersion('v2')}
            >V2 Tuned</button>
          </div>
          <button onClick={loadRandomInput} style={s.randomBtn} disabled={!testInputs.length}>
            <RefreshCw size={14} /> Random Input
          </button>
        </div>

        <textarea
          style={{ ...s.textarea, fontSize: fullscreen ? '1.1rem' : '0.92rem', minHeight: fullscreen ? 100 : 70 }}
          placeholder="Type any service request here... or click 'Random Input' to load a test case"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button
          style={{ ...s.runBtn, fontSize: fullscreen ? '1.1rem' : '0.95rem', padding: fullscreen ? '16px 32px' : '14px 28px' }}
          onClick={handleRun}
          disabled={running || !input.trim()}
        >
          <Play size={18} /> {running ? 'Processing...' : `Run ${version.toUpperCase()} Pipeline`}
        </button>
      </div>

      {/* Pipeline Visualization */}
      <div style={{ ...s.card, marginBottom: 24 }}>
        <div style={s.cardTitle}>Pipeline Execution</div>
        <div style={s.pipelineRow}>
          {steps.map((step, i) => {
            const status = stepState[step.key] || 'pending';
            const Icon = step.icon;
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={s.pipelineNode(status, fullscreen)}>
                  <div style={s.pipelineIcon(status)}>
                    {status === 'done' ? <CheckCircle size={fullscreen ? 24 : 20} /> :
                     status === 'running' ? <Clock size={fullscreen ? 24 : 20} className="spin" /> :
                     <Icon size={fullscreen ? 24 : 20} />}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: fullscreen ? '0.95rem' : '0.82rem', color: 'var(--text-primary)' }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: fullscreen ? '0.82rem' : '0.72rem', color: 'var(--text-secondary)' }}>
                    {step.desc}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={s.pipelineArrow(stepState[step.key] === 'done')}>→</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {result && !result.error && (
        <div style={s.card}>
          <div style={s.cardTitle}>Results</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={s.metricCard}>
              <div style={s.metricLabel}>Classification</div>
              <div style={s.metricValue(fullscreen)}>
                {Array.isArray(result.classification?.classification)
                  ? result.classification.classification.join(', ')
                  : result.classification?.classification || '—'}
              </div>
              <div style={s.metricSub}>Confidence: {((result.classification?.confidence || 0) * 100).toFixed(0)}%</div>
            </div>
            <div style={s.metricCard}>
              <div style={s.metricLabel}>Priority</div>
              <div style={s.metricValue(fullscreen)}>{result.triage?.priority || '—'} / 5</div>
              <div style={s.metricSub}>SLA: {result.triage?.sla || result.triage?.recommended_sla || '—'}</div>
            </div>
            <div style={s.metricCard}>
              <div style={s.metricLabel}>Latency</div>
              <div style={s.metricValue(fullscreen)}>{(result.telemetry_summary?.total_latency_ms / 1000).toFixed(2)}s</div>
              <div style={s.metricSub}>
                {(result.telemetry_summary?.total_input_tokens || 0) + (result.telemetry_summary?.total_output_tokens || 0)} tokens
              </div>
            </div>
          </div>

          {/* Evaluation */}
          {result.evaluation && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Classification', val: result.evaluation.agent_1_accuracy },
                { label: 'Triage', val: result.evaluation.agent_2_accuracy },
                { label: 'Draft Quality', val: result.evaluation.agent_3_accuracy },
                { label: 'Overall', val: result.evaluation.overall_accuracy },
              ].map((m) => (
                <div key={m.label} style={{ ...s.metricCard, background: 'rgba(16,185,129,0.06)' }}>
                  <div style={s.metricLabel}>{m.label} Accuracy</div>
                  <div style={{
                    ...s.metricValue(fullscreen),
                    color: (m.val || 0) >= 0.7 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {((m.val || 0) * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reflections */}
          {result.telemetry_summary?.reflections && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ReAct Reflections
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {Object.entries(result.telemetry_summary.reflections).map(([name, info]) => (
                  <div key={name} style={{
                    padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                    background: info.was_corrected ? 'rgba(232,132,42,0.08)' : 'var(--bg)',
                    border: `1px solid ${info.was_corrected ? 'rgba(232,132,42,0.3)' : 'var(--border)'}`,
                    flex: 1, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {name}
                    </div>
                    <div style={{
                      fontWeight: 700, fontSize: fullscreen ? '1rem' : '0.88rem',
                      color: info.was_corrected ? 'var(--accent)' : 'var(--success)',
                    }}>
                      {info.was_corrected ? '✓ Corrected' : '✓ Confirmed'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {Math.round(info.latency_ms)}ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Draft Response */}
          {result.draft?.response && (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Agent Draft Response
              </div>
              <div style={{
                padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                fontSize: fullscreen ? '1rem' : '0.88rem', lineHeight: 1.7,
                color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
              }}>
                {result.draft.response}
              </div>
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div style={{ ...s.card, background: 'rgba(239,68,68,0.06)', color: 'var(--danger)' }}>
          Error: {result.error}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

const s = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 28,
  },
  cardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.05rem',
    fontWeight: 600,
    marginBottom: 16,
    color: 'var(--text-primary)',
  },
  fsBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
  },
  versionToggle: {
    display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  versionBtn: {
    padding: '10px 24px', border: 'none', background: 'var(--bg)',
    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
  },
  versionActive: {
    padding: '10px 24px', border: 'none', background: 'var(--accent)',
    color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  },
  randomBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
    color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer',
  },
  textarea: {
    width: '100%', padding: '14px 16px',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-body)', resize: 'vertical',
    color: 'var(--text-primary)', background: 'var(--bg)',
    marginBottom: 16, boxSizing: 'border-box',
  },
  runBtn: {
    width: '100%', border: 'none',
    borderRadius: 'var(--radius-sm)', background: 'var(--accent)',
    color: '#fff', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    transition: 'opacity 0.15s',
  },
  pipelineRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    flexWrap: 'wrap', gap: 0,
  },
  pipelineNode: (status, fs) => ({
    textAlign: 'center', padding: fs ? '20px 16px' : '16px 12px',
    borderRadius: 'var(--radius-sm)', minWidth: fs ? 140 : 110,
    background: status === 'done' ? 'rgba(16,185,129,0.06)' :
                status === 'running' ? 'rgba(232,132,42,0.08)' : 'var(--bg)',
    border: status === 'running' ? '2px solid var(--accent)' :
            status === 'done' ? '2px solid var(--success)' : '2px solid transparent',
    transition: 'all 0.4s',
  }),
  pipelineIcon: (status) => ({
    marginBottom: 8,
    color: status === 'done' ? 'var(--success)' :
           status === 'running' ? 'var(--accent)' : 'var(--text-secondary)',
  }),
  pipelineArrow: (done) => ({
    fontSize: '1.5rem', fontWeight: 700, padding: '20px 6px',
    color: done ? 'var(--success)' : 'var(--border)',
    transition: 'color 0.3s',
  }),
  metricCard: {
    padding: 16, borderRadius: 'var(--radius-sm)',
    background: 'var(--bg)', textAlign: 'center',
  },
  metricLabel: {
    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6,
  },
  metricValue: (fs) => ({
    fontFamily: 'var(--font-heading)', fontSize: fs ? '1.8rem' : '1.4rem',
    fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2,
  }),
  metricSub: {
    fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4,
  },
};
