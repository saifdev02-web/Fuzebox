import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TelemetryConsole from './TelemetryConsole';

// Mock the API client
vi.mock('../../api/client', () => ({
  getAgentTelemetry: vi.fn(),
}));

import { getAgentTelemetry } from '../../api/client';

const makeMockTelemetry = (agentId) => ({
  agent_id: agentId,
  count: 5,
  metrics: {
    completion_rate: 1.0,
    accuracy: 0.85,
    escalation_rate: 0.0,
    avg_task_time: 2.34,
    auop: 0.92,
  },
  rows: [
    {
      timestamp: new Date().toISOString(),
      run_version: 'v2',
      iteration: 1,
      completion_status: 'success',
      accuracy_score: 0.9,
      auop_score: 0.95,
      latency_ms: 2340,
      cost_usd: 0.0004,
      input_tokens: 220,
      output_tokens: 60,
    },
    {
      timestamp: new Date().toISOString(),
      run_version: 'v1',
      iteration: 1,
      completion_status: 'success',
      accuracy_score: 0.7,
      auop_score: 0.85,
      latency_ms: 1060,
      cost_usd: 0.0003,
      input_tokens: 200,
      output_tokens: 50,
    },
  ],
});

const EMPTY_TELEMETRY = { agent_id: 'intake_classifier', count: 0, metrics: {}, rows: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getAgentTelemetry.mockImplementation((agentId) =>
    Promise.resolve(makeMockTelemetry(agentId))
  );
});

describe('TelemetryConsole', () => {
  it('renders page title', () => {
    render(<TelemetryConsole />);
    expect(screen.getByText('Agent Telemetry Console')).toBeInTheDocument();
  });

  it('renders version toggle buttons', () => {
    render(<TelemetryConsole />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('V1')).toBeInTheDocument();
    expect(screen.getByText('V2')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
    render(<TelemetryConsole />);
    expect(screen.getByLabelText('Refresh telemetry')).toBeInTheDocument();
  });

  it('renders all three agent cards', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      expect(screen.getByText('Intake Classifier')).toBeInTheDocument();
      expect(screen.getByText('Triage Scorer')).toBeInTheDocument();
      expect(screen.getByText('Response Drafter')).toBeInTheDocument();
    });
  });

  it('renders agent KPI values after data loads', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      // Completion rate = 100%
      const completionValues = screen.getAllByText('100%');
      expect(completionValues.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('renders telemetry row count', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      const counts = screen.getAllByText('5 telemetry rows');
      expect(counts.length).toBe(3);
    });
  });

  it('renders Recent Rows sections', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      expect(screen.getByText('Intake Classifier — Recent Rows')).toBeInTheDocument();
      expect(screen.getByText('Triage Scorer — Recent Rows')).toBeInTheDocument();
      expect(screen.getByText('Response Drafter — Recent Rows')).toBeInTheDocument();
    });
  });

  it('fetches telemetry for all agents on mount', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      expect(getAgentTelemetry).toHaveBeenCalledWith('intake_classifier', null, 100);
      expect(getAgentTelemetry).toHaveBeenCalledWith('triage_scorer', null, 100);
      expect(getAgentTelemetry).toHaveBeenCalledWith('response_drafter', null, 100);
    });
  });

  it('refetches on Refresh click', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      expect(getAgentTelemetry).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByLabelText('Refresh telemetry'));

    await waitFor(() => {
      expect(getAgentTelemetry).toHaveBeenCalledTimes(6);
    });
  });

  it('filters by V1 when V1 button clicked', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      expect(getAgentTelemetry).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByText('V1'));

    await waitFor(() => {
      expect(getAgentTelemetry).toHaveBeenCalledWith('intake_classifier', 'v1', 100);
    });
  });

  it('shows empty state when no data', async () => {
    getAgentTelemetry.mockResolvedValue(EMPTY_TELEMETRY);
    render(<TelemetryConsole />);

    await waitFor(() => {
      expect(screen.getByText('No telemetry data yet')).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    getAgentTelemetry.mockRejectedValue(new Error('Network error'));
    render(<TelemetryConsole />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows KPI labels in agent cards', async () => {
    render(<TelemetryConsole />);
    await waitFor(() => {
      // KPI labels appear in agent cards + possibly in table headers
      expect(screen.getAllByText('Completion').length).toBeGreaterThanOrEqual(3);
      expect(screen.getAllByText(/^Accuracy$/).length).toBeGreaterThanOrEqual(3);
      expect(screen.getAllByText('Escalation').length).toBeGreaterThanOrEqual(3);
      expect(screen.getAllByText('Avg Time').length).toBeGreaterThanOrEqual(3);
      expect(screen.getAllByText(/^AUoP$/).length).toBeGreaterThanOrEqual(3);
    });
  });
});
