import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExecutiveSummary from './ExecutiveSummary';

// Mock the API client
vi.mock('../../api/client', () => ({
  getComparison: vi.fn(),
  getAllTelemetry: vi.fn(),
}));

import { getComparison, getAllTelemetry } from '../../api/client';

const MOCK_COMPARISON = {
  overall: {
    completion_rate: { v1: 1.0, v2: 1.0, delta: 0 },
    accuracy: { v1: 0.728, v2: 0.942, delta: 0.214 },
    escalation_rate: { v1: 0, v2: 0, delta: 0 },
    avg_task_time: { v1: 2.56, v2: 3.63, delta: 1.07 },
    auop: { v1: 0.923, v2: 0.973, delta: 0.05 },
    rop: { v1: { rop_pct: 100 }, v2: { rop_pct: 100 }, delta: 0 },
    ratio_shift: {
      v1: { total_tasks: 15, tasks_handled_by_agents: 15, tasks_requiring_humans: 0 },
      v2: { total_tasks: 15, tasks_handled_by_agents: 15, tasks_requiring_humans: 0 },
    },
  },
  per_agent: {
    intake_classifier: {
      accuracy: { v1: 0.667, v2: 1.0, delta: 0.333 },
      auop: { v1: 0.913, v2: 0.992, delta: 0.079 },
      avg_task_time: { v1: 1.06, v2: 2.34, delta: 1.28 },
      completion_rate: { v1: 1.0, v2: 1.0, delta: 0 },
      escalation_rate: { v1: 0, v2: 0, delta: 0 },
    },
    triage_scorer: {
      accuracy: { v1: 0.567, v2: 0.9, delta: 0.333 },
      auop: { v1: 0.886, v2: 0.964, delta: 0.078 },
      avg_task_time: { v1: 1.77, v2: 3.35, delta: 1.58 },
      completion_rate: { v1: 1.0, v2: 1.0, delta: 0 },
      escalation_rate: { v1: 0, v2: 0, delta: 0 },
    },
    response_drafter: {
      accuracy: { v1: 0.95, v2: 0.927, delta: -0.023 },
      auop: { v1: 0.971, v2: 0.964, delta: -0.007 },
      avg_task_time: { v1: 4.85, v2: 5.21, delta: 0.36 },
      completion_rate: { v1: 1.0, v2: 1.0, delta: 0 },
      escalation_rate: { v1: 0, v2: 0, delta: 0 },
    },
  },
  v1_total_rows: 15,
  v2_total_rows: 15,
};

const MOCK_TELEMETRY = {
  rows: [
    { run_id: 'r1', run_version: 'v1', agent_id: 'intake_classifier', cost_usd: 0.0003, input_tokens: 200, output_tokens: 50, completion_status: 'success' },
    { run_id: 'r1', run_version: 'v1', agent_id: 'triage_scorer', cost_usd: 0.0004, input_tokens: 250, output_tokens: 80, completion_status: 'success' },
    { run_id: 'r1', run_version: 'v1', agent_id: 'response_drafter', cost_usd: 0.0005, input_tokens: 300, output_tokens: 120, completion_status: 'success' },
    { run_id: 'r2', run_version: 'v2', agent_id: 'intake_classifier', cost_usd: 0.0004, input_tokens: 220, output_tokens: 60, completion_status: 'success' },
    { run_id: 'r2', run_version: 'v2', agent_id: 'triage_scorer', cost_usd: 0.0005, input_tokens: 280, output_tokens: 90, completion_status: 'success' },
    { run_id: 'r2', run_version: 'v2', agent_id: 'response_drafter', cost_usd: 0.0006, input_tokens: 320, output_tokens: 130, completion_status: 'success' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getComparison.mockResolvedValue(MOCK_COMPARISON);
  getAllTelemetry.mockResolvedValue(MOCK_TELEMETRY);
  window.print = vi.fn();
});

describe('ExecutiveSummary', () => {
  it('renders page title', () => {
    render(<ExecutiveSummary />);
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });

  it('renders report header', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('AI Agent Performance Report')).toBeInTheDocument();
    });
  });

  it('renders refresh button after data loads', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('renders export PDF button', () => {
    render(<ExecutiveSummary />);
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });

  it('calls window.print on export', () => {
    render(<ExecutiveSummary />);
    fireEvent.click(screen.getByText('Export PDF'));
    expect(window.print).toHaveBeenCalled();
  });

  it('shows key metric cards', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Total Pipeline Runs')).toBeInTheDocument();
      expect(screen.getByText('Accuracy Improvement')).toBeInTheDocument();
      expect(screen.getByText('AUoP Score')).toBeInTheDocument();
      expect(screen.getByText('Cost Per Run')).toBeInTheDocument();
    });
  });

  it('shows correct total runs', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Total Pipeline Runs')).toBeInTheDocument();
      // 2 unique run_ids
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows accuracy improvement', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      // +21.4% appears in metric card — use getAllByText since it appears in comparison too
      const matches = screen.getAllByText('+21.4%');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows performance comparison section', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Performance Comparison: V1 vs V2')).toBeInTheDocument();
    });
  });

  it('shows all five comparison metric labels', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      // 'Accuracy' appears multiple times — in the comparison card and per-agent rows
      expect(screen.getAllByText('Accuracy').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Escalation Rate')).toBeInTheDocument();
      expect(screen.getByText('Avg Task Time')).toBeInTheDocument();
    });
  });

  it('shows cost analysis section', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Cost Analysis & ROI Projection')).toBeInTheDocument();
    });
  });

  it('shows cost cards', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Current AI Cost')).toBeInTheDocument();
      expect(screen.getByText('Annual Projection (10K runs)')).toBeInTheDocument();
      expect(screen.getByText('Estimated Annual Savings')).toBeInTheDocument();
    });
  });

  it('shows per-agent breakdown', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Per-Agent Performance')).toBeInTheDocument();
      expect(screen.getByText('Intake Classifier')).toBeInTheDocument();
      expect(screen.getByText('Triage Scorer')).toBeInTheDocument();
      expect(screen.getByText('Response Drafter')).toBeInTheDocument();
    });
  });

  it('shows recommendation section', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Recommendation')).toBeInTheDocument();
      expect(screen.getByText(/Deploy V2 tuned pipeline/)).toBeInTheDocument();
    });
  });

  it('shows report footer with token count', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText(/tokens processed/)).toBeInTheDocument();
    });
  });

  it('fetches data on mount', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(getComparison).toHaveBeenCalled();
      expect(getAllTelemetry).toHaveBeenCalledWith(null, 2000);
    });
  });

  it('refetches on refresh click', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(getComparison).toHaveBeenCalledTimes(2);
    });
  });

  it('handles API errors gracefully', async () => {
    getComparison.mockRejectedValue(new Error('Network error'));
    getAllTelemetry.mockRejectedValue(new Error('Network error'));

    render(<ExecutiveSummary />);

    await waitFor(() => {
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });
  });
});
