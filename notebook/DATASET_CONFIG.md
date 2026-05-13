# Dataset configuration (environment variables)

## Overview

- **Dataset downloads at runtime** when the API starts and the catalog is not ready under `DATA_DIR`.
- **Downloads once** — then persists on disk under your configured `DATA_DIR`.
- **Works with different Kaggle datasets** — change `KAGGLE_DATASET_SLUG` in `.env`.

## Download behavior

```
First start with an empty DATA_DIR
  → Downloads from Kaggle (time depends on dataset size)
  → Extracts under {DATA_DIR}/kaggle/...

Later starts
  → Data already on disk
  → Skips download (fast startup)
```

## Environment variables

Set these in `app/backend/.env` (or your process environment), not only in a shell one-off — the API reads them at startup.

```env
# Dataset slug: owner/name from kaggle.com/datasets/owner/name
KAGGLE_DATASET_SLUG=silverstone1903/deep-fashion-multimodal
KAGGLE_API_TOKEN=KGAT_xxxxxxxxxxxxxxxxxxxx

# Required — absolute path recommended
DATA_DIR=/absolute/path/to/SecundusDermis/app/data

# Optional cap (0 = full catalog)
MAX_ITEMS=0
```

Paths under `DATA_DIR` are defined in `app/backend/config.py` (Kaggle extract, Chroma, uploads, journal, etc.).

## Switch to a different dataset

1. Update `KAGGLE_DATASET_SLUG` (and token if needed) in `.env`.
2. Optionally remove or archive the old tree under `{DATA_DIR}/kaggle/`.
3. Restart `uv run python api.py` from `app/backend/`.

## Verify

```bash
cd app/backend
uv run python -c "import config; print(config.DATA_DIR)"
curl -s http://localhost:8000/catalog/stats
```
