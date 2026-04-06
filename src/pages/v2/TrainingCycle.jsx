import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Play, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { runV1, runV2, getTestInputs } from '../../api/client';

const FALLBACK_INPUTS = [
  "I can't log in to my account. I've tried resetting my password three times and it still says invalid credentials.",
  "Our billing shows we were charged $4,500 this month but our plan is only $299/month.",
  "The entire platform has been down for the last 2 hours. None of our team can access any features.",
  "Hi, I'd like to update the email address on my account from john@old.com to john@new.com.",
  "I've spoken to three different agents about this issue and nobody has resolved it. I want to speak to a manager.",
];

const PIPELINE_STEPS = [
  { key: 'classify', label: 'Step 1: Classify', desc: 'Intake Classifier categorizes the request', icon: Zap },
  { key: 'reflect_1', label: 'Step 2: Reflect (Classify)', desc: 'ReAct loop validates classification', icon: RefreshCw, v2Only: true },
  { key: 'triage', label: 'Step 3: Triage', desc: 'Triage Scorer assigns priority', icon: Zap },
  { key: 'reflect_2', label: 'Step 4: Reflect (Triage)', desc: 'ReAct loop validates triage score', icon: RefreshCw, v2Only: true },
  { key: 'draft', label: 'Step 5: Draft', desc: 'Response Drafter creates reply', icon: Zap },
  { key: 'reflect_3', label: 'Step 6: Reflect (Draft)', desc: 'ReAct loop validates draft quality', icon: RefreshCw, v2Only: true },
];

const s = {
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    marginBottom: 24,
  },
  panel: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 24,
  },
  panelTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.05rem',
    fontWeight: 600,
    marginBottom: 16,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  selectInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xs)',
    fontSize: '0.85rem',
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    marginBottom: 12,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xs)',
    fontSize: '0.85rem',
    fontFamily: 'var(--font-body)',
    minHeight: 80,
    resize: 'vertical',
    marginBottom: 12,
  },
  runBtnRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 20,
  },
  runBtn: (variant) => ({
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: variant === 'v1' ? 'var(--text-secondary)' : 'var(--accent)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'opacity 0.15s',
  }),
  timeline: {
    position: 'relative',
    paddingLeft: 32,
  },
  timelineLine: {
    position: 'absolute',
    left: 13,
    top: 0,
    bottom: 0,
    width: 2,
    background: 'var(--border)',
  },
  step: (status) => ({
    position: 'relative',
    marginBottom: 16,
    padding: '14px 16px',
    borderRadius: 'var(--radius-sm)',
    background: status === 'done' ? 'rgba(16,185,129,0.06)' : status === 'running' ? 'rgba(232,132,42,0.08)' : 'var(--bg)',
    border: status === 'running' ? '1px solid var(--accent)' : '1px solid transparent',
    transition: 'all 0.3s',
  }),
  stepDot: (status) => ({
    position: 'absolute',
    left: -26,
    top: 18,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: status === 'done' ? 'var(--success)' : status === 'running' ? 'var(--accent)' : 'var(--border)',
    border: '2px solid var(--surface)',
    transition: 'all 0.3s',
  }),
  stepLabel: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  stepOutput: {
    marginTop: 8,
    padding: '8px 10px',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xs)',
    fontSize: '0.78rem',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    maxHeight: 120,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  iterLabel: {
    fontFamily: 'var(--font-heading)',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  resultCard: {
    marginTop: 16,
    padding: 16,
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.82rem',
    marginBottom: 6,
  },
  evalSection: {
    marginTop: 12,
    padding: '10px 12px',
    background: 'rgba(16,185,129,0.05)',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid rgba(16,185,129,0.15)',
  },
  evalTitle: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--success)',
    marginBottom: 6,
    letterSpacing: '0.06em',
  },
};

export default function TrainingCycle() {
  const [testInputs, setTestInputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const [iteration, setIteration] = useState(1);
  const [v1Steps, setV1Steps] = useState({});
  const [v2Steps, setV2Steps] = useState({});
  const [v1Result, setV1Result] = useState(null);
  const [v2Result, setV2Result] = useState(null);
  const [running, setRunning] = useState({ v1: false, v2: false });

  // Load test inputs from backend on mount
  useEffect(() => {
    getTestInputs()
      .then((data) => {
        if (data?.inputs?.length) {
          setTestInputs(data.inputs);
        } else {
          // Fallback to hardcoded inputs if backend unavailable
          setTestInputs(FALLBACK_INPUTS.map((text, i) => ({
            id: `LOCAL-${i + 1}`,
            input_text: text,
            category: '',
            notes: '',
          })));
        }
      })
      .catch(() => {
        setTestInputs(FALLBACK_INPUTS.map((text, i) => ({
          id: `LOCAL-${i + 1}`,
          input_text: text,
          category: '',
          notes: '',
        })));
      });
  }, []);

  const getInput = () => {
    if (customInput) return customInput;
    const item = testInputs[selectedInput];
    return item?.input_text || item || '';
  };

  const simulateSteps = async (version, setSteps) => {
    const steps = version === 'v1'
      ? PIPELINE_STEPS.filter((s) => !s.v2Only)
      : PIPELINE_STEPS;

    for (let i = 0; i < steps.length; i++) {
      setSteps((prev) => ({ ...prev, [steps[i].key]: 'running' }));
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const handleRun = useCallback(async (version) => {
    const input = getInput();
    if (!input || !input.trim()) return;

    setRunning((prev) => ({ ...prev, [version]: true }));
    const setSteps = version === 'v1' ? setV1Steps : setV2Steps;
    const setResult = version === 'v1' ? setV1Result : setV2Result;

    setSteps({});
    setResult(null);

    const stepPromise = simulateSteps(version, setSteps);

    try {
      const result = version === 'v1'
        ? await runV1(input, iteration)
        : await runV2(input, null, iteration);

      await stepPromise;

      const steps = version === 'v1'
        ? PIPELINE_STEPS.filter((s) => !s.v2Only)
        : PIPELINE_STEPS;
      const doneSteps = {};
      steps.forEach((s) => { doneSteps[s.key] = 'done'; });
      setSteps(doneSteps);

      setResult(result);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setRunning((prev) => ({ ...prev, [version]: false }));
    }
  }, [testInputs, selectedInput, customInput, iteration]);

  const renderTimeline = (version) => {
    const steps = version === 'v1'
      ? PIPELINE_STEPS.filter((st) => !st.v2Only)
      : PIPELINE_STEPS;
    const stepState = version === 'v1' ? v1Steps : v2Steps;
    const result = version === 'v1' ? v1Result : v2Result;

    return (
      <>
        <div style={s.timeline}>
          <div style={s.timelineLine} aria-hidden="true" />
          {steps.map((step) => {
            const status = stepState[step.key] || 'pending';
            const Icon = step.icon;
            return (
              <div key={step.key} style={s.step(status)} role="listitem">
                <div style={s.stepDot(status)} aria-hidden="true" />
                <div style={s.stepLabel}>
                  <Icon size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {step.label}
                  {status === 'done' && <CheckCircle size={14} style={{ color: 'var(--success)', marginLeft: 6 }} aria-label="Complete" />}
                  {status === 'running' && <Clock size={14} style={{ color: 'var(--accent)', marginLeft: 6 }} aria-label="Running" />}
                </div>
                <div style={s.stepDesc}>{step.desc}</div>
              </div>
            );
          })}
        </div>

        {result && !result.error && (
          <div style={s.resultCard}>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Classification</span>
              <span style={{ fontWeight: 600 }}>
                {Array.isArray(result.classification?.classification)
                  ? result.classification.classification.join(', ')
                  : result.classification?.classification || '—'}
              </span>
            </div>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
              <span style={{ fontWeight: 600 }}>{((result.classification?.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Priority</span>
              <span style={{ fontWeight: 600 }}>{result.triage?.priority || '—'}/5</span>
            </div>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Latency</span>
              <span style={{ fontWeight: 600 }}>{Math.round(result.telemetry_summary?.total_latency_ms || 0)}ms</span>
            </div>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Tokens</span>
              <span style={{ fontWeight: 600 }}>
                {(result.telemetry_summary?.total_input_tokens || 0) + (result.telemetry_summary?.total_output_tokens || 0)}
              </span>
            </div>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Cost</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                ${(result.telemetry_summary?.total_cost_usd || 0).toFixed(4)}
              </span>
            </div>
            <div style={s.resultRow}>
              <span style={{ color: 'var(--text-secondary)' }}>Model</span>
              <span style={{ fontWeight: 600 }}>
                {result.telemetry_summary?.model_name || 'gpt-5.4-mini'}
              </span>
            </div>

            {/* Evaluation Scores */}
            {result.evaluation && (
              <div style={s.evalSection}>
                <div style={s.evalTitle}>Accuracy Scores (vs Ground Truth)</div>
                <div style={s.resultRow}>
                  <span style={{ color: 'var(--text-secondary)' }}>Classification Accuracy</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    {((result.evaluation.agent_1_accuracy || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={s.resultRow}>
                  <span style={{ color: 'var(--text-secondary)' }}>Triage Accuracy</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    {((result.evaluation.agent_2_accuracy || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={s.resultRow}>
                  <span style={{ color: 'var(--text-secondary)' }}>Draft Quality</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    {((result.evaluation.agent_3_accuracy || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ ...s.resultRow, borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Overall Accuracy</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.92rem' }}>
                    {((result.evaluation.overall_accuracy || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* Reflections (V2 only) */}
            {result.telemetry_summary?.reflections && (
              <div style={{ ...s.evalSection, background: 'rgba(232,132,42,0.05)', borderColor: 'rgba(232,132,42,0.15)', marginTop: 8 }}>
                <div style={{ ...s.evalTitle, color: 'var(--accent)' }}>ReAct Reflections</div>
                {Object.entries(result.telemetry_summary.reflections).map(([name, info]) => (
                  <div key={name} style={s.resultRow}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{name}</span>
                    <span style={{ fontWeight: 600, color: info.was_corrected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {info.was_corrected ? 'Corrected' : 'Confirmed'} ({Math.round(info.latency_ms)}ms)
                    </span>
                  </div>
                ))}
              </div>
            )}

            {result.draft?.response && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Draft Response</div>
                <div style={s.stepOutput}>{result.draft.response}</div>
              </div>
            )}
          </div>
        )}

        {result?.error && (
          <div style={{ ...s.resultCard, background: 'rgba(239,68,68,0.06)' }} role="alert">
            <AlertCircle size={14} style={{ color: 'var(--danger)', marginRight: 6 }} />
            <span style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>{result.error}</span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="page-container">
      <h1 className="page-title">
        <RefreshCw size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
        Training Cycle Visualizer
      </h1>

      {/* Input Selection */}
      <div style={{ ...s.panel, marginBottom: 24 }}>
        <div style={s.panelTitle}>Select Test Input</div>
        <select
          style={s.selectInput}
          value={selectedInput}
          onChange={(e) => { setSelectedInput(Number(e.target.value)); setCustomInput(''); }}
          aria-label="Select test input"
        >
          {testInputs.map((inp, i) => (
            <option key={inp.id || i} value={i}>
              [{inp.id}] {(inp.input_text || inp).slice(0, 90)}...
            </option>
          ))}
          <option value={-1}>Custom input...</option>
        </select>

        {/* Show selected input details */}
        {selectedInput >= 0 && testInputs[selectedInput] && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)' }}>
            <strong>Category:</strong> {testInputs[selectedInput].category || 'N/A'}
            {testInputs[selectedInput].notes && (
              <> &nbsp;|&nbsp; <strong>Note:</strong> {testInputs[selectedInput].notes}</>
            )}
          </div>
        )}

        {selectedInput === -1 && (
          <textarea
            style={s.textarea}
            placeholder="Type your custom service request..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            aria-label="Custom input text"
          />
        )}

        <div style={s.iterLabel}>
          <RefreshCw size={14} />
          Iteration {iteration}/10
          <input
            type="range"
            min={1}
            max={10}
            value={iteration}
            onChange={(e) => setIteration(Number(e.target.value))}
            style={{ width: 120, accentColor: 'var(--accent)', marginLeft: 8 }}
            aria-label="Iteration number"
          />
        </div>

        <div style={s.runBtnRow}>
          <button
            style={s.runBtn('v1')}
            onClick={() => handleRun('v1')}
            disabled={running.v1 || running.v2}
            aria-label="Run V1 baseline pipeline"
          >
            <Play size={16} /> {running.v1 ? 'Running V1...' : 'Run V1 Baseline'}
          </button>
          <button
            style={s.runBtn('v2')}
            onClick={() => handleRun('v2')}
            disabled={running.v1 || running.v2}
            aria-label="Run V2 tuned pipeline"
          >
            <Play size={16} /> {running.v2 ? 'Running V2...' : 'Run V2 Tuned'}
          </button>
        </div>
      </div>

      {/* Side-by-side timelines */}
      <div style={s.columns}>
        <div style={s.panel}>
          <div style={s.panelTitle}>V1 Baseline (One-Shot)</div>
          {renderTimeline('v1')}
        </div>
        <div style={s.panel}>
          <div style={s.panelTitle}>V2 Tuned (ReAct)</div>
          {renderTimeline('v2')}
        </div>
      </div>
    </div>
  );
}
