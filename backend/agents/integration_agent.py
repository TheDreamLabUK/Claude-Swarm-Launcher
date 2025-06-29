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

        integration_prompt = f"""You are an expert software integration specialist. Your task is to analyze solutions from three different AI agents and synthesize the best combined solution.

Original Task: {prompt}

Agent Solutions:

--- CLAUDE'S CHANGES ---
{claude_diff if claude_diff else "No changes made"}

--- GEMINI'S CHANGES ---
{gemini_diff if gemini_diff else "No changes made"}

--- CODEX'S CHANGES ---
{codex_diff if codex_diff else "No changes made"}

Please analyze these changes and create an integrated solution that:
1. Identifies the strengths of each approach
2. Resolves any conflicts between implementations
3. Combines the best aspects of all solutions
4. Ensures code quality and consistency
5. Provides a cohesive, production-ready implementation

Output your analysis and the final integrated solution."""

        # Use gemini CLI for integration
        command = f'gemini "{integration_prompt.replace('"', '\\"').replace("$", "\\$")}"'
        await self._run_command(command)