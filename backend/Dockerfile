FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY . .

# Download dataset at build time so it's included in the image
# This ensures the full 12,278 product dataset is available
RUN echo "Downloading full DeepFashion dataset..." && \
    uv run python download_data.py && \
    echo "Dataset download complete. Verifying..." && \
    ls -la data/selected_images/*.jpg 2>/dev/null | wc -l || echo "Warning: Dataset may not have downloaded"

EXPOSE 8000

CMD ["uv", "run", "python", "api.py"]
