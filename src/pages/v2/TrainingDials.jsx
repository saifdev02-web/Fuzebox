import { useState, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw, Save, Sparkles } from 'lucide-react';
import { getTuningParams, setAgentTuning, resetAgentTuning, getPresets } from '../../api/client';

const AGENTS = [
  { id: 'intake_classifier', name: 'Intake Classifier' },
  { id: 'triage_scorer', name: 'Triage Scorer' },
  { id: 'response_drafter', name: 'Response Drafter' },
];

const DIAL_INFO = {
  prompt_precision: {
    label: 'Prompt Precision',
    min: 0, max: 100, step: 5, unit: '',
    tooltip: '0–40: basic prompt | 40–70: category-aware | 70–100: expert prompt with multi-label support, scoring rubrics, and edge case handling.',
  },
  confidence_threshold: {
    label: 'Confidence Threshold',
    min: 0, max: 1, step: 0.05, unit: '',
    tooltip: 'Minimum confidence score an agent must reach before its output is accepted. Below this, the ReAct loop re-evaluates.',
  },
  fallback_depth: {
    label: 'Fallback Depth',
    min: 1, max: 5, step: 1, unit: ' levels',
    tooltip: 'How many fallback attempts the system tries. 1 = no fallback, 5 = try up to 5 different strategies.',
  },
  data_prefetch: {
    label: 'Data Pre-fetch',
    type: 'toggle',
    tooltip: 'When ON, agent fetches customer context (account tier, open tickets, SLA level) before scoring. Adds latency but improves accuracy.',
  },
  sentiment_weight: {
    label: 'Sentiment Weight',
    min: 0, max: 1, step: 0.1, unit: '',
    tooltip: '0.0 = ignore customer emotion | 0.5 = light sentiment hints | 1.0 = full sentiment analysis with tone-matching instructions.',
  },
  tone_variant: {
    label: 'Tone Variant',
    type: 'select',
    options: ['professional', 'empathetic', 'concise', 'dynamic'],
    tooltip: 'professional = business-like | empathetic = validation-first | concise = short & direct | dynamic = auto-select based on sentiment.',
  },
};

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24,
    marginBottom: 24,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    padding: 24,
  },
  cardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.05rem',
    fontWeight: 600,
    marginBottom: 20,
    color: 'var(--text-primary)',
  },
  dialGroup: {
    marginBottom: 18,
  },
  dialLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  dialValue: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  },
  slider: {
    width: '100%',
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
  },
  selectInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xs)',
    fontSize: '0.82rem',
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
  },
  tooltip: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginTop: 4,
    padding: '6px 8px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-xs)',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    marginTop: 20,
  },
  btn: (variant) => ({
    flex: 1,
    padding: '10px 16px',
    border: variant === 'primary' ? 'none' : '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: variant === 'primary' ? 'var(--accent)' : 'var(--surface)',
    color: variant === 'primary' ? '#fff' : 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.15s',
  }),
  status: (type) => ({
    fontSize: '0.78rem',
    padding: '8px 12px',
    borderRadius: 'var(--radius-xs)',
    marginBottom: 16,
    background: type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
    color: type === 'success' ? 'var(--success)' : 'var(--danger)',
  }),
};

export default function TrainingDials() {
  const [params, setParams] = useState({});
  const [presets, setPresets] = useState(null);
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadParams();
    getPresets().then(setPresets).catch(() => {});
  }, []);

  const loadParams = async () => {
    try {
      const data = await getTuningParams();
      const p = {};
      for (const agent of AGENTS) {
        p[agent.id] = data.params?.[agent.id] || {};
      }
      setParams(p);
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const updateParam = (agentId, key, value) => {
    setParams((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [key]: value },
    }));
  };

  const handleSave = async (agentId) => {
    setSaving((prev) => ({ ...prev, [agentId]: true }));
    try {
      await setAgentTuning(agentId, params[agentId]);
      setMessage({ type: 'success', text: `Saved tuning params for ${agentId}` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving((prev) => ({ ...prev, [agentId]: false }));
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleReset = async (agentId) => {
    try {
      await resetAgentTuning(agentId);
      await loadParams();
      setMessage({ type: 'success', text: `Reset ${agentId} to V2 preset` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const handlePreset = (agentId) => {
    if (presets?.v2_presets?.[agentId]) {
      setParams((prev) => ({
        ...prev,
        [agentId]: { ...prev[agentId], ...presets.v2_presets[agentId] },
      }));
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">
        <SlidersHorizontal size={24} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
        Training Dials
      </h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 700 }}>
        Tune each agent's parameters to improve performance. Each dial maps to a specific change in the agent's prompts, configuration, or execution logic.
      </p>

      {message && <div style={s.status(message.type)} role="status">{message.text}</div>}

      <div style={s.grid}>
        {AGENTS.map((agent) => {
          const agentParams = params[agent.id] || {};

          return (
            <div key={agent.id} style={s.card}>
              <div style={s.cardTitle}>{agent.name}</div>

              {Object.entries(DIAL_INFO).map(([key, dial]) => (
                <div key={key} style={s.dialGroup}>
                  {dial.type === 'toggle' ? (
                    <label style={s.toggle}>
                      <input
                        type="checkbox"
                        checked={agentParams[key] || false}
                        onChange={(e) => updateParam(agent.id, key, e.target.checked)}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                        aria-label={dial.label}
                      />
                      <span>{dial.label}</span>
                    </label>
                  ) : dial.type === 'select' ? (
                    <>
                      <div style={s.dialLabel}>
                        <span>{dial.label}</span>
                        <span style={s.dialValue}>{agentParams[key] || dial.options[0]}</span>
                      </div>
                      <select
                        style={s.selectInput}
                        value={agentParams[key] || dial.options[0]}
                        onChange={(e) => updateParam(agent.id, key, e.target.value)}
                        aria-label={dial.label}
                      >
                        {dial.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <div style={s.dialLabel}>
                        <span>{dial.label}</span>
                        <span style={s.dialValue}>
                          {typeof agentParams[key] === 'number' ? agentParams[key] : dial.min}
                          {dial.unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        style={s.slider}
                        min={dial.min}
                        max={dial.max}
                        step={dial.step}
                        value={agentParams[key] ?? dial.min}
                        onChange={(e) => updateParam(agent.id, key, parseFloat(e.target.value))}
                        aria-label={dial.label}
                        aria-valuemin={dial.min}
                        aria-valuemax={dial.max}
                        aria-valuenow={agentParams[key] ?? dial.min}
                      />
                    </>
                  )}
                  <div style={s.tooltip}>{dial.tooltip}</div>
                </div>
              ))}

              <div style={s.btnRow}>
                <button
                  style={s.btn('primary')}
                  onClick={() => handleSave(agent.id)}
                  disabled={saving[agent.id]}
                  aria-label={`Save ${agent.name} parameters`}
                >
                  <Save size={14} /> {saving[agent.id] ? 'Saving...' : 'Save'}
                </button>
                <button
                  style={s.btn('secondary')}
                  onClick={() => handlePreset(agent.id)}
                  aria-label={`Apply recommended preset for ${agent.name}`}
                >
                  <Sparkles size={14} /> Preset
                </button>
                <button
                  style={s.btn('secondary')}
                  onClick={() => handleReset(agent.id)}
                  aria-label={`Reset ${agent.name} parameters`}
                >
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
