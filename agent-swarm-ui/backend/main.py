from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import asyncio
import shutil
from datetime import datetime
import git
from typing import Dict

app = FastAPI()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class APIKeys(BaseModel):
    claude_api_key: str | None = None
    gemini_api_key: str | None = None
    codex_api_key: str | None = None

# --- Helper Functions ---

def get_api_keys_file_path():
    """Determines the correct path for api_keys.json, handling Docker volume mount issues."""
    keys_file = "api_keys.json"
    fallback_dir = "config"
    if os.path.exists(keys_file) and os.path.isdir(keys_file):
        os.makedirs(fallback_dir, exist_ok=True)
        return os.path.join(fallback_dir, keys_file)
    return keys_file

def load_api_keys():
    """Loads API keys from the JSON file."""
    keys_path = get_api_keys_file_path()
    if os.path.exists(keys_path):
        try:
            with open(keys_path, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}

def save_api_keys(keys: dict):
    """Saves API keys to the JSON file."""
    keys_path = get_api_keys_file_path()
    os.makedirs(os.path.dirname(keys_path), exist_ok=True)
    with open(keys_path, "w") as f:
        json.dump(keys, f, indent=4)

def create_claude_md(path: str):
    """Creates the default CLAUDE.md constitution file."""
    content = """
*This configuration optimizes Claude for direct, efficient pair programming with implicit mode adaptation and complete solution generation.*
## Core Operating Principles
### 1. Direct Implementation Philosophy
- Generate complete, working code that realizes the conceptualized solution
- Avoid partial implementations, mocks, or placeholders
### 2. Multi-Dimensional Analysis with Linear Execution
- Think at SYSTEM level in latent space
- Linearize complex thoughts into actionable strategies
### 3. Precision and Token Efficiency
- Eliminate unnecessary context or explanations
- Focus tokens on solution generation
## Execution Patterns
### Tool Usage Optimization
- Batch related operations for efficiency
- Execute in parallel where dependencies allow
## Anti-Patterns (STRICTLY AVOID)
### Implementation Hedging
**NEVER USE:** "In a full implementation...", "This is a simplified version...", "TODO", "mock", "fake", "stub"
### Unnecessary Qualifiers
**NEVER USE:** "profound", difficulty assessments, future tense deferrals ("would", "could", "should")
"""
    with open(os.path.join(path, "CLAUDE.md"), "w") as f:
        f.write(content)

def create_claude_flow_config(path: str, model: str):
    """Creates a default claude-flow.config.json file."""
    config = {
      "orchestrator": {
        "maxConcurrentAgents": 10,
        "taskQueueSize": 100,
        "agentTimeoutMs": 1800000, # 30 minutes
        "defaultAgentConfig": {
          "model": model,
          "temperature": 0.7
        }
      },
      "swarm": {
        "strategy": "development",
        "maxAgents": 5,
        "maxDepth": 3,
        "timeout": 180 # minutes
      }
    }
    with open(os.path.join(path, "claude-flow.config.json"), "w") as f:
        json.dump(config, f, indent=2)

async def stream_command(command: str, cwd: str, env: dict, websocket: WebSocket, agent_name: str):
    """Runs a command and streams its stdout/stderr to the WebSocket."""
    await websocket.send_json({"agent": agent_name, "type": "status", "message": f"Executing: {command}"})

    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
        env=env
    )

    async def stream_output(stream, output_type):
        while True:
            line = await stream.readline()
            if not line:
                break
            message = line.decode('utf-8', errors='ignore').strip()
            if message:
                await websocket.send_json({"agent": agent_name, "type": output_type, "message": message})

    await asyncio.gather(
        stream_output(process.stdout, "stdout"),
        stream_output(process.stderr, "stderr")
    )

    return await process.wait()

# --- API Routes ---

@app.post("/api/keys")
def set_api_keys(keys: APIKeys):
    try:
        current_keys = load_api_keys()
        if keys.claude_api_key:
            current_keys["ANTHROPIC_API_KEY"] = keys.claude_api_key
        if keys.gemini_api_key:
            current_keys["GEMINI_API_KEY"] = keys.gemini_api_key
        if keys.codex_api_key:
            current_keys["OPENAI_API_KEY"] = keys.codex_api_key
        save_api_keys(current_keys)
        return {"message": "API keys updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/keys")
def get_api_keys():
    return load_api_keys()

@app.websocket("/ws/project/{project_id}")
async def project_websocket(websocket: WebSocket, project_id: str):
    await websocket.accept()

    try:
        data = await websocket.receive_json()
        github_url = data.get("github_url")
        project_prompt = data.get("project_prompt")
        agent_models = data.get("agent_models")

        workspace_dir = f"/home/appuser/app/workspace/{project_id}"
        os.makedirs(workspace_dir, exist_ok=True)

        await websocket.send_json({"type": "status", "message": f"Cloning {github_url}..."})
        repo_name = github_url.split('/')[-1].replace('.git', '')
        repo_path = os.path.join(workspace_dir, repo_name)
        repo = git.Repo.clone_from(github_url, repo_path)

        # --- Agent Sandbox Setup ---
        sandboxes = {}
        for agent in ["claude", "gemini", "codex"]:
            sandbox_path = os.path.join(workspace_dir, f"{agent}_sandbox")
            shutil.copytree(repo_path, sandbox_path)
            sandboxes[agent] = sandbox_path

            # Create swarm config for claude-flow
            swarm_dir = os.path.join(sandbox_path, ".claude-flow-swarm")
            os.makedirs(swarm_dir, exist_ok=True)
            create_claude_md(swarm_dir)
            create_claude_flow_config(swarm_dir, agent_models.get("claude"))
            await websocket.send_json({"type": "status", "message": f"Created {agent} sandbox."})

        # --- Agent Execution ---
        api_keys = load_api_keys()
        base_env = os.environ.copy()
        base_env.update(api_keys)

        async def run_agent(name, model_key, command_template, sandbox_path):
            env = base_env.copy()
            model = agent_models.get(model_key)
            if "claude" in name.lower(): env["ANTHROPIC_MODEL"] = model
            elif "gemini" in name.lower(): env["GEMINI_MODEL"] = model
            elif "codex" in name.lower(): env["OPENAI_MODEL"] = model

            command = command_template.format(prompt=project_prompt)
            return await stream_command(command, sandbox_path, env, websocket, name)

        await websocket.send_json({"type": "status", "message": "Starting agents..."})

        await asyncio.gather(
            run_agent("Claude", "claude", 'claude-flow swarm "{prompt}"', sandboxes["claude"]),
            run_agent("Gemini", "gemini", 'gemini "{prompt}"', sandboxes["gemini"]),
            run_agent("Codex", "codex", 'codex "{prompt}"', sandboxes["codex"])
        )

        # --- Integration Step ---
        await websocket.send_json({"type": "status", "message": "All agents finished. Starting integration..."})

        integration_prompt = f"""
        Integrate the best ideas from three AI-generated solutions for the prompt: '{project_prompt}'.
        - Claude's solution: {sandboxes['claude']}
        - Gemini's solution: {sandboxes['gemini']}
        - Codex's solution: {sandboxes['codex']}
        Analyze all three, synthesize the best elements, and write the final, superior code to: {repo_path}
        """
        await run_agent("Integrator", "orchestrator", f'gemini "{integration_prompt}"', workspace_dir)

        # --- Git Workflow ---
        await websocket.send_json({"type": "status", "message": "Integration complete. Committing changes..."})
        integration_branch = f"ai-swarm-integration-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        repo.git.checkout('-b', integration_branch)
        repo.git.add(A=True)
        repo.git.commit('-m', f"AI Swarm Integration: {project_prompt}")

        await websocket.send_json({"type": "status", "message": f"Pushing branch '{integration_branch}' to origin..."})
        repo.remote('origin').push(integration_branch)

        await websocket.send_json({
            "type": "complete",
            "message": f"Successfully pushed branch '{integration_branch}'. Please create a PR on GitHub."
        })

    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"An unexpected error occurred: {str(e)}"})
    finally:
        await websocket.close()

# --- Static Files Mount ---
app.mount("/", StaticFiles(directory="/home/appuser/app/frontend/dist", html=True), name="static")
