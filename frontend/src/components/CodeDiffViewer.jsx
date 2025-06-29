import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  FileText,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  GitBranch,
  Plus,
  Minus,
  Code2,
  Maximize2,
  Minimize2,
  Search,
  Filter
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';

const getLanguageFromExtension = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    php: 'php',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    kt: 'kotlin',
    swift: 'swift',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    sql: 'sql'
  };
  return languageMap[ext] || 'text';
};

const DiffLine = ({ line, type, lineNumber, isHighlighted, onClick }) => {
  const getLineClass = (type) => {
    switch (type) {
      case 'added': return 'diff-line-added';
      case 'removed': return 'diff-line-removed';
      case 'modified': return 'diff-line-modified';
      case 'context': return 'diff-line-context';
      default: return 'diff-line-context';
    }
  };

  const getLineIcon = (type) => {
    switch (type) {
      case 'added': return <Plus size={14} className="line-icon added" />;
      case 'removed': return <Minus size={14} className="line-icon removed" />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: type === 'added' ? 10 : type === 'removed' ? -10 : 0 }}
      animate={{ opacity: 1, x: 0 }}
      className={clsx('diff-line', getLineClass(type), {
        highlighted: isHighlighted
      })}
      onClick={() => onClick && onClick(lineNumber)}
    >
      <span className="line-number">{lineNumber}</span>
      <span className="line-indicator">{getLineIcon(type)}</span>
      <span className="line-content">{line}</span>
    </motion.div>
  );
};

const DiffStats = ({ stats }) => (
  <div className="diff-stats">
    <div className="stat-item additions">
      <Plus size={16} />
      <span>{stats.additions} additions</span>
    </div>
    <div className="stat-item deletions">
      <Minus size={16} />
      <span>{stats.deletions} deletions</span>
    </div>
    <div className="stat-item changes">
      <GitBranch size={16} />
      <span>{stats.changes} changes</span>
    </div>
  </div>
);

const FileHeader = ({ file, onToggle, isExpanded, onCopy, onDownload }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.content || file.diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy && onCopy(file);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="file-header">
      <div className="file-info">
        <button
          onClick={onToggle}
          className="file-toggle"
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <FileText size={16} className="file-icon" />
        <div className="file-details">
          <span className="file-path">{file.path}</span>
          <span className={clsx('file-status', file.changeType)}>
            {file.changeType}
          </span>
        </div>
      </div>

      <div className="file-actions">
        <DiffStats stats={file.stats || {}} />
        <div className="action-buttons">
          <button
            onClick={handleCopy}
            className="action-btn"
            title="Copy content"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={() => onDownload && onDownload(file)}
            className="action-btn"
            title="Download file"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const SplitView = ({ originalContent, modifiedContent, language }) => (
  <div className="split-view">
    <div className="split-pane original">
      <div className="pane-header">Original</div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines
        className="syntax-highlighter"
      >
        {originalContent}
      </SyntaxHighlighter>
    </div>
    <div className="split-pane modified">
      <div className="pane-header">Modified</div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines
        className="syntax-highlighter"
      >
        {modifiedContent}
      </SyntaxHighlighter>
    </div>
  </div>
);

const UnifiedView = ({ diffLines }) => (
  <div className="unified-view">
    <div className="diff-content">
      {diffLines.map((line, index) => (
        <DiffLine
          key={index}
          line={line.content}
          type={line.type}
          lineNumber={line.lineNumber}
          isHighlighted={line.isHighlighted}
        />
      ))}
    </div>
  </div>
);

const CodeDiffViewer = ({ fileChanges, viewMode = 'unified' }) => {
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);

  const filteredFiles = useMemo(() => {
    let filtered = fileChanges;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(file =>
        file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.content?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by change type
    if (filterType !== 'all') {
      filtered = filtered.filter(file => file.changeType === filterType);
    }

    return filtered;
  }, [fileChanges, searchTerm, filterType]);

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

  const parseDiffLines = (diff) => {
    if (!diff) return [];

    return diff.split('\n').map((line, index) => {
      let type = 'context';
      let content = line;

      if (line.startsWith('+')) {
        type = 'added';
        content = line.substring(1);
      } else if (line.startsWith('-')) {
        type = 'removed';
        content = line.substring(1);
      } else if (line.startsWith('@@')) {
        type = 'header';
      }

      return {
        type,
        content,
        lineNumber: index + 1,
        isHighlighted: false
      };
    });
  };

  if (!fileChanges || fileChanges.length === 0) {
    return (
      <div className="code-diff-viewer empty">
        <div className="empty-state">
          <Code2 size={48} className="empty-icon" />
          <h3>No file changes yet</h3>
          <p>File modifications will appear here as agents work on your project</p>
        </div>
      </div>
    );
  }

  return (
    <div className="code-diff-viewer">
      <div className="diff-controls">
        <div className="search-filter">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-dropdown">
            <Filter size={16} className="filter-icon" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Changes</option>
              <option value="created">Created</option>
              <option value="modified">Modified</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>

        <div className="view-controls">
          <button
            onClick={() => setCurrentViewMode('unified')}
            className={clsx('view-btn', { active: currentViewMode === 'unified' })}
          >
            Unified
          </button>
          <button
            onClick={() => setCurrentViewMode('split')}
            className={clsx('view-btn', { active: currentViewMode === 'split' })}
          >
            Split
          </button>
        </div>
      </div>

      <div className="files-list">
        {filteredFiles.map((file, index) => {
          const fileId = `${file.path}-${file.timestamp}`;
          const isExpanded = expandedFiles.has(fileId);
          const language = getLanguageFromExtension(file.path);
          const diffLines = parseDiffLines(file.diff);

          return (
            <motion.div
              key={fileId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="file-diff-container"
            >
              <FileHeader
                file={file}
                onToggle={() => toggleFileExpansion(fileId)}
                isExpanded={isExpanded}
                onCopy={(file) => console.log('Copied:', file.path)}
                onDownload={(file) => console.log('Download:', file.path)}
              />

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="file-content"
                  >
                    {currentViewMode === 'split' && file.originalContent && file.modifiedContent ? (
                      <SplitView
                        originalContent={file.originalContent}
                        modifiedContent={file.modifiedContent}
                        language={language}
                      />
                    ) : (
                      <UnifiedView
                        diffLines={diffLines}
                        language={language}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CodeDiffViewer;