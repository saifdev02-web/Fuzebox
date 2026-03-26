import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { generateDemoData } from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Core data state
  const [data, setData] = useState({ agents: [], tasks: [], spans: [], workflows: [], pipelines: [] });
  const [loaded, setLoaded] = useState(false);

  // Filters
  const [timeRange, setTimeRange] = useState('Last 7 days');
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('All');

  // UI state
  const [currentPage, setCurrentPage] = useState('Overview');
  const [presentationMode, setPresentationMode] = useState(false);

  // Load demo data
  const loadDemoData = useCallback(() => {
    const demo = generateDemoData();
    setData(demo);
    setLoaded(true);
    return demo.summary;
  }, []);

  // Reset all data
  const resetAllData = useCallback(() => {
    setData({ agents: [], tasks: [], spans: [], workflows: [], pipelines: [] });
    setLoaded(false);
  }, []);

  // Computed date range
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate = null;
    if (timeRange === 'Last 7 days') startDate = new Date(now.getTime() - 7 * 86400000);
    else if (timeRange === 'Last 14 days') startDate = new Date(now.getTime() - 14 * 86400000);
    else if (timeRange === 'Last 30 days') startDate = new Date(now.getTime() - 30 * 86400000);
    return { startDate, endDate: now };
  }, [timeRange]);

  // Agent CRUD
  const upsertAgent = useCallback((agent) => {
    setData((prev) => {
      const idx = prev.agents.findIndex((a) => a.agent_id === agent.agent_id);
      const newAgents = [...prev.agents];
      if (idx >= 0) newAgents[idx] = agent;
      else newAgents.push(agent);
      return { ...prev, agents: newAgents };
    });
  }, []);

  const deleteAgent = useCallback((agentId) => {
    setData((prev) => ({
      ...prev,
      agents: prev.agents.filter((a) => a.agent_id !== agentId),
      tasks: prev.tasks.filter((t) => t.agent_id !== agentId),
      spans: prev.spans.filter((s) => s.agent_id !== agentId),
    }));
  }, []);

  // Pipeline CRUD
  const upsertPipeline = useCallback((pipeline) => {
    setData((prev) => {
      const idx = prev.pipelines.findIndex((p) => p.pipeline_id === pipeline.pipeline_id);
      const newPipelines = [...prev.pipelines];
      if (idx >= 0) newPipelines[idx] = pipeline;
      else newPipelines.push(pipeline);
      return { ...prev, pipelines: newPipelines };
    });
  }, []);

  const deletePipeline = useCallback((pipelineId) => {
    setData((prev) => ({
      ...prev,
      pipelines: prev.pipelines.filter((p) => p.pipeline_id !== pipelineId),
    }));
  }, []);

  // Available groups
  const groups = useMemo(() => {
    return [...new Set(data.agents.map((a) => a.group))].sort();
  }, [data.agents]);

  const value = {
    data, loaded, loadDemoData, resetAllData,
    timeRange, setTimeRange,
    selectedAgentIds, setSelectedAgentIds,
    selectedGroup, setSelectedGroup,
    currentPage, setCurrentPage,
    presentationMode, setPresentationMode,
    dateRange, groups,
    upsertAgent, deleteAgent,
    upsertPipeline, deletePipeline,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
