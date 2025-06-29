import os
from .base_agent import BaseAgent

class CodexAgent(BaseAgent):
    """Agent for interacting with the Codex CLI."""

    def __init__(self, **kwargs):
        super().__init__(name="Codex", **kwargs)
        if not self.model:
            self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.env["OPENAI_MODEL"] = self.model
        self.env["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")

    async def execute(self, prompt: str):
        """Executes the OpenAI CLI command using a proper wrapper."""
        # Create a simple Node.js script to use OpenAI API
        script = f"""
const OpenAI = require('openai');
const openai = new OpenAI({{
    apiKey: process.env.OPENAI_API_KEY,
}});

async function main() {{
    const completion = await openai.chat.completions.create({{
        model: "{self.model}",
        messages: [{{role: "user", content: `{prompt.replace('`', '\\`').replace('"', '\\"')}`}}],
    }});
    console.log(completion.choices[0].message.content);
}}
main().catch(console.error);
"""
        # Write script to temp file and execute
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(script)
            script_path = f.name
        
        command = f'node {script_path}'
        await self._run_command(command)
        
        # Clean up temp file
        import os
        try:
            os.unlink(script_path)
        except:
            pass