import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BeforeAfter from './BeforeAfter';

// Mock the API client
vi.mock('../../api/client', () => ({
  getComparison: vi.fn(),
}));

import { getComparison } from '../../api/client';

const MOCK_COMPARISON = {
  overall: {
    completion_rate: { v1: 1.0, v2: 1.0, delta: 0, improved: null },
    accuracy: { v1: 0.728, v2: 0.942, delta: 0.214, improved: true },
    escalation_rate: { v1: 0, v2: 0, delta: 0, improved: null },
    avg_task_time: { v1: 2.56, v2: 3.63, delta: 1.07, improved: false },
    auop: { v1: 0.923, v2: 0.973, delta: 0.05, improved: true },
    rop: {
      v1: { rop_pct: 95 },
      v2: { rop_pct: 100 },
      delta: 5,
    },
  },
  per_agent: {
    intake_classifier: {
      accuracy: { v1: 0.667, v2: 1.0, delta: 0.333, improved: true },
      auop: { v1: 0.913, v2: 0.992, delta: 0.079, improved: true },
      avg_task_time: { v1: 1.06, v2: 2.34, delta: 1.28, improved: false },
      completion_rate: { v1: 1.0, v2: 1.0, delta: 0, improved: null },
      escalation_rate: { v1: 0, v2: 0, delta: 0, improved: null },
    },
    triage_scorer: {
      accuracy: { v1: 0.567, v2: 0.9, delta: 0.333, improved: true },
      auop: { v1: 0.886, v2: 0.964, delta: 0.078, improved: true },
      avg_task_time: { v1: 1.77, v2: 3.35, delta: 1.58, improved: false },
      completion_rate: { v1: 1.0, v2: 1.0, delta: 0, improved: null },
      escalation_rate: { v1: 0, v2: 0, delta: 0, improved: null },
    },
    response_drafter: {
      accuracy: { v1: 0.95, v2: 0.927, delta: -0.023, improved: false },
      auop: { v1: 0.971, v2: 0.964, delta: -0.007, improved: false },
      avg_task_time: { v1: 4.85, v2: 5.21, delta: 0.36, improved: false },
      completion_rate: { v1: 1.0, v2: 1.0, delta: 0, improved: null },
      escalation_rate: { v1: 0, v2: 0, delta: 0, improved: null },
    },
  },
  v1_total_rows: 15,
  v2_total_rows: 15,
};

beforeEach(() => {
  vi.clearAllMocks();
  getComparison.mockResolvedValue(MOCK_COMPARISON);
});

describe('BeforeAfter', () => {
  it('renders page title', () => {
    render(<BeforeAfter />);
    expect(screen.getByText('Before / After Comparison')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
    render(<BeforeAfter />);
    expect(screen.getByLabelText('Refresh comparison data')).toBeInTheDocument();
  });

  it('shows overall comparison section', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      expect(screen.getByText('Full Workflow — V1 vs V2')).toBeInTheDocument();
    });
  });

  it('shows all metric labels in overall section', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      // Metric labels appear in both overall and per-agent sections
      expect(screen.getAllByText('Completion Rate').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Accuracy').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Escalation Rate').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Avg Task Time').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('AUoP Score').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows row counts', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      expect(screen.getByText('V1: 15 rows | V2: 15 rows')).toBeInTheDocument();
    });
  });

  it('shows RoP improvement section', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      expect(screen.getByText('AI-ROI Improvement (RoP)')).toBeInTheDocument();
      expect(screen.getByText('+5%')).toBeInTheDocument();
    });
  });

  it('shows per-agent breakdown', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      expect(screen.getByText('Per-Agent Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Intake Classifier')).toBeInTheDocument();
      expect(screen.getByText('Triage Scorer')).toBeInTheDocument();
      expect(screen.getByText('Response Drafter')).toBeInTheDocument();
    });
  });

  it('shows accuracy improvement delta', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      // Overall accuracy delta = +21.4%
      const deltas = screen.getAllByText('+21.4%');
      expect(deltas.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('fetches data on mount', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      expect(getComparison).toHaveBeenCalled();
    });
  });

  it('refetches on Refresh click', async () => {
    render(<BeforeAfter />);
    await waitFor(() => {
      expect(getComparison).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByLabelText('Refresh comparison data'));

    await waitFor(() => {
      expect(getComparison).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error state on API failure', async () => {
    getComparison.mockRejectedValue(new Error('Network error'));
    render(<BeforeAfter />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows Try Again button on error', async () => {
    getComparison.mockRejectedValue(new Error('Network error'));
    render(<BeforeAfter />);

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('retries on Try Again click', async () => {
    getComparison.mockRejectedValueOnce(new Error('fail'));
    render(<BeforeAfter />);

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    getComparison.mockResolvedValue(MOCK_COMPARISON);
    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(getComparison).toHaveBeenCalledTimes(2);
    });
  });

  it('shows loading skeleton while data loads', () => {
    getComparison.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<BeforeAfter />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
