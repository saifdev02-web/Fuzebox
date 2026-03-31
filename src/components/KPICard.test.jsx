import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICard from './KPICard';

describe('KPICard', () => {
  it('renders label and value', () => {
    render(<KPICard label="Completion Rate" value="95%" />);
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('renders with small variant', () => {
    render(<KPICard label="AUoP" value="0.82" small />);
    expect(screen.getByText('AUoP')).toBeInTheDocument();
    expect(screen.getByText('0.82')).toBeInTheDocument();
  });

  it('renders numeric value', () => {
    render(<KPICard label="Tasks" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
