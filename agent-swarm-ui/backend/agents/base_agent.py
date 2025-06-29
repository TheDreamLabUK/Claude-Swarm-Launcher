import asyncio
import time
from abc import ABC, abstractmethod
from fastapi import WebSocket

class BaseAgent(ABC):
    """Abstract base class for all AI agents."""

    def __init__(self, name: str, model: str, websocket: WebSocket, sandbox_path: str, env: dict):
        self.name = name
        self.model = model
        self.websocket = websocket
        self.sandbox_path = sandbox_path
        self.env = env
        self.start_time = None
        self.end_time = None

    async def log(self, type: str, message: str):
        """Sends a log message to the WebSocket."""
        await self.websocket.send_json({
            "agent": self.name,
            "type": type,
            "message": message
        })

    async def _run_command(self, command: str, retries: int = 3, timeout: int = 1800):
        """
        Executes a shell command with retries and timeout, streaming output.
        """
        for attempt in range(retries):
            try:
                await self.log("status", f"Executing: {command} (Attempt {attempt + 1}/{retries})")

                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=self.sandbox_path,
                    env=self.env
                )

                async def stream_output(stream, output_type):
                    while True:
                        line = await stream.readline()
                        if not line:
                            break
                        message = line.decode('utf-8', errors='ignore').strip()
                        if message:
                            await self.log(output_type, message)

                await asyncio.wait_for(
                    asyncio.gather(
                        stream_output(process.stdout, "stdout"),
                        stream_output(process.stderr, "stderr")
                    ),
                    timeout=timeout
                )

                return_code = await process.wait()
                if return_code == 0:
                    return True
                else:
                    await self.log("error", f"Command failed with exit code {return_code}.")

            except asyncio.TimeoutError:
                await self.log("error", f"Command timed out after {timeout} seconds.")
                process.kill()
            except Exception as e:
                await self.log("error", f"An unexpected error occurred: {str(e)}")

            if attempt < retries - 1:
                backoff_time = 2 ** attempt
                await self.log("status", f"Retrying in {backoff_time} seconds...")
                await asyncio.sleep(backoff_time)

        return False

    @abstractmethod
    async def execute(self, prompt: str):
        """The main execution logic for the agent."""
        pass

    async def run(self, prompt: str):
        """Runs the agent's execution logic and records timing."""
        self.start_time = time.time()
        await self.log("status", f"Starting...")

        try:
            await self.execute(prompt)
            await self.log("status", "Execution completed.")
        except Exception as e:
            await self.log("error", f"Failed to execute: {str(e)}")
        finally:
            self.end_time = time.time()
            duration = self.end_time - self.start_time
            await self.log("status", f"Finished in {duration:.2f} seconds.")
