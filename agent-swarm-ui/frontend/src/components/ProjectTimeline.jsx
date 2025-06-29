import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  GitBranch,
  Database,
  Activity,
  Cpu,
  Eye,
  EyeOff,
  Calendar,
  Filter,
  Download
} from 'lucide-react';
import clsx from 'clsx';

const TimelineEvent = ({ event, index, isVisible, onToggleVisibility }) => {
  const getEventIcon = (type) => {
    switch (type) {
      case 'phase': return GitBranch;
      case 'info': return Info;
      case 'success': return CheckCircle;
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'start': return Play;
      case 'pause': return Pause;
      case 'complete': return CheckCircle;
      default: return Info;
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'phase': return '#3498db';
      case 'info': return '#6c757d';
      case 'success': return '#27ae60';
      case 'error': return '#e74c3c';
      case 'warning': return '#f39c12';
      case 'start': return '#27ae60';
      case 'pause': return '#f39c12';
      case 'complete': return '#27ae60';
      default: return '#6c757d';
    }
  };

  const Icon = getEventIcon(event.type);
  const color = getEventColor(event.type);
  const timestamp = new Date(event.timestamp);
  const timeString = timestamp.toLocaleTimeString();
  const dateString = timestamp.toLocaleDateString();

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={clsx('timeline-event', event.type, { hidden: !isVisible })}
      style={{ '--event-color': color }}
    >
      <div className="event-connector" />
      <div className="event-marker">
        <Icon size={16} />
      </div>
      <div className="event-content">
        <div className="event-header">
          <h4 className="event-phase">{event.phase}</h4>
          <div className="event-time">
            <span className="event-date">{dateString}</span>
            <span className="event-timestamp">{timeString}</span>
          </div>
        </div>
        <p className="event-description">{event.description}</p>
        {event.details && (
          <div className="event-details">
            {Object.entries(event.details).map(([key, value]) => (
              <div key={key} className="detail-item">
                <span className="detail-key">{key}:</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        className="visibility-toggle"
        onClick={() => onToggleVisibility(event.id)}
        title={isVisible ? 'Hide event' : 'Show event'}
      >
        {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </motion.div>
  );
};

const TimelineStats = ({ timeline, currentPhase }) => {
  const stats = useMemo(() => {
    const totalEvents = timeline.length;
    const eventsByType = timeline.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    const startTime = timeline.length > 0 ? new Date(timeline[0].timestamp) : null;
    const endTime = timeline.length > 0 ? new Date(timeline[timeline.length - 1].timestamp) : null;
    const duration = startTime && endTime ? endTime - startTime : 0;

    const phases = [...new Set(timeline.map(e => e.phase))].filter(Boolean);

    return {
      totalEvents,
      eventsByType,
      duration,
      phases: phases.length,
      currentPhase
    };
  }, [timeline, currentPhase]);

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="timeline-stats">
      <div className="stats-grid">
        <div className="stat-item">
          <Activity size={20} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.totalEvents}</h3>
            <p>Total Events</p>
          </div>
        </div>

        <div className="stat-item">
          <Clock size={20} className="stat-icon" />
          <div className="stat-content">
            <h3>{formatDuration(stats.duration)}</h3>
            <p>Duration</p>
          </div>
        </div>

        <div className="stat-item">
          <GitBranch size={20} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.phases}</h3>
            <p>Phases</p>
          </div>
        </div>

        <div className="stat-item">
          <Database size={20} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.currentPhase}</h3>
            <p>Current Phase</p>
          </div>
        </div>
      </div>

      <div className="event-breakdown">
        <h4>Event Types</h4>
        <div className="breakdown-list">
          {Object.entries(stats.eventsByType).map(([type, count]) => (
            <div key={type} className="breakdown-item">
              <span className={clsx('type-indicator', type)} />
              <span className="type-name">{type}</span>
              <span className="type-count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PhaseProgress = ({ timeline, currentPhase, isRunning }) => {
  const phases = [
    { name: 'Planning', key: 'planning', color: '#3498db' },
    { name: 'Executing', key: 'executing', color: '#e67e22' },
    { name: 'Integrating', key: 'integrating', color: '#9b59b6' },
    { name: 'Completing', key: 'completing', color: '#27ae60' }
  ];

  const getPhaseStatus = (phaseKey) => {
    const phaseEvents = timeline.filter(e => e.phase?.toLowerCase().includes(phaseKey));
    const hasStarted = phaseEvents.length > 0;
    const isCurrent = currentPhase === phaseKey;
    const isCompleted = hasStarted && !isCurrent && phases.findIndex(p => p.key === phaseKey) < phases.findIndex(p => p.key === currentPhase);

    return { hasStarted, isCurrent, isCompleted };
  };

  return (
    <div className="phase-progress">
      <h4>Phase Progress</h4>
      <div className="phases-timeline">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase.key);

          return (
            <div key={phase.key} className="phase-item">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{
                  scale: status.isCurrent ? 1.1 : 1,
                  backgroundColor: status.isCompleted
                    ? '#27ae60'
                    : status.isCurrent
                      ? phase.color
                      : '#e9ecef'
                }}
                className={clsx('phase-marker', {
                  current: status.isCurrent,
                  completed: status.isCompleted,
                  started: status.hasStarted
                })}
              >
                {status.isCompleted && <CheckCircle size={16} />}
                {status.isCurrent && isRunning && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Activity size={16} />
                  </motion.div>
                )}
                {!status.hasStarted && <Clock size={16} />}
              </motion.div>

              <div className="phase-info">
                <span className="phase-name">{phase.name}</span>
                <span className={clsx('phase-status', {
                  completed: status.isCompleted,
                  current: status.isCurrent,
                  pending: !status.hasStarted
                })}>
                  {status.isCompleted ? 'Completed' :
                   status.isCurrent ? 'In Progress' : 'Pending'}
                </span>
              </div>

              {index < phases.length - 1 && (
                <div className={clsx('phase-connector', {
                  completed: status.isCompleted
                })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProjectTimeline = ({ timeline, currentPhase, isRunning }) => {
  const [filter, setFilter] = useState('all');
  const [hiddenEvents, setHiddenEvents] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTimeline = useMemo(() => {
    let filtered = timeline;

    // Filter by type
    if (filter !== 'all') {
      filtered = filtered.filter(event => event.type === filter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.phase?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [timeline, filter, searchTerm]);

  const eventTypes = useMemo(() =>
    [...new Set(timeline.map(e => e.type))], [timeline]);

  const toggleEventVisibility = (eventId) => {
    setHiddenEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const exportTimeline = () => {
    const data = {
      exportTime: new Date().toISOString(),
      currentPhase,
      isRunning,
      timeline: filteredTimeline.map(event => ({
        timestamp: event.timestamp,
        phase: event.phase,
        description: event.description,
        type: event.type,
        details: event.details
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-timeline-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!timeline || timeline.length === 0) {
    return (
      <div className="project-timeline empty">
        <div className="empty-state">
          <Clock size={48} className="empty-icon" />
          <h3>No timeline events yet</h3>
          <p>Project events and phase changes will appear here as your project progresses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="project-timeline">
      <div className="timeline-header">
        <div className="header-left">
          <h2>Project Timeline</h2>
          <div className="timeline-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Events</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={exportTimeline} className="export-btn">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="timeline-content">
        <div className="timeline-sidebar">
          <TimelineStats
            timeline={timeline}
            currentPhase={currentPhase}
          />

          <PhaseProgress
            timeline={timeline}
            currentPhase={currentPhase}
            isRunning={isRunning}
          />
        </div>

        <div className="timeline-main">
          <div className="timeline-events">
            <AnimatePresence>
              {filteredTimeline.map((event, index) => (
                <TimelineEvent
                  key={event.id || index}
                  event={event}
                  index={index}
                  isVisible={!hiddenEvents.has(event.id)}
                  onToggleVisibility={toggleEventVisibility}
                />
              ))}
            </AnimatePresence>
          </div>

          {filteredTimeline.length === 0 && (
            <div className="no-events">
              <Info size={32} />
              <p>No events match your current filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectTimeline;