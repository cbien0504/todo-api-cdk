import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.api.routes import todos
from app.core.config import settings

# Run database migrations if running in AWS Lambda
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    try:
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        logger.info("AWS Lambda environment detected. Running database migrations...")
        
        from alembic.config import Config
        from alembic import command
        # In AWS Lambda, the root directory of the task is /var/task
        alembic_cfg = Config("/var/task/alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully.")
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to run database migrations at startup: {e}", exc_info=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    allow_origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS]
    allow_credentials = True
    if "*" in allow_origins:
        allow_credentials = False
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include subrouters
app.include_router(todos.router, prefix="/todos", tags=["todos"])


@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint for AWS ECS / Target Groups.
    """
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "Welcome to the Todo API. Access API docs at /docs"}

handler = Mangum(app, lifespan="off")
