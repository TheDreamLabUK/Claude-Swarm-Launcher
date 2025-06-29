import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  DollarSign,
  Clock,
  Info,
  ChevronDown,
  Check,
  Star,
  TrendingUp,
  Shield,
  Cpu,
  Database
} from 'lucide-react';
import clsx from 'clsx';

const ModelCard = ({
  modelKey,
  modelConfig,
  isSelected,
  onSelect,
  disabled
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getSpeedColor = (speed) => {
    switch (speed.toLowerCase()) {
      case 'ultra fast': return '#10B981';
      case 'very fast': return '#06B6D4';
      case 'fast': return '#3B82F6';
      case 'moderate': return '#F59E0B';
      case 'slow': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getCostLevel = (cost) => {
    if (cost <= 0.001) return { level: 'Low', color: '#10B981' };
    if (cost <= 0.005) return { level: 'Medium', color: '#F59E0B' };
    return { level: 'High', color: '#EF4444' };
  };

  const costInfo = getCostLevel(modelConfig.costPer1kTokens);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx('model-card', {
        selected: isSelected,
        disabled
      })}
      onClick={() => !disabled && onSelect(modelKey)}
    >
      <div className="model-header">
        <div className="model-identity">
          <span className="model-icon">{modelConfig.icon}</span>
          <div className="model-info">
            <h4 className="model-name">{modelConfig.name}</h4>
            <p className="model-provider">{modelConfig.provider}</p>
          </div>
        </div>

        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="selected-indicator"
          >
            <Check size={16} />
          </motion.div>
        )}
      </div>

      <p className="model-description">{modelConfig.description}</p>

      <div className="model-specs">
        <div className="spec-item">
          <Zap size={14} className="spec-icon" />
          <span className="spec-label">Speed:</span>
          <span
            className="spec-value speed"
            style={{ color: getSpeedColor(modelConfig.speed) }}
          >
            {modelConfig.speed}
          </span>
        </div>

        <div className="spec-item">
          <DollarSign size={14} className="spec-icon" />
          <span className="spec-label">Cost:</span>
          <span
            className="spec-value cost"
            style={{ color: costInfo.color }}
          >
            {costInfo.level}
          </span>
        </div>

        <div className="spec-item">
          <Database size={14} className="spec-icon" />
          <span className="spec-label">Context:</span>
          <span className="spec-value">
            {(modelConfig.contextWindow / 1000).toFixed(0)}K
          </span>
        </div>
      </div>

      <div className="model-capabilities">
        {modelConfig.capabilities.slice(0, 3).map((capability, index) => (
          <span key={index} className="capability-tag">
            {capability}
          </span>
        ))}
        {modelConfig.capabilities.length > 3 && (
          <span className="capability-more">
            +{modelConfig.capabilities.length - 3} more
          </span>
        )}
      </div>

      <button
        className="details-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setShowDetails(!showDetails);
        }}
      >
        <Info size={14} />
        <span>Details</span>
        <ChevronDown
          size={14}
          className={clsx('chevron', { rotated: showDetails })}
        />
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="model-details"
          >
            <div className="detail-section">
              <h5>Strengths</h5>
              <div className="strengths-list">
                {modelConfig.strengths.map((strength, index) => (
                  <div key={index} className="strength-item">
                    <Star size={12} />
                    <span>{strength}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h5>All Capabilities</h5>
              <div className="all-capabilities">
                {modelConfig.capabilities.map((capability, index) => (
                  <span key={index} className="capability-detail">
                    {capability}
                  </span>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h5>Pricing</h5>
              <div className="pricing-info">
                <span className="price-amount">
                  ${modelConfig.costPer1kTokens.toFixed(4)}
                </span>
                <span className="price-unit">per 1,000 tokens</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ModelSelector = ({
  models,
  selectedModels,
  onModelChange,
  disabled = false
}) => {
  const [activeTab, setActiveTab] = useState('claude');

  const agents = ['claude', 'gemini', 'codex', 'integrator'];

  return (
    <div className="model-selector">
      <div className="selector-controls">
        <div className="tab-buttons">
          {agents.map(agent => (
            <button
              key={agent}
              onClick={() => setActiveTab(agent)}
              className={clsx('tab-btn', { active: activeTab === agent })}
              disabled={disabled}
            >
              <Brain size={16} />
              {agent.charAt(0).toUpperCase() + agent.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="models-grid">
        {Object.entries(models).map(([modelKey, modelConfig]) => {
          const isSelected = selectedModels[activeTab] === modelKey;

          return (
            <ModelCard
              key={modelKey}
              modelKey={modelKey}
              modelConfig={modelConfig}
              isSelected={isSelected}
              onSelect={(key) => onModelChange(activeTab, key)}
              agentType={activeTab}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ModelSelector;