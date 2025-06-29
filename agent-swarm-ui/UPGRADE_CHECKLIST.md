# Model Upgrade Checklist

## Completed Changes ✅

### 1. Environment Configuration
- [x] Updated `.env.example` with new model identifiers
- [x] Changed `CODEX_MODEL` to `OPENAI_MODEL` for consistency
- [x] Added backwards compatibility comments for old model names

### 2. Backend Agent Updates
- [x] **Claude Agent** (`claude_agent.py`)
  - Added `os.getenv("CLAUDE_MODEL", "claude-sonnet-4")` fallback
  - Import `os` module
- [x] **Gemini Agent** (`gemini_agent.py`)
  - Added `os.getenv("GEMINI_MODEL", "gemini-2.5-pro")` fallback
  - Updated command to include `--model {self.model}` parameter
  - Import `os` module
- [x] **Codex Agent** (`codex_agent.py`)
  - Added `os.getenv("OPENAI_MODEL", "gpt-4.1-mini")` fallback
  - Import `os` module

### 3. Orchestration Layer
- [x] **Main.py** - Updated agent_models fallback dictionary with new defaults:
  ```python
  {
      "claude": os.getenv("CLAUDE_MODEL", "claude-sonnet-4"),
      "gemini": os.getenv("GEMINI_MODEL", "gemini-2.5-pro"),
      "codex": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
      "integrator": os.getenv("INTEGRATION_MODEL", "gemini-2.5-pro")
  }
  ```

### 4. Frontend Updates
- [x] **App.jsx** - Updated default state and dropdown options:
  - Claude: `claude-sonnet-4`, `claude-opus-4`
  - Gemini: `gemini-2.5-pro`, `gemini-2.5-flash`
  - OpenAI: `gpt-4.1-mini`, `o3`, `o4-mini (legacy)`
  - Integrator: `gemini-2.5-pro`, `claude-sonnet-4`

### 5. Infrastructure
- [x] **Dockerfile** - Bumped CLI versions:
  - `claude-flow@^4`
  - `@google/generative-ai@^2.5.0`
  - `openai@^4.1.0`

### 6. Testing & Validation
- [x] Created regression test script (`test-models.sh`)
- [x] Created GitHub Actions workflow (`model-upgrade-tests.yml`)
- [x] Added automated testing for all three providers

### 7. Documentation
- [x] Updated README.md with new model information
- [x] Added cost/performance considerations
- [x] Updated API examples

## Model Mapping Reference

| Old Model | New Model | Provider | Notes |
|-----------|-----------|----------|-------|
| `claude-3-5-sonnet-20241022` | `claude-sonnet-4` | Anthropic | Default Claude model |
| `claude-3-opus-20240229` | `claude-opus-4` | Anthropic | High-reasoning model |
| `gemini-1.5-pro-002` | `gemini-2.5-pro` | Google | Default Gemini model |
| `gemini-1.5-flash-latest` | `gemini-2.5-flash` | Google | Fast/cheap option |
| `o1-mini` | `gpt-4.1-mini` | OpenAI | Default OpenAI model |
| `o4-mini` | `o4-mini (legacy)` | OpenAI | Kept for compatibility |
| New: `o3` | `o3` | OpenAI | Flagship reasoning model |

## Performance & Cost Notes

### Claude Models
- **Opus 4**: ~5× slower and 4× pricier than Sonnet 4
- **Sonnet 4**: Best balance of speed/capability
- Use case: Opus for deep integration, Sonnet for general tasks

### Gemini Models
- **2.5 Flash**: 35–50 ms/token vs. ≈120 ms for Pro
- **2.5 Flash**: One-third the cost of Pro
- Use case: Flash for rapid iteration, Pro for complex analysis

### OpenAI Models
- **GPT-4.1 mini**: ~40% cheaper than o3
- **GPT-4.1 mini**: Handles 1M token context windows
- **o3**: Best for long-chain reasoning with tool calls
- Use case: 4.1-mini for speed, o3 for complex reasoning

## Testing Commands

### Quick Manual Tests
```bash
# Test new models work
./agent-swarm-ui/test-models.sh

# Test Docker build
cd agent-swarm-ui && docker build -t ai-agent-swarm:test .

# Test frontend build
cd agent-swarm-ui/frontend && npm run build
```

### Regression Tests
```bash
# Run the three smoke tests from the playbook:

# 1. Anthropic
claude-flow --model claude-opus-4 "2+2"

# 2. Google
npx @google/generative-ai --model gemini-2.5-flash "hello"

# 3. OpenAI
openai api chat.completions.create -m gpt-4.1-mini --messages '[{"role":"user","content":"ping"}]'
```

## Rollback Instructions

If issues arise, rollback by reverting these environment variables in `.env`:

```bash
# Rollback to old models
CLAUDE_MODEL=claude-3-5-sonnet-20241022
GEMINI_MODEL=gemini-1.5-pro-002
OPENAI_MODEL=o1-mini
INTEGRATION_MODEL=claude-3-5-sonnet-20241022
```

The code changes maintain backwards compatibility, so old model names should still work.

## Final Verification

- [ ] Docker image builds successfully
- [ ] Frontend shows new model options
- [ ] All three CLI tools respond to help commands
- [ ] Environment variables are properly referenced
- [ ] GitHub Actions tests pass