import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [codexApiKey, setCodexApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [currentKeys, setCurrentKeys] = useState({});

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100';

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
        fetchCurrentKeys(); // Refresh current keys after successful submission
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
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
    </div>
  );
}

export default App