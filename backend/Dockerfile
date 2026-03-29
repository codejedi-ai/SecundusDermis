FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY . .

# Download full dataset at build time (12,278 products)
# MAX_ITEMS=0 ensures complete dataset download
RUN echo "=== Downloading complete DeepFashion dataset (12,278 products) ===" && \
    MAX_ITEMS=0 uv run python download_data.py && \
    echo "=== Verifying dataset ===" && \
    IMG_COUNT=$(ls -1 data/selected_images/*.jpg 2>/dev/null | wc -l) && \
    echo "Images downloaded: $IMG_COUNT" && \
    if [ "$IMG_COUNT" -ge 12000 ]; then \
        echo "✓ Full dataset verified"; \
    else \
        echo "⚠ Warning: Expected 12,278 images, got $IMG_COUNT"; \
    fi

EXPOSE 8000

CMD ["uv", "run", "python", "api.py"]
