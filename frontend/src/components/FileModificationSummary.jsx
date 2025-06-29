import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  FileText,
  FolderOpen,
  Plus,
  Minus,
  Edit3,
  Trash2,
  Eye,
  Search,
  Filter,
  Download,
  GitBranch,
  Clock,
  User,
  Code2,
  Image,
  FileCode,
  Database,
  Settings
} from 'lucide-react';
import clsx from 'clsx';
import CodeDiffViewer from './CodeDiffViewer';

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap = {
    js: Code2, jsx: Code2, ts: Code2, tsx: Code2,
    py: Code2, rb: Code2, php: Code2, java: Code2,
    cpp: Code2, c: Code2, cs: Code2, go: Code2,
    html: Code2, css: Code2, scss: Code2,
    json: Settings, xml: Settings, yaml: Settings,
    md: FileText, txt: FileText,
    png: Image, jpg: Image, jpeg: Image, gif: Image, svg: Image,
    sql: Database,
    default: FileText
  };
  return iconMap[ext] || iconMap.default;
};

const FileChangeIcon = ({ changeType, size = 16 }) => {
  const iconMap = {
    created: Plus,
    modified: Edit3,
    deleted: Trash2,
    renamed: GitBranch
  };
  const Icon = iconMap[changeType] || Edit3;

  return (
    <Icon
      size={size}
      className={clsx('change-icon', changeType)}
    />
  );
};

const FileCard = ({ file, onExpand, isExpanded, agentColor }) => {
  const FileIcon = getFileIcon(file.path);
  const timestamp = new Date(file.timestamp).toLocaleString();

  const getChangeStats = () => {
    if (!file.stats) return null;
    return (
      <div className="change-stats">
        {file.stats.additions > 0 && (
          <span className="additions">+{file.stats.additions}</span>
        )}
        {file.stats.deletions > 0 && (
          <span className="deletions">-{file.stats.deletions}</span>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="file-card"
      style={{ '--agent-color': agentColor }}
    >
      <div className="file-header" onClick={() => onExpand(file.id)}>
        <div className="file-info">
          <FileIcon size={20} className="file-icon" />
          <div className="file-details">
            <div className="file-path-row">
              <span className="file-path">{file.path}</span>
              <FileChangeIcon changeType={file.changeType} />
            </div>
            <div className="file-meta">
              <span className="file-agent">{file.agent}</span>
              <span className="file-timestamp">{timestamp}</span>
            </div>
          </div>
        </div>

        <div className="file-actions">
          {getChangeStats()}
          <button className="expand-btn">
            <Eye size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="file-expanded-content"
          >
            <div className="file-diff-preview">
              {file.diff ? (
                <CodeDiffViewer
                  fileChanges={[file]}
                  viewMode="unified"
                  compact={true}
                />
              ) : (
                <div className="no-diff">
                  <Code2 size={24} />
                  <p>Diff information not available</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FileTreeView = ({ files, onFileSelect, selectedFile }) => {
  const fileTree = useMemo(() => {
    const tree = {};

    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          current[part] = { ...file, isFile: true };
        } else {
          // It's a directory
          if (!current[part]) {
            current[part] = { isDirectory: true, children: {} };
          }
          current = current[part].children || current[part];
        }
      });
    });

    return tree;
  }, [files]);

  const renderTree = (node, path = '', level = 0) => {
    return Object.entries(node).map(([name, item]) => {
      const fullPath = path ? `${path}/${name}` : name;
      const isSelected = selectedFile?.path === fullPath;

      if (item.isFile) {
        const FileIcon = getFileIcon(name);
        return (
          <motion.div
            key={fullPath}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={clsx('tree-file', { selected: isSelected })}
            style={{ paddingLeft: `${level * 20 + 10}px` }}
            onClick={() => onFileSelect(item)}
          >
            <FileIcon size={16} className="tree-icon" />
            <span className="tree-name">{name}</span>
            <FileChangeIcon changeType={item.changeType} size={14} />
          </motion.div>
        );
      } else {
        return (
          <div key={fullPath} className="tree-directory">
            <div
              className="tree-folder"
              style={{ paddingLeft: `${level * 20 + 10}px` }}
            >
              <FolderOpen size={16} className="tree-icon" />
              <span className="tree-name">{name}</span>
            </div>
            {item.children && renderTree(item.children, fullPath, level + 1)}
          </div>
        );
      }
    });
  };

  return (
    <div className="file-tree">
      <h4>File Structure</h4>
      <div className="tree-content">
        {renderTree(fileTree)}
      </div>
    </div>
  );
};

const StatsSummary = ({ files }) => {
  const stats = useMemo(() => {
    const totalFiles = files.length;
    const byType = files.reduce((acc, file) => {
      acc[file.changeType] = (acc[file.changeType] || 0) + 1;
      return acc;
    }, {});

    const byAgent = files.reduce((acc, file) => {
      acc[file.agent] = (acc[file.agent] || 0) + 1;
      return acc;
    }, {});

    const totalAdditions = files.reduce((sum, file) =>
      sum + (file.stats?.additions || 0), 0);
    const totalDeletions = files.reduce((sum, file) =>
      sum + (file.stats?.deletions || 0), 0);

    return {
      totalFiles,
      byType,
      byAgent,
      totalAdditions,
      totalDeletions,
      netChange: totalAdditions - totalDeletions
    };
  }, [files]);

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
    <div className="stats-summary">
      <div className="stats-grid">
        <div className="stat-card">
          <FileText size={24} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.totalFiles}</h3>
            <p>Files Modified</p>
          </div>
        </div>

        <div className="stat-card additions">
          <Plus size={24} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.totalAdditions.toLocaleString()}</h3>
            <p>Lines Added</p>
          </div>
        </div>

        <div className="stat-card deletions">
          <Minus size={24} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.totalDeletions.toLocaleString()}</h3>
            <p>Lines Removed</p>
          </div>
        </div>

        <div className="stat-card net-change">
          <GitBranch size={24} className="stat-icon" />
          <div className="stat-content">
            <h3>{stats.netChange > 0 ? '+' : ''}{stats.netChange.toLocaleString()}</h3>
            <p>Net Change</p>
          </div>
        </div>
      </div>

      <div className="breakdown-section">
        <div className="breakdown-item">
          <h4>By Change Type</h4>
          <div className="breakdown-list">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="breakdown-row">
                <FileChangeIcon changeType={type} />
                <span className="breakdown-label">{type}</span>
                <span className="breakdown-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="breakdown-item">
          <h4>By Agent</h4>
          <div className="breakdown-list">
            {Object.entries(stats.byAgent).map(([agent, count]) => (
              <div key={agent} className="breakdown-row">
                <div
                  className="agent-color-indicator"
                  style={{ backgroundColor: getAgentColor(agent) }}
                />
                <span className="breakdown-label">{agent}</span>
                <span className="breakdown-value">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const FileModificationSummary = ({ fileChanges }) => {
  const [viewMode, setViewMode] = useState('list'); // list, tree, diff
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedFile, setSelectedFile] = useState(null);

  const filteredFiles = useMemo(() => {
    let filtered = [...fileChanges];

    if (searchTerm) {
      filtered = filtered.filter(file =>
        file.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterAgent !== 'all') {
      filtered = filtered.filter(file => file.agent === filterAgent);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(file => file.changeType === filterType);
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [fileChanges, searchTerm, filterAgent, filterType]);

  const agents = useMemo(() =>
    [...new Set(fileChanges.map(f => f.agent))], [fileChanges]);

  const changeTypes = useMemo(() =>
    [...new Set(fileChanges.map(f => f.changeType))], [fileChanges]);

  const getAgentColor = (agentName) => {
    const colors = {
      claude: '#8B5CF6',
      gemini: '#06B6D4',
      codex: '#10B981',
      integrator: '#F59E0B'
    };
    return colors[agentName.toLowerCase()] || '#6B7280';
  };

  const toggleFileExpansion = (fileId) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const exportChanges = () => {
    const data = {
      timestamp: new Date().toISOString(),
      totalFiles: filteredFiles.length,
      changes: filteredFiles.map(file => ({
        path: file.path,
        changeType: file.changeType,
        agent: file.agent,
        timestamp: file.timestamp,
        stats: file.stats
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `file-changes-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!fileChanges || fileChanges.length === 0) {
    return (
      <div className="file-modifications-empty">
        <div className="empty-state">
          <FileText size={48} className="empty-icon" />
          <h3>No file modifications yet</h3>
          <p>File changes will appear here as agents work on your project</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-modification-summary">
      <div className="summary-header">
        <div className="header-left">
          <h2>File Modifications</h2>
          <div className="view-controls">
            <button
              onClick={() => setViewMode('list')}
              className={clsx('view-btn', { active: viewMode === 'list' })}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={clsx('view-btn', { active: viewMode === 'tree' })}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode('diff')}
              className={clsx('view-btn', { active: viewMode === 'diff' })}
            >
              Diff View
            </button>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={exportChanges} className="export-btn">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="summary-filters">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Agents</option>
          {agents.map(agent => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Changes</option>
          {changeTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <StatsSummary files={filteredFiles} />

      <div className="summary-content">
        {viewMode === 'list' && (
          <div className="files-list">
            {filteredFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onExpand={toggleFileExpansion}
                isExpanded={expandedFiles.has(file.id)}
                agentColor={getAgentColor(file.agent)}
              />
            ))}
          </div>
        )}

        {viewMode === 'tree' && (
          <div className="tree-view">
            <FileTreeView
              files={filteredFiles}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
            />
            {selectedFile && (
              <div className="selected-file-details">
                <FileCard
                  file={selectedFile}
                  onExpand={toggleFileExpansion}
                  isExpanded={expandedFiles.has(selectedFile.id)}
                  agentColor={getAgentColor(selectedFile.agent)}
                />
              </div>
            )}
          </div>
        )}

        {viewMode === 'diff' && (
          <CodeDiffViewer
            fileChanges={filteredFiles}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
        )}
      </div>
    </div>
  );
};

export default FileModificationSummary;