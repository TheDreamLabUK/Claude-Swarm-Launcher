import os
from .base_agent import BaseAgent

class ClaudeAgent(BaseAgent):
    """Agent for interacting with the claude-flow tool."""

    def __init__(self, **kwargs):
        super().__init__(name="Claude", **kwargs)
        if not self.model:
            self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4")
        self.env["ANTHROPIC_MODEL"] = self.model

    async def execute(self, prompt: str):
        """Executes the claude-flow swarm command."""
        command = f'claude-flow swarm "{prompt}"'
        await self._run_command(command)