import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingCycle from './TrainingCycle';

// Mock the API client
vi.mock('../../api/client', () => ({
  getTestInputs: vi.fn(),
  runV1: vi.fn(),
  runV2: vi.fn(),
}));

import { getTestInputs, runV1, runV2 } from '../../api/client';

const MOCK_TEST_INPUTS = {
  inputs: [
    { id: 'REQ-001', input_text: 'I cannot log in to my account.', category: 'access_auth', notes: 'Urgent' },
    { id: 'REQ-002', input_text: 'Billing is wrong this month.', category: 'billing', notes: '' },
  ],
};

const MOCK_RESULT = {
  run_id: 'abc-123',
  run_version: 'v2',
  classification: { classification: 'access_auth', confidence: 0.95 },
  triage: { priority: 4, sla: '1 hour' },
  draft: { response: 'We are looking into your issue.' },
  telemetry_summary: {
    total_latency_ms: 3200,
    total_input_tokens: 500,
    total_output_tokens: 200,
    total_cost_usd: 0.0012,
    model_name: 'gpt-4o-mini',
    reflections: {
      classify: { was_corrected: false, latency_ms: 800 },
      triage: { was_corrected: true, latency_ms: 900 },
      draft: { was_corrected: false, latency_ms: 700 },
    },
  },
  evaluation: {
    agent_1_accuracy: 1.0,
    agent_2_accuracy: 0.7,
    agent_3_accuracy: 0.85,
    overall_accuracy: 0.85,
  },
};

const MOCK_V1_RESULT = {
  run_id: 'def-456',
  run_version: 'v1',
  classification: { classification: 'billing', confidence: 0.7 },
  triage: { priority: 3 },
  draft: { response: 'We will help you.' },
  telemetry_summary: {
    total_latency_ms: 2000,
    total_input_tokens: 300,
    total_output_tokens: 150,
    total_cost_usd: 0.0008,
    model_name: 'gpt-4o-mini',
  },
  evaluation: {
    agent_1_accuracy: 0.5,
    agent_2_accuracy: 0.3,
    agent_3_accuracy: 0.8,
    overall_accuracy: 0.53,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getTestInputs.mockResolvedValue(MOCK_TEST_INPUTS);
});

describe('TrainingCycle', () => {
  it('renders page title', () => {
    render(<TrainingCycle />);
    expect(screen.getByText('Training Cycle Visualizer')).toBeInTheDocument();
  });

  it('renders input selector', async () => {
    render(<TrainingCycle />);
    expect(screen.getByLabelText('Select test input')).toBeInTheDocument();
  });

  it('renders V1 and V2 run buttons', async () => {
    render(<TrainingCycle />);
    expect(screen.getByText('Run V1 Baseline')).toBeInTheDocument();
    expect(screen.getByText('Run V2 Tuned')).toBeInTheDocument();
  });

  it('renders V1 and V2 panels', () => {
    render(<TrainingCycle />);
    expect(screen.getByText('V1 Baseline (One-Shot)')).toBeInTheDocument();
    expect(screen.getByText('V2 Tuned (ReAct)')).toBeInTheDocument();
  });

  it('shows iteration slider', () => {
    render(<TrainingCycle />);
    expect(screen.getByLabelText('Iteration number')).toBeInTheDocument();
    expect(screen.getByText('Iteration 1/10')).toBeInTheDocument();
  });

  it('loads test inputs from backend', async () => {
    render(<TrainingCycle />);
    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });
  });

  it('falls back to hardcoded inputs on API error', async () => {
    getTestInputs.mockRejectedValue(new Error('fail'));
    render(<TrainingCycle />);
    await waitFor(() => {
      expect(screen.getByLabelText('Select test input')).toBeInTheDocument();
    });
  });

  it('shows pipeline steps in both panels', () => {
    render(<TrainingCycle />);
    // Steps appear in both V1 and V2 panels
    expect(screen.getAllByText('Step 1: Classify').length).toBe(2);
    expect(screen.getAllByText('Step 3: Triage').length).toBe(2);
    expect(screen.getAllByText('Step 5: Draft').length).toBe(2);
  });

  it('shows V2-only reflect steps', () => {
    render(<TrainingCycle />);
    // Reflect steps only appear once (in V2 panel)
    expect(screen.getByText('Step 2: Reflect (Classify)')).toBeInTheDocument();
    expect(screen.getByText('Step 4: Reflect (Triage)')).toBeInTheDocument();
    expect(screen.getByText('Step 6: Reflect (Draft)')).toBeInTheDocument();
  });

  it('runs V2 pipeline and shows results', async () => {
    runV2.mockResolvedValue(MOCK_RESULT);
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(screen.getByText('Run V2 Tuned')).toBeInTheDocument();
    });

    // Need test inputs loaded first
    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V2 Tuned'));

    await waitFor(() => {
      expect(screen.getByText('access_auth')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('We are looking into your issue.')).toBeInTheDocument();
  });

  it('runs V1 pipeline and shows results', async () => {
    runV1.mockResolvedValue(MOCK_V1_RESULT);
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V1 Baseline'));

    await waitFor(() => {
      expect(screen.getByText('billing')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows evaluation scores after V2 run', async () => {
    runV2.mockResolvedValue(MOCK_RESULT);
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V2 Tuned'));

    await waitFor(() => {
      expect(screen.getByText('Accuracy Scores (vs Ground Truth)')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows cost and model in results', async () => {
    runV2.mockResolvedValue(MOCK_RESULT);
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V2 Tuned'));

    await waitFor(() => {
      expect(screen.getByText('$0.0012')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows reflections for V2 run', async () => {
    runV2.mockResolvedValue(MOCK_RESULT);
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V2 Tuned'));

    await waitFor(() => {
      expect(screen.getByText('ReAct Reflections')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows error when pipeline fails', async () => {
    runV2.mockRejectedValue(new Error('Pipeline timeout'));
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V2 Tuned'));

    await waitFor(() => {
      expect(screen.getByText('Pipeline timeout')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('disables buttons while running', async () => {
    runV2.mockImplementation(() => new Promise((r) => setTimeout(() => r(MOCK_RESULT), 2000)));
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Run V2 Tuned'));

    expect(screen.getByText('Running V2...')).toBeInTheDocument();
    expect(screen.getByLabelText('Run V1 baseline pipeline')).toBeDisabled();
  });

  it('supports custom input option', async () => {
    render(<TrainingCycle />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('Select test input');
    fireEvent.change(select, { target: { value: '-1' } });

    expect(screen.getByLabelText('Custom input text')).toBeInTheDocument();
  });
});
