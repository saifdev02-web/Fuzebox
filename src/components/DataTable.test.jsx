import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataTable from './DataTable';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    const rows = [{ name: 'Test', value: '123' }];
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders row data', () => {
    const rows = [
      { name: 'Alpha', value: '100' },
      { name: 'Beta', value: '200' },
    ];
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders empty message when no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders default empty message', () => {
    render(<DataTable columns={columns} rows={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('supports custom render function', () => {
    const cols = [
      { key: 'score', label: 'Score', render: (val) => `${val}%` },
    ];
    const rows = [{ score: 95 }];
    render(<DataTable columns={cols} rows={rows} />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });
});
