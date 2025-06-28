#!/bin/bash
# Claude Flow Swarm Launcher
# A self-contained script to launch a Claude Flow Swarm session in a Docker container.
# It checks for prerequisites, creates missing files, and guides the user through setup.
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

# Creates a .gitignore entry for the swarm directory if not already present
ensure_gitignore_entry() {
    local gitignore_path="$1/.gitignore"
    local entry="$SWARM_DIR_NAME/"

    if [ -f "$gitignore_path" ]; then
        if ! grep -qxF "$entry" "$gitignore_path"; then
            echo "" >> "$gitignore_path"
            echo "# Claude Flow Swarm files" >> "$gitignore_path"
            echo "$entry" >> "$gitignore_path"
            print_status "Added $SWARM_DIR_NAME/ to .gitignore"
        fi
    else
        echo "# Claude Flow Swarm files" > "$gitignore_path"
        echo "$entry" >> "$gitignore_path"
        print_status "Created .gitignore with $SWARM_DIR_NAME/ entry"
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

# Install global npm packages required for Claude Flow
RUN npm install -g \\
    claude-flow \\
    @anthropic-ai/claude-code \\
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
  echo "Usage: $0 [options] <project_directory_name> \"<swarm_objective>\" [mode] [model]"
  echo ""
  echo "Options:"
  echo "  --rebuild              Force a rebuild of the Docker image without using cache."
  echo "  --force-opus           Force the use of the Claude 4 Opus model."
  echo "  -h, --help             Show this help message."
  echo ""
  echo "Arguments:"
  echo "  project_directory_name  Name of the project directory (must exist)"
  echo "  swarm_objective        What you want the swarm to accomplish (quoted string)"
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

# Validate command line arguments
if [ -z "$1" ] || [ -z "$2" ]; then
  print_error "Missing required arguments. Use --help for usage information."
  exit 1
fi

# Parse command line arguments
PROJECT_NAME=$1
SWARM_OBJECTIVE=$2
MODE=${3:-auto}
MODEL_PREFERENCE=${4:-auto-fallback}
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
print_api_key_warning
create_dockerfile_if_missing

# Create the dedicated swarm directory and related files
mkdir -p "$SWARM_DIR_PATH"
mkdir -p "$SWARM_DIR_PATH/tmp"
print_status "Ensured swarm directory exists at: $SWARM_DIR_PATH"
ensure_gitignore_entry "$PROJECT_PATH"
create_config_if_missing "$CONFIG_FILE_PATH"
setup_claude_md "$PROJECT_PATH" "$SWARM_DIR_PATH"
create_swarm_readme "$SWARM_DIR_PATH"

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
print_status "🎯 Objective: ${YELLOW}$SWARM_OBJECTIVE${NC}"
print_status "🔧 Mode: ${YELLOW}$MODE${NC}"
print_status "🤖 Model: ${YELLOW}$MODEL_PREFERENCE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Handle shell mode - just start an interactive shell
if [ "$MODE" = "shell" ]; then
    print_status "Starting interactive shell in container..."
    docker run $TTY_FLAGS --rm \
      --gpus all \
      -v "$PROJECT_PATH":"/home/appuser/projects/$PROJECT_NAME" \
      -v "$SWARM_DIR_PATH/tmp":/tmp \
      -v "claude-config:/home/appuser/.claude" \
      -v "npm-cache:/home/appuser/.npm" \
      $ENV_FLAGS \
      --name $CONTAINER_NAME \
      --workdir "/home/appuser/projects/$PROJECT_NAME" \
      $IMAGE_NAME \
      zsh
    exit 0
fi

# Handle auto mode - run the swarm with full fallback logic
LOG_FILE_NAME="claude-swarm-$(date +%Y%m%d-%H%M%S).log"
LOG_FILE_PATH_HOST="$SWARM_DIR_PATH/$LOG_FILE_NAME"
print_status "📝 Logs will be saved to: ${YELLOW}$LOG_FILE_PATH_HOST${NC}"

# Create a temporary script file to avoid complex quoting issues
TEMP_SCRIPT=$(mktemp)
trap "rm -f $TEMP_SCRIPT" EXIT

# Write the execution script using a heredoc
cat > "$TEMP_SCRIPT" << 'SCRIPT_END'
#!/bin/bash
# --- Container-side execution script ---

# Explicitly set PATH to include npm global bins and deno
export PATH="/home/appuser/.npm-global/bin:/home/appuser/.deno/bin:$PATH"

# Verify claude-flow is accessible
echo "[DEBUG] Current PATH: $PATH"
echo "[DEBUG] Which claude-flow: $(which claude-flow)"
echo "[DEBUG] NPM global packages:"
npm list -g --depth=0

# Extract passed variables
OBJECTIVE="$1"
LOG_FILE="$2"
MODEL_PREFERENCE="$3"
CONFIG_FILE_PATH="./claude-flow.config.json"

# Model identifiers matching Claude API
MODEL_OPUS="claude-opus-4-20250514"
MODEL_SONNET="claude-sonnet-4-20250514"

# Initialize logging with header
echo "🔄 Claude Flow Swarm Execution Log" | tee "$LOG_FILE"
echo "====================================" | tee -a "$LOG_FILE"
echo "Objective: $OBJECTIVE" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "Working directory: $(pwd)" | tee -a "$LOG_FILE"
echo "====================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Function to execute swarm with a specific model
try_swarm_with_model() {
    local model_name="$1"
    local attempt="$2"
    echo "[$(date +%H:%M:%S)] 🤖 Attempt $attempt: Using model $model_name" | tee -a "$LOG_FILE"

    # Update model in config file
    if [ -f "$CONFIG_FILE_PATH" ]; then
        sed -i "s|\(\"model\":\s*\"\)[^\"]*\(\"\)|\1$model_name\2|g" "$CONFIG_FILE_PATH"
        echo "[$(date +%H:%M:%S)] Updated config to use model: $model_name" | tee -a "$LOG_FILE"
    else
        echo "[$(date +%H:%M:%S)] ⚠️  Config file not found. Using swarm defaults." | tee -a "$LOG_FILE"
    fi

    # Set a generous timeout for individual agent tasks (e.g., 30 minutes)
    # This is the most important timeout to prevent premature kills.
    local agent_timeout_ms=1800000 # 30 minutes
    if [[ "$model_name" == *"opus"* ]]; then
        # Give Opus even more time
        agent_timeout_ms=2700000 # 45 minutes
    fi
    echo "[$(date +%H:%M:%S)] Setting agent task timeout to ${agent_timeout_ms}ms" | tee -a "$LOG_FILE"
    claude-flow config set orchestrator.agentTimeoutMs $agent_timeout_ms 2>&1 | tee -a "$LOG_FILE"

    # Also set the terminal command timeout to be equally generous
    echo "[$(date +%H:%M:%S)] Setting terminal command timeout to 30 minutes" | tee -a "$LOG_FILE"
    claude-flow config set terminal.commandTimeout 1800000 2>&1 | tee -a "$LOG_FILE"

    # Set the overall swarm timeout in the config as well
    # This should be longer than any individual step.
    local swarm_timeout_minutes=180
    echo "[$(date +%H:%M:%S)] Setting swarm config timeout to ${swarm_timeout_minutes} minutes" | tee -a "$LOG_FILE"
    claude-flow config set swarm.timeout $swarm_timeout_minutes 2>&1 | tee -a "$LOG_FILE"

    echo "[$(date +%H:%M:%S)] Launching swarm..." | tee -a "$LOG_FILE"
    echo "------------------------------------" | tee -a "$LOG_FILE"

    # The outer timeout command acts as the final safety net.
    # It should be slightly longer than the swarm.timeout config (180m).
    # e.g., timeout 185m ...
    timeout 185m claude-flow swarm "$OBJECTIVE" 2>&1 | tee -a "$LOG_FILE"
    local exit_code=${PIPESTATUS[0]}

    echo "------------------------------------" | tee -a "$LOG_FILE"
    echo "[$(date +%H:%M:%S)] Swarm exited with code: $exit_code" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    return $exit_code
}

COMMAND_EXIT_CODE=1

# Memory System Workaround: Clean memory state to prevent hangs
echo "[$(date +%H:%M:%S)] Applying workaround for potential memory hangs..." | tee -a "$LOG_FILE"
# This removes the database file, forcing claude-flow to re-initialize it cleanly.
# It's safe because the swarm builds its context from scratch for each run anyway.
rm -f ./memory/claude-flow-data.json* # Remove db and journal files
# We can also use the built-in cleanup command for a safer approach
claude-flow memory cleanup --older-than 0 --vacuum --dry-run false 2>&1 | tee -a "$LOG_FILE"
echo "[$(date +%H:%M:%S)] ✅ Memory state cleaned." | tee -a "$LOG_FILE"

# Execute based on model preference
case "$MODEL_PREFERENCE" in
    "opus4")
        try_swarm_with_model "$MODEL_OPUS" "1"
        COMMAND_EXIT_CODE=$?
        ;;
    "sonnet4")
        try_swarm_with_model "$MODEL_SONNET" "1"
        COMMAND_EXIT_CODE=$?
        ;;
    "auto-fallback"|*)
        echo "🔄 Auto-fallback mode: Trying Opus 4 first..." | tee -a "$LOG_FILE"
        try_swarm_with_model "$MODEL_OPUS" "1"
        COMMAND_EXIT_CODE=$?

        if [ $COMMAND_EXIT_CODE -ne 0 ]; then
            echo "[$(date +%H:%M:%S)] ⚠️  Opus 4 failed (exit code: $COMMAND_EXIT_CODE)" | tee -a "$LOG_FILE"
            echo "[$(date +%H:%M:%S)] 🔄 Attempting fallback to Sonnet 4..." | tee -a "$LOG_FILE"
            sleep 5
            try_swarm_with_model "$MODEL_SONNET" "2 (fallback)"
            COMMAND_EXIT_CODE=$?
        fi
        ;;
esac

# Final summary
echo "" | tee -a "$LOG_FILE"
echo "====================================" | tee -a "$LOG_FILE"
echo "SWARM EXECUTION SUMMARY" | tee -a "$LOG_FILE"
echo "====================================" | tee -a "$LOG_FILE"
echo "Finished at: $(date)" | tee -a "$LOG_FILE"
echo "Exit code: $COMMAND_EXIT_CODE" | tee -a "$LOG_FILE"

# Interpret exit code
if [ $COMMAND_EXIT_CODE -eq 0 ]; then
    echo "Status: ✅ SUCCESS" | tee -a "$LOG_FILE"
elif [ $COMMAND_EXIT_CODE -eq 124 ]; then
    echo "Status: ⏱️  TIMEOUT (185 minutes exceeded)" | tee -a "$LOG_FILE"
else
    echo "Status: ❌ FAILED" | tee -a "$LOG_FILE"
fi

echo "====================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# List modified files
echo "Files modified during swarm execution:" | tee -a "$LOG_FILE"
echo "------------------------------------" | tee -a "$LOG_FILE"
# Find files in parent directory, excluding swarm directory
find .. -name ".claude-flow-swarm" -prune -o -newer "$LOG_FILE" -type f -print 2>/dev/null | \
    sed "s|^\.\./||" | \
    sort | \
    head -20 | \
    tee -a "$LOG_FILE"

file_count=$(find .. -name ".claude-flow-swarm" -prune -o -newer "$LOG_FILE" -type f -print 2>/dev/null | wc -l)
if [ $file_count -gt 20 ]; then
    echo "... and $((file_count - 20)) more files" | tee -a "$LOG_FILE"
fi

echo "====================================" | tee -a "$LOG_FILE"
echo "Log file saved in container at: $LOG_FILE" | tee -a "$LOG_FILE"
SCRIPT_END

# Make the script executable
chmod +x "$TEMP_SCRIPT"

# Launch container with the script
docker run $TTY_FLAGS --rm \
  --gpus all \
  -v "$PROJECT_PATH":"/home/appuser/projects/$PROJECT_NAME" \
  -v "$SWARM_DIR_PATH/tmp":/tmp \
  -v "$TEMP_SCRIPT":/tmp/swarm-script.sh:ro \
  -v "claude-config:/home/appuser/.claude" \
  -v "npm-cache:/home/appuser/.npm" \
  $ENV_FLAGS \
  --name $CONTAINER_NAME \
  --workdir "/home/appuser/projects/$PROJECT_NAME/$SWARM_DIR_NAME" \
  $IMAGE_NAME \
  /tmp/swarm-script.sh "$SWARM_OBJECTIVE" "./$LOG_FILE_NAME" "$MODEL_PREFERENCE"

# Final status message
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
print_status "✅ Swarm session completed"
print_status "📁 Project: ${YELLOW}$PROJECT_NAME${NC}"
print_status "📝 Log saved: ${YELLOW}$LOG_FILE_PATH_HOST${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"