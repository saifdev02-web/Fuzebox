import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import {
  getHealth,
  getUsageSummary,
  runV1,
  runV2,
  getAgentTelemetry,
  getComparison,
  getTuningParams,
  setAgentTuning,
  resetAgentTuning,
  getPresets,
} from './client';

beforeEach(() => {
  mockFetch.mockReset();
});

function mockOk(data) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockError(status, detail) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  });
}

describe('API Client', () => {
  describe('getHealth', () => {
    it('calls GET /health', async () => {
      mockOk({ status: 'healthy' });
      const data = await getHealth();
      expect(data.status).toBe('healthy');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });
  });

  describe('getUsageSummary', () => {
    it('calls GET /usage-summary', async () => {
      mockOk({ total_runs: 5 });
      const data = await getUsageSummary();
      expect(data.total_runs).toBe(5);
    });
  });

  describe('runV1', () => {
    it('sends POST /run/v1 with input_text', async () => {
      mockOk({ run_id: '123', run_version: 'v1' });
      const data = await runV1('test input');
      expect(data.run_version).toBe('v1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/run/v1'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test input'),
        })
      );
    });
  });

  describe('runV2', () => {
    it('sends POST /run/v2 with input_text and params', async () => {
      mockOk({ run_id: '456', run_version: 'v2' });
      const params = { prompt_precision: 85 };
      const data = await runV2('test input', params);
      expect(data.run_version).toBe('v2');
    });
  });

  describe('getAgentTelemetry', () => {
    it('calls GET /telemetry/{agent_id}', async () => {
      mockOk({ agent_id: 'intake_classifier', count: 10 });
      const data = await getAgentTelemetry('intake_classifier', 'v1');
      expect(data.agent_id).toBe('intake_classifier');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/telemetry/intake_classifier'),
        expect.any(Object)
      );
    });
  });

  describe('getComparison', () => {
    it('calls GET /telemetry/comparison/delta', async () => {
      mockOk({ overall: {}, per_agent: {} });
      const data = await getComparison();
      expect(data).toHaveProperty('overall');
    });
  });

  describe('getTuningParams', () => {
    it('calls GET /tuning-params/', async () => {
      mockOk({ params: {}, source: 'defaults' });
      const data = await getTuningParams();
      expect(data.source).toBe('defaults');
    });
  });

  describe('setAgentTuning', () => {
    it('calls POST /tuning-params/{agent_id}', async () => {
      mockOk({ id: 1, version: 1 });
      const data = await setAgentTuning('intake_classifier', { prompt_precision: 85 });
      expect(data.version).toBe(1);
    });
  });

  describe('resetAgentTuning', () => {
    it('calls POST /tuning-params/reset/{agent_id}', async () => {
      mockOk({ agent_id: 'intake_classifier', message: 'Reset' });
      const data = await resetAgentTuning('intake_classifier');
      expect(data.message).toBe('Reset');
    });
  });

  describe('getPresets', () => {
    it('calls GET /tuning-params/presets', async () => {
      mockOk({ v1_defaults: {}, v2_presets: {} });
      const data = await getPresets();
      expect(data).toHaveProperty('v1_defaults');
      expect(data).toHaveProperty('v2_presets');
    });
  });

  describe('error handling', () => {
    it('throws on API error with detail', async () => {
      mockError(500, 'Pipeline error: timeout');
      await expect(runV1('test')).rejects.toThrow('Pipeline error: timeout');
    });

    it('throws generic error when no detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.reject(),
      });
      await expect(getHealth()).rejects.toThrow('API error 404');
    });
  });
});
