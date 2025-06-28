import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [codexApiKey, setCodexApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [currentKeys, setCurrentKeys] = useState({});

  // Project configuration
  const [githubUrl, setGithubUrl] = useState('');
  const [projectPrompt, setProjectPrompt] = useState('');
  const [isProjectRunning, setIsProjectRunning] = useState(false);
  const [agentModels, setAgentModels] = useState({
    claude: 'claude-3-sonnet-20250514',
    gemini: 'gemini-2.5-pro',
    codex: 'gpt-4',
    orchestrator: 'gemini-2.5-pro'
  });

  // Agent monitoring
  const [agentLogs, setAgentLogs] = useState({
    Claude: [],
    Gemini: [],
    Codex: [],
    Integrator: []
  });
  const [agentStatus, setAgentStatus] = useState({
    Claude: 'idle',
    Gemini: 'idle',
    Codex: 'idle',
    Integrator: 'idle'
  });

  const projectWs = useRef(null);
  const projectId = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100';
  const WS_URL = API_BASE_URL.replace('http', 'ws');

  useEffect(() => {
    fetchCurrentKeys();
  }, []);

  const fetchCurrentKeys = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys`);
      if (response.ok) {
        const data = await response.json();
        setCurrentKeys(data);
      } else {
        setMessage(`Error fetching current keys: ${response.statusText}`);
      }
    } catch (error) {
      setMessage(`Error fetching current keys: ${error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const keysToSubmit = {};
    if (claudeApiKey) keysToSubmit.claude_api_key = claudeApiKey;
    if (geminiApiKey) keysToSubmit.gemini_api_key = geminiApiKey;
    if (codexApiKey) keysToSubmit.codex_api_key = codexApiKey;

    try {
      const response = await fetch(`${API_BASE_URL}/api/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keysToSubmit),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
        setClaudeApiKey('');
        setGeminiApiKey('');
        setCodexApiKey('');
        fetchCurrentKeys();
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
    }
  };

  const addLogEntry = (agent, type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, type, message };

    setAgentLogs(prev => ({
      ...prev,
      [agent]: [...prev[agent], logEntry].slice(-100) // Keep last 100 entries
    }));
  };

  const updateAgentStatus = (agent, status) => {
    setAgentStatus(prev => ({
      ...prev,
      [agent]: status
    }));
  };

  const handleStartProject = () => {
    if (!githubUrl.trim() || !projectPrompt.trim()) {
      setMessage('Please enter both GitHub URL and project prompt.');
      return;
    }

    // Generate unique project ID
    projectId.current = `project_${Date.now()}`;
    setIsProjectRunning(true);

    // Clear previous logs
    setAgentLogs({
      Claude: [],
      Gemini: [],
      Codex: [],
      Integrator: []
    });

    // Reset agent status
    setAgentStatus({
      Claude: 'starting',
      Gemini: 'starting',
      Codex: 'starting',
      Integrator: 'idle'
    });

    // Connect to project WebSocket
    projectWs.current = new WebSocket(`${WS_URL}/ws/project/${projectId.current}`);

    projectWs.current.onopen = () => {
      projectWs.current.send(JSON.stringify({
        github_url: githubUrl,
        project_prompt: projectPrompt,
        agent_models: agentModels,
      }));
    };

    projectWs.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.agent) {
        // Agent-specific message
        addLogEntry(data.agent, data.type, data.message);

        if (data.type === 'status') {
          if (data.message.includes('Starting')) {
            updateAgentStatus(data.agent, 'running');
          } else if (data.message.includes('completed')) {
            updateAgentStatus(data.agent, 'completed');
          }
        } else if (data.type === 'error') {
          updateAgentStatus(data.agent, 'error');
        }
      } else {
        // General project message
        addLogEntry('System', data.type, data.message);

        if (data.type === 'complete') {
          setIsProjectRunning(false);
          updateAgentStatus('Integrator', 'completed');
        }
      }
    };

    projectWs.current.onclose = () => {
      setIsProjectRunning(false);
    };

    projectWs.current.onerror = (error) => {
      console.error('Project WebSocket error:', error);
      addLogEntry('System', 'error', 'WebSocket connection error');
      setIsProjectRunning(false);
    };
  };

  const handleStopProject = () => {
    if (projectWs.current) {
      projectWs.current.close();
    }
    setIsProjectRunning(false);

    // Update all agent statuses to stopped
    setAgentStatus({
      Claude: 'stopped',
      Gemini: 'stopped',
      Codex: 'stopped',
      Integrator: 'stopped'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'idle': return '#6c757d';
      case 'starting': return '#ffc107';
      case 'running': return '#007bff';
      case 'completed': return '#28a745';
      case 'error': return '#dc3545';
      case 'stopped': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const AgentPanel = ({ agentName, logs, status }) => (
    <div className="agent-panel">
      <div className="agent-header">
        <h3>{agentName}</h3>
        <span
          className="status-indicator"
          style={{ backgroundColor: getStatusColor(status) }}
        >
          {status}
        </span>
      </div>
      <div className="agent-logs">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.type}`}>
            <span className="log-timestamp">{log.timestamp}</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="log-empty">No activity yet...</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="App">
      <h1>AI Agent Swarm - GitHub Integration</h1>

      <div className="main-content">
        {/* API Key Management */}
        <div className="api-key-management">
          <h2>API Key Management</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="claudeApiKey">Claude API Key:</label>
                <input
                  type="password"
                  id="claudeApiKey"
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="Enter Claude API Key"
                />
              </div>
              <div className="form-group">
                <label htmlFor="geminiApiKey">Gemini API Key:</label>
                <input
                  type="password"
                  id="geminiApiKey"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter Gemini API Key"
                />
              </div>
              <div className="form-group">
                <label htmlFor="codexApiKey">OpenAI API Key:</label>
                <input
                  type="password"
                  id="codexApiKey"
                  value={codexApiKey}
                  onChange={(e) => setCodexApiKey(e.target.value)}
                  placeholder="Enter OpenAI API Key"
                />
              </div>
            </div>
            <button type="submit">Save API Keys</button>
          </form>
          {message && <p className="message">{message}</p>}

          <div className="current-keys">
            <h3>Current Stored Keys:</h3>
            <div className="key-status-row">
              <span>Claude: {currentKeys.ANTHROPIC_API_KEY ? '✓' : '✗'}</span>
              <span>Gemini: {currentKeys.GEMINI_API_KEY ? '✓' : '✗'}</span>
              <span>OpenAI: {currentKeys.OPENAI_API_KEY ? '✓' : '✗'}</span>
            </div>
          </div>
        </div>

        {/* Project Configuration */}
        <div className="project-setup">
          <h2>Project Configuration</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="githubUrl">GitHub Repository URL:</label>
              <input
                type="url"
                id="githubUrl"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                disabled={isProjectRunning}
              />
            </div>
            <div className="form-group">
              <label htmlFor="projectPrompt">Project Prompt:</label>
              <textarea
                id="projectPrompt"
                value={projectPrompt}
                onChange={(e) => setProjectPrompt(e.target.value)}
                placeholder="Describe what you want the agents to build or improve..."
                rows="3"
                disabled={isProjectRunning}
              />
            </div>
          </div>

          {/* Model Configuration */}
          <div className="model-configuration">
            <h3>Agent Models</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Claude:</label>
                <select
                  value={agentModels.claude}
                  onChange={(e) => setAgentModels({...agentModels, claude: e.target.value})}
                  disabled={isProjectRunning}
                >
                  <option value="claude-3-sonnet-20250514">Claude 3.5 Sonnet</option>
                  <option value="claude-3-opus-20250514">Claude 3 Opus</option>
                </select>
              </div>
              <div className="form-group">
                <label>Gemini:</label>
                <select
                  value={agentModels.gemini}
                  onChange={(e) => setAgentModels({...agentModels, gemini: e.target.value})}
                  disabled={isProjectRunning}
                >
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>
              <div className="form-group">
                <label>OpenAI:</label>
                <select
                  value={agentModels.codex}
                  onChange={(e) => setAgentModels({...agentModels, codex: e.target.value})}
                  disabled={isProjectRunning}
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Integrator:</label>
                <select
                  value={agentModels.orchestrator}
                  onChange={(e) => setAgentModels({...agentModels, orchestrator: e.target.value})}
                  disabled={isProjectRunning}
                >
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="claude-3-sonnet-20250514">Claude 3.5 Sonnet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Project Controls */}
          <div className="project-controls">
            {!isProjectRunning ? (
              <button
                onClick={handleStartProject}
                className="start-btn"
                disabled={!githubUrl.trim() || !projectPrompt.trim()}
              >
                Start AI Agent Swarm
              </button>
            ) : (
              <button
                onClick={handleStopProject}
                className="stop-btn"
              >
                Stop Project
              </button>
            )}
          </div>
        </div>

        {/* Agent Monitoring Panels */}
        <div className="agent-monitoring">
          <h2>Agent Activity Monitor</h2>
          <div className="agent-panels-grid">
            <AgentPanel
              agentName="Claude"
              logs={agentLogs.Claude}
              status={agentStatus.Claude}
            />
            <AgentPanel
              agentName="Gemini"
              logs={agentLogs.Gemini}
              status={agentStatus.Gemini}
            />
            <AgentPanel
              agentName="Codex"
              logs={agentLogs.Codex}
              status={agentStatus.Codex}
            />
            <AgentPanel
              agentName="Integrator"
              logs={agentLogs.Integrator}
              status={agentStatus.Integrator}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;