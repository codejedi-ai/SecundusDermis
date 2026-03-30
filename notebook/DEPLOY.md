# Deployment Guide

## Can I deploy this on Vercel?

**Short answer: the frontend yes, the backend no.**

Vercel is a serverless platform optimised for static sites and edge functions. The FastAPI backend has requirements that don't fit:

| Requirement | Vercel | Alternative |
|---|---|---|
| Persistent in-memory catalog (12k items) | No — each request is stateless | Railway / Render / Fly.io |
| Long-running Python process (ADK agent) | No — functions time out in ~10s | Railway / Render / Fly.io |
| Serve static image files (`/images/*`) | No — no disk access | Cloudflare R2 / S3 |
| 12 GB+ image dataset on disk | No | Object storage |

---

## Recommended Setup

### Frontend → Vercel
Works perfectly. The React/Vite app is a static build.

### Backend → Railway (easiest) or Render or Fly.io
All three support long-running Python servers with persistent processes.

---

## Step-by-step: Frontend on Vercel

1. Push your repo to GitHub.

2. Go to [vercel.com](https://vercel.com) → New Project → import your repo.

3. Set the **Root Directory** to `frontend`.

4. Vercel will auto-detect Vite. Build settings should be:
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. Add an environment variable:
   ```
   VITE_API_URL=https://your-backend-url.railway.app
   VITE_IMAGE_URL=https://your-backend-url.railway.app
   ```

6. Deploy. Done.

---

## Step-by-step: Backend on Railway

Railway is the path of least resistance — it runs the Python server as-is, no config changes needed.

### Prerequisites
- [Railway account](https://railway.app) (free tier available)
- GitHub repo with your code

### 1. Create a new Railway project

```bash
# Install Railway CLI (optional, or use the web UI)
npm install -g @railway/cli
railway login
```

### 2. Add a service from your GitHub repo

In the Railway dashboard:
- New Project → Deploy from GitHub repo
- Select your repo
- Set **Root Directory** to `backend`

### 3. Set environment variables in Railway

In the service settings → Variables, add:
```
GEMINI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
AGENT_MODEL=gemini-3.1-pro-preview-customtools
VLM_MODEL=gemini-3.1-pro-preview
DATASET_ROOT=./data
IMAGES_DIR=./data/selected_images
JOURNAL_DIR=./journal
CHROMA_PERSIST_DIR=./chroma_db
MAX_ITEMS=0
PORT=8000
```

### 4. Add a start command

In Railway service settings → Deploy → Start Command:
```
uv run python api.py
```

### 5. The image dataset problem

The `data/selected_images/` folder is ~several GB and cannot be committed to git. Options:

**Option A — Include in repo (small dataset only)**
If you trim to a few hundred images, you can commit them. Set `MAX_ITEMS=500` in `.env`.

**Option B — Upload to object storage (recommended for full 12k catalog)**
1. Upload `data/selected_images/` to Cloudflare R2 or AWS S3.
2. Modify `api.py` to serve images from the object storage URL instead of local `StaticFiles`.
3. Update `VITE_IMAGE_URL` on Vercel to point to the CDN.

**Option C — Mount a Railway volume**
Railway supports persistent volumes. Upload the image dataset to the volume after deploy.

---

## Step-by-step: Backend on Render

Similar to Railway but uses a `render.yaml` config file.

Create `backend/render.yaml`:
```yaml
services:
  - type: web
    name: secundus-dermis-api
    runtime: python
    rootDir: backend
    buildCommand: pip install uv && uv sync
    startCommand: uv run python api.py
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: GOOGLE_API_KEY
        sync: false
      - key: AGENT_MODEL
        value: gemini-3.1-pro-preview-customtools
      - key: VLM_MODEL
        value: gemini-3.1-pro-preview
```

---

## Step-by-step: Backend on Fly.io

Fly.io lets you run a persistent VM, which is ideal for this use case.

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.13-slim

WORKDIR /app
COPY . .

RUN pip install uv && uv sync

EXPOSE 8000
CMD ["uv", "run", "python", "api.py"]
```

Then:
```bash
cd backend
fly launch          # creates fly.toml
fly secrets set GEMINI_API_KEY=your_key
fly secrets set GOOGLE_API_KEY=your_key
fly deploy
```

---

## CORS

The backend already has `allow_origins=["*"]`. For production, replace with your Vercel URL:

In `api.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-app.vercel.app"],
    ...
)
```

---

## Summary

| Component | Host | Cost |
|---|---|---|
| Frontend | Vercel | Free |
| Backend API | Railway / Render / Fly.io | Free tier available |
| Image dataset (12k files) | Cloudflare R2 / S3 | ~$0.01/GB/month |
| Gemini API | Google AI Studio | Free tier: 15 RPM |
