
# Base image with Python
FROM python:3.11-slim

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl build-essential unzip && \
    rm -rf /var/lib/apt/lists/* && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Set up working directory
WORKDIR /app

# Copy backend requirements and install dependencies
COPY ./backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend and frontend code
COPY ./backend /app/backend
COPY ./frontend /app/frontend
COPY ./backend/*.md /app/agents/

# --- Agent CLI Installation ---
# Install Gemini CLI
RUN npm install -g @google/gemini-cli

# Install Claude tools
RUN npm install -g @anthropic-ai/claude-code
RUN npm install -g claude-flow

# Install OpenAI/Codex tools
RUN pip install openai
RUN pip install codex-cli
RUN npm install -g openai
RUN pip install openai-cli

# Install frontend dependencies
RUN npm install --prefix /app/frontend

# Build frontend
RUN npm run build --prefix /app/frontend

# Expose port for the backend
EXPOSE 8100

# Volume for persistent API keys
VOLUME /app/api_keys.json

# Command to run the backend server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8100"]
