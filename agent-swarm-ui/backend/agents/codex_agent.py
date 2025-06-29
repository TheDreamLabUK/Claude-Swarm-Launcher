import os
from .base_agent import BaseAgent

class CodexAgent(BaseAgent):
    """Agent for interacting with the Codex CLI."""

    def __init__(self, **kwargs):
        super().__init__(name="Codex", **kwargs)
        if not self.model:
            self.model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        self.env["OPENAI_MODEL"] = self.model

    async def execute(self, prompt: str):
        """Executes the OpenAI CLI command in auto mode."""
        command = f'openai api chat.completions.create -m {self.model} --messages \'[{{"role": "user", "content": "{prompt}"}}]\' --stream'
        await self._run_command(command)