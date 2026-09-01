# Finia Backend - Codebase Knowledge Transfer (KT) for Claude

> **Target Audience**: Claude / AI Assistants / New Developers  
> **Purpose**: Complete architectural overview, code structure breakdown, database schemas, and conventions for the Finia backend platform.

---

## 1. Executive Summary & Tech Stack

**Finia** is an AI-powered financial management platform backend structured as a dual-microservice architecture located in the `server/` directory:

1. **REST API Microservice (`server/api/src`)**
   - **Framework**: Node.js, Express, TypeScript
   - **Database & ORM**: PostgreSQL with Prisma ORM (`prisma/schema.prisma`)
   - **Authentication**: JWT-based (Access & Refresh Tokens)
   - **Responsibility**: Core user profile, auth, financial goal tracking, budgeting, and transaction/limit models.

2. **AI Microservice (`server/ai/src`)**
   - **Framework**: Python 3.12+, FastAPI, Pydantic v2, PydanticAI Agent Framework
   - **Database & ORM**: PostgreSQL with Async SQLAlchemy & Alembic migrations
   - **Responsibility**: AI financial assistant multi-turn agent, chat sessions, smart nudges, and AI goal strategy generation.

---

## 2. Directory & File Structure

```plaintext
d:/Finia-backend
├── CLAUDE.md                   # Primary AI/Claude guidelines
├── CODEBASE_KT.md              # Complete Codebase Knowledge Transfer Document
├── README.md                   # Repository README
├── .claude/                    # Claude AI documentation directory
│   ├── architecture.md         # Detailed architectural design & flow
│   ├── codebase_summary.md     # Route & file map
│   └── claude_prompt.md        # Master copy-paste prompt for Claude Web/Desktop
└── server/
    ├── api/
    │   └── src/                # Express + TypeScript REST API Service
    │       ├── prisma/
    │       │   └── schema.prisma           # Prisma Data Schema (Users, Goals, Budgets, Tokens)
    │       ├── src/
    │       │   ├── app.ts                  # Express application setup & middleware stack
    │       │   ├── index.ts                # HTTP Server entry point
    │       │   ├── config/                 # Environment variables & constants
    │       │   ├── controllers/            # Controller layer (HTTP Request/Response handling)
    │       │   │   ├── auth.controller.ts  # Login, signup, token refresh
    │       │   │   ├── user.controller.ts  # Profile fetch & preference updates
    │       │   │   ├── goal.controller.ts  # Financial goals CRUD & AI creation
    │       │   │   └── budget.controller.ts# Budget category management
    │       │   ├── services/               # Business logic & Prisma DB operations
    │       │   ├── routes/                 # Express router declarations
    │       │   │   ├── auth.route.ts       # /api/v1/auth
    │       │   │   ├── user.route.ts       # /api/v1/users
    │       │   │   ├── goal.route.ts       # /api/v1/goals
    │       │   │   └── budget.route.ts     # /api/v1/budgets
    │       │   ├── middlewares/            # Auth guards, error handlers, rate limiters
    │       │   ├── validations/            # Request validation schemas (Joi/Zod)
    │       │   └── types/                  # TypeScript interfaces & custom types
    │       ├── package.json
    │       └── tsconfig.json
    └── ai/
        └── src/                # FastAPI + Python + PydanticAI Service
            ├── AGENTS.md                   # Agent system overview
            ├── CLAUDE.md                   # AI Service guide
            ├── backend/
            │   └── app/
            │       ├── main.py             # FastAPI entry point & CORS
            │       ├── agents/             # PydanticAI Agents
            │       │   ├── assistant.py    # Main financial assistant agent logic
            │       │   ├── prompts.py      # System prompts & persona guidelines
            │       │   └── tools/          # Custom tools available to PydanticAI
            │       ├── api/routes/v1/      # FastAPI API Routers
            │       │   ├── agent.py        # /api/v1/agent chat & goal generation
            │       │   ├── conversations.py# /api/v1/conversations session history
            │       │   ├── auth.py         # Auth validation
            │       │   ├── users.py        # User financial context retrieval
            │       │   └── health.py       # Service health checks
            │       ├── core/               # App configuration & security settings
            │       ├── db/                 # Async SQLAlchemy engine & models
            │       ├── repositories/       # Async DB data access layer
            │       ├── schemas/            # Pydantic request/response schemas
            │       └── services/           # Agent execution & session orchestration
            ├── docker-compose.yml
            └── Makefile
```

---

## 3. Database Schema & Data Models

### Express API (Prisma Schema - `server/api/src/prisma/schema.prisma`)

```prisma
model User {
  id              String    @id @default(uuid())
  name            String    @db.VarChar(255)
  email           String    @unique
  password        String    @db.VarChar(255)
  role            UserRole  @default(USER) // USER | ADMIN
  isEmailVerified Boolean   @default(false)
  dob             DateTime?
  maritalStatus   String?   @db.VarChar(255)
  motive          String?   @db.VarChar(255)
  spendMostly     String?   @db.VarChar(255)
  spendMostlyOn   String?   @db.VarChar(255)
  income          Float     @default(0)
  avatarUrl       String?   @db.VarChar(500)
  theme           String?   @default("dark") @db.VarChar(50)
  currency        String?   @default("USD ($)") @db.VarChar(50)
  notifications   Boolean   @default(true)
  biometric       Boolean   @default(true)
  twoFactor       Boolean   @default(false)
  aiNudges        Boolean   @default(true)
  goals           Goal[]
  budgets         Budget[]
  Token           Token[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Goal {
  id                      String              @id @default(uuid())
  userId                  String
  user                    User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  goalName                String
  goalType                GoalType            @default(CUSTOM) // EMERGENCY_FUND, VACATION, CAR, HOME, GADGET, EDUCATION, INVESTMENT, CUSTOM
  coverImage              String?
  targetAmount            Decimal             @db.Decimal(12, 2)
  currentSavedAmount      Decimal             @default(0) @db.Decimal(12, 2)
  targetDate              DateTime?
  projectedCompletionDate DateTime?
  status                  GoalStatus          @default(ACTIVE) // ACTIVE, COMPLETED, ARCHIVED
  smartSaverEnabled       Boolean             @default(false)
  automationMinBalance    Decimal?            @db.Decimal(12, 2)
  automationFrequency     AutomationFrequency?// DAILY, WEEKLY, MONTHLY
  createdVia              GoalCreatedVia      @default(MANUAL) // MANUAL, AI_PLAN
  createdAt               DateTime            @default(now())
  updatedAt               DateTime            @updatedAt
}

model Budget {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category  String
  amount    Float    @default(0)
  limit     Float    @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, category])
}

model Token {
  id          String    @id @default(uuid())
  token       String    @db.Text
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        TokenType // ACCESS, REFRESH, RESET_PASSWORD, VERIFY_EMAIL
  expires     DateTime
  blacklisted Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

---

## 4. AI Service & PydanticAI Agent Architecture

The AI service (`server/ai/src`) uses **PydanticAI** to run structured LLM agents:

- **Main Agent**: Defined in `backend/app/agents/assistant.py`.
- **Capabilities**:
  1. Multi-turn chat for financial advice, budgeting strategy, and savings optimization.
  2. Structured goal generation (`/api/v1/agent/plan-goal`) returning JSON matching `Goal` creation parameters.
  3. Proactive nudges based on spending habits (`spendMostly`, `income`).
- **Data Flow**:
  - `agent.py` router receives request -> passes user context to `services/` -> invokes PydanticAI agent with prompt & system persona -> records message history -> returns structured response.

---

## 5. API Endpoint Reference

### REST API Service (`server/api/src`) - Port 3000 / Configured Port

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/auth/register` | Create user account | No |
| `POST` | `/api/v1/auth/login` | Authenticate user & receive JWT | No |
| `POST` | `/api/v1/auth/refresh-tokens` | Renew access token | No |
| `GET`  | `/api/v1/users/me` | Get profile & settings | Yes |
| `PATCH`| `/api/v1/users/me` | Update income, preferences | Yes |
| `GET`  | `/api/v1/goals` | List user financial goals | Yes |
| `POST` | `/api/v1/goals` | Create goal (Manual / AI_PLAN) | Yes |
| `GET`  | `/api/v1/budgets` | Fetch budget limits | Yes |
| `POST` | `/api/v1/budgets` | Upsert category budget limit | Yes |

### AI Service (`server/ai/src`) - Port 8000

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/agent/chat` | Chat with AI financial assistant | Yes |
| `POST` | `/api/v1/agent/plan-goal` | Generate AI goal plan | Yes |
| `GET`  | `/api/v1/conversations` | List user chat sessions | Yes |
| `GET`  | `/api/v1/conversations/{id}` | Get session message history | Yes |
| `GET`  | `/api/v1/health` | Health check endpoint | No |

---

## 6. How to Run the Services

### 1. Running REST API (`server/api/src`)
```bash
cd server/api/src
pnpm install
pnpm run dev
```

### 2. Running AI Service (`server/ai/src`)
```bash
cd server/ai/src/backend
uv run uvicorn app.main:app --reload --port 8000
```

---

## 7. Key Code Patterns & Best Practices

1. **Express REST API**:
   - Keep controllers slim (`controllers/`).
   - Move database interactions into service modules (`services/`).
   - Always validate incoming request bodies (`validations/`).

2. **FastAPI AI Service**:
   - Data repositories (`repositories/`) use `db.flush()` instead of `db.commit()`. Commits are controlled by service wrappers.
   - Pydantic schemas must separate `Create`, `Update`, and `Response` interfaces.
   - Agent prompts are decoupled into `app/agents/prompts.py`.
