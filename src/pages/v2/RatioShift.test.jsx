import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RatioShift from './RatioShift';

// Mock the API client
vi.mock('../../api/client', () => ({
  getComparison: vi.fn(),
}));

import { getComparison } from '../../api/client';

const MOCK_COMPARISON = {
  overall: {
    ratio_shift: {
      v1: { total_tasks: 15, tasks_handled_by_agents: 12, tasks_requiring_humans: 3, ratio_display: '1:4.0' },
      v2: { total_tasks: 15, tasks_handled_by_agents: 15, tasks_requiring_humans: 0, ratio_display: 'Fully automated' },
    },
    rop: {
      v1: { rop_pct: 95.0, agent_cost: 0.005, manual_equivalent: 600, savings: 599.99 },
      v2: { rop_pct: 100.0, agent_cost: 0.007, manual_equivalent: 750, savings: 749.99 },
      delta: 5,
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getComparison.mockResolvedValue(MOCK_COMPARISON);
});

describe('RatioShift', () => {
  it('renders page title', () => {
    render(<RatioShift />);
    expect(screen.getByText('Ratio Shift Dashboard')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
    render(<RatioShift />);
    expect(screen.getByLabelText('Refresh ratio data')).toBeInTheDocument();
  });

  it('shows Human-to-Agent Ratio section', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('Human-to-Agent Ratio')).toBeInTheDocument();
    });
  });

  it('shows V1 and V2 ratio bars', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('V1 Baseline')).toBeInTheDocument();
      expect(screen.getByText('V2 Tuned')).toBeInTheDocument();
    });
  });

  it('shows ratio displays', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('Ratio: 1:4.0')).toBeInTheDocument();
      expect(screen.getByText('Ratio: Fully automated')).toBeInTheDocument();
    });
  });

  it('shows bar legend', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('Agent-handled')).toBeInTheDocument();
      expect(screen.getByText('Human-required')).toBeInTheDocument();
    });
  });

  it('shows narrative section', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('What This Means')).toBeInTheDocument();
      expect(screen.getByText('Business Impact Summary')).toBeInTheDocument();
    });
  });

  it('shows narrative content with V1/V2 stats', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      // V1 = 12/15 = 80%, V2 = 15/15 = 100% — multiple elements may match
      expect(screen.getAllByText(/80%/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/100%/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows RoP card', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('Return on Potential (RoP)')).toBeInTheDocument();
    });
  });

  it('shows RoP improvement delta', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText('RoP Improvement (V1 → V2)')).toBeInTheDocument();
      expect(screen.getByText('+5%')).toBeInTheDocument();
    });
  });

  it('shows agent cost in RoP detail', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(screen.getByText(/Agent cost: \$0\.0070/)).toBeInTheDocument();
    });
  });

  it('fetches data on mount', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(getComparison).toHaveBeenCalled();
    });
  });

  it('refetches on Refresh click', async () => {
    render(<RatioShift />);
    await waitFor(() => {
      expect(getComparison).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByLabelText('Refresh ratio data'));

    await waitFor(() => {
      expect(getComparison).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error message on API failure', async () => {
    getComparison.mockRejectedValue(new Error('Server error'));
    render(<RatioShift />);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while data loads', () => {
    getComparison.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<RatioShift />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
