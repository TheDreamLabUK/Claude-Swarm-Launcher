import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Activity,
  GitBranch,
  Clock,
  DollarSign,
  FileText,
  Code2,
  Settings,
  Play,
  Square,
  Eye,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  RotateCcw,
  Monitor,
  Database,
  Cpu,
  Layers
} from 'lucide-react';
import clsx from 'clsx';

import DashboardOverview from './components/DashboardOverview';
import AgentMonitorPanel from './components/AgentMonitorPanel';
import CodeDiffViewer from './components/CodeDiffViewer';
import CostTracker from './components/CostTracker';
import FileModificationSummary from './components/FileModificationSummary';
import ModelSelector from './components/ModelSelector';
import ProjectTimeline from './components/ProjectTimeline';
import PerformanceMetrics from './components/PerformanceMetrics';

import './App.css';

// Model configurations with detailed metadata
const MODEL_CONFIG = {
  'claude-sonnet-4': {
    name: 'Claude 4 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance and efficiency for most development tasks',
    capabilities: ['Code Generation', 'Refactoring', 'Documentation', 'Testing'],
    costPer1kTokens: 0.003,
    contextWindow: 200000,
    strengths: ['Code Quality', 'Context Understanding', 'Reasoning'],
    speed: 'Fast',
    icon: '🧠'
  },
  'claude-opus-4': {
    name: 'Claude 4 Opus',
    provider: 'Anthropic',
    description: 'Most capable model for complex reasoning and large-scale projects',
    capabilities: ['Complex Architecture', 'System Design', 'Advanced Debugging', 'Research'],
    costPer1kTokens: 0.015,
    contextWindow: 200000,
    strengths: ['Complex Reasoning', 'Architecture Design', 'Problem Solving'],
    speed: 'Moderate',
    icon: '🚀'
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Excellent for multimodal tasks and rapid development',
    capabilities: ['Rapid Prototyping', 'Multimodal', 'Data Analysis', 'API Integration'],
    costPer1kTokens: 0.002,
    contextWindow: 2000000,
    strengths: ['Speed', 'Multimodal', 'Large Context'],
    speed: 'Very Fast',
    icon: '⚡'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Ultra-fast model for simple tasks and quick iterations',
    capabilities: ['Quick Fixes', 'Simple Refactoring', 'Code Review', 'Documentation'],
    costPer1kTokens: 0.0005,
    contextWindow: 1000000,
    strengths: ['Ultra Speed', 'Cost Effective', 'Quick Tasks'],
    speed: 'Ultra Fast',
    icon: '⚡'
  },
  'gpt-4.1-mini': {
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    description: 'Compact model optimized for code-focused tasks',
    capabilities: ['Code Generation', 'Bug Fixing', 'Code Review', 'Simple Refactoring'],
    costPer1kTokens: 0.001,
    contextWindow: 128000,
    strengths: ['Code Focus', 'Efficiency', 'Cost Effective'],
    speed: 'Fast',
    icon: '🔧'
  },
  'o3': {
    name: 'OpenAI o3',
    provider: 'OpenAI',
    description: 'Advanced reasoning model for complex problem solving',
    capabilities: ['Complex Logic', 'Mathematical Reasoning', 'Algorithm Design', 'Optimization'],
    costPer1kTokens: 0.020,
    contextWindow: 128000,
    strengths: ['Reasoning', 'Mathematics', 'Logic'],
    speed: 'Slow',
    icon: '🧮'
  }
};

function App() {
  // Core state
  const [currentView, setCurrentView] = useState('dashboard');
  const [isProjectRunning, setIsProjectRunning] = useState(false);
  const [projectPhase, setProjectPhase] = useState('idle'); // idle, planning, executing, integrating, completing

  // API Keys
  const [apiKeys, setApiKeys] = useState({
    claude: '',
    gemini: '',
    openai: ''
  });
  const [storedKeys, setStoredKeys] = useState({});

  // Project Configuration
  const [projectConfig, setProjectConfig] = useState({
    githubUrl: '',
    projectPrompt: '',
    agentModels: {
      claude: 'claude-sonnet-4',
      gemini: 'gemini-2.5-pro',
      codex: 'gpt-4.1-mini',
      integrator: 'gemini-2.5-pro'
    },
    maxConcurrentAgents: 3,
    enableAdvancedMonitoring: true,
    enableCostTracking: true
  });

  // Agent Monitoring
  const [agentStates, setAgentStates] = useState({
    claude: {
      status: 'idle',
      progress: 0,
      currentTask: '',
      tokensUsed: 0,
      estimatedCost: 0,
      performance: { speed: 0, accuracy: 0, efficiency: 0 },
      logs: [],
      files: []
    },
    gemini: {
      status: 'idle',
      progress: 0,
      currentTask: '',
      tokensUsed: 0,
      estimatedCost: 0,
      performance: { speed: 0, accuracy: 0, efficiency: 0 },
      logs: [],
      files: []
    },
    codex: {
      status: 'idle',
      progress: 0,
      currentTask: '',
      tokensUsed: 0,
      estimatedCost: 0,
      performance: { speed: 0, accuracy: 0, efficiency: 0 },
      logs: [],
      files: []
    },
    integrator: {
      status: 'idle',
      progress: 0,
      currentTask: '',
      tokensUsed: 0,
      estimatedCost: 0,
      performance: { speed: 0, accuracy: 0, efficiency: 0 },
      logs: [],
      files: []
    }
  });

  // Real-time data
  const [projectMetrics, setProjectMetrics] = useState({
    totalTokensUsed: 0,
    totalCost: 0,
    filesModified: 0,
    linesOfCodeChanged: 0,
    duration: 0,
    efficiency: 0
  });

  const [fileChanges, setFileChanges] = useState([]);
  const [projectTimeline, setProjectTimeline] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);

  // WebSocket and refs
  const projectWs = useRef(null);
  const projectId = useRef(null);
  const metricsInterval = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100';
  const WS_URL = API_BASE_URL.replace('http', 'ws');

  // Computed values
  const totalCost = useMemo(() =>
    Object.values(agentStates).reduce((sum, agent) => sum + agent.estimatedCost, 0),
    [agentStates]
  );

  const overallProgress = useMemo(() => {
    const progresses = Object.values(agentStates).map(agent => agent.progress);
    return progresses.reduce((sum, progress) => sum + progress, 0) / progresses.length;
  }, [agentStates]);

  const activeAgents = useMemo(() =>
    Object.values(agentStates).filter(agent =>
      ['running', 'processing', 'analyzing'].includes(agent.status)
    ).length,
    [agentStates]
  );

  // Event handlers
  const handleApiKeySubmit = useCallback(async (keys) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claude_api_key: keys.claude,
          gemini_api_key: keys.gemini,
          codex_api_key: keys.openai
        })
      });

      if (response.ok) {
        await fetchStoredKeys();
        setApiKeys({ claude: '', gemini: '', openai: '' });
        return { success: true, message: 'API keys updated successfully' };
      } else {
        const error = await response.json();
        return { success: false, message: error.detail || 'Failed to update keys' };
      }
    } catch (error) {
      return { success: false, message: `Network error: ${error.message}` };
    }
  }, [API_BASE_URL, fetchStoredKeys]);

  const fetchStoredKeys = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys`);
      if (response.ok) {
        const keys = await response.json();
        setStoredKeys(keys);
      }
    } catch (error) {
      console.error('Failed to fetch stored keys:', error);
    }
  }, [API_BASE_URL]);

  const startProject = useCallback(() => {
    if (!projectConfig.githubUrl.trim() || !projectConfig.projectPrompt.trim()) {
      return { success: false, message: 'Please provide both GitHub URL and project prompt' };
    }

    projectId.current = `project_${Date.now()}`;
    setIsProjectRunning(true);
    setProjectPhase('planning');

    // Reset states
    setAgentStates(prev => Object.keys(prev).reduce((acc, key) => ({
      ...acc,
      [key]: {
        ...prev[key],
        status: 'initializing',
        progress: 0,
        logs: [],
        files: [],
        tokensUsed: 0,
        estimatedCost: 0
      }
    }), {}));

    setProjectMetrics({
      totalTokensUsed: 0,
      totalCost: 0,
      filesModified: 0,
      linesOfCodeChanged: 0,
      duration: 0,
      efficiency: 0
    });

    setFileChanges([]);
    setProjectTimeline([{
      timestamp: Date.now(),
      phase: 'Project Started',
      description: 'Initializing AI agent swarm...',
      type: 'info'
    }]);

    // Connect WebSocket
    projectWs.current = new WebSocket(`${WS_URL}/ws/project/${projectId.current}`);

    projectWs.current.onopen = () => {
      projectWs.current.send(JSON.stringify({
        github_url: projectConfig.githubUrl,
        project_prompt: projectConfig.projectPrompt,
        agent_models: projectConfig.agentModels,
        config: {
          maxConcurrentAgents: projectConfig.maxConcurrentAgents,
          enableAdvancedMonitoring: projectConfig.enableAdvancedMonitoring,
          enableCostTracking: projectConfig.enableCostTracking
        }
      }));
    };

    projectWs.current.onmessage = handleWebSocketMessage;
    projectWs.current.onclose = () => setIsProjectRunning(false);
    projectWs.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsProjectRunning(false);
    };

    // Start metrics collection
    startMetricsCollection();

    return { success: true, message: 'Project started successfully' };
  }, [projectConfig, WS_URL, handleWebSocketMessage, startMetricsCollection]);

  const handleWebSocketMessage = useCallback((event) => {
    const data = JSON.parse(event.data);

    // Update agent states
    if (data.agent) {
      setAgentStates(prev => ({
        ...prev,
        [data.agent]: {
          ...prev[data.agent],
          status: data.status || prev[data.agent].status,
          progress: data.progress ?? prev[data.agent].progress,
          currentTask: data.currentTask || prev[data.agent].currentTask,
          tokensUsed: data.tokensUsed ?? prev[data.agent].tokensUsed,
          estimatedCost: data.estimatedCost ?? prev[data.agent].estimatedCost,
          logs: [...prev[data.agent].logs, {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type: data.type,
            message: data.message,
            level: data.level || 'info'
          }].slice(-100), // Keep latest 100 logs
          files: data.files || prev[data.agent].files
        }
      }));
    }

    // Handle file changes
    if (data.type === 'file_change') {
      setFileChanges(prev => [...prev, {
        id: Date.now(),
        agent: data.agent,
        file: data.file,
        changeType: data.changeType,
        diff: data.diff,
        timestamp: new Date().toISOString()
      }]);
    }

    // Update project timeline
    if (data.type === 'phase_change') {
      setProjectPhase(data.phase);
      setProjectTimeline(prev => [...prev, {
        timestamp: Date.now(),
        phase: data.phase,
        description: data.message,
        type: 'phase'
      }]);
    }

    // Handle project completion
    if (data.type === 'complete') {
      setIsProjectRunning(false);
      setProjectPhase('completed');
      stopMetricsCollection();
    }
  }, []);

  const stopProject = useCallback(() => {
    if (projectWs.current) {
      projectWs.current.close();
    }
    setIsProjectRunning(false);
    setProjectPhase('stopped');
    stopMetricsCollection();
  }, [stopMetricsCollection]);

  const startMetricsCollection = useCallback(() => {
    metricsInterval.current = setInterval(() => {
      const timestamp = Date.now();
      const newDataPoint = {
        timestamp,
        totalTokens: Object.values(agentStates).reduce((sum, agent) => sum + agent.tokensUsed, 0),
        totalCost: Object.values(agentStates).reduce((sum, agent) => sum + agent.estimatedCost, 0),
        activeAgents: Object.values(agentStates).filter(agent =>
          ['running', 'processing'].includes(agent.status)
        ).length,
        averageProgress: Object.values(agentStates).reduce((sum, agent) => sum + agent.progress, 0) / 4
      };

      setPerformanceData(prev => [...prev.slice(-50), newDataPoint]);
    }, 5000);
  }, [agentStates, startMetricsCollection]);

  const stopMetricsCollection = useCallback(() => {
    if (metricsInterval.current) {
      clearInterval(metricsInterval.current);
      metricsInterval.current = null;
    }
  }, [stopMetricsCollection]);

  // Effects
  useEffect(() => {
    fetchStoredKeys();
    return () => {
      if (projectWs.current) {
        projectWs.current.close();
      }
      stopMetricsCollection();
    };
  }, [fetchStoredKeys, stopMetricsCollection]);

  // Navigation items
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Monitor },
    { id: 'agents', label: 'Agent Monitor', icon: Activity },
    { id: 'files', label: 'File Changes', icon: FileText },
    { id: 'costs', label: 'Cost Tracker', icon: DollarSign },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardOverview
            projectMetrics={projectMetrics}
            agentStates={agentStates}
            isProjectRunning={isProjectRunning}
            projectPhase={projectPhase}
            overallProgress={overallProgress}
            totalCost={totalCost}
            activeAgents={activeAgents}
          />
        );
      case 'agents':
        return (
          <div className="agents-grid">
            {Object.entries(agentStates).map(([agentName, state]) => (
              <AgentMonitorPanel
                key={agentName}
                agentName={agentName}
                agentState={state}
                modelConfig={MODEL_CONFIG[projectConfig.agentModels[agentName]]}
              />
            ))}
          </div>
        );
      case 'files':
        return (
          <FileModificationSummary
            fileChanges={fileChanges}
            agentStates={agentStates}
          />
        );
      case 'costs':
        return (
          <CostTracker
            agentStates={agentStates}
            modelConfigs={MODEL_CONFIG}
            totalCost={totalCost}
            performanceData={performanceData}
          />
        );
      case 'timeline':
        return (
          <ProjectTimeline
            timeline={projectTimeline}
            currentPhase={projectPhase}
            isRunning={isProjectRunning}
          />
        );
      case 'performance':
        return (
          <PerformanceMetrics
            performanceData={performanceData}
            agentStates={agentStates}
          />
        );
      case 'settings':
        return (
          <div className="settings-panel">
            <div className="api-keys-section">
              <h3>API Key Management</h3>
              <div className="api-keys-form">
                <div className="key-input-group">
                  <label htmlFor="claude-key">Claude API Key</label>
                  <input
                    id="claude-key"
                    type="password"
                    value={apiKeys.claude}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, claude: e.target.value }))}
                    placeholder="Enter Claude API key..."
                  />
                  <span className="key-status">
                    {storedKeys.ANTHROPIC_API_KEY ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
                  </span>
                </div>
                <div className="key-input-group">
                  <label htmlFor="gemini-key">Gemini API Key</label>
                  <input
                    id="gemini-key"
                    type="password"
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, gemini: e.target.value }))}
                    placeholder="Enter Gemini API key..."
                  />
                  <span className="key-status">
                    {storedKeys.GEMINI_API_KEY ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
                  </span>
                </div>
                <div className="key-input-group">
                  <label htmlFor="openai-key">OpenAI API Key</label>
                  <input
                    id="openai-key"
                    type="password"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                    placeholder="Enter OpenAI API key..."
                  />
                  <span className="key-status">
                    {storedKeys.OPENAI_API_KEY ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
                  </span>
                </div>
                <button
                  onClick={() => handleApiKeySubmit(apiKeys)}
                  className="save-keys-btn"
                >
                  Save API Keys
                </button>
              </div>
            </div>

            <div className="project-config-section">
              <h3>Project Configuration</h3>
              <div className="config-form">
                <div className="form-group">
                  <label htmlFor="github-url">GitHub Repository URL</label>
                  <input
                    id="github-url"
                    type="url"
                    value={projectConfig.githubUrl}
                    onChange={(e) => setProjectConfig(prev => ({ ...prev, githubUrl: e.target.value }))}
                    placeholder="https://github.com/user/repo.git"
                    disabled={isProjectRunning}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="project-prompt">Project Prompt</label>
                  <textarea
                    id="project-prompt"
                    value={projectConfig.projectPrompt}
                    onChange={(e) => setProjectConfig(prev => ({ ...prev, projectPrompt: e.target.value }))}
                    placeholder="Describe what you want the AI agents to accomplish..."
                    rows={4}
                    disabled={isProjectRunning}
                  />
                </div>

                <ModelSelector
                  models={MODEL_CONFIG}
                  selectedModels={projectConfig.agentModels}
                  onModelChange={(agent, model) =>
                    setProjectConfig(prev => ({
                      ...prev,
                      agentModels: { ...prev.agentModels, [agent]: model }
                    }))
                  }
                  disabled={isProjectRunning}
                />

                <div className="advanced-config">
                  <h4>Advanced Settings</h4>
                  <div className="config-row">
                    <label htmlFor="max-agents">Max Concurrent Agents</label>
                    <input
                      id="max-agents"
                      type="number"
                      min="1"
                      max="10"
                      value={projectConfig.maxConcurrentAgents}
                      onChange={(e) => setProjectConfig(prev => ({
                        ...prev,
                        maxConcurrentAgents: parseInt(e.target.value)
                      }))}
                      disabled={isProjectRunning}
                    />
                  </div>
                  <div className="config-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={projectConfig.enableAdvancedMonitoring}
                        onChange={(e) => setProjectConfig(prev => ({
                          ...prev,
                          enableAdvancedMonitoring: e.target.checked
                        }))}
                        disabled={isProjectRunning}
                      />
                      Enable Advanced Monitoring
                    </label>
                  </div>
                  <div className="config-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={projectConfig.enableCostTracking}
                        onChange={(e) => setProjectConfig(prev => ({
                          ...prev,
                          enableCostTracking: e.target.checked
                        }))}
                        disabled={isProjectRunning}
                      />
                      Enable Cost Tracking
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>
            <Layers className="app-icon" />
            AI Agent Swarm
          </h1>
          <div className="project-status">
            <div className={clsx('status-indicator', projectPhase)}>
              {projectPhase === 'idle' && <Database size={16} />}
              {projectPhase === 'planning' && <Cpu size={16} />}
              {projectPhase === 'executing' && <Activity size={16} />}
              {projectPhase === 'integrating' && <GitBranch size={16} />}
              {projectPhase === 'completed' && <CheckCircle size={16} />}
              {projectPhase === 'stopped' && <XCircle size={16} />}
              <span>{projectPhase.charAt(0).toUpperCase() + projectPhase.slice(1)}</span>
            </div>
            {isProjectRunning && (
              <div className="live-metrics">
                <span className="metric">
                  <Activity size={14} />
                  {activeAgents} Active
                </span>
                <span className="metric">
                  <DollarSign size={14} />
                  ${totalCost.toFixed(4)}
                </span>
                <span className="metric">
                  <TrendingUp size={14} />
                  {overallProgress.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="header-controls">
          {!isProjectRunning ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startProject}
              className="primary-btn start-btn"
              disabled={!projectConfig.githubUrl.trim() || !projectConfig.projectPrompt.trim()}
            >
              <Play size={16} />
              Start Swarm
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={stopProject}
              className="danger-btn stop-btn"
            >
              <Square size={16} />
              Stop Swarm
            </motion.button>
          )}
        </div>
      </header>

      <div className="app-body">
        <nav className="app-sidebar">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentView(item.id)}
                className={clsx('nav-item', { active: currentView === item.id })}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <main className="app-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="view-container"
            >
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;