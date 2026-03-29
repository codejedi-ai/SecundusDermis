FROM ghcr.io/astral-sh/uv:python3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY . .

# Ensure data directory exists with correct permissions for volume mount
RUN mkdir -p /app/data/selected_images && \
    chown -R root:root /app/data && \
    chmod -R 755 /app/data

EXPOSE 8000

# Dataset is downloaded at runtime by api.py if not present
# Configure via KAGGLE_* environment variables in docker-compose.yml
CMD ["uv", "run", "python", "api.py"]
