import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import AgentRegistry from './pages/AgentRegistry';
import TaskScorecards from './pages/TaskScorecards';
import EconomicAnalysis from './pages/EconomicAnalysis';
import PerformanceMetrics from './pages/PerformanceMetrics';
import WorkflowTraces from './pages/WorkflowTraces';
import ScenarioBuilder from './pages/ScenarioBuilder';
import PresentationMode from './pages/PresentationMode';

// V2 pages
import TelemetryConsole from './pages/v2/TelemetryConsole';
import TrainingDials from './pages/v2/TrainingDials';
import TrainingCycle from './pages/v2/TrainingCycle';
import BeforeAfter from './pages/v2/BeforeAfter';
import RatioShift from './pages/v2/RatioShift';

function AppContent() {
  const { currentPage, presentationMode } = useApp();

  if (presentationMode) {
    return <PresentationMode />;
  }

  const pages = {
    'Overview': Overview,
    'Agent Registry': AgentRegistry,
    'Task Scorecards': TaskScorecards,
    'Economic Analysis': EconomicAnalysis,
    'Performance Metrics': PerformanceMetrics,
    'Workflow Traces': WorkflowTraces,
    'Scenario Builder': ScenarioBuilder,
    // V2 pages
    'Telemetry Console': TelemetryConsole,
    'Training Dials': TrainingDials,
    'Training Cycle': TrainingCycle,
    'Before / After': BeforeAfter,
    'Ratio Shift': RatioShift,
  };

  const Page = pages[currentPage] || Overview;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ marginLeft: 260, flex: 1, padding: '32px 40px', minWidth: 0 }}>
        <Page />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
