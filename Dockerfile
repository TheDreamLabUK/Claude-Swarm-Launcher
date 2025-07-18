# Use the official Python base image
FROM python:3.11-slim
ARG DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential git curl wget nano vim zsh unzip python3 python3-pip sudo tmux \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (v20 LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Deno (for potential TypeScript/JavaScript runtime needs)
RUN curl -fsSL https://deno.land/install.sh | sh

# Create a non-root user for security
RUN useradd -ms /bin/zsh -u 1000 appuser
RUN usermod -aG sudo appuser
RUN echo "appuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up global npm directory and PATH, plus Deno
ENV NPM_CONFIG_PREFIX=/home/appuser/.npm-global
ENV PATH=$NPM_CONFIG_PREFIX/bin:/home/appuser/.deno/bin:$PATH

# Environment variables to handle TTY and raw mode issues
ENV FORCE_COLOR=0
ENV CI=true
ENV TERM=xterm-256color
ENV NODE_NO_READLINE=1

# Switch to the non-root user
USER appuser
WORKDIR /home/appuser

# Install global npm packages required for AI agents
RUN npm install -g \
    claude-flow \
    @google/gemini-cli \
    openai@^4.1.0 \
    node-pty \
    tsx \
    nodemon

# Pre-configure Claude to accept dangerous permissions (avoids interactive prompt)
RUN mkdir -p /home/appuser/.claude && \
    echo '{"hasAcceptedDangerousPermissions": true}' > /home/appuser/.claude/config.json

# Install Python dependencies for the backend
COPY ./backend/requirements.txt /tmp/requirements.txt
RUN sudo pip3 install --no-cache-dir -r /tmp/requirements.txt
RUN sudo pip3 install --no-cache-dir GitPython

# Copy the application code
COPY --chown=appuser:appuser ./backend /home/appuser/app/backend
COPY --chown=appuser:appuser ./frontend /home/appuser/app/frontend

# Install frontend dependencies and build
WORKDIR /home/appuser/app/frontend
RUN npm install --legacy-peer-deps
RUN npm run build
RUN ls -la /home/appuser/app/frontend/dist

# Set up final working directory
WORKDIR /home/appuser/app

# Expose port for the backend
EXPOSE 8100

# Command to run the backend server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8100"]
