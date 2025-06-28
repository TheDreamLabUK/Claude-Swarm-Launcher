from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import asyncio
import subprocess

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

API_KEYS_FILE = "api_keys.json"
API_KEYS_FALLBACK = "config/api_keys.json"

class APIKeys(BaseModel):
    claude_api_key: str | None = None
    gemini_api_key: str | None = None
    codex_api_key: str | None = None

def get_api_keys_file():
    # If the main file path is a directory (Docker volume issue), use fallback
    if os.path.exists(API_KEYS_FILE) and os.path.isdir(API_KEYS_FILE):
        # Ensure config directory exists
        os.makedirs("config", exist_ok=True)
        return API_KEYS_FALLBACK
    return API_KEYS_FILE

def load_api_keys():
    keys_file = get_api_keys_file()
    if os.path.exists(keys_file) and os.path.isfile(keys_file):
        try:
            with open(keys_file, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}

def save_api_keys(keys: dict):
    keys_file = get_api_keys_file()
    # Ensure the directory exists (only if it's not the root directory)
    dirname = os.path.dirname(keys_file)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(keys_file, "w") as f:
        json.dump(keys, f, indent=4)


@app.post("/api/keys")
def set_api_keys(keys: APIKeys):
    try:
        current_keys = load_api_keys()
        updated_keys = current_keys.copy()
        if keys.claude_api_key:
            updated_keys["ANTHROPIC_API_KEY"] = keys.claude_api_key
        if keys.gemini_api_key:
            updated_keys["GEMINI_API_KEY"] = keys.gemini_api_key
        if keys.codex_api_key:
            updated_keys["CODEX_API_KEY"] = keys.codex_api_key
        save_api_keys(updated_keys)
        return {"message": "API keys updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/keys")
def get_api_keys():
    return load_api_keys()

@app.websocket("/ws/shell")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    process = None
    try:
        # Load API keys and set them as environment variables for the shell process
        api_keys = load_api_keys()
        env = os.environ.copy()
        for key, value in api_keys.items():
            env[key] = value

        # Start a shell process
        process = await asyncio.create_subprocess_shell(
            "bash -i",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )

        async def read_stdout():
            while True:
                data = await process.stdout.read(1024)
                if not data:
                    break
                await websocket.send_text(data.decode('utf-8', errors='ignore'))

        async def read_stderr():
            while True:
                data = await process.stderr.read(1024)
                if not data:
                    break
                await websocket.send_text(data.decode('utf-8', errors='ignore'))

        stdout_task = asyncio.create_task(read_stdout())
        stderr_task = asyncio.create_task(read_stderr())

        while True:
            data = await websocket.receive_text()
            if process.stdin:
                process.stdin.write(data.encode('utf-8'))
                await process.stdin.drain()

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error in websocket: {e}")
    finally:
        if process and process.returncode is None:
            process.terminate()
            await process.wait()
        if 'stdout_task' in locals() and not stdout_task.done():
            stdout_task.cancel()
        if 'stderr_task' in locals() and not stderr_task.done():
            stderr_task.cancel()

# Mount the frontend's static files at the end
app.mount("/", StaticFiles(directory="/app/frontend/dist", html=True), name="static")
