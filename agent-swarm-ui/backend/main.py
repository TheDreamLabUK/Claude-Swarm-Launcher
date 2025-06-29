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
from .agents.claude_agent import ClaudeAgent
from .agents.gemini_agent import GeminiAgent
from .agents.codex_agent import CodexAgent
from .agents.integration_agent import IntegrationAgent

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
        agent_models = data.get("agent_models") or {
            "claude": os.getenv("CLAUDE_MODEL", "claude-sonnet-4"),
            "gemini": os.getenv("GEMINI_MODEL", "gemini-2.5-pro"),
            "codex": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            "integrator": os.getenv("INTEGRATION_MODEL", "gemini-2.5-pro")
        }

        workspace_dir = f"/home/appuser/app/workspace/{project_id}"
        os.makedirs(workspace_dir, exist_ok=True)

        repo_path = os.path.join(workspace_dir, "repository")
        sandboxes = {}

        try:
            await websocket.send_json({"type": "status", "message": f"Cloning {github_url}..."})
            repo = git.Repo.clone_from(github_url, repo_path)

            # --- Agent Sandbox Setup ---
            agent_configs = {
                "claude": ClaudeAgent,
                "gemini": GeminiAgent,
                "codex": CodexAgent,
            }

            for name, _ in agent_configs.items():
                sandbox_path = os.path.join(workspace_dir, f"{name}_sandbox")
                shutil.copytree(repo_path, sandbox_path)
                git.Repo.init(sandbox_path)
                sandboxes[name] = sandbox_path

                if name == "claude":
                    swarm_dir = os.path.join(sandbox_path, ".claude-flow-swarm")
                    os.makedirs(swarm_dir, exist_ok=True)
                    create_claude_md(swarm_dir)
                    create_claude_flow_config(swarm_dir, agent_models.get("claude"))

                await websocket.send_json({"type": "status", "message": f"Created {name} sandbox."})

            # --- Agent Execution ---
            api_keys = load_api_keys()
            base_env = os.environ.copy()
            base_env.update(api_keys)

            tasks = []
            for name, agent_class in agent_configs.items():
                agent = agent_class(
                    model=agent_models.get(name),
                    websocket=websocket,
                    sandbox_path=sandboxes[name],
                    env=base_env
                )
                tasks.append(agent.run(project_prompt))

            await websocket.send_json({"type": "status", "message": "Starting agents..."})
            await asyncio.gather(*tasks)

            # --- Integration Step ---
            await websocket.send_json({"type": "status", "message": "All agents finished. Starting integration..."})

            integration_prompt = f"""
            Integrate the best ideas from three AI-generated solutions for the prompt: '{project_prompt}'.
            - Claude's solution is in the git history of: {sandboxes['claude']}
            - Gemini's solution is in the git history of: {sandboxes['gemini']}
            - Codex's solution is in the git history of: {sandboxes['codex']}
            Analyze all three, synthesize the best elements, and write the final, superior code to the original repo at: {repo_path}
            """

            integrator = IntegrationAgent(
                model=agent_models.get("integrator"),
                websocket=websocket,
                sandbox_path=workspace_dir, # Integrator works in the main workspace
                env=base_env,
                sandboxes=sandboxes
            )
            await integrator.run(integration_prompt)

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
            await websocket.send_json({"type": "error", "message": f"Error during project execution: {str(e)}"})

    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"An unexpected error occurred: {str(e)}"})
    finally:
        # --- Workspace Cleanup ---
        if 'workspace_dir' in locals() and os.path.exists(workspace_dir):
            shutil.rmtree(workspace_dir)
            await websocket.send_json({"type": "status", "message": "Workspace cleaned up."})
        await websocket.close()

# --- Static Files Mount ---
app.mount("/", StaticFiles(directory="/home/appuser/app/frontend/dist", html=True), name="static")
