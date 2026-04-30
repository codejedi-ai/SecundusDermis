# syntax=docker/dockerfile:1

FROM node:20-slim AS frontend_builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# Official Python image — faster cold builds than Debian + uv (no extra Python download).
FROM python:3.12-slim-bookworm

LABEL maintainer="Darcy Liu <darcy.ldx@gmail.com>"
LABEL description="Secundus Dermis API - Cyber-Luxury Retail Platform"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Dependencies layer (cached when only app code changes)
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend_builder /frontend/dist ./frontend_dist

RUN mkdir -p /app/data/kaggle/selected_images /app/data/journal /app/data/chroma_db /app/data/uploads \
    && chmod -R 755 /app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "api.py", "--no-reload"]
