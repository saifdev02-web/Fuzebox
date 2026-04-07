import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingDials from './TrainingDials';

// Mock the API client
vi.mock('../../api/client', () => ({
  getTuningParams: vi.fn(),
  setAgentTuning: vi.fn(),
  resetAgentTuning: vi.fn(),
  getPresets: vi.fn(),
}));

import { getTuningParams, setAgentTuning, resetAgentTuning, getPresets } from '../../api/client';

const MOCK_PARAMS = {
  params: {
    intake_classifier: {
      prompt_precision: 80,
      confidence_threshold: 0.75,
      fallback_depth: 3,
      data_prefetch: true,
      sentiment_weight: 0.5,
      tone_variant: 'professional',
    },
    triage_scorer: {
      prompt_precision: 70,
      confidence_threshold: 0.65,
      fallback_depth: 2,
      data_prefetch: false,
      sentiment_weight: 0.3,
      tone_variant: 'concise',
    },
    response_drafter: {
      prompt_precision: 90,
      confidence_threshold: 0.8,
      fallback_depth: 4,
      data_prefetch: true,
      sentiment_weight: 0.8,
      tone_variant: 'empathetic',
    },
  },
};

const MOCK_PRESETS = {
  v2_presets: {
    intake_classifier: { prompt_precision: 85, confidence_threshold: 0.8 },
    triage_scorer: { prompt_precision: 75, confidence_threshold: 0.7 },
    response_drafter: { prompt_precision: 95, confidence_threshold: 0.85 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getTuningParams.mockResolvedValue(MOCK_PARAMS);
  getPresets.mockResolvedValue(MOCK_PRESETS);
  setAgentTuning.mockResolvedValue({ success: true });
  resetAgentTuning.mockResolvedValue({ success: true });
});

describe('TrainingDials', () => {
  it('renders page title', () => {
    render(<TrainingDials />);
    expect(screen.getByText('Training Dials')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<TrainingDials />);
    expect(screen.getByText(/Tune each agent's parameters/)).toBeInTheDocument();
  });

  it('renders all three agent cards', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getByText('Intake Classifier')).toBeInTheDocument();
      expect(screen.getByText('Triage Scorer')).toBeInTheDocument();
      expect(screen.getByText('Response Drafter')).toBeInTheDocument();
    });
  });

  it('renders dial labels for each agent', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      // Each agent has these dials — use getAllByText since they appear 3 times
      expect(screen.getAllByText('Prompt Precision').length).toBe(3);
      expect(screen.getAllByText('Confidence Threshold').length).toBe(3);
      expect(screen.getAllByText('Fallback Depth').length).toBe(3);
      expect(screen.getAllByText('Data Pre-fetch').length).toBe(3);
      expect(screen.getAllByText('Sentiment Weight').length).toBe(3);
      expect(screen.getAllByText('Tone Variant').length).toBe(3);
    });
  });

  it('renders Save, Preset, and Reset buttons per agent', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getAllByText('Save').length).toBe(3);
      expect(screen.getAllByText('Preset').length).toBe(3);
      expect(screen.getAllByText('Reset').length).toBe(3);
    });
  });

  it('loads params from API on mount', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(getTuningParams).toHaveBeenCalled();
    });
  });

  it('loads presets from API on mount', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(getPresets).toHaveBeenCalled();
    });
  });

  it('saves agent tuning on Save click', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getAllByText('Save').length).toBe(3);
    });

    // Click the first Save button (Intake Classifier)
    fireEvent.click(screen.getAllByText('Save')[0].closest('button'));

    await waitFor(() => {
      expect(setAgentTuning).toHaveBeenCalledWith('intake_classifier', expect.any(Object));
    });
  });

  it('shows success message after save', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getAllByText('Save').length).toBe(3);
    });

    fireEvent.click(screen.getAllByText('Save')[0].closest('button'));

    await waitFor(() => {
      expect(screen.getByText(/Saved tuning params for intake_classifier/)).toBeInTheDocument();
    });
  });

  it('resets agent tuning on Reset click', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getAllByText('Reset').length).toBe(3);
    });

    fireEvent.click(screen.getAllByText('Reset')[0].closest('button'));

    await waitFor(() => {
      expect(resetAgentTuning).toHaveBeenCalledWith('intake_classifier');
    });
  });

  it('shows error message on API failure', async () => {
    getTuningParams.mockRejectedValue(new Error('Network error'));
    render(<TrainingDials />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders tooltips for each dial', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getAllByText(/basic prompt/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Minimum confidence score/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders aria labels on inputs', async () => {
    render(<TrainingDials />);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Prompt Precision').length).toBe(3);
      expect(screen.getAllByLabelText('Confidence Threshold').length).toBe(3);
      expect(screen.getAllByLabelText('Data Pre-fetch').length).toBe(3);
    });
  });
});
