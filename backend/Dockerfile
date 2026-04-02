FROM debian:12-slim AS runtime-base

LABEL maintainer="Darcy Liu <darcy.ldx@gmail.com>"
LABEL description="Secundus Dermis API - Cyber-Luxury Retail Platform"

# Setup environment
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install minimal system deps (kept small for faster rebuilds)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS deps

# Grab uv from official image (only in deps stage)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install dependencies (layer caching)
COPY pyproject.toml uv.lock ./
RUN uv python install && \
    uv sync --frozen --no-dev --no-install-project

FROM runtime-base AS runtime

# Ensure the venv python is used at runtime (avoids PATH/venv copy ambiguity)
ENV PATH="/app/.venv/bin:$PATH"

# Copy the resolved virtualenv from deps stage
COPY --from=deps /app/.venv /app/.venv

# uv installs the CPython runtime under /root/.local/share/uv and the venv's
# /app/.venv/bin/python is often a symlink into that location. Copy it too,
# otherwise container startup fails with "stat ... bin/python: no such file".
COPY --from=deps /root/.local/share/uv /root/.local/share/uv

# Copy app code (changes here will not invalidate deps stage)
COPY . .

# Directory setup
RUN mkdir -p /app/data/kaggle/selected_images /app/data/journal /app/data/chroma_db /app/data/uploads && \
    chmod -R 755 /app/data

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Execute directly via the venv's python
# This keeps --no-reload active and ensures clean shutdowns
CMD ["/app/.venv/bin/python", "api.py", "--no-reload"]
