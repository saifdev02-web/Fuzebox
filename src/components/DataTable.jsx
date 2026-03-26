const s = {
  wrapper: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-card)',
    overflow: 'auto',
    maxHeight: 480,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.82rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '0.68rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
    borderBottom: '2px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.88rem',
  },
};

/**
 * Generic data table. Pass columns (array of { key, label, render? }) and rows (array of objects).
 */
export default function DataTable({ columns, rows, emptyMessage = 'No data available' }) {
  if (!rows || !rows.length) {
    return (
      <div style={s.wrapper}>
        <div style={s.empty}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div style={s.wrapper}>
      <table style={s.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ ...s.th, ...(col.style || {}) }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col.key} style={{ ...s.td, ...(col.cellStyle || {}) }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
