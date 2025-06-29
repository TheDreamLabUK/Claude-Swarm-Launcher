#!/usr/bin/env python3
"""Test script for AI Agent Swarm System"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from agents.claude_agent import ClaudeAgent
from agents.gemini_agent import GeminiAgent
from agents.codex_agent import CodexAgent
from agents.integration_agent import IntegrationAgent


async def test_individual_agents():
    """Test each agent individually"""
    print("Testing individual agents...\n")
    
    # Test prompt
    test_prompt = "Write a simple hello world function in Python"
    
    # Test Claude
    print("1. Testing Claude Agent...")
    claude = ClaudeAgent()
    try:
        await claude.execute(test_prompt)
        print("✓ Claude Agent completed\n")
    except Exception as e:
        print(f"✗ Claude Agent failed: {e}\n")
    
    # Test Gemini
    print("2. Testing Gemini Agent...")
    gemini = GeminiAgent()
    try:
        await gemini.execute(test_prompt)
        print("✓ Gemini Agent completed\n")
    except Exception as e:
        print(f"✗ Gemini Agent failed: {e}\n")
    
    # Test Codex
    print("3. Testing Codex Agent...")
    codex = CodexAgent()
    try:
        await codex.execute(test_prompt)
        print("✓ Codex Agent completed\n")
    except Exception as e:
        print(f"✗ Codex Agent failed: {e}\n")


async def test_orchestration():
    """Test full orchestration flow"""
    print("\nTesting full orchestration...\n")
    
    # Create workspace directories
    workspace_base = Path("workspace/test")
    sandboxes = {
        "claude": str(workspace_base / "claude"),
        "gemini": str(workspace_base / "gemini"),
        "codex": str(workspace_base / "codex"),
        "integrator": str(workspace_base / "integrator")
    }
    
    # Create directories
    for path in sandboxes.values():
        Path(path).mkdir(parents=True, exist_ok=True)
    
    # Test integration
    print("4. Testing Integration Agent...")
    integrator = IntegrationAgent(sandboxes=sandboxes)
    try:
        await integrator.execute("Analyze and synthesize the best hello world implementation")
        print("✓ Integration Agent completed\n")
    except Exception as e:
        print(f"✗ Integration Agent failed: {e}\n")


async def main():
    """Main test function"""
    print("=" * 60)
    print("AI Agent Swarm System - Test Suite")
    print("=" * 60)
    
    # Check for API keys
    missing_keys = []
    for key in ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]:
        if not os.getenv(key):
            missing_keys.append(key)
    
    if missing_keys:
        print(f"\nWarning: Missing API keys: {', '.join(missing_keys)}")
        print("Some tests may fail. Set keys in .env file or environment.\n")
    
    # Run tests
    await test_individual_agents()
    await test_orchestration()
    
    print("=" * 60)
    print("Test suite completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())