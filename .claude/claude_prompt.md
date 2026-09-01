# Master System Context Prompt for Claude

> **Instructions for User**: Copy the entire text block below and paste it into Claude (Web `claude.ai`, Claude Desktop, or Claude Code) to instantly load the context of the **Finia-backend** repository.

```markdown
I am working on **Finia-backend**, a dual-service AI-driven financial platform backend. Here is the architectural overview, directory structure, tech stack, database schemas, and codebase patterns:

---

### 1. Architectural Overview & Microservices

The repository contains two microservices under `server/`:

1. **REST API Microservice (`server/api/src`)**
   - **Framework**: Express.js + TypeScript
   - **Database**: PostgreSQL with Prisma ORM (`server/api/src/prisma/schema.prisma`)
   - **Responsibilities**: User authentication (JWT), user profiles, financial goal tracking (`Goal`), budget limits (`Budget`), and security tokens (`Token`).

2. **AI Microservice (`server/ai/src`)**
   - **Framework**: FastAPI (Python 3.12+) + Pydantic v2 + PydanticAI agent framework
   - **Database**: PostgreSQL with Async SQLAlchemy & Alembic migrations
   - **Responsibilities**: AI financial assistant agent (`app/agents/assistant.py`), conversational memory, AI savings plan generation, spending insights, and automated financial nudges.

---

### 2. Directory Tree

```
Finia-backend/
├── CLAUDE.md                   # Core Claude rules & commands
├── .claude/
│   ├── architecture.md         # System architecture & DB schemas
│   ├── codebase_summary.md     # Route & file map
│   └── claude_prompt.md        # Master prompt
└── server/
    ├── api/src/                # Express + TypeScript + Prisma API
    │   ├── prisma/schema.prisma# Database models (User, Goal, Budget, Token)
    │   └── src/                # Controllers, Routes, Services, Middlewares
    └── ai/src/                 # FastAPI + Python + PydanticAI Service
        └── backend/app/        # Agents, Routers, Repositories, Schemas
```

---

### 3. Primary Database Models (Prisma Schema Summary)

- **User**: `id`, `email`, `password`, `name`, `role` (USER|ADMIN), `income`, `spendMostly`, `spendMostlyOn`, `motive`, `currency`, `theme`, `aiNudges`, `biometric`, `twoFactor`.
- **Goal**: `id`, `userId`, `goalName`, `goalType` (`EMERGENCY_FUND`, `VACATION`, `CAR`, `HOME`, `GADGET`, `EDUCATION`, `INVESTMENT`, `CUSTOM`), `targetAmount`, `currentSavedAmount`, `targetDate`, `status` (`ACTIVE`, `COMPLETED`, `ARCHIVED`), `createdVia` (`MANUAL`, `AI_PLAN`).
- **Budget**: `id`, `userId`, `category`, `amount`, `limit`. Unique per `[userId, category]`.
- **Token**: `id`, `token`, `userId`, `type` (`ACCESS`, `REFRESH`, `RESET_PASSWORD`, `VERIFY_EMAIL`), `expires`, `blacklisted`.

---

### 4. Development Commands

- **Express API**:
  - Start Dev: `cd server/api/src && pnpm run dev`
  - Prisma Sync: `pnpm run prisma:generate && pnpm run prisma:migrate:dev`
- **FastAPI AI**:
  - Start Dev: `cd server/ai/src/backend && uv run uvicorn app.main:app --reload --port 8000`
  - Run Tests: `pytest`
  - Code Format: `ruff check . --fix && ruff format .`

---

### 5. Coding Standards

- **Express API**: Controller-Service architecture. Business logic in `services/`, handlers in `controllers/`, route declarations in `routes/`.
- **FastAPI AI**: Repository pattern for async DB access (`db.flush()` in repos, commits at service layer). Pydantic v2 schemas separated into `Create`, `Update`, `Response`. Domain exceptions (`NotFoundError`, `AlreadyExistsError`).

Now that you have full context on the Finia-backend codebase architecture, please assist me with my task.
```
