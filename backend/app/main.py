import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse
from mangum import Mangum

from app.api.routes import todos
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Setup CORS allowed origins
allow_origins = []
if settings.FRONTEND_URL:
    allow_origins.append(settings.FRONTEND_URL)
allow_origins.extend(["http://localhost:5173", "http://localhost:3000"])
allow_origins = list(set([o for o in allow_origins if o]))

if allow_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Middleware: Log request performance metrics
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = None
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url.path} - Error: {e}", exc_info=True)
        raise e
    finally:
        duration = (time.time() - start_time) * 1000
        status_code = response.status_code if response else 500
        logger.info(
            f"Method={request.method} | Path={request.url.path} | Status={status_code} | Duration={duration:.2f}ms"
        )

# Exception Handler: Request parameter validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error for path {request.url.path}: {exc.errors()}")
    msg = "Validation failed for request parameters."
    if exc.errors():
        details = [f"{' -> '.join(map(str, err['loc']))}: {err['msg']}" for err in exc.errors()]
        msg = f"Validation errors: {'; '.join(details)}"
        
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": msg
            }
        }
    )

# Exception Handler: Standard HTTP exceptions
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 401:
        code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 405:
        code = "METHOD_NOT_ALLOWED"
    else:
        code = "BAD_REQUEST"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": exc.detail
            }
        }
    )

# Exception Handler: Core runtime errors
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Internal server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later."
            }
        }
    )

app.include_router(todos.router, prefix="/todos", tags=["todos"])

@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "Welcome to the Todo API. Access API docs at /docs"}

handler = Mangum(app, lifespan="off")
