# AI Agent Swarm System

A powerful multi-agent AI system that orchestrates Claude, Gemini, and OpenAI Codex to collaboratively solve software engineering tasks. Each agent works on independent copies of your codebase in parallel, with an intelligent integration phase that synthesizes the best solutions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Key Features](#key-features)
3. [Architecture](#architecture)
4. [Software Requirements Specification](#software-requirements-specification)
5. [User Journeys](#user-journeys)
6. [Installation & Setup](#installation--setup)
7. [Configuration](#configuration)
8. [API Reference](#api-reference)
9. [Migration TODO List](#migration-todo-list)
10. [Development Guide](#development-guide)
11. [Troubleshooting](#troubleshooting)

## System Overview

The AI Agent Swarm System enables developers to leverage the unique strengths of three leading AI coding assistants simultaneously:

- **Claude (via claude-flow)**: Excels at deep code understanding, complex refactoring, and maintaining code consistency
- **Gemini (via gemini-cli)**: Provides rapid prototyping, multimodal capabilities, and Google-grounded insights
- **OpenAI Codex**: Offers autonomous coding with sophisticated approval workflows and chain-of-thought reasoning

After parallel execution, an intelligent integration agent synthesizes the best aspects of each solution into a final, optimized implementation.

## Key Features

### Core Capabilities
- **Parallel Agent Execution**: All three agents work simultaneously on isolated code copies
- **Intelligent Synthesis**: Advanced integration logic merges the best solutions
- **Real-time Monitoring**: WebSocket-based live progress tracking for all agents
- **Git Integration**: Automatic branch creation and PR-ready commits
- **Flexible Model Selection**: Choose specific models from each provider
- **Sandboxed Execution**: Each agent operates in an isolated environment
- **Web UI**: Modern React interface for configuration and monitoring

### Agent-Specific Features

#### Claude Agent
- Powered by claude-flow swarm mode
- Default model: Claude 4 Sonnet
- Excels at: Architecture design, code consistency, comprehensive refactoring
- Special features: CLAUDE.md constitution support, memory state management

#### Gemini Agent
- Runs via npx for zero-config setup
- Default model: Gemini 2.5 Pro
- Excels at: Rapid iteration, multimodal input, real-time information
- Special features: Screenshot/diagram input, Google Search grounding

#### OpenAI Agent
- Full-featured CLI with approval modes
- Default model: GPT-4.1 mini (fast reasoning)
- Excels at: Autonomous task completion, test-driven development
- Special features: o3 flagship reasoning, image processing, tool integration

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI Agent Swarm System                        │
├─────────────────────────────────────────────────────────────────────┤
│                         Web UI (React + Vite)                       │
│  ┌─────────────────┬─────────────────┬─────────────────────────┐  │
│  │ API Key Config  │ Project Setup   │ Agent Status Monitor    │  │
│  └─────────────────┴─────────────────┴─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    FastAPI Backend + WebSocket                      │
│  ┌─────────────────┬─────────────────┬─────────────────────────┐  │
│  │ Project Manager │ Agent Orchestra  │ WebSocket Handler       │  │
│  └─────────────────┴─────────────────┴─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Agent Execution Layer                        │
│  ┌─────────────┬─────────────┬─────────────┬──────────────────┐  │
│  │   Claude    │   Gemini    │   Codex     │   Integration    │  │
│  │   Agent     │   Agent     │   Agent     │     Agent        │  │
│  ├─────────────┼─────────────┼─────────────┼──────────────────┤  │
│  │ claude-flow │ gemini-cli  │ codex CLI   │ Multi-provider   │  │
│  │   swarm     │   (npx)     │ full-auto   │   Synthesis      │  │
│  ├─────────────┴─────────────┴─────────────┴──────────────────┤  │
│  │          Isolated Sandboxes (Git-tracked workspaces)        │  │
│  └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer (Docker)                    │
│  ┌─────────────────┬─────────────────┬─────────────────────────┐  │
│  │ Node.js 20 LTS  │ Python 3.11+    │ Git + Build Tools       │  │
│  └─────────────────┴─────────────────┴─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Software Requirements Specification

### 1. Functional Requirements

#### 1.1 Agent Management
- **FR-001**: System SHALL execute Claude, Gemini, and Codex agents in parallel
- **FR-002**: Each agent SHALL work on an isolated copy of the repository
- **FR-003**: System SHALL support model selection for each agent
- **FR-004**: Integration agent SHALL start only after all primary agents complete
- **FR-005**: System SHALL maintain complete isolation between agent workspaces

#### 1.2 Code Processing
- **FR-006**: System SHALL clone GitHub repositories into isolated environments
- **FR-007**: Each agent SHALL have full read/write access to its workspace
- **FR-008**: Integration agent SHALL access all three agent outputs for synthesis
- **FR-009**: System SHALL generate a unified final codebase with documentation
- **FR-010**: System SHALL commit changes to a new Git branch with detailed messages

#### 1.3 User Interface
- **FR-011**: Web UI SHALL provide real-time status for all agents
- **FR-012**: System SHALL stream agent output via WebSocket
- **FR-013**: UI SHALL allow API key configuration
- **FR-014**: UI SHALL support GitHub repository URL input
- **FR-015**: UI SHALL display file modification summaries

#### 1.4 Integration Logic
- **FR-016**: Integration agent SHALL analyze code quality metrics
- **FR-017**: Integration agent SHALL resolve conflicts between solutions
- **FR-018**: Integration agent SHALL document all decisions
- **FR-019**: Integration agent SHALL generate a comprehensive report and readme
- **FR-020**: Integration agent SHALL push the results back to a new branch on the original github url

### 2. Non-Functional Requirements

#### 2.1 Performance
- **NFR-001**: Parallel agent execution SHALL complete within 30 minutes typical
- **NFR-002**: System SHALL support repositories up to 1GB in size
- **NFR-003**: WebSocket latency SHALL be < 100ms
- **NFR-004**: UI SHALL remain responsive during agent execution

#### 2.2 Reliability
- **NFR-005**: Individual agent failure SHALL NOT affect other agents
- **NFR-006**: System SHALL retry failed operations up to 3 times
- **NFR-007**: System SHALL preserve partial results on failure
- **NFR-008**: System SHALL gracefully degrade if a provider is unavailable

#### 2.3 Security
- **NFR-009**: API keys SHALL be stored securely and never logged
- **NFR-010**: Each agent SHALL run in a sandboxed environment
- **NFR-011**: Agents SHALL have access to their stored credentials setup on the commandline inside the docker using the --init switch within their relevant sandbox
- **NFR-012**: System SHALL have network access for their tooling

#### 2.4 Usability
- **NFR-013**: System SHALL provide clear error messages
- **NFR-014**: Setup SHALL require < 5 minutes for experienced developers
- **NFR-015**: UI SHALL be intuitive without documentation
- **NFR-016**: System SHALL provide export functionality for logs

**Key Moments**:
- Completeness: Production-ready from start
- Best Practices: Combines strengths of all agents
- Time Saved: 2-week project in 2 hours

## Installation & Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Git
- API Keys from:
  - Anthropic (Claude)
  - Google (Gemini)
  - OpenAI

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ai-agent-swarm
cd ai-agent-swarm

# 2. Copy environment template
cp .env.example .env

# 3. Add your API keys to .env
# Edit .env with your keys

# 4. Start the system
docker-compose up -d

# 5. Access the UI
open http://localhost:8100
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  ai-swarm:
    build: ./agent-swarm-ui
    ports:
      - "8100:8100"
    environment:
      - NODE_ENV=production
    volumes:
      - ./workspace:/home/appuser/app/workspace
      - agent-cache:/home/appuser/.cache
    env_file:
      - .env

volumes:
  agent-cache:
```

## Configuration

claude code and gemini cli must be logged in within the docker context and the credentials stored. This demands a --init command for the docker which logs into the commandline.

### Environment Variables

```bash
# Required API Keys
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...

# Model Configuration (Optional - defaults shown)
CLAUDE_MODEL=claude-sonnet-4
GEMINI_MODEL=gemini-2.5-pro
OPENAI_MODEL=gpt-4.1-mini
INTEGRATION_MODEL=gemini-2.5-pro

# System Configuration
MAX_PARALLEL_AGENTS=3
AGENT_TIMEOUT_MINUTES=30
WORKSPACE_SIZE_LIMIT_GB=1
LOG_LEVEL=INFO
```

### Model Selection Guide

| Agent | Default Model | Alternatives | Best For |
|-------|--------------|--------------|----------|
| Claude | claude-sonnet-4 | claude-opus-4 | Balance of speed/capability |
| Gemini | gemini-2.5-pro | gemini-2.5-flash | Complex analysis |
| OpenAI | gpt-4.1-mini | o3, o4-mini | Fast iteration with reasoning |
| Integration | gemini-2.5-pro | claude-sonnet-4 | Fast synthesis |

#### Cost & Performance Notes
- **Claude Opus 4**: ~5× slower and 4× pricier than Sonnet 4—use for deep integration passes
- **Gemini 2.5 Flash**: 35–50 ms/token vs. ≈120 ms for Pro at one-third the cost
- **GPT-4.1 mini**: ~40% cheaper than o3, handles 1M token context windows
- **o3**: Best for long-chain reasoning with tool calls

## API Reference

### REST Endpoints

#### Set API Keys
```http
POST /api/keys
Content-Type: application/json

{
  "claude_api_key": "sk-ant-...",
  "gemini_api_key": "AIza...",
  "codex_api_key": "sk-..."
}
```

#### Get API Key Status
```http
GET /api/keys

Response:
{
  "ANTHROPIC_API_KEY": "configured",
  "GEMINI_API_KEY": "configured",
  "OPENAI_API_KEY": "configured"
}
```

### WebSocket API

#### Start Project
```javascript
ws.send(JSON.stringify({
  "github_url": "https://github.com/org/repo",
  "project_prompt": "Refactor authentication system",
  "agent_models": {
    "claude": "claude-3-5-sonnet-20241022",
    "gemini": "gemini-1.5-pro",
    "codex": "o4-mini",
    "integrator": "o4-mini"
  }
}));
```

#### Message Types
```typescript
interface AgentMessage {
  agent: "Claude" | "Gemini" | "Codex" | "Integrator";
  type: "status" | "stdout" | "stderr" | "error" | "complete";
  message: string;
  timestamp: string;
}
```

## Migration TODO List

### Phase 1: Fix Agent Implementations (Priority: HIGH)

- [ ] **Fix Gemini Agent Command**
  - [ ] Replace `gemini` command with `npx https://github.com/google-gemini/gemini-cli`
  - [ ] Add proper error handling for npx execution
  - [ ] Test with sample prompts

- [ ] **Fix Codex Agent Command**
  - [ ] Replace `codex` command with proper installation check
  - [ ] Add `@openai/codex` to npm global installs in Dockerfile
  - [ ] Implement `--full-auto` mode with proper sandboxing
  - [ ] Add model selection support (default: o4-mini)

- [ ] **Update Model Configurations**
  - [ ] Change Claude default from opus to sonnet-3.5
  - [ ] Add o4-mini as default for Codex
  - [ ] Update frontend model selection dropdowns

### Phase 2: Add Missing Base Agent Features (Priority: HIGH)

- [ ] **Create Base Agent Class**
  ```python
  # backend/agents/base_agent.py
  - [ ] Implement status tracking
  - [ ] Add execution timing
  - [ ] Create output logging system
  - [ ] Add retry logic with exponential backoff
  - [ ] Implement timeout handling
  ```

- [ ] **Implement Agent Workspace Isolation**
  - [ ] Create unique sandbox directory per agent
  - [ ] Implement workspace cleanup on completion
  - [ ] Add Git tracking for changes

### Phase 3: Enhance Integration Logic (Priority: MEDIUM)

- [ ] **Upgrade Integration Agent**
  - [ ] Implement code quality analysis
  - [ ] Add conflict resolution logic
  - [ ] Create decision documentation
  - [ ] Add validation steps
  - [ ] Generate comprehensive reports

- [ ] **Add Integration Strategies**
  - [ ] Best-of-breed selection
  - [ ] Voting mechanism
  - [ ] Confidence scoring
  - [ ] Synthetic merge algorithm

### Phase 4: Improve Error Handling (Priority: MEDIUM)

- [ ] **Agent-Level Error Handling**
  - [ ] Graceful degradation on agent failure
  - [ ] Partial result preservation
  - [ ] Error categorization and reporting
  - [ ] Automatic retry with different models

- [ ] **System-Level Resilience**
  - [ ] Health checks for each agent
  - [ ] Circuit breaker pattern
  - [ ] Fallback strategies
  - [ ] Recovery mechanisms

### Phase 5: Frontend Improvements (Priority: LOW)

- [ ] **Update Model Selection UI**
  - [ ] Add model descriptions
  - [ ] Show estimated costs
  - [ ] Add model capability indicators
  - [ ] Implement model recommendation

- [ ] **Enhance Monitoring**
  - [ ] Add progress bars
  - [ ] Show token usage
  - [ ] Display cost estimates
  - [ ] Add diff viewers

### Phase 6: Testing & Validation (Priority: HIGH)

- [ ] **Unit Tests**
  ```bash
  tests/
  ├── test_agents/
  │   ├── test_claude_agent.py
  │   ├── test_gemini_agent.py
  │   ├── test_codex_agent.py
  │   └── test_integration_agent.py
  ├── test_orchestration.py
  └── test_api.py
  ```

- [ ] **Integration Tests**
  - [ ] Test parallel execution
  - [ ] Test failure scenarios
  - [ ] Test large repositories
  - [ ] Test timeout handling

### Phase 7: Documentation (Priority: MEDIUM)

- [ ] **API Documentation**
  - [ ] OpenAPI/Swagger spec
  - [ ] Authentication guide
  - [ ] Rate limiting docs
  - [ ] Error code reference

- [ ] **User Guides**
  - [ ] Quick start video
  - [ ] Best practices guide
  - [ ] Model selection guide
  - [ ] Troubleshooting guide

### Phase 8: DevOps & Deployment (Priority: LOW)

- [ ] **Production Readiness**
  - [ ] Add Kubernetes manifests
  - [ ] Create Helm charts
  - [ ] Add monitoring (Prometheus/Grafana)
  - [ ] Implement log aggregation

- [ ] **CI/CD Pipeline**
  - [ ] Automated testing
  - [ ] Security scanning
  - [ ] Automated deployment
  - [ ] Rollback procedures

## Development Guide

### Local Development Setup

```bash
# Backend development
cd agent-swarm-ui/backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend development
cd agent-swarm-ui/frontend
npm install
npm run dev
```

### Adding a New Agent

1. Create agent class inheriting from `BaseAgent`
2. Implement `execute()` method
3. Add to agent registry in `main.py`
4. Update frontend model options
5. Add tests

### Testing Individual Agents

```bash
# Test Claude
docker exec -it ai-swarm bash
cd /tmp && mkdir test-claude && cd test-claude
echo "def hello(): print('world')" > test.py
claude-flow swarm "Add type hints and docstring"

# Test Gemini
cd /tmp && mkdir test-gemini && cd test-gemini
echo "def hello(): print('world')" > test.py
npx https://github.com/google-gemini/gemini-cli "Add error handling"

# Test Codex
cd /tmp && mkdir test-codex && cd test-codex
echo "def hello(): print('world')" > test.py
codex --full-auto "Add unit tests"
```

## Troubleshooting

### Common Issues

#### 1. Agent Command Not Found
**Problem**: "gemini: command not found" or "codex: command not found"
**Solution**: These are the most common errors due to incorrect commands
```bash
# Gemini runs via npx, not as a command
npx https://github.com/google-gemini/gemini-cli

# Codex must be installed globally first
npm install -g @openai/codex
```

#### 2. API Key Errors
**Problem**: 401 or 403 errors from agents
**Solution**: Verify API keys are correctly set
```bash
# Check environment variables
docker exec -it ai-swarm env | grep API_KEY

# Validate keys
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

#### 3. Timeout Issues
**Problem**: Agents timing out on large tasks
**Solution**: Adjust timeout settings
```bash
# In .env
AGENT_TIMEOUT_MINUTES=60  # Increase from default 30
```

#### 4. Memory Issues
**Problem**: Container running out of memory
**Solution**: Increase Docker memory allocation or reduce parallel agents
```yaml
# docker-compose.yml
services:
  ai-swarm:
    mem_limit: 8g  # Increase memory limit
```

### Debug Mode

Enable debug logging for detailed troubleshooting:
```bash
# In .env
LOG_LEVEL=DEBUG

# View logs
docker logs -f ai-swarm
```

## License

[Specify your license]

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- GitHub Issues: [Report bugs](https://github.com/your-org/ai-agent-swarm/issues)
- Documentation: [Full docs](https://docs.your-org.com)
- Community: [Discord/Slack]