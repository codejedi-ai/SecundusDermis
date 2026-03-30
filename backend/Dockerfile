FROM debian:12-slim

LABEL maintainer="Darcy Liu <darcy.ldx@gmail.com>"
LABEL description="Secundus Dermis API - Cyber-Luxury Retail Platform"

# Setup environment
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install minimal system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Grab uv from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install dependencies (layer caching)
COPY pyproject.toml uv.lock ./
RUN uv python install && \
    uv sync --frozen --no-dev --no-install-project

# Copy app code
COPY . .

# Final sync for the project itself
RUN uv sync --frozen --no-dev

# Directory setup
RUN mkdir -p /app/data/kaggle/selected_images /app/data/journal /app/data/chroma_db /app/data/uploads && \
    chmod -R 755 /app/data

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Execute directly via the venv's python
# This keeps --no-reload active and ensures clean shutdowns
CMD ["python", "api.py", "--no-reload"]
