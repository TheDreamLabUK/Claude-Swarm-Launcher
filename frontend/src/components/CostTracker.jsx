import { useState, useMemo } from 'react';

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Brain,
  Clock,
  Zap,
  AlertTriangle,
  Info,
  Download,
  Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import clsx from 'clsx';

const CostCard = ({ title, value, change, color, subtitle }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -2 }}
    className={clsx('cost-card', color)}
  >
    <div className="cost-header">
      <Icon size={24} className="cost-icon" />
      <div className="cost-change">
        {change !== undefined && (
          <span className={clsx('change', change >= 0 ? 'positive' : 'negative')}>
            {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
    </div>
    <div className="cost-content">
      <h3 className="cost-value">${value.toFixed(4)}</h3>
      <p className="cost-title">{title}</p>
      {subtitle && <p className="cost-subtitle">{subtitle}</p>}
    </div>
  </motion.div>
);

const TokenUsageChart = ({ data, height = 300 }) => (
  <div className="token-usage-chart">
    <h4>Token Usage Over Time</h4>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
        />
        <YAxis />
        <Tooltip
          labelFormatter={(value) => new Date(value).toLocaleString()}
          formatter={(value) => [value.toLocaleString(), 'Tokens']}
        />
        <Area
          type="monotone"
          dataKey="totalTokens"
          stroke="#3498db"
          fill="#3498db"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const CostBreakdownChart = ({ agentStates }) => {
  const data = useMemo(() => {
    return Object.entries(agentStates).map(([agentName, state]) => ({
      name: agentName.charAt(0).toUpperCase() + agentName.slice(1),
      cost: state.estimatedCost,
      tokens: state.tokensUsed,
      color: getAgentColor(agentName)
    }));
  }, [agentStates]);

  const getAgentColor = (agentName) => {
    const colors = {
      claude: '#8B5CF6',
      gemini: '#06B6D4',
      codex: '#10B981',
      integrator: '#F59E0B'
    };
    return colors[agentName.toLowerCase()] || '#6B7280';
  };

  return (
    <div className="cost-breakdown-chart">
      <h4>Cost Breakdown by Agent</h4>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsPieChart>
          <RechartsPieChart
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="cost"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </RechartsPieChart>
          <Tooltip
            formatter={(value) => [`$${value.toFixed(4)}`, 'Cost']}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
      <div className="legend">
        {data.map((entry, index) => (
          <div key={index} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: entry.color }}
            />
            <span className="legend-label">{entry.name}</span>
            <span className="legend-value">${entry.cost.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ModelCostComparison = ({ modelConfigs, agentStates }) => {
  const data = useMemo(() => {
    return Object.entries(agentStates).map(([agentName, state]) => {
      const modelKey = agentName === 'codex' ? 'openai' : agentName;
      const modelConfig = Object.values(modelConfigs).find(config =>
        config.name.toLowerCase().includes(modelKey)
      );

      return {
        agent: agentName.charAt(0).toUpperCase() + agentName.slice(1),
        actualCost: state.estimatedCost,
        tokensUsed: state.tokensUsed,
        costPer1k: modelConfig?.costPer1kTokens || 0,
        efficiency: state.tokensUsed > 0 ? (state.estimatedCost / state.tokensUsed * 1000) : 0
      };
    });
  }, [modelConfigs, agentStates]);

  return (
    <div className="model-cost-comparison">
      <h4>Model Efficiency Comparison</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="agent" />
          <YAxis />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'actualCost') return [`$${value.toFixed(4)}`, 'Actual Cost'];
              if (name === 'costPer1k') return [`$${value.toFixed(4)}`, 'Cost per 1K Tokens'];
              return [value, name];
            }}
          />
          <Bar dataKey="actualCost" fill="#3498db" name="actualCost" />
          <Bar dataKey="costPer1k" fill="#e74c3c" name="costPer1k" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const CostProjection = ({ performanceData, currentCost }) => {
  const [timeframe, setTimeframe] = useState('hour');

  const projection = useMemo(() => {
    if (!performanceData || performanceData.length < 2) {
      return { projected: 0, confidence: 0 };
    }

    const recent = performanceData.slice(-5);
    const costGrowthRate = recent.length > 1
      ? (recent[recent.length - 1].totalCost - recent[0].totalCost) / recent.length
      : 0;

    const timeMultipliers = {
      hour: 12, // 5-minute intervals
      day: 288, // 5-minute intervals in a day
      week: 2016 // 5-minute intervals in a week
    };

    const projectedCost = currentCost + (costGrowthRate * timeMultipliers[timeframe]);
    const confidence = Math.min(95, Math.max(20, recent.length * 20));

    return { projected: projectedCost, confidence };
  }, [performanceData, currentCost, timeframe]);

  return (
    <div className="cost-projection">
      <div className="projection-header">
        <h4>Cost Projection</h4>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="timeframe-select"
        >
          <option value="hour">Next Hour</option>
          <option value="day">Next Day</option>
          <option value="week">Next Week</option>
        </select>
      </div>

      <div className="projection-content">
        <div className="projection-value">
          <span className="projected-cost">${projection.projected.toFixed(4)}</span>
          <span className="projection-timeframe">in next {timeframe}</span>
        </div>

        <div className="projection-confidence">
          <div className="confidence-bar">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${projection.confidence}%` }}
              className="confidence-fill"
            />
          </div>
          <span className="confidence-text">{projection.confidence}% confidence</span>
        </div>

        <div className="projection-warning">
          {projection.projected > currentCost * 2 && (
            <div className="warning-message">
              <AlertTriangle size={16} />
              <span>High cost growth rate detected</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CostOptimizationSuggestions = ({ agentStates }) => {
  const suggestions = useMemo(() => {
    const tips = [];

    // Find highest cost agent
    const costByAgent = Object.entries(agentStates)
      .map(([name, state]) => ({ name, cost: state.estimatedCost, tokens: state.tokensUsed }))
      .sort((a, b) => b.cost - a.cost);

    if (costByAgent[0]?.cost > 0.01) {
      tips.push({
        type: 'warning',
        title: 'High Cost Agent',
        message: `${costByAgent[0].name} is consuming the most resources. Consider optimizing its tasks.`,
        impact: 'High'
      });
    }

    // Check for inefficient token usage
    const inefficientAgents = Object.entries(agentStates)
      .filter(([, state]) => state.tokensUsed > 0 && (state.estimatedCost / state.tokensUsed * 1000) > 0.005)
      .map(([name]) => name);

    if (inefficientAgents.length > 0) {
      tips.push({
        type: 'info',
        title: 'Token Efficiency',
        message: `Consider using more efficient models for ${inefficientAgents.join(', ')}.`,
        impact: 'Medium'
      });
    }

    // General optimization tips
    tips.push({
      type: 'info',
      title: 'Batch Operations',
      message: 'Group similar tasks together to reduce context switching overhead.',
      impact: 'Low'
    });

    return tips;
  }, [agentStates]);

  const getIconForType = (type) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return Info;
    }
  };

  return (
    <div className="cost-optimization">
      <h4>Optimization Suggestions</h4>
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => {
          const Icon = getIconForType(suggestion.type);
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={clsx('suggestion-item', suggestion.type)}
            >
              <Icon size={18} className="suggestion-icon" />
              <div className="suggestion-content">
                <h5 className="suggestion-title">{suggestion.title}</h5>
                <p className="suggestion-message">{suggestion.message}</p>
                <span className={clsx('suggestion-impact', suggestion.impact.toLowerCase())}>
                  {suggestion.impact} Impact
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const CostTracker = ({ agentStates, modelConfigs, totalCost, performanceData }) => {
  const [viewMode, setViewMode] = useState('overview');
  const [timeRange, setTimeRange] = useState('1h');

  const costMetrics = useMemo(() => {
    const totalTokens = Object.values(agentStates).reduce((sum, state) => sum + state.tokensUsed, 0);
    const avgCostPerToken = totalTokens > 0 ? totalCost / totalTokens : 0;
    const mostExpensive = Object.entries(agentStates)
      .reduce((max, [name, state]) => state.estimatedCost > max.cost ? { name, cost: state.estimatedCost } : max,
        { name: '', cost: 0 });

    return {
      totalCost,
      totalTokens,
      avgCostPerToken: avgCostPerToken * 1000, // per 1k tokens
      mostExpensive,
      efficiency: totalTokens > 0 ? (totalCost / totalTokens * 1000) : 0
    };
  }, [agentStates, totalCost]);

  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      totalCost: costMetrics.totalCost,
      totalTokens: costMetrics.totalTokens,
      agentBreakdown: Object.entries(agentStates).map(([name, state]) => ({
        agent: name,
        cost: state.estimatedCost,
        tokens: state.tokensUsed
      })),
      performanceData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cost-tracker">
      <div className="cost-header">
        <div className="header-left">
          <h2>Cost Analysis</h2>
          <div className="view-controls">
            <button
              onClick={() => setViewMode('overview')}
              className={clsx('view-btn', { active: viewMode === 'overview' })}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={clsx('view-btn', { active: viewMode === 'detailed' })}
            >
              Detailed
            </button>
            <button
              onClick={() => setViewMode('optimization')}
              className={clsx('view-btn', { active: viewMode === 'optimization' })}
            >
              Optimization
            </button>
          </div>
        </div>

        <div className="header-actions">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
          <button onClick={exportData} className="export-btn">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <div className="overview-content">
          <div className="cost-metrics">
            <CostCard
              title="Total Cost"
              value={costMetrics.totalCost}
              icon={DollarSign}
              color="primary"
              subtitle="Project lifetime"
            />
            <CostCard
              title="Tokens Used"
              value={costMetrics.totalTokens}
              icon={Brain}
              color="info"
              subtitle="All agents"
            />
            <CostCard
              title="Avg Cost/1K"
              value={costMetrics.avgCostPerToken}
              icon={Zap}
              color="warning"
              subtitle="Per 1000 tokens"
            />
            <CostCard
              title="Most Expensive"
              value={costMetrics.mostExpensive.cost}
              icon={TrendingUp}
              color="danger"
              subtitle={costMetrics.mostExpensive.name}
            />
          </div>

          <div className="charts-grid">
            <TokenUsageChart data={performanceData} />
            <CostBreakdownChart agentStates={agentStates} modelConfigs={modelConfigs} />
          </div>

          <CostProjection
            performanceData={performanceData}
            currentCost={totalCost}
          />
        </div>
      )}

      {viewMode === 'detailed' && (
        <div className="detailed-content">
          <ModelCostComparison
            modelConfigs={modelConfigs}
            agentStates={agentStates}
          />

          <div className="detailed-breakdown">
            <h4>Agent Performance Details</h4>
            <div className="agent-details-grid">
              {Object.entries(agentStates).map(([agentName, state]) => (
                <div key={agentName} className="agent-detail-card">
                  <h5>{agentName.charAt(0).toUpperCase() + agentName.slice(1)}</h5>
                  <div className="detail-metrics">
                    <div className="metric">
                      <span className="label">Cost:</span>
                      <span className="value">${state.estimatedCost.toFixed(4)}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Tokens:</span>
                      <span className="value">{state.tokensUsed.toLocaleString()}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Efficiency:</span>
                      <span className="value">
                        {state.tokensUsed > 0
                          ? (state.estimatedCost / state.tokensUsed * 1000).toFixed(4)
                          : '0.0000'} $/1k
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'optimization' && (
        <div className="optimization-content">
          <CostOptimizationSuggestions
            agentStates={agentStates}
          />
        </div>
      )}
    </div>
  );
};

export default CostTracker;