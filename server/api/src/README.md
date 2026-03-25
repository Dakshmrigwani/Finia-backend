# Express TypeScript Boilerplate

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Contributions](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)

## Overview

A clean and scalable boilerplate for building production-ready REST APIs using Node.js, TypeScript, Express, Prisma ORM, and PostgreSQL. Designed with modularity, developer productivity, and maintainability in mind.
This starter includes everything you need: JWT-based authentication, request validation, Docker support, pagination utilities, and more.

## Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Prisma** - SQL query builder and ORM
- **PostgreSQL** - Relational database
- **Docker** - Containerized environment
- **pnpm** - Fast, disk-efficient package manager

## Folder Structure

```plaintext
├── .husky/                # Git hooks configuration
├── .vscode/               # VS Code workspace settings
├── generated/             # Generated prisma client
├── prisma/                # Prisma's directory
│   ├── schema.prisma      # Prisma schema file
│   ├── migrations/        # Database migrations
├── templates/             # Custom code generators (Plop)
├── public/                # Static assets
├── scripts/               # Automation & utility scripts
├── src/                   # Application source code
│   ├── config/            # App configuration files
│   ├── controllers/       # Request & response handlers
│   ├── docs/              # API documentation
│   ├── middlewares/       # Express middlewares
│   ├── models/            # Mongoose models (DB schemas)
│   ├── routes/            # API routes
│   ├── services/          # Business logic & reusable services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions & helpers
│   ├── validations/       # Request schema validations
│   ├── app.ts             # Express app configuration
│   ├── index.ts           # Server entry point
├── tests/                 # Unit & integration tests
├── .dockerignore          # Docker ignore rules
├── .env.example           # Example environment config
├── .gitignore             # Git ignore rules
├── biome.json             # Biome (linter/formatter) config
├── docker-compose.yml     # Docker Compose setup
├── Dockerfile             # Docker image build instructions
├── ecosystem.config.json  # PM2 process manager config
├── package.json           # Project metadata & scripts
├── start-docker.sh        # Shell script to start application container
├── plopfile.js            # Plop generator config
├── pnpm-lock.yaml         # Dependency lock file (PNPM)
├── tsconfig.json          # TypeScript compiler configuration
```

## Installation

### Quick Start

To create a project, simply run:

```bash
npx get-express-starter
```

### Manual Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/logicalHassan/express-postgres-prisma.git
   cd express-postgres-prisma
   ```

2. Install dependencies:

   ```sh
   pnpm install // PNPM is recommended
   ```

3. Configure environment variables:

   ```sh
   cp .env.example .env
   ```

4. Start the development server:

   ```sh
   pnpm run dev
   ```

## Commands

### Development

| Command                  | Description                                         |
|--------------------------|-----------------------------------------------------|
| `pnpm run dev`           | Start the development server with live reload       |
| `pnpm run start:dev`     | Compile TypeScript and run the server in dev mode   |
| `pnpm run clean`         | Remove the build output (`dist/` folder)            |

---

### Build & Production

| Command                  | Description                                         |
|--------------------------|-----------------------------------------------------|
| `pnpm run build`         | Type-check and compile the project                  |
| `pnpm start`             | Start the server using PM2 in production mode       |
| `pnpm run start:docker`  | Start the app in Docker with production `.env`      |

---

### Linting & Formatting

| Command                  | Description                                         |
|--------------------------|-----------------------------------------------------|
| `pnpm run lint`          | Lint all source files with Biome                    |
| `pnpm run lint:fix`      | Lint and auto-fix issues                            |
| `pnpm run format`        | Format source files using Biome                     |

---

### Prisma Database

| Command                          | Description                                  |
|---------------------------------|----------------------------------------------|
| `pnpm run prisma:migrate:dev`   | Run development database migrations          |
| `pnpm run prisma:migrate:deploy`| Apply pending migrations in production       |
| `pnpm run prisma:generate`      | Generate Prisma client                       |
| `pnpm run prisma:remove`        | Remove generated Prisma client files         |
| `pnpm run prisma:push`          | Sync Prisma schema to the database           |
| `pnpm run prisma:pull`          | Pull database schema to Prisma schema        |
| `pnpm run prisma:seed`          | Seed the database using Prisma               |
| `pnpm run prisma:studio`        | Open Prisma Studio (GUI)                     |

---

### ⚙️ Scripts & Utilities

| Command                  | Description                                         |
|--------------------------|-----------------------------------------------------|
| `pnpm run seed:admin`    | Seed the database with an admin user                |
| `pnpm run generate`      | Generate boilerplate code using Plop                |
| `pnpm run prepare`       | Setup Husky Git hooks                               |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`feature/your-feature-name`).
3. Commit your changes with meaningful messages.
4. Open a pull request.

## License

This project is licensed under the [MIT](LICENSE) License.
