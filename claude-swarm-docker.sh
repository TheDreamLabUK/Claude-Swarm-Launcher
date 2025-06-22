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
      "model": "claude-3.5-sonnet-20240620",
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
    "cacheSizeMB": 100
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

- **claude-flow.config.json**: Configuration file for the swarm behavior
- **claude-swarm-*.log**: Execution logs from swarm runs
- **README.md**: This file

## Notes

- This directory is automatically added to .gitignore
- Logs are timestamped and preserved for debugging
- You can safely delete old log files if needed
- The config file can be edited to customize swarm behavior

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

# Handle help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  echo "Claude Flow Swarm Launcher"
  echo ""
  echo "Usage: $0 <project_directory_name> \"<swarm_objective>\" [mode] [model]"
  echo ""
  echo "Arguments:"
  echo "  project_directory_name  Name of the project directory (must exist)"
  echo "  swarm_objective        What you want the swarm to accomplish (quoted string)"
  echo "  mode                   Execution mode (optional):"
  echo "                         - auto: Run swarm non-interactively (default)"
  echo "                         - shell: Start an interactive shell in the container"
  echo "  model                  Model preference (optional):"
  echo "                         - opus: Use Claude 3 Opus (powerful, slower)"
  echo "                         - sonnet: Use Claude 3.5 Sonnet (fast, efficient)"
  echo "                         - auto-fallback: Try Opus, fallback to Sonnet (default)"
  echo ""
  echo "Examples:"
  echo "  $0 my-project \"Refactor the authentication system\""
  echo "  $0 my-app \"Add comprehensive test coverage\" auto sonnet"
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
if [[ "$MODEL_PREFERENCE" != "opus" && "$MODEL_PREFERENCE" != "sonnet" && "$MODEL_PREFERENCE" != "auto-fallback" ]]; then
  print_error "Invalid model preference: $MODEL_PREFERENCE. Must be 'opus', 'sonnet', or 'auto-fallback'."
  exit 1
fi

# Run all prerequisite checks and setup steps
check_prerequisites
print_api_key_warning
create_dockerfile_if_missing

# Create the dedicated swarm directory and related files
mkdir -p "$SWARM_DIR_PATH"
print_status "Ensured swarm directory exists at: $SWARM_DIR_PATH"
ensure_gitignore_entry "$PROJECT_PATH"
create_config_if_missing "$CONFIG_FILE_PATH"
create_swarm_readme "$SWARM_DIR_PATH"

# Build Docker image if it doesn't exist
print_status "Checking for Docker image: $IMAGE_NAME..."
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  print_status "Image not found. Building now (this may take a few minutes)..."
  docker build -t $IMAGE_NAME .
  if [ $? -ne 0 ]; then
    print_error "Docker build failed. Please check the Dockerfile and your Docker setup."
    exit 1
  fi
  print_status "✅ Image built successfully."
else
  print_status "✅ Image found."
fi

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

# Launch container with embedded swarm execution logic
docker run $TTY_FLAGS --rm \
  --gpus all \
  -v "$PROJECT_PATH":"/home/appuser/projects/$PROJECT_NAME" \
  -v "claude-config:/home/appuser/.claude" \
  -v "npm-cache:/home/appuser/.npm" \
  $ENV_FLAGS \
  --name $CONTAINER_NAME \
  --workdir "/home/appuser/projects/$PROJECT_NAME/$SWARM_DIR_NAME" \
  $IMAGE_NAME \
  /bin/bash -c '
    # --- Container-side execution script ---
    
    OBJECTIVE="'"$SWARM_OBJECTIVE"'"
    LOG_FILE="./'"$LOG_FILE_NAME"'"
    MODEL_PREFERENCE="'"$MODEL_PREFERENCE"'"
    CONFIG_FILE_PATH="./claude-flow.config.json"
    
    # Model identifiers matching Claude API
    MODEL_OPUS="claude-3-opus-20240229"
    MODEL_SONNET="claude-3.5-sonnet-20240620"

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

        # Adjust timeout based on model
        if [[ "$model_name" == *"opus"* ]]; then
            echo "[$(date +%H:%M:%S)] Setting Opus timeout: 20 minutes per agent task" | tee -a "$LOG_FILE"
            claude-flow config set orchestrator.agentTimeoutMs 1200000 2>&1 | tee -a "$LOG_FILE"
        else
            echo "[$(date +%H:%M:%S)] Setting Sonnet timeout: 15 minutes per agent task" | tee -a "$LOG_FILE"
            claude-flow config set orchestrator.agentTimeoutMs 900000 2>&1 | tee -a "$LOG_FILE"
        fi

        echo "[$(date +%H:%M:%S)] Launching swarm..." | tee -a "$LOG_FILE"
        echo "------------------------------------" | tee -a "$LOG_FILE"
        
        # Execute with 30-minute overall timeout
        timeout 1800s claude-flow swarm "$OBJECTIVE" 2>&1 | tee -a "$LOG_FILE"
        local exit_code=${PIPESTATUS[0]}
        
        echo "------------------------------------" | tee -a "$LOG_FILE"
        echo "[$(date +%H:%M:%S)] Swarm exited with code: $exit_code" | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
        
        return $exit_code
    }

    COMMAND_EXIT_CODE=1

    # Execute based on model preference
    case "$MODEL_PREFERENCE" in
        "opus")
            try_swarm_with_model "$MODEL_OPUS" "1"
            COMMAND_EXIT_CODE=$?
            ;;
        "sonnet")
            try_swarm_with_model "$MODEL_SONNET" "1"
            COMMAND_EXIT_CODE=$?
            ;;
        "auto-fallback"|*)
            echo "🔄 Auto-fallback mode: Trying Opus first..." | tee -a "$LOG_FILE"
            try_swarm_with_model "$MODEL_OPUS" "1"
            COMMAND_EXIT_CODE=$?

            if [ $COMMAND_EXIT_CODE -ne 0 ]; then
                echo "[$(date +%H:%M:%S)] ⚠️  Opus failed (exit code: $COMMAND_EXIT_CODE)" | tee -a "$LOG_FILE"
                echo "[$(date +%H:%M:%S)] 🔄 Attempting fallback to Sonnet..." | tee -a "$LOG_FILE"
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
        echo "Status: ⏱️  TIMEOUT (30 minutes exceeded)" | tee -a "$LOG_FILE"
    else
        echo "Status: ❌ FAILED" | tee -a "$LOG_FILE"
    fi

    echo "====================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    # List modified files
    echo "Files modified during swarm execution:" | tee -a "$LOG_FILE"
    echo "------------------------------------" | tee -a "$LOG_FILE"
    # Find files in parent directory, excluding swarm directory
    find .. -name "'"$SWARM_DIR_NAME"'" -prune -o -newer "$LOG_FILE" -type f -print 2>/dev/null | \
        sed "s|^\.\./||" | \
        sort | \
        head -20 | \
        tee -a "$LOG_FILE"
    
    file_count=$(find .. -name "'"$SWARM_DIR_NAME"'" -prune -o -newer "$LOG_FILE" -type f -print 2>/dev/null | wc -l)
    if [ $file_count -gt 20 ]; then
        echo "... and $((file_count - 20)) more files" | tee -a "$LOG_FILE"
    fi
    
    echo "====================================" | tee -a "$LOG_FILE"
    echo "Log file saved in container at: $LOG_FILE" | tee -a "$LOG_FILE"
  '

# Final status message
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
print_status "✅ Swarm session completed"
print_status "📁 Project: ${YELLOW}$PROJECT_NAME${NC}"
print_status "📝 Log saved: ${YELLOW}$LOG_FILE_PATH_HOST${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
