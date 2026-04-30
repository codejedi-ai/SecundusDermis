# syntax=docker/dockerfile:1

FROM node:20-slim AS frontend_builder

WORKDIR /app/frontend
COPY app/frontend/ ./
RUN --mount=type=cache,target=/root/.npm npm ci
RUN npm run build

FROM python:3.12-slim-bookworm

LABEL maintainer="Darcy Liu <darcy.ldx@gmail.com>"
LABEL description="Secundus Dermis unified app container"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl openssl \
    && rm -rf /var/lib/apt/lists/*

# Keep both source trees in the runtime image as requested.
COPY app/frontend/ ./frontend
COPY app/backend/ ./backend

COPY app/backend/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY --from=frontend_builder /app/frontend/dist ./backend/frontend_dist

RUN mkdir -p /app/data/kaggle/selected_images /app/data/journal /app/data/chroma_db /app/data/uploads \
    && chmod -R 755 /app/data
RUN mkdir -p /app/certs \
    && openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
    -keyout /app/certs/selfsigned.key \
    -out /app/certs/selfsigned.crt \
    -subj "/CN=secundus_dermis"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -k -f https://localhost:8000/health || exit 1

CMD ["python", "backend/api.py", "--no-reload"]
