/**
 * API client for Fuzebox Agent Backend.
 * All fetch calls go through this layer so the base URL is configurable.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
        : `API error ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

// ── Health ───────────────────────────────────────────────────────────────

export function getHealth() {
  return request('/health');
}

export function getUsageSummary() {
  return request('/usage-summary');
}

// ── Runs ─────────────────────────────────────────────────────────────────

export function runV1(inputText, iteration = 1) {
  return request('/run/v1', {
    method: 'POST',
    body: JSON.stringify({ input_text: inputText, iteration }),
  });
}

export function runV2(inputText, tuningParams = null, iteration = 1) {
  return request('/run/v2', {
    method: 'POST',
    body: JSON.stringify({
      input_text: inputText,
      tuning_params: tuningParams,
      iteration,
    }),
  });
}

// ── Telemetry ────────────────────────────────────────────────────────────

export function getAgentTelemetry(agentId, runVersion = null, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (runVersion) params.set('run_version', runVersion);
  return request(`/telemetry/${agentId}?${params}`);
}

export function getAllTelemetry(runVersion = null, limit = 200) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (runVersion) params.set('run_version', runVersion);
  return request(`/telemetry/?${params}`);
}

export function getComparison() {
  return request('/telemetry/comparison/delta');
}

// ── Tuning ───────────────────────────────────────────────────────────────

export function getTuningParams() {
  return request('/tuning-params/');
}

export function getAgentTuning(agentId) {
  return request(`/tuning-params/${agentId}`);
}

export function setAgentTuning(agentId, params) {
  return request(`/tuning-params/${agentId}`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, ...params }),
  });
}

export function resetAgentTuning(agentId) {
  return request(`/tuning-params/reset/${agentId}`, { method: 'POST' });
}

export function getPresets() {
  return request('/tuning-params/presets');
}
