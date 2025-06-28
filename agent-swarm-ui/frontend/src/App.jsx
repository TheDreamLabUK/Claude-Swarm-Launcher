import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './App.css';

function App() {
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [codexApiKey, setCodexApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [currentKeys, setCurrentKeys] = useState({});
  const [projectPrompt, setProjectPrompt] = useState('');
  const [projectDirectory, setProjectDirectory] = useState('/workspace');
  const [isProjectRunning, setIsProjectRunning] = useState(false);
  const [agentModels, setAgentModels] = useState({
    claude: 'claude-3-sonnet-20250514',
    gemini: 'gemini-2.5-pro',
    codex: 'gpt-4.1-mini',
    orchestrator: 'claude-3-sonnet-20250514'
  });
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100';
  const WS_URL = API_BASE_URL.replace('http', 'ws');

  useEffect(() => {
    fetchCurrentKeys();

    if (terminalRef.current) {
      term.current = new Terminal();
      fitAddon.current = new FitAddon();
      term.current.loadAddon(fitAddon.current);
      term.current.open(terminalRef.current);
      fitAddon.current.fit();

      ws.current = new WebSocket(`${WS_URL}/ws/shell`);

      ws.current.onopen = () => {
        term.current.write('Connected to shell.\r\n');
      };

      ws.current.onmessage = (event) => {
        term.current.write(event.data);
      };

      ws.current.onclose = () => {
        term.current.write('\r\nDisconnected from shell.\r\n');
      };

      ws.current.onerror = (error) => {
        term.current.write(`\r\nWebSocket error occurred\r\n`);
        console.error('WebSocket error:', error);
      };

      term.current.onData((data) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(data);
        }
      });

      const handleResize = () => {
        fitAddon.current.fit();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        term.current.dispose();
        if (ws.current) {
          ws.current.close();
        }
      };
    }
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
        fetchCurrentKeys(); // Refresh current keys after successful submission
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
    }
  };

  const handleStartProject = () => {
    if (!projectPrompt.trim()) {
      setMessage('Please enter a project prompt');
      return;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      setIsProjectRunning(true);

      // Change to project directory
      ws.current.send(`cd ${projectDirectory}\r`);

      // Start all agents concurrently in the background
      setTimeout(() => {
        // Start orchestrator agent first to coordinate
        ws.current.send(`echo "Starting Agent Swarm for: ${projectPrompt}"\r`);

        // Start Claude Code with specified model
        ws.current.send(`export ANTHROPIC_MODEL=${agentModels.claude} && claude-code "${projectPrompt}" > claude_output.txt 2>&1 &\r`);

        // Also run claude-flow in parallel
        ws.current.send(`export ANTHROPIC_MODEL=${agentModels.claude} && claude-flow "${projectPrompt}" > claude_flow_output.txt 2>&1 &\r`);

        // Start Gemini CLI with specified model
        ws.current.send(`export GEMINI_MODEL=${agentModels.gemini} && gemini "${projectPrompt}" > gemini_output.txt 2>&1 &\r`);

        // Start OpenAI tools with specified model
        ws.current.send(`export OPENAI_MODEL=${agentModels.codex} && codex "${projectPrompt}" > codex_output.txt 2>&1 &\r`);

        // Also run openai CLI
        ws.current.send(`export OPENAI_MODEL=${agentModels.codex} && echo "${projectPrompt}" | openai api chat.completions.create -m ${agentModels.codex} > openai_output.txt 2>&1 &\r`);

        // Run orchestrator to integrate results
        ws.current.send(`echo "All agents started. Type 'jobs' to see running processes."\r`);
        ws.current.send(`echo "Agent outputs: claude_output.txt, claude_flow_output.txt, gemini_output.txt, codex_output.txt, openai_output.txt"\r`);
        ws.current.send(`echo "Use 'tail -f *_output.txt' to monitor progress."\r`);
      }, 500);
    } else {
      setMessage('Terminal not connected. Please wait for connection.');
    }
  };

  const handleStopProject = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send('\x03'); // Send Ctrl+C
      setIsProjectRunning(false);
    }
  };

  return (
    <div className="App">
      <h1>Agent Swarm UI</h1>
      <p>Frontend is running!</p>

      <div className="api-key-management">
        <h2>API Key Management</h2>
        <form onSubmit={handleSubmit}>
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
            <label htmlFor="codexApiKey">Codex API Key:</label>
            <input
              type="password"
              id="codexApiKey"
              value={codexApiKey}
              onChange={(e) => setCodexApiKey(e.target.value)}
              placeholder="Enter Codex API Key"
            />
          </div>
          <button type="submit">Save API Keys</button>
        </form>
        {message && <p className="message">{message}</p>}

        <div className="current-keys">
          <h3>Current Stored Keys:</h3>
          <ul>
            <li>Claude API Key: {currentKeys.ANTHROPIC_API_KEY ? 'Set' : 'Not Set'}</li>
            <li>Gemini API Key: {currentKeys.GEMINI_API_KEY ? 'Set' : 'Not Set'}</li>
            <li>Codex API Key: {currentKeys.CODEX_API_KEY ? 'Set' : 'Not Set'}</li>
          </ul>
        </div>
      </div>

      <div className="project-setup">
        <h2>Project Setup</h2>
        <div className="form-group">
          <label htmlFor="projectPrompt">Project Prompt:</label>
          <textarea
            id="projectPrompt"
            value={projectPrompt}
            onChange={(e) => setProjectPrompt(e.target.value)}
            placeholder="Describe what you want to build..."
            rows="4"
            disabled={isProjectRunning}
          />
        </div>
        <div className="form-group">
          <label htmlFor="projectDirectory">Project Directory:</label>
          <input
            type="text"
            id="projectDirectory"
            value={projectDirectory}
            onChange={(e) => setProjectDirectory(e.target.value)}
            placeholder="/workspace"
            disabled={isProjectRunning}
          />
        </div>
        <div className="model-configuration">
          <h3>Agent Model Configuration</h3>
          <div className="form-group">
            <label htmlFor="claudeModel">Claude Model:</label>
            <select
              id="claudeModel"
              value={agentModels.claude}
              onChange={(e) => setAgentModels({...agentModels, claude: e.target.value})}
              disabled={isProjectRunning}
            >
              <option value="claude-3-sonnet-20250514">Sonnet 4</option>
              <option value="claude-3-opus-20250514">Opus 4</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="geminiModel">Gemini Model:</label>
            <select
              id="geminiModel"
              value={agentModels.gemini}
              onChange={(e) => setAgentModels({...agentModels, gemini: e.target.value})}
              disabled={isProjectRunning}
            >
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="codexModel">Codex/OpenAI Model:</label>
            <select
              id="codexModel"
              value={agentModels.codex}
              onChange={(e) => setAgentModels({...agentModels, codex: e.target.value})}
              disabled={isProjectRunning}
            >
              <option value="gpt-4.1-mini">ChatGPT 4.1 Mini</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="orchestratorModel">Orchestrator Model:</label>
            <select
              id="orchestratorModel"
              value={agentModels.orchestrator}
              onChange={(e) => setAgentModels({...agentModels, orchestrator: e.target.value})}
              disabled={isProjectRunning}
            >
              <option value="claude-3-sonnet-20250514">Sonnet 4</option>
              <option value="claude-3-opus-20250514">Opus 4</option>
              <option value="gpt-4.1-mini">ChatGPT 4.1 Mini</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            </select>
          </div>
        </div>
        <div className="project-controls">
          {!isProjectRunning ? (
            <button
              onClick={handleStartProject}
              className="start-btn"
              disabled={!projectPrompt.trim()}
            >
              Start Project
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

      <div className="terminal-container">
        <h2>Interactive Shell</h2>
        <div ref={terminalRef} className="xterm-terminal"></div>
      </div>
    </div>
  );
}

export default App