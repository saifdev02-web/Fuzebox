import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LiveDemo from './LiveDemo';

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
    { id: 'REQ-002', input_text: 'Billing is wrong.', category: 'billing', notes: '' },
  ],
};

const MOCK_V2_RESULT = {
  run_id: 'abc-123',
  run_version: 'v2',
  classification: { classification: 'access_auth', confidence: 0.95 },
  triage: { priority: 4, sla: '1 hour' },
  draft: { response: 'We are looking into your issue.', sentiment_flag: 'neutral' },
  telemetry_summary: {
    total_latency_ms: 3200,
    total_input_tokens: 500,
    total_output_tokens: 200,
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

describe('LiveDemo', () => {
  it('renders page title', () => {
    render(<LiveDemo />);
    expect(screen.getByText('Live Agent Demo')).toBeInTheDocument();
  });

  it('renders version toggle buttons', () => {
    render(<LiveDemo />);
    expect(screen.getByText('V1 Baseline')).toBeInTheDocument();
    expect(screen.getByText('V2 Tuned')).toBeInTheDocument();
  });

  it('renders presentation mode button', () => {
    render(<LiveDemo />);
    expect(screen.getByText('Presentation Mode')).toBeInTheDocument();
  });

  it('renders textarea placeholder', () => {
    render(<LiveDemo />);
    expect(screen.getByPlaceholderText(/Type any service request/)).toBeInTheDocument();
  });

  it('renders Random Input button', () => {
    render(<LiveDemo />);
    expect(screen.getByText('Random Input')).toBeInTheDocument();
  });

  it('renders pipeline execution section', () => {
    render(<LiveDemo />);
    expect(screen.getByText('Pipeline Execution')).toBeInTheDocument();
  });

  it('shows V2 pipeline steps by default', () => {
    render(<LiveDemo />);
    expect(screen.getByText('Agent 1: Classify')).toBeInTheDocument();
    expect(screen.getByText('Reflect: Classify')).toBeInTheDocument();
    expect(screen.getByText('Agent 2: Triage')).toBeInTheDocument();
    expect(screen.getByText('Reflect: Triage')).toBeInTheDocument();
    expect(screen.getByText('Agent 3: Draft')).toBeInTheDocument();
    expect(screen.getByText('Reflect: Draft')).toBeInTheDocument();
  });

  it('switches to V1 pipeline steps when V1 is selected', () => {
    render(<LiveDemo />);
    fireEvent.click(screen.getByText('V1 Baseline'));
    expect(screen.getByText('Agent 1: Classify')).toBeInTheDocument();
    expect(screen.getByText('Agent 2: Triage')).toBeInTheDocument();
    expect(screen.getByText('Agent 3: Draft')).toBeInTheDocument();
    expect(screen.queryByText('Reflect: Classify')).not.toBeInTheDocument();
  });

  it('run button is disabled when input is empty', () => {
    render(<LiveDemo />);
    const runBtn = screen.getByText(/Run V2 Pipeline/);
    expect(runBtn.closest('button')).toBeDisabled();
  });

  it('run button is enabled when input is provided', () => {
    render(<LiveDemo />);
    const textarea = screen.getByPlaceholderText(/Type any service request/);
    fireEvent.change(textarea, { target: { value: 'Test input' } });
    const runBtn = screen.getByText(/Run V2 Pipeline/);
    expect(runBtn.closest('button')).not.toBeDisabled();
  });

  it('runs V2 pipeline and shows results', async () => {
    runV2.mockResolvedValue(MOCK_V2_RESULT);
    render(<LiveDemo />);

    const textarea = screen.getByPlaceholderText(/Type any service request/);
    fireEvent.change(textarea, { target: { value: 'I cannot log in' } });
    fireEvent.click(screen.getByText(/Run V2 Pipeline/));

    await waitFor(() => {
      expect(screen.getByText('Results')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('access_auth')).toBeInTheDocument();
    expect(screen.getByText('4 / 5')).toBeInTheDocument();
    expect(screen.getByText('We are looking into your issue.')).toBeInTheDocument();
  });

  it('runs V1 pipeline and shows results', async () => {
    runV1.mockResolvedValue(MOCK_V1_RESULT);
    render(<LiveDemo />);

    fireEvent.click(screen.getByText('V1 Baseline'));
    const textarea = screen.getByPlaceholderText(/Type any service request/);
    fireEvent.change(textarea, { target: { value: 'Billing issue' } });
    fireEvent.click(screen.getByText(/Run V1 Pipeline/));

    await waitFor(() => {
      expect(screen.getByText('Results')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('billing')).toBeInTheDocument();
  });

  it('shows evaluation scores when available', async () => {
    runV2.mockResolvedValue(MOCK_V2_RESULT);
    render(<LiveDemo />);

    const textarea = screen.getByPlaceholderText(/Type any service request/);
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/Run V2 Pipeline/));

    await waitFor(() => {
      expect(screen.getAllByText(/Accuracy/).length).toBeGreaterThanOrEqual(4);
    }, { timeout: 5000 });
  });

  it('shows reflection status when available', async () => {
    runV2.mockResolvedValue(MOCK_V2_RESULT);
    render(<LiveDemo />);

    const textarea = screen.getByPlaceholderText(/Type any service request/);
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/Run V2 Pipeline/));

    await waitFor(() => {
      expect(screen.getByText('ReAct Reflections')).toBeInTheDocument();
    }, { timeout: 5000 });

    // triage was_corrected = true
    expect(screen.getByText('✓ Corrected')).toBeInTheDocument();
    // classify and draft were confirmed
    expect(screen.getAllByText('✓ Confirmed').length).toBe(2);
  });

  it('shows error when pipeline fails', async () => {
    runV2.mockRejectedValue(new Error('Pipeline timeout'));
    render(<LiveDemo />);

    const textarea = screen.getByPlaceholderText(/Type any service request/);
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/Run V2 Pipeline/));

    await waitFor(() => {
      expect(screen.getByText(/Pipeline timeout/)).toBeInTheDocument();
    });
  });

  it('loads random input from test inputs', async () => {
    render(<LiveDemo />);

    await waitFor(() => {
      expect(getTestInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Random Input'));

    const textarea = screen.getByPlaceholderText(/Type any service request/);
    expect(textarea.value).not.toBe('');
  });
});
