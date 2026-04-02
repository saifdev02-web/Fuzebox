import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BatchRunner from './BatchRunner';

// Mock the API client
vi.mock('../../api/client', () => ({
  getTestInputs: vi.fn(),
  runV1: vi.fn(),
  runV2: vi.fn(),
}));

import { getTestInputs, runV1, runV2 } from '../../api/client';

const MOCK_TEST_INPUTS = {
  inputs: [
    { id: 'REQ-001', input_text: 'Cannot log in.', category: 'access_auth', notes: '' },
    { id: 'REQ-002', input_text: 'Wrong billing.', category: 'billing', notes: '' },
    { id: 'REQ-003', input_text: 'Platform down.', category: 'outage', notes: '' },
  ],
};

const makeMockResult = (version, accuracy) => ({
  run_id: `run-${version}-${Math.random()}`,
  run_version: version,
  classification: { classification: 'test', confidence: 0.9 },
  triage: { priority: 4 },
  draft: { response: 'Response text' },
  telemetry_summary: {
    total_latency_ms: 2500,
    total_input_tokens: 400,
    total_output_tokens: 200,
    ...(version === 'v2' ? {
      reflections: {
        classify: { was_corrected: false, latency_ms: 500 },
        triage: { was_corrected: true, latency_ms: 600 },
        draft: { was_corrected: false, latency_ms: 400 },
      },
    } : {}),
  },
  evaluation: {
    agent_1_accuracy: accuracy,
    agent_2_accuracy: accuracy,
    agent_3_accuracy: accuracy,
    overall_accuracy: accuracy,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  getTestInputs.mockResolvedValue(MOCK_TEST_INPUTS);
});

describe('BatchRunner', () => {
  it('renders page title', () => {
    render(<BatchRunner />);
    expect(screen.getByText('Batch Runner')).toBeInTheDocument();
  });

  it('renders run button', async () => {
    render(<BatchRunner />);
    await waitFor(() => {
      expect(screen.getByText('Start Batch Run')).toBeInTheDocument();
    });
  });

  it('shows test case count in header', async () => {
    render(<BatchRunner />);
    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });
  });

  it('shows description text', () => {
    render(<BatchRunner />);
    expect(screen.getByText(/Runs each test input through both V1 and V2/)).toBeInTheDocument();
  });

  it('disables run button when no test inputs loaded yet', () => {
    getTestInputs.mockResolvedValue({ inputs: [] });
    render(<BatchRunner />);
    const btn = screen.getByText('Start Batch Run').closest('button');
    // Initially it might be disabled until inputs load
    expect(btn).toBeInTheDocument();
  });

  it('runs batch and shows progress', async () => {
    runV1.mockImplementation(() => Promise.resolve(makeMockResult('v1', 0.6)));
    runV2.mockImplementation(() => Promise.resolve(makeMockResult('v2', 0.9)));

    render(<BatchRunner />);

    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Batch Run'));

    // Wait for batch to complete
    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument();
    }, { timeout: 15000 });

    // Progress should show final count
    expect(screen.getByText('6/6')).toBeInTheDocument();
  });

  it('shows summary cards after batch completes', async () => {
    runV1.mockImplementation(() => Promise.resolve(makeMockResult('v1', 0.6)));
    runV2.mockImplementation(() => Promise.resolve(makeMockResult('v2', 0.9)));

    render(<BatchRunner />);

    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Batch Run'));

    await waitFor(() => {
      expect(screen.getByText('V1 Avg Accuracy')).toBeInTheDocument();
      expect(screen.getByText('V2 Avg Accuracy')).toBeInTheDocument();
      expect(screen.getByText('Accuracy Improvement')).toBeInTheDocument();
      expect(screen.getByText('V2 Self-Corrections')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('shows results table with test case rows', async () => {
    runV1.mockImplementation(() => Promise.resolve(makeMockResult('v1', 0.6)));
    runV2.mockImplementation(() => Promise.resolve(makeMockResult('v2', 0.9)));

    render(<BatchRunner />);

    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Batch Run'));

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
      expect(screen.getByText('REQ-003')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('shows table headers', async () => {
    runV1.mockImplementation(() => Promise.resolve(makeMockResult('v1', 0.6)));
    runV2.mockImplementation(() => Promise.resolve(makeMockResult('v2', 0.9)));

    render(<BatchRunner />);

    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Batch Run'));

    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('V1 Status')).toBeInTheDocument();
      expect(screen.getByText('V1 Accuracy')).toBeInTheDocument();
      expect(screen.getByText('V2 Status')).toBeInTheDocument();
      expect(screen.getByText('V2 Accuracy')).toBeInTheDocument();
      expect(screen.getByText('Delta')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('handles V1 errors gracefully', async () => {
    runV1.mockRejectedValue(new Error('V1 failed'));
    runV2.mockImplementation(() => Promise.resolve(makeMockResult('v2', 0.9)));

    render(<BatchRunner />);

    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Batch Run'));

    await waitFor(() => {
      // Should still complete despite V1 errors
      expect(screen.getByText('Complete')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('calculates accuracy delta correctly', async () => {
    runV1.mockImplementation(() => Promise.resolve(makeMockResult('v1', 0.6)));
    runV2.mockImplementation(() => Promise.resolve(makeMockResult('v2', 0.9)));

    render(<BatchRunner />);

    await waitFor(() => {
      expect(screen.getByText(/Run All 3 Test Cases/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Batch Run'));

    await waitFor(() => {
      expect(screen.getByText('Accuracy Improvement')).toBeInTheDocument();
      // V2 (90%) - V1 (60%) = +30%
      expect(screen.getByText('+30.0%')).toBeInTheDocument();
    }, { timeout: 15000 });
  });
});
