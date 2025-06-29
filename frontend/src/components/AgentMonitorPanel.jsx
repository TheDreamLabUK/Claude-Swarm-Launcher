import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Activity,
  Brain,
  Clock,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  RotateCcw,
  Maximize2,
  Minimize2,
  Terminal,
  Code2,
  Zap,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';
import clsx from 'clsx';

const LogEntry = ({ log, isExpanded, onToggle }) => {
  const getLogIcon = (type) => {
    switch (type) {
      case 'error': return AlertTriangle;
      case 'success': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Terminal;
      case 'code': return Code2;
      default: return Terminal;
    }
  };

  const LogIcon = getLogIcon(log.type);
  const timestamp = new Date(log.timestamp).toLocaleTimeString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('log-entry', `log-${log.type}`, log.level)}
    >
      <div className="log-header" onClick={onToggle}>
        <div className="log-meta">
          <LogIcon size={14} className="log-icon" />
          <span className="log-timestamp">{timestamp}</span>
          <span className={clsx('log-level', log.level)}>{log.level}</span>
        </div>
        {log.message.length > 100 && (
          <button className="log-expand">
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        )}
      </div>
      <div className={clsx('log-content', { expanded: isExpanded })}>
        <pre className="log-message">{log.message}</pre>
      </div>
    </motion.div>
  );
};

const PerformanceGauge = ({ label, value, max = 100, unit = '%', color = '#3498db' }) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="performance-gauge">
      <div className="gauge-header">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value">{value}{unit}</span>
      </div>
      <div className="gauge-bar">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="gauge-fill"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const TaskProgress = ({ currentTask, progress, status }) => {
  return (
    <div className="task-progress">
      <div className="task-header">
        <span className="task-label">Current Task</span>
        <span className="task-progress-value">{Math.round(progress)}%</span>
      </div>
      <div className="task-description">
        {currentTask || 'Waiting for task assignment...'}
      </div>
      <div className="task-progress-bar">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
          className={clsx('progress-fill', status)}
        />
      </div>
    </div>
  );
};

const FileChangesList = ({ files, onFileClick }) => {
  if (!files || files.length === 0) {
    return (
      <div className="no-files">
        <FileText size={24} className="no-files-icon" />
        <p>No file changes yet</p>
      </div>
    );
  }

  return (
    <div className="files-list">
      <h4>Modified Files ({files.length})</h4>
      <div className="files-scroll">
        {files.map((file, index) => (
          <motion.div
            key={`${file.path}-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="file-item"
            onClick={() => onFileClick && onFileClick(file)}
          >
            <div className="file-info">
              <FileText size={16} className="file-icon" />
              <span className="file-path">{file.path}</span>
              <span className={clsx('file-change-type', file.changeType)}>
                {file.changeType}
              </span>
            </div>
            <div className="file-stats">
              {file.linesAdded && <span className="lines-added">+{file.linesAdded}</span>}
              {file.linesRemoved && <span className="lines-removed">-{file.linesRemoved}</span>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const ModelInfo = ({ modelConfig }) => {
  if (!modelConfig) return null;

  return (
    <div className="model-info">
      <div className="model-header">
        <span className="model-icon">{modelConfig.icon}</span>
        <div className="model-details">
          <h4 className="model-name">{modelConfig.name}</h4>
          <p className="model-provider">{modelConfig.provider}</p>
        </div>
      </div>
      <div className="model-specs">
        <div className="spec-item">
          <span className="spec-label">Speed:</span>
          <span className="spec-value">{modelConfig.speed}</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">Cost:</span>
          <span className="spec-value">${modelConfig.costPer1kTokens}/1k tokens</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">Context:</span>
          <span className="spec-value">{modelConfig.contextWindow.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

const AgentMonitorPanel = ({ agentName, agentState, modelConfig }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [showLogs, setShowLogs] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const logsEndRef = useRef(null);

  const {
    status,
    progress,
    currentTask,
    tokensUsed,
    estimatedCost,
    performance,
    logs,
    files
  } = agentState;

  useEffect(() => {
    if (logsEndRef.current && logs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#3498db';
      case 'completed': return '#27ae60';
      case 'error': return '#e74c3c';
      case 'idle': return '#95a5a6';
      case 'initializing': return '#f39c12';
      case 'paused': return '#9b59b6';
      default: return '#95a5a6';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return Activity;
      case 'completed': return CheckCircle;
      case 'error': return XCircle;
      case 'idle': return Clock;
      case 'initializing': return Zap;
      case 'paused': return Pause;
      default: return Clock;
    }
  };

  const StatusIcon = getStatusIcon(status);

  const toggleLogExpansion = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  

  return (
    <motion.div
      layout
      className={clsx('agent-monitor-panel', { expanded: isExpanded })}
      style={{ '--status-color': getStatusColor(status) }}
    >
      {/* Header */}
      <div className="agent-header">
        <div className="agent-title">
          <div className="agent-identity">
            <h3 className="agent-name">{agentName.charAt(0).toUpperCase() + agentName.slice(1)}</h3>
            <div className="agent-status">
              <StatusIcon size={16} className="status-icon" />
              <span className="status-text">{status}</span>
            </div>
          </div>
          <div className="agent-controls">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="expand-btn"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-item">
            <Brain size={14} />
            <span>{tokensUsed.toLocaleString()} tokens</span>
          </div>
          <div className="stat-item">
            <DollarSign size={14} />
            <span>${estimatedCost.toFixed(4)}</span>
          </div>
          <div className="stat-item">
            <FileText size={14} />
            <span>{files?.length || 0} files</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <TaskProgress
        currentTask={currentTask}
        progress={progress}
        status={status}
      />

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="agent-expanded-content"
          >
            {/* Model Information */}
            <ModelInfo modelConfig={modelConfig} />

            {/* Performance Metrics */}
            {performance && (
              <div className="performance-section">
                <h4>Performance Metrics</h4>
                <div className="performance-gauges">
                  <PerformanceGauge
                    label="Speed"
                    value={performance.speed}
                    color="#3498db"
                  />
                  <PerformanceGauge
                    label="Accuracy"
                    value={performance.accuracy}
                    color="#27ae60"
                  />
                  <PerformanceGauge
                    label="Efficiency"
                    value={performance.efficiency}
                    color="#f39c12"
                  />
                </div>
              </div>
            )}

            {/* Tabs for Logs and Files */}
            <div className="content-tabs">
              <div className="tab-buttons">
                <button
                  className={clsx('tab-btn', { active: showLogs })}
                  onClick={() => setShowLogs(true)}
                >
                  <Terminal size={16} />
                  Logs ({logs.length})
                </button>
                <button
                  className={clsx('tab-btn', { active: !showLogs })}
                  onClick={() => setShowLogs(false)}
                >
                  <FileText size={16} />
                  Files ({files?.length || 0})
                </button>
              </div>

              <div className="tab-content">
                {showLogs ? (
                  <div className="logs-section">
                    <div className="logs-header">
                      <span>Activity Logs</span>
                      <button
                        className="toggle-visibility"
                        onClick={() => setShowFiles(!showFiles)}
                      >
                        {showFiles ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <div className="logs-container">
                      {logs.length === 0 ? (
                        <div className="no-logs">
                          <Terminal size={24} className="no-logs-icon" />
                          <p>No activity logs yet</p>
                        </div>
                      ) : (
                        <>
                          {logs.map((log) => (
                            <LogEntry
                              key={log.id}
                              log={log}
                              isExpanded={expandedLogs.has(log.id)}
                              onToggle={() => toggleLogExpansion(log.id)}
                            />
                          ))}
                          <div ref={logsEndRef} />
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <FileChangesList
                    files={files}
                    onFileClick={(file) => console.log('File clicked:', file)}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AgentMonitorPanel;