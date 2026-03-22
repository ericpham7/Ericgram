# EricGram

EricGram is a React + Vite frontend backed by a C++ HTTP server. This repo is
configured to deploy as a single Dockerized web service so the app can be
reached from one public URL.

## Local development

Backend:

```bash
cmake -S . -B build
cmake --build build
./build/my_app
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Public deployment

This repo includes:

- `Dockerfile` for a production build
- `render.yaml` for one-click Render setup
- backend static-file serving from `frontend/dist` so frontend and API share one
  origin in production

### Render

1. Push this repo to GitHub.
2. In Render, create a new **Blueprint** or **Web Service** from the repo.
3. Render will detect `render.yaml` and the included `Dockerfile`.
4. After the deploy finishes, Render will assign a public URL such as:
   `https://ericgram.onrender.com`

Recommended production env vars:

- `FRONTEND_BASE_URL=https://<your-render-domain>`
- `IG_TOKEN_ENC_KEY` is generated automatically by `render.yaml`

Optional Instagram sync env vars:

- `IG_APP_ID`
- `IG_APP_SECRET`
- `IG_REDIRECT_URI`
- `IG_SCOPE`
- `IG_GRAPH_VERSION`

## Important limitation

The backend is in-memory. Uploaded posts, messages, and other runtime-created
data do not survive server restarts unless you explicitly seed them again.
