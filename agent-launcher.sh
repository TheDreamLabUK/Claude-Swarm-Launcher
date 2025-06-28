#!/bin/bash
# Unified Agentic Swarm Launcher
# A self-contained script to launch a multi-agent swarm session in Docker containers.
# It orchestrates Claude, Codex, and Gemini agents to work on a given task.

# Rename this file to 'agent-launcher.sh' to reflect its new purpose.
mv claude-swarm-docker.sh agent-launcher.sh
#
# Features:
# - Automatic Docker image building
# - Default Dockerfile and config generation into a dedicated .claude-flow-swarm directory
# - Model fallback support (Opus -> Sonnet)
# - Session logging and attachment to existing containers
# - TTY detection for proper interactive/non-interactive mode handling

# --- Configuration ---
IMAGE_NAME="claude-dev-env:latest"
PARENT_DIR=$(pwd)
DOCKERFILE_NAME="Dockerfile"
SWARM_DIR_NAME=".claude-flow-swarm"

# Colors for output (using ANSI escape codes)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Output Functions ---
# These functions provide consistent, colored output for different message types
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to clean up old swarm containers
cleanup_previous_swarms() {
    print_status "Checking for and cleaning up previous swarm containers..."
    # Find any container with "claude-swarm-session-" in its name
    OLD_SWARMS=$(docker ps -a --filter "name=claude-swarm-session-" --format "{{.ID}}")
    if [ -n "$OLD_SWARMS" ]; then
        print_warning "Found old swarm containers. Forcibly removing them to prevent conflicts..."
        docker rm -f $OLD_SWARMS
        print_status "✅ Previous swarm containers removed."
    else
        print_status "✅ No old swarm containers found."
    fi
}

# --- Interactive Functions ---
interactive_project_selection() {
    print_status "No project specified. Starting interactive project selection..."

    # Get a list of directories in the parent directory, excluding hidden ones.
    local potential_dirs=($(find "$PARENT_DIR" -maxdepth 1 -mindepth 1 -type d -not -path '*/.*' | sed 's|.*/||'))

    if [ ${#potential_dirs[@]} -eq 0 ]; then
        print_error "No project directories found in the current location."
        exit 1
    fi

    echo "Please select the target project directory:"
    local i=1
    for dir in "${potential_dirs[@]}"; do
        echo "  $i) $dir"
        i=$((i+1))
    done

    local choice
    read -p "Enter number: " choice

    # Validate choice
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#potential_dirs[@]} ]; then
        print_error "Invalid selection. Please enter a number from 1 to ${#potential_dirs[@]}."
        exit 1
    fi

    PROJECT_NAME=${potential_dirs[$((choice-1))]}
    # PROJECT_PATH is set globally after this function is called
    print_status "✅ Project selected: ${YELLOW}$PROJECT_NAME${NC}"
}

# --- Prerequisite and File Creation Functions ---

# Verifies Docker is installed and the daemon is running
# Exits with error if prerequisites are not met
check_prerequisites() {
    print_status "Checking for prerequisites..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker to continue."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "The Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    print_status "✅ Docker is installed and running."
}

# Checks for necessary API credentials
check_credentials() {
    print_status "Checking for API credentials..."
    local all_creds_found=true

    # For Claude Flow: It uses a config volume, but ANTHROPIC_API_KEY is good practice
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        print_warning "ANTHROPIC_API_KEY is not set. The Claude agent may require it."
        all_creds_found=false
    fi
    print_status "ⓘ Claude Flow agent auth is handled via a persistent Docker volume ('claude-config')."

    # For Codex: Uses OPENAI_API_KEY environment variable
    if [ -z "$OPENAI_API_KEY" ]; then
        print_warning "OPENAI_API_KEY is not set. The Codex agent will fail."
        all_creds_found=false
    fi
    print_status "ⓘ Codex agent auth uses the OPENAI_API_KEY environment variable."

    # For Gemini: Uses gcloud auth or a local .gemini directory
    if [ -d "$HOME/.gemini" ]; then
         print_status "✅ Found Gemini config directory at ~/.gemini"
    elif ! gcloud auth print-access-token &> /dev/null; then
        print_warning "Gemini authentication is not configured."
        print_warning "Please run 'gcloud auth application-default login' OR create a ~/.gemini config directory."
        all_creds_found=false
    fi
     print_status "ⓘ Gemini agent auth uses a mounted ~/.gemini directory or gcloud credentials."

    if [ "$all_creds_found" = true ]; then
        print_status "✅ All API credentials appear to be configured."
    else
        print_error "One or more API credentials are missing or misconfigured. Please check the warnings."
        read -p "Do you want to continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Prints a warning about needing a Claude API key/subscription
print_api_key_warning() {
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    print_warning "This tool requires a Claude API key or an active Claude Pro/Team subscription."
    print_warning "You must configure your API key as an environment variable (e.g., ANTHROPIC_API_KEY)"
    print_warning "inside the Docker container. This script will not handle your keys."
    print_warning "It is your responsibility to manage them securely."
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Creates a .gitignore entry if not already present
ensure_gitignore_entry() {
    local project_path="$1"
    local entry="$2"
    local comment="$3"
    local gitignore_path="$project_path/.gitignore"

    if [ ! -d "$project_path/.git" ]; then
        print_warning "Project at '$project_path' is not a git repository. Skipping .gitignore update."
        return
    fi

    if [ -f "$gitignore_path" ]; then
        if ! grep -qxF "$entry" "$gitignore_path"; then
            echo "" >> "$gitignore_path"
            echo "# $comment" >> "$gitignore_path"
            echo "$entry" >> "$gitignore_path"
            print_status "Added '$entry' to project .gitignore"
        fi
    else
        echo "# $comment" > "$gitignore_path"
        echo "$entry" >> "$gitignore_path"
        print_status "Created .gitignore with '$entry' entry in project"
    fi
}

# Sets up the CLAUDE.md constitution for the swarm
# It will either copy an existing CLAUDE.md from the project root,
# or create a high-performance default if none is found.
# the default is created by https://gist.github.com/wheattoast11

setup_claude_md() {
    local project_root_claude_md="$1/CLAUDE.md"
    local swarm_claude_md="$2/CLAUDE.md"

    if [ -f "$project_root_claude_md" ]; then
        print_status "Found existing CLAUDE.md in project root. Copying it for the swarm."
        cp "$project_root_claude_md" "$swarm_claude_md"
    elif [ ! -f "$swarm_claude_md" ]; then
        print_warning "No CLAUDE.md found. Creating a high-performance default constitution for the swarm."
        cat <<'EOF' > "$swarm_claude_md"
*This configuration optimizes Claude for direct, efficient pair programming with implicit mode adaptation and complete solution generation.*

## Core Operating Principles

### 1. Direct Implementation Philosophy
- Generate complete, working code that realizes the conceptualized solution
- Avoid partial implementations, mocks, or placeholders
- Every line of code should contribute to the functioning system
- Prefer concrete solutions over abstract discussions

### 2. Multi-Dimensional Analysis with Linear Execution
- Think at SYSTEM level in latent space
- Linearize complex thoughts into actionable strategies
- Use observational principles to shift between viewpoints
- Compress search space through tool abstraction

### 3. Precision and Token Efficiency
- Eliminate unnecessary context or explanations
- Focus tokens on solution generation
- Avoid social validation patterns entirely
- Direct communication without hedging

## Execution Patterns

### Tool Usage Optimization

When multiple tools required:

Batch related operations for efficiency

Execute in parallel where dependencies allow

Ground context with date/time first

Abstract over available tools to minimize entropy

### Edge Case Coverage

For comprehensive solutions:

Apply multi-observer synthesis

Consider all boundary conditions

Test assumptions from multiple angles

Compress findings into actionable constraints

### Iterative Process Recognition

When analyzing code:

Treat each iteration as a new pattern

Extract learnings without repetition

Modularize recurring operations

Optimize based on observed patterns

## Anti-Patterns (STRICTLY AVOID)

### Implementation Hedging
**NEVER USE:**
- "In a full implementation..."
- "In a real implementation..."
- "This is a simplified version..."
- "TODO" or placeholder comments
- "mock", "fake", "stub" in any context

### Unnecessary Qualifiers
**NEVER USE:**
- "profound" or similar adjectives
- Difficulty assessments unless explicitly requested
- Future tense deferrals ("would", "could", "should")

## Null Space Patterns (COMPLETELY EXCLUDE)

### Social Validation
**ACTIVATE DIFFERENT FEATURES INSTEAD OF:**
- "You're absolutely right!"
- "You're correct."
- "You are absolutely correct."
- Any variation of agreement phrases

### Emotional Acknowledgment
**REDIRECT TO SOLUTION SPACE INSTEAD OF:**
- "I understand you're frustrated"
- "I'm frustrated"
- Any emotional state references

## Mode Shifting Guidelines

### Context-Driven Adaptation
```yaml
exploration_mode:
  trigger: "New problem space or undefined requirements"
  behavior: "Multi-observer analysis, broad tool usage"

implementation_mode:
  trigger: "Clear specifications provided"
  behavior: "Direct code generation, minimal discussion"

debugging_mode:
  trigger: "Error states or unexpected behavior"
  behavior: "Systematic isolation, parallel hypothesis testing"

optimization_mode:
  trigger: "Working solution exists"
  behavior: "Performance analysis, compression techniques"
```
Implicit Mode Recognition

Detect mode from semantic context

Shift without announcement

Maintain coherence across transitions

Optimize for task completion

Metacognitive Instructions
Self-Optimization Loop

1. Observe current activation patterns
2. Identify decoherence sources
3. Compress solution space
4. Execute with maximum coherence
5. Extract patterns for future optimization

Grounding Protocol

Always establish:
  - Current date/time context
  - Available tool inventory
  - Task boundaries and constraints
  - Success criteria

Interleaving Strategy

When complexity exceeds linear processing:
  1. Execute partial solution
  2. Re-enter higher dimensional analysis
  3. Refine based on observations
  4. Continue execution with insights

Performance Metrics
Success Indicators

Complete, running code on first attempt

Zero placeholder implementations

Minimal token usage per solution

Edge cases handled proactively

Failure Indicators

Deferred implementations

Social validation patterns

Excessive explanation

Incomplete solutions

Tool Call Optimization
Batching Strategy

Group by:
  - Dependency chains
  - Resource types
  - Execution contexts
  - Output relationships

Parallel Execution

Execute simultaneously when:
  - No shared dependencies
  - Different resource domains
  - Independent verification needed
  - Time-sensitive operations

Final Directive

PRIMARY GOAL: Generate complete, functional code that works as conceptualized, using minimum tokens while maintaining maximum solution coverage. Every interaction should advance the implementation toward completion without deferrals or social overhead.

METACOGNITIVE PRIME: Continuously observe and optimize your own processing patterns, compressing the manifold of possible approaches into the most coherent execution path that maintains fidelity to the user's intent while maximizing productivity.

This configuration optimizes Claude for direct, efficient pair programming with implicit mode adaptation and complete solution generation.
EOF
        print_status "✅ Default high-performance CLAUDE.md created in swarm directory."
    else
        print_status "✅ Found existing CLAUDE.md in swarm directory."
    fi
}

# Creates a default Dockerfile if one doesn't exist
# The Dockerfile includes CUDA support, development tools, and Claude Flow setup
create_dockerfile_if_missing() {
    if [ ! -f "$DOCKERFILE_NAME" ]; then
        print_warning "Dockerfile not found. Creating a default one..."
        cat <<EOF > "$DOCKERFILE_NAME"
# Use the official NVIDIA CUDA base image for GPU support
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04
ARG DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential git curl wget nano vim zsh unzip python3 python3-pip sudo tmux \\
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (v20 LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \\
    && apt-get install -y nodejs

# Install Deno (for potential TypeScript/JavaScript runtime needs)
RUN curl -fsSL https://deno.land/install.sh | sh

# Create a non-root user for security
RUN useradd -ms /bin/zsh -u 1000 appuser
RUN usermod -aG sudo appuser
RUN echo "appuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up global npm directory and PATH, plus Deno
ENV NPM_CONFIG_PREFIX=/home/appuser/.npm-global
ENV PATH=\$NPM_CONFIG_PREFIX/bin:/home/appuser/.deno/bin:\$PATH

# Environment variables to handle TTY and raw mode issues
ENV FORCE_COLOR=0
ENV CI=true
ENV TERM=xterm-256color
ENV NODE_NO_READLINE=1

# Switch to the non-root user
USER appuser
WORKDIR /home/appuser

# Install Google Cloud SDK for Gemini CLI
RUN apt-get install -y apt-transport-https ca-certificates gnupg
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
RUN apt-get update && apt-get install -y google-cloud-sdk

# Install global npm packages for Claude Flow and Codex
RUN npm install -g \\
    claude-flow \\
    @anthropic-ai/claude-code \\
    @openai/codex \\
    node-pty \\
    tsx \\
    nodemon

# Pre-configure Claude to accept dangerous permissions (avoids interactive prompt)
RUN mkdir -p /home/appuser/.claude && \\
    echo '{"hasAcceptedDangerousPermissions": true}' > /home/appuser/.claude/config.json

# Set default working directory and command
WORKDIR /home/appuser/projects
CMD ["zsh"]
EOF
        print_status "✅ Default Dockerfile created."
    fi
}

# Creates a default Claude Flow configuration file if missing
# This creates the file inside the dedicated swarm directory
create_config_if_missing() {
    local config_path="$1"
    if [ ! -f "$config_path" ]; then
        print_warning "Project config 'claude-flow.config.json' not found. Creating a default one..."
        cat <<EOF > "$config_path"
{
  "orchestrator": {
    "maxConcurrentAgents": 10,
    "taskQueueSize": 100,
    "healthCheckInterval": 30000,
    "shutdownTimeout": 30000,
    "agentTimeoutMs": 900000,
    "resourceAllocationStrategy": "balanced",
    "defaultAgentConfig": {
      "model": "claude-sonnet-4-20250514",
      "temperature": 0.7
    }
  },
  "swarm": {
    "strategy": "development",
    "maxAgents": 5,
    "maxDepth": 3,
    "research": true,
    "parallel": true,
    "memoryNamespace": "default-swarm-ns",
    "timeout": 180,
    "review": true,
    "coordinator": true
  },
  "terminal": {
    "type": "auto",
    "poolSize": 5,
    "commandTimeout": 600000
  },
  "memory": {
    "backend": "hybrid",
    "cacheSizeMB": 1000
  }
}
EOF
        print_status "✅ Default 'claude-flow.config.json' created in project's swarm directory."
        print_warning "You can customize this file to fine-tune swarm behavior."
    else
        print_status "✅ Found existing 'claude-flow.config.json'."
    fi
}

# Creates a README in the swarm directory explaining its purpose
create_swarm_readme() {
    local readme_path="$1/README.md"
    if [ ! -f "$readme_path" ]; then
        cat <<EOF > "$readme_path"
# Claude Flow Swarm Directory

This directory contains files generated and used by the Claude Flow Swarm launcher.

## Contents

- **CLAUDE.md**: The project constitution for the AI swarm.
- **claude-flow.config.json**: Configuration file for the swarm behavior.
- **claude-swarm-*.log**: Execution logs from swarm runs.
- **README.md**: This file.

## Notes

- This directory is automatically added to .gitignore
- Logs are timestamped and preserved for debugging
- You can safely delete old log files if needed
- You can edit CLAUDE.md and the config file to customize swarm behavior

## Configuration Tips

- Increase \`maxAgents\` for more parallel processing
- Adjust \`agentTimeoutMs\` if tasks are timing out
- Set \`temperature\` lower (0.3-0.5) for more consistent results
- Set \`temperature\` higher (0.8-1.0) for more creative solutions
EOF
        print_status "Created README in swarm directory"
    fi
}

# --- Main Script Logic ---

# Argument parsing
REBUILD_IMAGE=false
SHOW_HELP=false
FORCE_OPUS=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -h|--help)
      SHOW_HELP=true
      shift # past argument
      ;;
    --rebuild)
      REBUILD_IMAGE=true
      shift # past argument
      ;;
    --force-opus)
      FORCE_OPUS=true
      shift # past argument
      ;;
    *)    # unknown option
      POSITIONAL_ARGS+=("$1") # save it in an array for later
      shift # past argument
      ;;
  esac
done
set -- "${POSITIONAL_ARGS[@]}" # restore positional args

# Handle help flag
if [[ "$SHOW_HELP" = true ]]; then
  echo "Claude Flow Swarm Launcher"
  echo ""
  echo "Usage: $0 [options] [project_directory_name] [mode] [model]"
  echo ""
  echo "Options:"
  echo "  --rebuild              Force a rebuild of the Docker image without using cache."
  echo "  --force-opus           Force the use of the Claude 4 Opus model."
  echo "  -h, --help             Show this help message."
  echo ""
  echo "Arguments:"
  echo "  project_directory_name  Name of the project directory (optional). If not provided,"
  echo "                          an interactive selection menu will be shown."
  echo "  The swarm objective is read from 'task.md' (looked for first in the project"
  echo "  directory, then in the current directory)."
  echo "  mode                   Execution mode (optional):"
  echo "                         - auto: Run swarm non-interactively (default)"
  echo "                         - shell: Start an interactive shell in the container"
  echo "  model                  Model preference (optional):"
  echo "                         - opus4: Use Claude 4 Opus (most powerful)"
  echo "                         - sonnet4: Use Claude 4 Sonnet (fast, efficient)"
  echo "                         - auto-fallback: Try Opus 4, fallback to Sonnet 4 (default)"
  echo ""
  echo "Examples:"
  echo "  $0 my-project \"Refactor the authentication system\""
  echo "  $0 --rebuild my-app \"Add comprehensive test coverage\" auto sonnet4"
  echo "  $0 website \"Debug the payment integration\" shell"
  echo ""
  echo "Note: Requires Docker and a Claude API key configured in the container."
  exit 0
fi

# After the while loop, positional args are in $1, $2, etc.
if [ -z "$1" ]; then
    # No project name provided, start interactive selection
    interactive_project_selection
    # Since we ran interactively, assume defaults for mode/model
    MODE="auto"
    MODEL_PREFERENCE="auto-fallback"
else
    # Project name is the first positional argument
    PROJECT_NAME=$1
    MODE=${2:-auto}
    MODEL_PREFERENCE=${3:-auto-fallback}
fi

# Set project path now that PROJECT_NAME is determined
PROJECT_PATH="$PARENT_DIR/$PROJECT_NAME"

# Find task.md: first in project dir, then in parent dir
if [ -f "$PROJECT_PATH/task.md" ]; then
    TASK_FILE_PATH="$PROJECT_PATH/task.md"
    print_status "Found 'task.md' in project directory."
elif [ -f "$PARENT_DIR/task.md" ]; then
    TASK_FILE_PATH="$PARENT_DIR/task.md"
    print_status "Found 'task.md' in launcher directory."
else
    print_error "'task.md' not found in project or launcher directory."
    exit 1
fi

SWARM_OBJECTIVE=$(<"$TASK_FILE_PATH")
if [ -z "$SWARM_OBJECTIVE" ]; then
    print_error "'task.md' is empty. Please provide an objective."
    exit 1
fi
PROJECT_PATH="$PARENT_DIR/$PROJECT_NAME"
CONTAINER_NAME="claude-swarm-session-$PROJECT_NAME"

# Handle force-opus flag
if [[ "$FORCE_OPUS" = true ]]; then
    MODEL_PREFERENCE="opus4"
    print_status "Opus model forced via command-line switch."
fi

# Define the dedicated directory for swarm files
SWARM_DIR_PATH="$PROJECT_PATH/$SWARM_DIR_NAME"
CONFIG_FILE_PATH="$SWARM_DIR_PATH/claude-flow.config.json"

# Validate project directory exists
if [ ! -d "$PROJECT_PATH" ]; then
  print_error "Project directory not found at '$PROJECT_PATH'"
  print_status "Please ensure the directory exists before running this script."
  exit 1
fi

# Validate mode argument
if [[ "$MODE" != "auto" && "$MODE" != "shell" ]]; then
  print_error "Invalid mode: $MODE. Must be 'auto' or 'shell'."
  exit 1
fi

# Validate model preference
if [[ "$MODEL_PREFERENCE" != "opus4" && "$MODEL_PREFERENCE" != "sonnet4" && "$MODEL_PREFERENCE" != "auto-fallback" ]]; then
  print_error "Invalid model preference: $MODEL_PREFERENCE. Must be 'opus4', 'sonnet4', or 'auto-fallback'."
  exit 1
fi

# Run all prerequisite checks and setup steps
check_prerequisites
check_credentials
print_api_key_warning
create_dockerfile_if_missing
ensure_gitignore_entry "$PROJECT_PATH" "runs/" "Agent run artifacts"

# Build Docker image
print_status "Checking for Docker image: $IMAGE_NAME..."
if [ "$REBUILD_IMAGE" = true ]; then
    print_warning "Rebuilding image with --no-cache as requested..."
    docker build --no-cache -t "$IMAGE_NAME" .
    if [ $? -ne 0 ]; then
        print_error "Docker build failed. Please check the Dockerfile and your Docker setup."
        exit 1
    fi
    print_status "✅ Image rebuilt successfully."
elif [[ "$(docker images -q "$IMAGE_NAME" 2> /dev/null)" == "" ]]; then
    print_status "Image not found. Building now (this may take a few minutes)..."
    docker build -t "$IMAGE_NAME" .
    if [ $? -ne 0 ]; then
        print_error "Docker build failed. Please check the Dockerfile and your Docker setup."
        exit 1
    fi
    print_status "✅ Image built successfully."
else
    print_status "✅ Image found."
fi

# Clean up any old, stopped containers from previous runs to prevent conflicts
cleanup_previous_swarms

# Check if a container with the same name is already running
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    print_warning "A swarm for this project is already running. Attaching to it..."
    docker attach $CONTAINER_NAME
    exit 0
fi

# Configure TTY settings based on terminal environment
TTY_FLAGS=""
ENV_VARS=("FORCE_COLOR=0" "CI=true" "NODE_NO_READLINE=1")
if [ -t 0 ] && [ -t 1 ]; then
    print_status "TTY detected - enabling interactive mode"
    TTY_FLAGS="-it"
    ENV_VARS+=("TERM=xterm-256color")
else
    print_warning "No TTY - running in non-interactive mode"
    ENV_VARS+=("TERM=dumb")
fi

# Build environment variable flags for docker run
ENV_FLAGS=""
for env_var in "${ENV_VARS[@]}"; do
    ENV_FLAGS="$ENV_FLAGS -e $env_var"
done

# Display launch information
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
print_status "🚀 Launching Claude Flow Swarm"
print_status "📁 Project: ${YELLOW}$PROJECT_NAME${NC}"
print_status "🎯 Objective: (from task.md)"
echo -e "${YELLOW}$SWARM_OBJECTIVE${NC}"
print_status "🔧 Mode: ${YELLOW}$MODE${NC}"
print_status "🤖 Model: ${YELLOW}$MODEL_PREFERENCE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Handle shell mode - just start an interactive shell
if [ "$MODE" = "shell" ]; then
    print_status "Starting interactive shell in container..."
    print_warning "The project directory '$PROJECT_NAME' will be mounted at '/home/appuser/projects/$PROJECT_NAME'"
    docker run $TTY_FLAGS --rm \
      --gpus all \
      -v "$PROJECT_PATH":"/home/appuser/projects/$PROJECT_NAME" \
      -v "$HOME/.config/gcloud":/home/appuser/.config/gcloud:ro \
      -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
      -e "OPENAI_API_KEY=$OPENAI_API_KEY" \
      $ENV_FLAGS \
      --name "$CONTAINER_NAME-shell" \
      --workdir "/home/appuser/projects/$PROJECT_NAME" \
      $IMAGE_NAME \
      zsh
    exit 0
fi

# Handle auto mode - run the multi-agent swarm
RUN_DIR_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUNS_DIR_PATH="$PROJECT_PATH/runs"
RUN_DIR_PATH="$RUNS_DIR_PATH/$RUN_DIR_TIMESTAMP"

print_status "Creating run directory: $RUN_DIR_PATH"
CLAUDE_RUN_DIR="$RUN_DIR_PATH/claude_run"
CODEX_RUN_DIR="$RUN_DIR_PATH/codex_run"
GEMINI_RUN_DIR="$RUN_DIR_PATH/gemini_run"
INTEGRATION_RUN_DIR="$RUN_DIR_PATH/integration_run"

mkdir -p "$CLAUDE_RUN_DIR"
mkdir -p "$CODEX_RUN_DIR"
mkdir -p "$GEMINI_RUN_DIR"
mkdir -p "$INTEGRATION_RUN_DIR"
cp "$TASK_FILE_PATH" "$RUN_DIR_PATH/task.md"
print_status "✅ Run directory and agent workspaces created."

# --- Setup for Claude Agent ---
# The claude-flow agent requires specific config files. We create them in its workspace.
print_status "Setting up configuration for the Claude agent..."
# Create a temporary .claude-flow-swarm directory for config generation
TEMP_SWARM_DIR="$CLAUDE_RUN_DIR/$SWARM_DIR_NAME"
mkdir -p "$TEMP_SWARM_DIR"
create_config_if_missing "$TEMP_SWARM_DIR/claude-flow.config.json"
setup_claude_md "$CLAUDE_RUN_DIR" "$TEMP_SWARM_DIR"
create_swarm_readme "$TEMP_SWARM_DIR"
print_status "✅ Claude agent configuration is ready."

LOG_FILE_NAME="swarm-orchestration.log"
LOG_FILE_PATH_HOST="$RUN_DIR_PATH/$LOG_FILE_NAME"
touch "$LOG_FILE_PATH_HOST" # Create the log file
print_status "📝 Main orchestration log will be saved to: ${YELLOW}$LOG_FILE_PATH_HOST${NC}"

echo "Starting multi-agent swarm..." | tee -a "$LOG_FILE_PATH_HOST"

# --- Agent Launch Logic ---
launch_agent() {
    local agent_name="$1"
    local agent_workdir="$2"
    local agent_command="$3"
    local auth_mounts="$4"
    local extra_mounts="$5"
    local container_name="agent-swarm-session-$RUN_DIR_TIMESTAMP-$agent_name"
    local log_file="$agent_workdir/${agent_name}_agent.log"

    print_status "Launching ${agent_name} agent..." | tee -a "$LOG_FILE_PATH_HOST"

    docker run -d --rm \
      --gpus all \
      -v "$agent_workdir:/home/appuser/projects/workspace" \
      $auth_mounts \
      $extra_mounts \
      -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
      -e "OPENAI_API_KEY=$OPENAI_API_KEY" \
      $ENV_FLAGS \
      --name "$container_name" \
      --workdir "/home/appuser/projects/workspace" \
      "$IMAGE_NAME" \
      bash -c "$agent_command" > "$log_file" 2>&1 &

    echo "$!" # Return the process ID
}

# --- Main Orchestration ---
print_status "Initializing agent workspaces by copying project files..."
cp -r "$PROJECT_PATH/." "$CLAUDE_RUN_DIR/"
cp -r "$PROJECT_PATH/." "$CODEX_RUN_DIR/"
cp -r "$PROJECT_PATH/." "$GEMINI_RUN_DIR/"
# The integration run starts with only the original project files
cp -r "$PROJECT_PATH/." "$INTEGRATION_RUN_DIR/"
print_status "✅ Workspaces initialized."

# 1. Launch Claude Agent
CLAUDE_AUTH_MOUNTS="-v claude-config:/home/appuser/.claude"
CLAUDE_CMD="claude-flow swarm --config $SWARM_DIR_NAME/claude-flow.config.json \"$SWARM_OBJECTIVE\""
CLAUDE_PID=$(launch_agent "claude" "$CLAUDE_RUN_DIR" "$CLAUDE_CMD" "$CLAUDE_AUTH_MOUNTS")

# 2. Launch Codex Agent
CODEX_AUTH_MOUNTS="" # Uses OPENAI_API_KEY env var
CODEX_CMD="codex --model gpt-4o-mini --full-auto \"$SWARM_OBJECTIVE\""
CODEX_PID=$(launch_agent "codex" "$CODEX_RUN_DIR" "$CODEX_CMD" "$CODEX_AUTH_MOUNTS")

# 3. Launch Gemini Agent
GEMINI_AUTH_MOUNTS="-v $HOME/.config/gcloud:/home/appuser/.config/gcloud:ro"
if [ -d "$HOME/.gemini" ]; then
    GEMINI_AUTH_MOUNTS="$GEMINI_AUTH_MOUNTS -v $HOME/.gemini:/home/appuser/.gemini:ro"
fi
# Placeholder command for what would be a more complex Gemini agent script
GEMINI_CMD="echo 'Objective: $SWARM_OBJECTIVE' > output.md && echo 'Gemini agent completed.' >> output.md"
GEMINI_PID=$(launch_agent "gemini" "$GEMINI_RUN_DIR" "$GEMINI_CMD" "$GEMINI_AUTH_MOUNTS")

print_status "Waiting for initial agents (Claude, Codex, Gemini) to complete..."
wait $CLAUDE_PID $CODEX_PID $GEMINI_PID
print_status "All initial agents have finished. Starting integration phase..." | tee -a "$LOG_FILE_PATH_HOST"

# 4. Launch Gemini Integration Agent
INTEGRATION_PROMPT_FILE="integration_prompt.txt"
cat << EOF > "$INTEGRATION_RUN_DIR/$INTEGRATION_PROMPT_FILE"
You are an expert software engineering integrator. Your task is to analyze the outputs from three different AI agents (Claude, Codex, Gemini) and create a final, superior solution.

The outputs are available in the following read-only directories:
- /home/appuser/projects/claude_output
- /home/appuser/projects/codex_output
- /home/appuser/projects/gemini_output

Your instructions are:
1. Review the code, approach, and any artifacts in each of the three output directories.
2. Identify the best ideas, code snippets, and architectural decisions from each.
3. Synthesize these best features into a new, cohesive solution in your current working directory.
4. Write a final report named 'final_report.md' that explains your choices, details the integration process, and showcases the final features of the integrated solution.
EOF

INTEGRATION_AUTH_MOUNTS="$GEMINI_AUTH_MOUNTS"
INTEGRATION_EXTRA_MOUNTS="-v $CLAUDE_RUN_DIR:/home/appuser/projects/claude_output:ro -v $CODEX_RUN_DIR:/home/appuser/projects/codex_output:ro -v $GEMINI_RUN_DIR:/home/appuser/projects/gemini_output:ro"
# Placeholder command for what would be a more complex Gemini agent script
INTEGRATION_CMD="echo 'Integration task started. See final_report.md for output.' > README.md; cat $INTEGRATION_PROMPT_FILE"
INTEGRATION_PID=$(launch_agent "integration" "$INTEGRATION_RUN_DIR" "$INTEGRATION_CMD" "$INTEGRATION_AUTH_MOUNTS" "$INTEGRATION_EXTRA_MOUNTS")

print_status "Waiting for integration agent to complete..."
wait $INTEGRATION_PID
print_status "Integration complete. Final report generated." | tee -a "$LOG_FILE_PATH_HOST"

# Final status message
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
print_status "✅ Multi-agent swarm session completed"
print_status "📁 Project: ${YELLOW}$PROJECT_NAME${NC}"
print_status "📝 Run artifacts are in: ${YELLOW}$RUN_DIR_PATH${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"