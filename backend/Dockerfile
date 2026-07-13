# Base Stage
FROM python:3.12-slim AS base

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Builder Stage
FROM base AS builder

COPY requirements.txt /app/

RUN pip install --no-cache-dir --user -r requirements.txt

# Final Runtime Stage
FROM base AS runner

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy backend files
COPY app /app/app
COPY migrations /app/migrations
COPY alembic.ini /app/alembic.ini
COPY start.sh /app/start.sh

EXPOSE 8000

ENTRYPOINT ["./start.sh"]
