# Finia Backend - Codebase Summary & File Map

## Repository Directory Tree

```
d:/Finia-backend
├── CLAUDE.md
├── README.md
├── generate_ai_context.py
├── AI_CODEBASE_CONTEXT.md
├── .claude/
│   ├── architecture.md
│   ├── codebase_summary.md
│   └── claude_prompt.md
└── server/
    ├── api/
    │   └── src/
    │       ├── prisma/
    │       │   └── schema.prisma           # Primary Prisma database schema
    │       ├── src/
    │       │   ├── app.ts                  # Express app setup & middleware stack
    │       │   ├── index.ts                # Server entry point & listener
    │       │   ├── config/                 # Environment config & constants
    │       │   ├── controllers/            # API Controllers:
    │       │   │   ├── auth.controller.ts  # Signin, signup, refresh, logout
    │       │   │   ├── user.controller.ts  # Profile, settings, onboarding
    │       │   │   ├── goal.controller.ts  # Goal CRUD & AI goal creation
    │       │   │   └── budget.controller.ts# Budget limits & tracking
    │       │   ├── routes/                 # Express Route declarations:
    │       │   │   ├── auth.route.ts       # /api/v1/auth endpoints
    │       │   │   ├── user.route.ts       # /api/v1/users endpoints
    │       │   │   ├── goal.route.ts       # /api/v1/goals endpoints
    │       │   │   └── budget.route.ts     # /api/v1/budgets endpoints
    │       │   ├── services/               # Business logic services
    │       │   ├── middlewares/            # Auth guard, error handler, rate limit
    │       │   ├── validations/            # Joi/Zod request schemas
    │       │   └── types/                  # Express & TypeScript declarations
    │       ├── package.json
    │       └── tsconfig.json
    └── ai/
        └── src/
            ├── AGENTS.md                   # Agent system overview
            ├── CLAUDE.md                   # Python service guide
            ├── backend/
            │   └── app/
            │       ├── main.py             # FastAPI entry point
            │       ├── agents/             # PydanticAI Agents:
            │       │   ├── assistant.py    # Main financial assistant agent
            │       │   ├── prompts.py      # System prompts & templates
            │       │   └── tools/          # Agent tools (DB access, calculations)
            │       ├── api/routes/v1/      # FastAPI Routers:
            │       │   ├── agent.py        # /api/v1/agent chat & task endpoints
            │       │   ├── conversations.py# /api/v1/conversations history
            │       │   ├── auth.py         # AI service auth verification
            │       │   ├── users.py        # User profile context retrieval
            │       │   └── health.py       # Health checks
            │       ├── core/               # App configuration & security settings
            │       ├── db/                 # Async SQLAlchemy models & engine
            │       ├── repositories/       # DB access layer for AI
            │       ├── schemas/            # Pydantic data schemas
            │       └── services/           # Conversation & agent orchestration
            ├── docker-compose.yml
            └── Makefile
```

## Core API Endpoints Overview

### Express REST API (`server/api/src`)
- `POST /api/v1/auth/register` - User signup
- `POST /api/v1/auth/login` - User authentication & JWT issuance
- `POST /api/v1/auth/refresh-tokens` - Refresh JWT token
- `GET /api/v1/users/me` - Get logged-in user profile
- `PATCH /api/v1/users/me` - Update profile, income, financial preferences
- `GET /api/v1/goals` - List user financial goals
- `POST /api/v1/goals` - Create goal (manual or AI-generated plan)
- `GET /api/v1/budgets` - Fetch spending categories & budget limits
- `POST /api/v1/budgets` - Create or update budget category limit

### FastAPI AI Service (`server/ai/src`)
- `POST /api/v1/agent/chat` - Multi-turn conversational AI financial advisor
- `POST /api/v1/agent/plan-goal` - Generate structured AI savings goal strategy
- `GET /api/v1/conversations` - List active AI chat sessions
- `GET /api/v1/conversations/{id}` - Fetch chat session history
- `GET /api/v1/health` - AI Service health & DB connection check
