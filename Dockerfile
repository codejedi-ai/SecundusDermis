# syntax=docker/dockerfile:1

# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the FastAPI backend and include the frontend
FROM python:3.12-slim-bookworm
LABEL maintainer="Darcy Liu <darcy.ldx@gmail.com>"
LABEL description="Secundus Dermis - Single Container Deploy (FastAPI + React SPA)"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIR=/app/static

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy frontend build from stage 1
COPY --from=frontend-builder /frontend/dist ./static

RUN mkdir -p /app/data/kaggle/selected_images /app/data/journal /app/data/chroma_db /app/data/uploads \
    && chmod -R 755 /app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "api.py", "--no-reload"]
