"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from fastapi_pagination import add_pagination

from app.api.exception_handlers import register_exception_handlers
from app.api.router import api_router
from app.core.config import settings
from app.core.logfire_setup import instrument_app, setup_logfire
from app.core.middleware import RequestIDMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan - startup and shutdown events.

    Resources yielded here are available via request.state in route handlers.
    See: https://asgi.readthedocs.io/en/latest/specs/lifespan.html#lifespan-state
    """
    # === Startup ===
    setup_logfire()
    from app.core.logfire_setup import instrument_asyncpg
    instrument_asyncpg()
    from app.core.logfire_setup import instrument_pydantic_ai
    instrument_pydantic_ai()

    yield

    # === Shutdown ===
    from app.db.session import close_db
    await close_db()


# Environments where API docs should be visible
SHOW_DOCS_ENVIRONMENTS = ("local", "staging", "development")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    # Only show docs in allowed environments (hide in production)
    show_docs = settings.ENVIRONMENT in SHOW_DOCS_ENVIRONMENTS
    openapi_url = f"{settings.API_V1_STR}/openapi.json" if show_docs else None
    docs_url = "/docs" if show_docs else None
    redoc_url = "/redoc" if show_docs else None

    # OpenAPI tags for better documentation organization
    openapi_tags = [
        {
            "name": "health",
            "description": "Health check endpoints for monitoring and Kubernetes probes",
        },
        {
            "name": "auth",
            "description": "Authentication endpoints - login, register, token refresh",
        },
        {
            "name": "users",
            "description": "User management endpoints",
        },
        {
            "name": "sessions",
            "description": "Session management - view and manage active login sessions",
        },
        {
            "name": "items",
            "description": "Example CRUD endpoints demonstrating the API pattern",
        },
        {
            "name": "conversations",
            "description": "AI conversation persistence - manage chat history",
        },
        {
            "name": "agent",
            "description": "AI agent WebSocket endpoint for real-time chat",
        },
    ]

    app = FastAPI(
        title=settings.PROJECT_NAME,
        summary="FastAPI application with Logfire observability",
        description="""
My FastAPI project

## Features
- **Authentication**: JWT-based authentication with refresh tokens
- **Database**: Async database operations
- **AI Agent**: PydanticAI-powered conversational assistant
- **Observability**: Logfire integration for tracing and monitoring

## Documentation

- [Swagger UI](/docs) - Interactive API documentation
- [ReDoc](/redoc) - Alternative documentation view
        """.strip(),
        version="0.1.0",
        openapi_url=openapi_url,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_tags=openapi_tags,
        contact={
            "name": "Your Name",
            "email": "mrigwanidaksh@gmail.com",
        },
        license_info={
            "name": "MIT",
            "identifier": "MIT",
        },
        lifespan=lifespan,
        default_response_class=ORJSONResponse,
    )
    # Logfire instrumentation
    instrument_app(app)

    # Request ID middleware (for request correlation/debugging)
    app.add_middleware(RequestIDMiddleware)

    # Exception handlers
    register_exception_handlers(app)

    # CORS middleware
    from starlette.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # Sentry
    if settings.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.SENTRY_DSN, enable_tracing=True)

    # Session middleware (for admin authentication and/or OAuth)
    from starlette.middleware.sessions import SessionMiddleware
    app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

    # Admin panel (environment restricted)
    ADMIN_ALLOWED_ENVIRONMENTS = ["development", "local", "staging"]

    if settings.ENVIRONMENT in ADMIN_ALLOWED_ENVIRONMENTS:
        from app.admin import setup_admin
        setup_admin(app)


    # Include API router

    app.include_router(api_router, prefix=settings.API_V1_STR)

    # Pagination
    add_pagination(app)

    return app


app = create_app()
