Viewed pyproject.toml:1-91
Viewed .env.example:1-49

Your project uses **`uv`** as the package manager (not plain pip) — the `uv.lock` file confirms this. Here's your complete command reference:

---

## 📦 Your Setup: `uv` + `.venv`

This project uses **`uv`** (a fast Python package manager). All commands should be run from:
```
d:\Finia-backend\server\ai\src\backend\
```

---

## 🔧 Virtual Environment Commands

### Activate / Deactivate `.venv`

```powershell
# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate (CMD)
.\.venv\Scripts\activate.bat

# Deactivate (any shell)
deactivate
```

---

## 📥 Install Packages

```powershell
# Install ALL dependencies from pyproject.toml (run this first!)
uv sync

# Install WITH dev dependencies (pytest, ruff, mypy, etc.)
uv sync --extra dev

# Install a new package and add it to pyproject.toml
uv add <package-name>

# Install a new DEV-only package
uv add --optional dev <package-name>

# Install a specific version
uv add "fastapi>=0.115.0"

# Install from requirements.txt (if you have one)
uv pip install -r requirements.txt
```

---

## 🔍 See What's Installed

```powershell
# List all installed packages
uv pip list

# Show details about a specific package
uv pip show pydantic-ai-slim

# Check for outdated packages
uv pip list --outdated

# Export installed packages to requirements.txt
uv pip freeze > requirements.txt
```

---

## 🗑️ Remove Packages

```powershell
# Remove a package (also removes from pyproject.toml)
uv remove <package-name>

# Remove via pip (doesn't update pyproject.toml)
uv pip uninstall <package-name>
```

---

## 🚀 Run the App

```powershell
# Run the FastAPI server (dev mode with auto-reload)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or if venv is activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run with the CLI tool (defined in pyproject.toml scripts)
uv run src
```

---

## 🧪 Run Tests

```powershell
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=app

# Run a specific test file
uv run pytest tests/test_agents.py -v
```

---

## 🔨 Other Useful Commands

```powershell
# Run linter (ruff)
uv run ruff check .

# Auto-fix lint issues
uv run ruff check . --fix

# Format code
uv run ruff format .

# Run type checker
uv run mypy app/

# Run Alembic DB migrations
uv run alembic upgrade head

# Generate a new migration
uv run alembic revision --autogenerate -m "your message"
```

---

## 📋 Quick Start Checklist

```powershell
# 1. Go to backend folder
cd d:\Finia-backend\server\ai\src\backend

# 2. Install all packages
uv sync --extra dev

# 3. Copy env file and fill in your values
copy .env.example .env

# 4. Run DB migrations
uv run alembic upgrade head

# 5. Start the server
uv run uvicorn app.main:app --reload --port 8000

# 6. Open docs in browser
# → http://localhost:8000/docs
```