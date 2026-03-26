import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { useApp } from '../context/AppContext';
import KPICard from '../components/KPICard';
import DataTable from '../components/DataTable';

const COLOR_PALETTE = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548', '#607D8B'];

export default function WorkflowTraces() {
  const { data } = useApp();

  // Get unique trace IDs from spans
  const traceIds = useMemo(() => {
    const ids = [...new Set(data.spans.map((s) => s.trace_id))];
    return ids.slice(0, 50);
  }, [data.spans]);

  const [selectedTrace, setSelectedTrace] = useState('');

  // When trace IDs change and nothing selected, auto-select first
  const activeTrace = selectedTrace || (traceIds.length ? traceIds[0] : '');

  const spans = useMemo(() => {
    if (!activeTrace) return [];
    return data.spans
      .filter((s) => s.trace_id === activeTrace)
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  }, [data.spans, activeTrace]);

  const agentMap = useMemo(() => {
    const map = {};
    data.agents.forEach((a) => { map[a.agent_id] = a.name; });
    return map;
  }, [data.agents]);

  // Trace summary
  const summary = useMemo(() => {
    if (!spans.length) return null;
    const agentsInTrace = new Set(spans.map((s) => s.agent_id));
    const rootSpans = spans.filter((s) => !s.parent_span_id);
    const totalDuration = rootSpans.reduce((s, sp) => s + (sp.duration_ms || 0), 0);
    const errors = spans.filter((s) => s.status === 'ERROR').length;
    return { spanCount: spans.length, agentCount: agentsInTrace.size, totalDuration, errors, agents: [...agentsInTrace] };
  }, [spans]);

  // Gantt chart data
  const ganttData = useMemo(() => {
    if (!spans.length) return [];
    const minTime = Math.min(...spans.map((s) => new Date(s.started_at).getTime()));
    const agentColors = {};
    const uniqueAgents = [...new Set(spans.map((s) => s.agent_id))].sort();
    uniqueAgents.forEach((aid, i) => { agentColors[aid] = COLOR_PALETTE[i % COLOR_PALETTE.length]; });

    return spans.map((span, i) => {
      const startOffset = new Date(span.started_at).getTime() - minTime;
      const duration = span.duration_ms || 0;
      const depth = span.parent_span_id ? (spans.some((s) => s.span_id === span.parent_span_id && s.parent_span_id) ? 2 : 1) : 0;
      const label = depth === 0
        ? `[${agentMap[span.agent_id] || span.agent_id}] ${span.operation}`
        : `${'  '.repeat(depth)}${span.operation}`;

      return {
        name: label,
        startOffset: Math.round(startOffset),
        duration: Math.round(duration),
        color: agentColors[span.agent_id] || '#999',
        status: span.status,
        agent: agentMap[span.agent_id] || span.agent_id,
        operation: span.operation,
      };
    });
  }, [spans, agentMap]);

  // Span details for table
  const spanDetails = useMemo(() => spans.map((s) => ({
    Operation: s.operation,
    Agent: agentMap[s.agent_id] || s.agent_id,
    'Duration (ms)': s.duration_ms ? Math.round(s.duration_ms * 10) / 10 : 0,
    Status: s.status,
    Attributes: s.attributes ? JSON.stringify(s.attributes) : '',
  })), [spans, agentMap]);

  if (!traceIds.length) {
    return (
      <div className="page-container">
        <h1 className="page-title">Workflow Traces</h1>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 32, boxShadow: 'var(--shadow-card)', color: 'var(--text-secondary)' }}>
          No trace data available.
        </div>
      </div>
    );
  }

  const detailColumns = [
    { key: 'Operation', label: 'Operation', cellStyle: { fontWeight: 500 } },
    { key: 'Agent', label: 'Agent' },
    { key: 'Duration (ms)', label: 'Duration (ms)' },
    { key: 'Status', label: 'Status', render: (v) => (
      <span style={{
        padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
        background: v === 'OK' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
        color: v === 'OK' ? 'var(--success)' : '#ef4444',
      }}>{v}</span>
    ) },
    { key: 'Attributes', label: 'Attributes', cellStyle: { fontSize: '0.72rem', fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' } },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">Workflow Traces</h1>

      {/* Trace selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>Select Trace</label>
        <select
          value={activeTrace}
          onChange={(e) => setSelectedTrace(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', fontSize: '0.82rem', background: 'var(--surface)', cursor: 'pointer', minWidth: 300 }}
        >
          {traceIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {/* Trace summary KPIs */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KPICard label="Spans" value={summary.spanCount} />
          <KPICard label="Agents" value={summary.agentCount} />
          <KPICard label="Root Duration" value={`${summary.totalDuration.toLocaleString()}ms`} />
          <KPICard label="Errors" value={summary.errors} />
        </div>
      )}

      {/* Gantt-style Timeline */}
      {ganttData.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Trace Timeline</h3>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 32, overflowX: 'auto' }}>
            <div style={{ minWidth: 600 }}>
              {ganttData.map((item, i) => {
                const maxDuration = Math.max(...ganttData.map((g) => g.startOffset + g.duration));
                const leftPct = maxDuration > 0 ? (item.startOffset / maxDuration) * 100 : 0;
                const widthPct = maxDuration > 0 ? Math.max((item.duration / maxDuration) * 100, 0.5) : 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ width: 220, flexShrink: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8, textAlign: 'right' }}
                      title={item.name}>
                      {item.name}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 16 }}>
                      <div style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: item.color,
                        opacity: item.status === 'ERROR' ? 0.5 : 0.85,
                        border: item.status === 'ERROR' ? '2px solid #F44336' : 'none',
                      }}
                        title={`${item.operation} — ${item.duration}ms (${item.agent})`}
                      />
                    </div>
                    <div style={{ width: 60, flexShrink: 0, fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'right', paddingLeft: 8 }}>
                      {item.duration}ms
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              {[...new Set(ganttData.map((g) => g.agent))].map((agent, i) => {
                const color = ganttData.find((g) => g.agent === agent)?.color;
                return (
                  <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
                    {agent}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Span Details Table */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: 12 }}>Span Details</h3>
      <DataTable columns={detailColumns} rows={spanDetails} />
    </div>
  );
}
