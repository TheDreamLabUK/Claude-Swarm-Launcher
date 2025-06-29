import os
from .base_agent import BaseAgent

class GeminiAgent(BaseAgent):
    """Agent for interacting with the Gemini CLI."""

    def __init__(self, **kwargs):
        super().__init__(name="Gemini", **kwargs)
        if not self.model:
            self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        self.env["GEMINI_MODEL"] = self.model
        self.env["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")

    async def execute(self, prompt: str):
        """Executes the Gemini CLI command."""
        # Using the official @google/gemini-cli tool
        # Model is set via GEMINI_MODEL env var
        command = f'gemini "{prompt}"'
        await self._run_command(command)