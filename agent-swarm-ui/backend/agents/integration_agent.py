import git
from .base_agent import BaseAgent

class IntegrationAgent(BaseAgent):
    """Agent for integrating solutions from other agents."""

    def __init__(self, sandboxes: dict, **kwargs):
        super().__init__(name="Integrator", **kwargs)
        self.env["GEMINI_MODEL"] = self.model
        self.sandboxes = sandboxes

    def _get_diff(self, sandbox_path: str):
        """Gets the git diff for a given sandbox."""
        try:
            repo = git.Repo(sandbox_path)
            return repo.git.diff()
        except git.InvalidGitRepositoryError:
            return "No git repository found."
        except Exception as e:
            return f"Error getting diff: {str(e)}"

    async def execute(self, prompt: str):
        """Executes the integration logic."""

        claude_diff = self._get_diff(self.sandboxes["claude"])
        gemini_diff = self._get_diff(self.sandboxes["gemini"])
        codex_diff = self._get_diff(self.sandboxes["codex"])

        integration_prompt = f"""
        {prompt}

        Here are the diffs from the agents:

        --- CLAUDE'S CHANGES ---
        {claude_diff}

        --- GEMINI'S CHANGES ---
        {gemini_diff}

        --- CODEX'S CHANGES ---
        {codex_diff}

        Please analyze these changes and synthesize the best solution.
        """

        command = f'gemini "{integration_prompt}"'
        await self._run_command(command)