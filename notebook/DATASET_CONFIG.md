# Dataset Configuration - Fully Configurable via Environment Variables

## Overview

- **Dataset downloads at RUNTIME** (when container first starts)
- **NOT at docker build time** - builds are fast
- **Downloads ONCE** - then persists in volume
- **Works with ANY Kaggle dataset** - change `KAGGLE_DATASET_SLUG`

## Download Behavior

```
┌─────────────────────────────────────────────────────────────┐
│ First docker-compose up -d (fresh volume)                  │
│ → Volume is empty                                           │
│ → Downloads from Kaggle (~5-10 min depending on dataset)   │
│ → Saves to backend-data:/app/data volume                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Subsequent docker-compose up -d                             │
│ → Data exists in volume                                     │
│ → SKIPS download (instant startup)                          │
│ → Uses existing data                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ docker-compose build                                        │
│ → NO download happens                                       │
│ → Build is fast                                             │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables (docker-compose.yml)

```yaml
services:
  backend:
    environment:
      # CHANGE THIS to use different dataset
      # Format: owner/dataset-name (from kaggle.com/datasets/owner/name)
      - KAGGLE_DATASET_SLUG=silverstone1903/deep-fashion-multimodal
      
      # Kaggle auth token - get from https://www.kaggle.com/settings → API
      - KAGGLE_API_TOKEN=KGAT_xxxxxxxxxxxxxxxxxxxx
      
      # Data folder paths (usually don't need to change)
      - DATASET_ROOT=/app/data
      - IMAGES_DIR=/app/data/selected_images
      
      # 0 = full dataset, or set number to limit (e.g., 2000 for testing)
      - MAX_ITEMS=0
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Container starts                                        │
│     ↓                                                       │
│  2. api.py checks: does /app/data have data?               │
│     ↓ NO                                                    │
│  3. download_data.py runs:                                  │
│     - Reads KAGGLE_DATASET_SLUG from env                   │
│     - Reads KAGGLE_API_TOKEN from env                      │
│     - Downloads from Kaggle                                │
│     ↓                                                       │
│  4. Data saved to volume: backend-data:/app/data           │
│     ↓                                                       │
│  5. Subsequent restarts: data already exists, skip download│
└─────────────────────────────────────────────────────────────┘
```

## Switch to Different Dataset

**Step 1:** Edit docker-compose.yml
```yaml
environment:
  - KAGGLE_DATASET_SLUG=new-owner/new-dataset-name  # ← Change this
  - KAGGLE_API_TOKEN=KGAT_your_token
```

**Step 2:** Remove old data (optional)
```bash
docker volume rm secundusdermis_backend-data
```

**Step 3:** Redeploy
```bash
docker-compose up -d
```

**Done!** New dataset will download automatically.

## Deployment

### First Time
```bash
docker-compose up -d
docker-compose logs -f backend  # Watch download progress
```

### Verify
```bash
docker-compose logs backend | grep -E "Loaded.*items"
# Should show: Loaded 12278 items from catalog (or your dataset size)
```

### Check Stats
```bash
curl http://localhost:7860/catalog/stats
```

## Volume

```yaml
volumes:
  - backend-data:/app/data        # Downloaded dataset persists here
  - backend-chroma:/app/chroma_db # Vector database
```

On first run:
- Volume is empty → downloads from Kaggle → saves to volume

On subsequent runs:
- Volume has data → skips download → uses existing data

## Security

- **Do not commit tokens to git**
- Use secrets management in production
- Get token: https://www.kaggle.com/settings → API → Create New Token
