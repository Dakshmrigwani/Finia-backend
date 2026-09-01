# Finia Backend - AI & Claude Codebase Guide

## Overview

**Finia Backend** is a dual-service financial platform backend consisting of an **Express REST API Service** and a **FastAPI Python AI Service**.

- **API Service (`server/api/src`)**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT Authentication. Handles user management, budgets, financial goals, tokens, and core business REST endpoints.
- **AI Service (`server/ai/src`)**: Python 3.12+, FastAPI, Pydantic v2, PydanticAI agent framework, Async SQLAlchemy, PostgreSQL. Handles AI financial assistant agents, conversational threads, smart budget nudges, and goal generation.

---

## Directory Architecture

```
Finia-backend/
├── CLAUDE.md                   # Primary AI/Claude codebase instructions
├── README.md                   # Main project documentation
├── generate_ai_context.py      # Script to dump entire codebase context for AI
├── AI_CODEBASE_CONTEXT.md      # Auto-generated full context document for Claude
├── .claude/                    # Dedicated Claude AI documentation folder
│   ├── architecture.md         # Deep-dive system architecture & inter-service flow
│   ├── codebase_summary.md     # Component, schema, and API route index
│   └── claude_prompt.md        # Copy-paste prompt for Claude Web / Desktop
└── server/
    ├── api/
    │   └── src/                # Express + TypeScript + Prisma REST API
    │       ├── prisma/         # Prisma Schema & Database Migrations
    │       ├── src/
    │       │   ├── config/     # App configuration & env vars
    │       │   ├── controllers/# Request & response handlers (Auth, User, Goal, Budget)
    │       │   ├── middlewares/# Auth, error handling, rate limiting, validation
    │       │   ├── routes/     # Express router declarations (/auth, /users, /goals, /budgets)
    │       │   ├── services/   # Business logic & Prisma data access
    │       │   ├── types/      # TypeScript interfaces and type definitions
    │       │   └── validations/# Request validation schemas
    │       ├── package.json
    │       └── tsconfig.json
    └── ai/
        └── src/                # FastAPI + Python PydanticAI Service
            ├── backend/
            │   └── app/
            │       ├── agents/       # PydanticAI Assistant & prompt logic
            │       ├── api/routes/v1/# FastAPI endpoints (agent, conversations, health)
            │       ├── core/         # Config, security, logging
            │       ├── db/models/    # SQLAlchemy models
            │       ├── repositories/ # Async DB repositories
            │       ├── schemas/      # Pydantic request/response schemas
            │       └── services/     # AI execution & conversation services
            ├── Makefile
            └── docker-compose.yml
```

---

## Development Commands

### Express API Service (`server/api/src`)
```bash
cd server/api/src

# Install dependencies (pnpm recommended)
pnpm install

# Development server
pnpm run dev

# Prisma Database Commands
pnpm run prisma:generate       # Generate Prisma client
pnpm run prisma:migrate:dev    # Run migrations in dev
pnpm run prisma:studio         # Open Prisma Studio GUI

# Linting & Building
pnpm run lint:fix
pnpm run build
```

### FastAPI AI Service (`server/ai/src`)
```bash
cd server/ai/src

# Backend server via UV
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Tests & Formatting
pytest
ruff check . --fix && ruff format .

# Database Migrations
uv run alembic upgrade head
```

---

## Key Conventions & Code Patterns

### Express API (`server/api/src`)
- **Controller-Service Architecture**: Routes map to controllers; business logic and database interactions reside inside services (`services/`).
- **Prisma Schema**: Output location is set to `../src/generated/prisma`. Models include `User`, `Goal`, `Budget`, and `Token`.
- **Response Format**: Standardized API responses using custom utility response handlers.

### FastAPI AI Service (`server/ai/src`)
- **Repository Pattern**: Data access via async repositories; use `db.flush()` within repository calls, deferring commit to unit of work / service layer.
- **Pydantic Schemas**: Strict separation between `Create`, `Update`, `Response` schemas.
- **AI Agents**: PydanticAI agents defined in `backend/app/agents/assistant.py` with custom tools and prompt templates.
- **Domain Exceptions**: Services raise explicit exceptions (e.g. `NotFoundError`, `AlreadyExistsError`).

---

## Where to Find Detailed AI Documentation

- `[architecture.md](file:///.claude/architecture.md)` - Complete system architecture, data models, and communication flows.
- `[codebase_summary.md](file:///.claude/codebase_summary.md)` - Quick index of all files, routes, and schemas.
- `[claude_prompt.md](file:///.claude/claude_prompt.md)` - Copy-paste starter context for Claude Web / Desktop.
- `[AI_CODEBASE_CONTEXT.md](file:///AI_CODEBASE_CONTEXT.md)` - Generated dump of the codebase for LLM ingestion.
