import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Activity,
  Clock,
  DollarSign,
  Cpu,
  Zap,
  BarChart3,
  LineChart,
  Download,
  Filter,
  Info
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import clsx from 'clsx';

const MetricCard = ({ title, value, icon: Icon, color, unit }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -2 }}
    className={clsx('metric-card', color)}
  >
    <div className="metric-header">
      <Icon size={24} className="metric-icon" />
    </div>
    <div className="metric-content">
      <h3 className="metric-value">{value}{unit}</h3>
      <p className="metric-title">{title}</p>
    </div>
  </motion.div>
);

const PerformanceChart = ({ data, dataKey, title, color, unit, type = 'line' }) => (
  <div className="performance-chart">
    <h4>{title}</h4>
    <ResponsiveContainer width="100%" height={300}>
      {type === 'line' ? (
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(value) => new Date(value).toLocaleString()}
            formatter={(value) => [`${value.toFixed(2)}${unit}`, title]}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </RechartsLineChart>
      ) : (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(value) => new Date(value).toLocaleString()}
            formatter={(value) => [`${value.toFixed(2)}${unit}`, title]}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.3} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  </div>
);

const AgentPerformanceOverview = ({ agentStates }) => {
  const agentData = useMemo(() => {
    return Object.entries(agentStates).map(([agentName, state]) => ({
      name: agentName.charAt(0).toUpperCase() + agentName.slice(1),
      speed: state.performance.speed,
      accuracy: state.performance.accuracy,
      efficiency: state.performance.efficiency,
      tokens: state.tokensUsed,
      cost: state.estimatedCost
    }));
  }, [agentStates]);

  return (
    <div className="agent-performance-overview">
      <h4>Agent Specific Performance</h4>
      <div className="agent-performance-grid">
        {agentData.map((agent, index) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="agent-performance-card"
          >
            <h5>{agent.name}</h5>
            <div className="performance-stats">
              <div className="stat-item">
                <Zap size={16} />
                <span>Speed: {agent.speed}%</span>
              </div>
              <div className="stat-item">
                <CheckCircle size={16} />
                <span>Accuracy: {agent.accuracy}%</span>
              </div>
              <div className="stat-item">
                <Cpu size={16} />
                <span>Efficiency: {agent.efficiency}%</span>
              </div>
              <div className="stat-item">
                <Brain size={16} />
                <span>Tokens: {agent.tokens.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <DollarSign size={16} />
                <span>Cost: ${agent.cost.toFixed(4)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const PerformanceMetrics = ({ performanceData, agentStates }) => {
  const [timeRange, setTimeRange] = useState('all');

  const filteredData = useMemo(() => {
    if (timeRange === 'all') return performanceData;
    const now = Date.now();
    let durationMs;
    switch (timeRange) {
      case '15m': durationMs = 15 * 60 * 1000; break;
      case '1h': durationMs = 60 * 60 * 1000; break;
      case '6h': durationMs = 6 * 60 * 60 * 1000; break;
      case '24h': durationMs = 24 * 60 * 60 * 1000; break;
      default: durationMs = 0;
    }
    return performanceData.filter(d => (now - d.timestamp) <= durationMs);
  }, [performanceData, timeRange]);

  const overallMetrics = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        avgTokens: 0,
        avgCost: 0,
        avgActiveAgents: 0,
        avgProgress: 0
      };
    }
    const sumTokens = filteredData.reduce((sum, d) => sum + d.totalTokens, 0);
    const sumCost = filteredData.reduce((sum, d) => sum + d.totalCost, 0);
    const sumActiveAgents = filteredData.reduce((sum, d) => sum + d.activeAgents, 0);
    const sumProgress = filteredData.reduce((sum, d) => sum + d.averageProgress, 0);

    return {
      avgTokens: sumTokens / filteredData.length,
      avgCost: sumCost / filteredData.length,
      avgActiveAgents: sumActiveAgents / filteredData.length,
      avgProgress: sumProgress / filteredData.length
    };
  }, [filteredData]);

  if (!performanceData || performanceData.length === 0) {
    return (
      <div className="performance-metrics empty">
        <div className="empty-state">
          <TrendingUp size={48} className="empty-icon" />
          <h3>No performance data yet</h3>
          <p>Real-time metrics will appear here as the project runs</p>
        </div>
      </div>
    );
  }

  const exportPerformanceData = () => {
    const data = {
      exportTime: new Date().toISOString(),
      timeRange,
      metrics: filteredData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <div className="header-left">
          <h2>Performance Metrics</h2>
          <div className="time-range-selector">
            <Filter size={16} />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="15m">Last 15 min</option>
              <option value="1h">Last 1 hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
            </select>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={exportPerformanceData} className="export-btn">
            <Download size={16} />
            Export Data
          </button>
        </div>
      </div>

      <div className="overall-stats-grid">
        <MetricCard
          title="Avg. Tokens/Interval"
          value={overallMetrics.avgTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          icon={Cpu}
          color="primary"
          unit=""
        />
        <MetricCard
          title="Avg. Cost/Interval"
          value={overallMetrics.avgCost.toFixed(4)}
          icon={DollarSign}
          color="success"
          unit=""
        />
        <MetricCard
          title="Avg. Active Agents"
          value={overallMetrics.avgActiveAgents.toFixed(1)}
          icon={Activity}
          color="info"
          unit=""
        />
        <MetricCard
          title="Avg. Progress"
          value={overallMetrics.avgProgress.toFixed(1)}
          icon={TrendingUp}
          color="warning"
          unit="%"
        />
      </div>

      <div className="charts-section">
        <PerformanceChart
          data={filteredData}
          dataKey="totalTokens"
          title="Total Tokens Used Over Time"
          color="#3498db"
          unit=" tokens"
          type="area"
        />
        <PerformanceChart
          data={filteredData}
          dataKey="totalCost"
          title="Total Cost Over Time"
          color="#27ae60"
          unit=" $"
          type="line"
        />
        <PerformanceChart
          data={filteredData}
          dataKey="activeAgents"
          title="Active Agents Over Time"
          color="#f39c12"
          unit=""
          type="bar"
        />
        <PerformanceChart
          data={filteredData}
          dataKey="averageProgress"
          title="Overall Progress Over Time"
          color="#9b59b6"
          unit="%"
          type="line"
        />
      </div>

      <AgentPerformanceOverview agentStates={agentStates} />
    </div>
  );
};

export default PerformanceMetrics;