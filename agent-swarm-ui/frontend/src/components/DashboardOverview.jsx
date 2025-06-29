import { motion } from 'framer-motion';
import {
  Activity,
  Clock,
  DollarSign,
  FileText,
  GitBranch,
  TrendingUp,
  Zap,
  CheckCircle,
  AlertTriangle,
  Users,
  Code2,
  Database
} from 'lucide-react';
import clsx from 'clsx';

const MetricCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -2 }}
    className={clsx('metric-card', color)}
  >
    <div className="metric-header">
      <Icon size={24} className="metric-icon" />
      <div className="metric-trend">
        {trend && (
          <span className={clsx('trend', trend > 0 ? 'positive' : 'negative')}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
    <div className="metric-content">
      <h3 className="metric-value">{value}</h3>
      <p className="metric-title">{title}</p>
      {subtitle && <p className="metric-subtitle">{subtitle}</p>}
    </div>
  </motion.div>
);

const ProgressRing = ({ progress, size = 100, strokeWidth = 8, color = '#3498db' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="progress-ring">
      <svg width={size} height={size} className="progress-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e6e6e6"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeInOut" }}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="progress-text">
        <span className="progress-value">{Math.round(progress)}%</span>
        <span className="progress-label">Complete</span>
      </div>
    </div>
  );
};

const AgentStatusBadge = ({ agentName, status, progress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'idle': return 'bg-gray-400';
      case 'initializing': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return Activity;
      case 'completed': return CheckCircle;
      case 'error': return AlertTriangle;
      case 'idle': return Clock;
      case 'initializing': return Zap;
      default: return Clock;
    }
  };

  const StatusIcon = getStatusIcon(status);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="agent-status-badge"
    >
      <div className="agent-info">
        <div className="agent-name">{agentName}</div>
        <div className="agent-progress">
          <div className="progress-bar">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="progress-fill"
            />
          </div>
          <span className="progress-text">{Math.round(progress)}%</span>
        </div>
      </div>
      <div className={clsx('status-indicator', getStatusColor(status))}>
        <StatusIcon size={16} />
      </div>
    </motion.div>
  );
};

const PhaseIndicator = ({ currentPhase, isRunning }) => {
  const phases = [
    { name: 'Planning', key: 'planning', icon: Database },
    { name: 'Executing', key: 'executing', icon: Activity },
    { name: 'Integrating', key: 'integrating', icon: GitBranch },
    { name: 'Completing', key: 'completing', icon: CheckCircle }
  ];

  const getPhaseIndex = (phase) => phases.findIndex(p => p.key === phase);
  const currentIndex = getPhaseIndex(currentPhase);

  return (
    <div className="phase-indicator">
      <h3>Project Phase</h3>
      <div className="phase-timeline">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex && isRunning;

          return (
            <div key={phase.key} className="phase-step">
              <motion.div
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  opacity: isCompleted || isActive ? 1 : 0.5
                }}
                className={clsx('phase-node', {
                  active: isActive,
                  completed: isCompleted,
                  current: isCurrent
                })}
              >
                <Icon size={20} />
                {isCurrent && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="phase-spinner"
                  />
                )}
              </motion.div>
              <span className="phase-name">{phase.name}</span>
              {index < phases.length - 1 && (
                <div className={clsx('phase-connector', {
                  completed: isCompleted
                })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DashboardOverview = ({
  projectMetrics,
  agentStates,
  isProjectRunning,
  projectPhase,
  overallProgress,
  totalCost,
  activeAgents
}) => {
  const formatCurrency = (amount) => `$${amount.toFixed(4)}`;
  const formatNumber = (num) => num.toLocaleString();

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <h2>Project Dashboard</h2>
        <div className="dashboard-status">
          {isProjectRunning ? (
            <span className="status-running">
              <Activity size={16} />
              Active
            </span>
          ) : (
            <span className="status-idle">
              <Clock size={16} />
              Idle
            </span>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Cost"
          value={formatCurrency(totalCost)}
          icon={DollarSign}
          color="cost"
          trend={projectMetrics.costTrend}
          subtitle="Estimated spend"
        />
        <MetricCard
          title="Files Modified"
          value={formatNumber(projectMetrics.filesModified)}
          icon={FileText}
          color="files"
          trend={projectMetrics.filesTrend}
          subtitle="Changes tracked"
        />
        <MetricCard
          title="Active Agents"
          value={activeAgents}
          icon={Users}
          color="agents"
          subtitle="Currently working"
        />
        <MetricCard
          title="Code Lines"
          value={formatNumber(projectMetrics.linesOfCodeChanged)}
          icon={Code2}
          color="code"
          trend={projectMetrics.codeTrend}
          subtitle="Lines changed"
        />
      </div>

      {/* Progress and Phase */}
      <div className="progress-section">
        <div className="overall-progress">
          <h3>Overall Progress</h3>
          <ProgressRing
            progress={overallProgress}
            size={120}
            strokeWidth={10}
            color="#3498db"
          />
        </div>

        <PhaseIndicator
          currentPhase={projectPhase}
          isRunning={isProjectRunning}
        />
      </div>

      {/* Agent Status Overview */}
      <div className="agents-overview">
        <h3>Agent Status</h3>
        <div className="agents-grid">
          {Object.entries(agentStates).map(([agentName, state]) => (
            <AgentStatusBadge
              key={agentName}
              agentName={agentName.charAt(0).toUpperCase() + agentName.slice(1)}
              status={state.status}
              progress={state.progress}
            />
          ))}
        </div>
      </div>

      {/* Real-time Activity */}
      {isProjectRunning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="activity-feed"
        >
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {Object.entries(agentStates)
              .filter(([_, state]) => state.logs.length > 0)
              .map(([agentName, state]) => {
                const recentLog = state.logs[state.logs.length - 1];
                return (
                  <motion.div
                    key={`${agentName}-${recentLog?.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="activity-item"
                  >
                    <div className="activity-agent">{agentName}</div>
                    <div className="activity-message">{recentLog?.message}</div>
                    <div className="activity-time">
                      {recentLog && new Date(recentLog.timestamp).toLocaleTimeString()}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardOverview;