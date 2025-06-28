
# Base image with Python
FROM python:3.11-slim

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl && \
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

# --- Agent CLI Installation ---
# Placeholder commands for installing the agents.
# We will replace these with the actual installation steps later.
RUN pip install google-generativeai
RUN npm install -g claude-flow
RUN pip install codex-cli

# Install frontend dependencies
RUN npm install --prefix /app/frontend

# Build frontend
RUN npm run build --prefix /app/frontend

# Expose port for the backend
EXPOSE 8100

# Command to run the backend server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8100"]
