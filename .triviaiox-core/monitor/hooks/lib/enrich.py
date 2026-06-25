#!/usr/bin/env python3
"""
Enrich events with TRIVIAIOX context (agent, story, task, etc.)
"""

import os
import re
from pathlib import Path
from typing import Any


def enrich_event(data: dict[str, Any]) -> dict[str, Any]:
    """Add TRIVIAIOX context to event data."""

    # Project detection
    cwd = data.get("cwd", os.getcwd())
    data["project"] = detect_project(cwd)

    # TRIVIAIOX context from environment
    if os.environ.get("TRIVIAIOX_AGENT"):
        data["triviaiox_agent"] = os.environ["TRIVIAIOX_AGENT"]

    if os.environ.get("TRIVIAIOX_STORY_ID"):
        data["triviaiox_story_id"] = os.environ["TRIVIAIOX_STORY_ID"]

    if os.environ.get("TRIVIAIOX_TASK_ID"):
        data["triviaiox_task_id"] = os.environ["TRIVIAIOX_TASK_ID"]

    # Try to detect TRIVIAIOX agent from user prompt if available
    user_prompt = data.get("user_prompt", "")
    if user_prompt:
        detected_agent = detect_agent_from_prompt(user_prompt)
        if detected_agent and not data.get("triviaiox_agent"):
            data["triviaiox_agent"] = detected_agent

    return data


def detect_project(cwd: str) -> str:
    """Detect project name from cwd."""
    path = Path(cwd)

    # Check for common project markers
    markers = [".git", "package.json", "Cargo.toml", "go.mod", "pyproject.toml"]
    for marker in markers:
        if (path / marker).exists():
            return path.name

    return path.name


def detect_agent_from_prompt(prompt: str) -> str | None:
    """Detect TRIVIAIOX agent activation from prompt."""
    # Look for @agent patterns
    match = re.search(r'@(dev|architect|qa|pm|po|sm|analyst|devops|triviaiox-master)', prompt.lower())
    if match:
        return match.group(1)
    return None
