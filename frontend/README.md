# EricGram Frontend

React + Vite frontend for EricGram.

## Run in dev mode

```bash
npm install
npm run dev
```

Dev server: `http://localhost:5176`

`vite.config.js` proxies `/api/*` requests to the C++ backend on `http://localhost:8080`.

## Build

```bash
npm run build
npm run preview
```

## Notes

- Google OAuth sign-in uses `VITE_GOOGLE_CLIENT_ID` from `frontend/.env`.
- This frontend is designed to work with the C++ backend in the repo root.
