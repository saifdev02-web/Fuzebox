import { useState } from 'react';
import {
  LayoutDashboard, ClipboardList, CheckSquare, DollarSign,
  Gauge, GitBranch, Settings, Database,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import styles from './Sidebar.module.css';

const pages = [
  { key: 'Overview', icon: LayoutDashboard },
  { key: 'Agent Registry', icon: ClipboardList },
  { key: 'Task Scorecards', icon: CheckSquare },
  { key: 'Economic Analysis', icon: DollarSign },
  { key: 'Performance Metrics', icon: Gauge },
  { key: 'Workflow Traces', icon: GitBranch },
  { key: 'Scenario Builder', icon: Settings },
];

export default function Sidebar() {
  const {
    data, loaded, loadDemoData,
    timeRange, setTimeRange,
    selectedAgentIds, setSelectedAgentIds,
    selectedGroup, setSelectedGroup, groups,
    currentPage, setCurrentPage,
    presentationMode, setPresentationMode,
  } = useApp();

  const [loadResult, setLoadResult] = useState(null);

  const handleLoadDemo = () => {
    const summary = loadDemoData();
    setLoadResult(summary);
    setTimeout(() => setLoadResult(null), 4000);
  };

  const handleAgentSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
    setSelectedAgentIds(selected);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>r</div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>r·Potential</span>
          <span className={styles.logoPowered}>powered by FuzeBox</span>
        </div>
      </div>

      {/* Presentation Mode */}
      <label className={styles.presToggle}>
        <input
          type="checkbox"
          checked={presentationMode}
          onChange={(e) => setPresentationMode(e.target.checked)}
        />
        Presentation Mode
      </label>

      {/* Load Demo Data */}
      <button className={styles.loadBtn} onClick={handleLoadDemo}>
        <Database size={15} /> Load Demo Data
      </button>
      {loadResult && (
        <div className={styles.loadResult}>
          ✓ Loaded {loadResult.agents} agents, {loadResult.tasks} tasks, {loadResult.spans} spans, {loadResult.workflows} workflows
        </div>
      )}

      {/* Filters */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Filters</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Time Range</div>
          <select className={styles.select} value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option>Last 7 days</option>
            <option>Last 14 days</option>
            <option>Last 30 days</option>
            <option>All time</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Agents</div>
          <select
            className={styles.multiSelect}
            multiple
            value={selectedAgentIds}
            onChange={handleAgentSelect}
          >
            {data.agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Group</div>
          <select className={styles.select} value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            <option value="All">All</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.navSection}>
        <div className={styles.sectionTitle}>Navigate</div>
        {pages.map(({ key, icon: Icon }) => (
          <button
            key={key}
            className={`${styles.navItem} ${currentPage === key ? styles.navItemActive : ''}`}
            onClick={() => setCurrentPage(key)}
          >
            <Icon size={16} /> {key}
          </button>
        ))}
      </div>
    </aside>
  );
}
