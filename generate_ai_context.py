#!/usr/bin/env python3
"""
Generate AI Codebase Context for Claude
---------------------------------------
This script scans the Finia-backend codebase and generates a single, formatted 
Markdown document (AI_CODEBASE_CONTEXT.md) containing the full architectural overview, 
directory tree, database schemas, and key source code files.

Usage:
    python generate_ai_context.py
"""

import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
OUTPUT_FILE = ROOT_DIR / "AI_CODEBASE_CONTEXT.md"

# Files to include completely in the context dump
IMPORTANT_FILES = [
    "CLAUDE.md",
    ".claude/architecture.md",
    ".claude/codebase_summary.md",
    "server/api/src/package.json",
    "server/api/src/prisma/schema.prisma",
    "server/api/src/src/app.ts",
    "server/api/src/src/routes/index.ts",
    "server/api/src/src/routes/auth.route.ts",
    "server/api/src/src/routes/goal.route.ts",
    "server/api/src/src/routes/budget.route.ts",
    "server/ai/src/CLAUDE.md",
    "server/ai/src/backend/app/main.py",
    "server/ai/src/backend/app/agents/assistant.py",
    "server/ai/src/backend/app/api/routes/v1/agent.py",
]

# Extensions to index in the directory map
TARGET_EXTENSIONS = {".ts", ".js", ".json", ".py", ".prisma", ".md", ".yml", ".yaml"}

def build_tree(dir_path: Path, prefix: str = "", max_depth: int = 4, depth: int = 0) -> str:
    if depth > max_depth:
        return ""
    
    ignore_dirs = {".git", "node_modules", ".venv", "__pycache__", "dist", "build", "generated"}
    lines = []
    
    try:
        entries = sorted(list(dir_path.iterdir()), key=lambda x: (not x.is_dir(), x.name.lower()))
    except PermissionError:
        return ""

    entries = [e for e in entries if e.name not in ignore_dirs and not e.name.startswith(".")]

    for i, entry in enumerate(entries):
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "
        lines.append(f"{prefix}{connector}{entry.name}")
        
        if entry.is_dir() and depth < max_depth:
            extension = "    " if is_last else "│   "
            sub_tree = build_tree(entry, prefix + extension, max_depth, depth + 1)
            if sub_tree:
                lines.append(sub_tree)
                
    return "\n".join(lines)

def main():
    print(f"Generating AI Codebase Context at: {OUTPUT_FILE}")
    
    content = []
    content.append("# Finia Backend - Complete Codebase Context for Claude\n")
    content.append("> Auto-generated context bundle for LLM code understanding & architectural analysis.\n")
    content.append(f"**Root Path:** `{ROOT_DIR}`\n")
    
    # 1. Directory Tree
    content.append("## 1. Directory Structure\n")
    content.append("```plaintext")
    content.append(ROOT_DIR.name)
    tree_str = build_tree(ROOT_DIR)
    content.append(tree_str)
    content.append("```\n")
    
    # 2. Critical Files Content
    content.append("## 2. Key Code & Configuration Files\n")
    
    for rel_path in IMPORTANT_FILES:
        file_path = ROOT_DIR / rel_path
        if file_path.exists():
            content.append(f"### File: `{rel_path}`\n")
            ext = file_path.suffix.lstrip(".")
            lang_map = {"ts": "typescript", "js": "javascript", "py": "python", "prisma": "prisma", "json": "json", "md": "markdown"}
            lang = lang_map.get(ext, ext)
            
            try:
                text = file_path.read_text(encoding="utf-8")
                content.append(f"```{lang}\n{text}\n```\n")
            except Exception as e:
                content.append(f"*Error reading file: {e}*\n")
        else:
            content.append(f"### File: `{rel_path}` *(Not found)*\n")

    OUTPUT_FILE.write_text("\n".join(content), encoding="utf-8")
    print(f"Successfully generated {OUTPUT_FILE.name} ({OUTPUT_FILE.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
