# EricGram Documentation

## 1. Overview

EricGram is a full-stack social app prototype with:

- A C++ backend server (`main.cpp`) using `cpp-httplib`.
- A React + Vite frontend (`frontend/`).
- In-memory backend storage only (no SQLite database).

The current authenticated frontend views are:

- `/` -> Instagram-style home feed (`MediaFeedPage`).
- `/people` -> profile/people page (`FeedPage`).

## 2. Simplified Tech Stack

### Backend

- Language: C++20
- HTTP server/client: `cpp-httplib` (`include/httplib.h`)
- Crypto helper: OpenSSL (`EVP`, `HMAC`, `SHA256`, `RAND_bytes`)
- Build: CMake
- Storage: in-memory C++ objects

### Frontend

- React 19 + JSX
- React Router (`react-router-dom`)
- Vite
- Google OAuth client helper (`@react-oauth/google`)

## 3. Repository Layout

```text
Ericgram/
├── main.cpp                    # Backend routes/services/models
├── CMakeLists.txt              # Backend build config
├── include/httplib.h           # HTTP library header
├── server.hpp                  # Legacy helper declarations
├── DOCUMENTATION.md            # This document
├── frontend/
│   ├── package.json            # Frontend scripts/dependencies
│   ├── package-lock.json       # Frontend lockfile
│   ├── vite.config.js          # Vite config + API proxy
│   ├── .env / .env.example     # Optional frontend env vars
│   ├── index.html              # SPA shell
│   ├── public/                 # Static assets
│   └── src/                    # React app code
├── build/                      # Backend build output
└── out/                        # Optional CMake preset output
```

## 4. Backend Architecture (`main.cpp`)

`main.cpp` remains monolithic but organized into logical sections:

- Utility helpers (JSON, env, parsing, crypto, HTTP helpers).
- Domain models (`User`, `Post`, `Message`, feed structs).
- In-memory social service (`SocialNetwork`).
- In-memory app store (`InMemoryStore`) for sessions and Instagram records.
- Instagram integration service (`InstagramIntegrationService`).
- Background sync worker (`SyncWorker`).
- API route registration and server startup.

### 4.1 In-Memory Storage

All runtime data is in process memory. Data resets when the backend restarts.

Stored in memory:

- Session records.
- Instagram connection records.
- Instagram media records.
- Users/messages/posts/comments/media blobs from `SocialNetwork`.

## 5. API Surface (Current)

### 5.1 Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/login` (legacy)

### 5.2 Users / Friends / Messaging

- `POST /api/signup`
- `GET /api/users`
- `POST /api/friends/add`
- `POST /api/messages/send`
- `GET /api/messages?user1=<...>&user2=<...>`

### 5.3 Local Post Features

- `POST /api/posts/create` (multipart)
- `GET /api/posts`
- `GET /api/posts/media`
- `POST /api/posts/like`
- `POST /api/posts/comment/add`
- `POST /api/posts/comment/edit`
- `POST /api/posts/comment/delete`
- `POST /api/posts/delete`

### 5.4 Feed

- `GET /api/feed?cursor=<cursor>&limit=<n>&source=<all|local|instagram>`

### 5.5 Instagram Admin

- `POST /api/admin/instagram/oauth/start`
- `GET /api/admin/instagram/oauth/callback`
- `GET /api/admin/instagram/connections`
- `POST /api/admin/instagram/connections/:id/sync`
- `DELETE /api/admin/instagram/connections/:id`

## 6. Frontend Architecture (`frontend/src`)

### 6.1 Entry Point

- `main.jsx` mounts `App` in `StrictMode` and wraps with:
  - `GoogleOAuthProvider`
  - `BrowserRouter`

### 6.2 App Shell

- `App.jsx` restores session with `/api/auth/me`.
- Routes:
  - `/login` -> login/signup page
  - `/` -> media feed (authenticated)
  - `/people` -> people/profile page (authenticated)

### 6.3 API Client

- `api.js` centralizes all backend `fetch` calls.

### 6.4 Main UI Components

- `LoginPage.jsx`: email/phone + password login/signup, plus Google sign-in button flow.
- `Navbar.jsx`: search/profile/logout shell.
- `MediaFeedPage.jsx`: feed viewer + admin Instagram actions.
- `FeedPage.jsx`: user/profile exploration page.

## 7. Environment Variables

### 7.1 Frontend (`frontend/.env`)

- `VITE_GOOGLE_CLIENT_ID` (required to enable Google sign-in).

### 7.2 Backend

- `HOST` (default: `0.0.0.0`)
- `PORT` (default: `8080`)
- `IG_TOKEN_ENC_KEY` (default: `dev-only-change-me`)
- `ADMIN_USERNAMES` (CSV)
- `COOKIE_SECURE` (bool)
- `ERICGRAM_ENV` (used for cookie secure default)
- `FRONTEND_BASE_URL` (default: `http://localhost:5176`)

Instagram config (needed only if using Instagram admin sync):

- `IG_APP_ID`
- `IG_APP_SECRET`
- `IG_REDIRECT_URI`
- `IG_SCOPE`
- `IG_GRAPH_VERSION`

Cloudflare R2 config (optional):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `R2_REGION`

## 8. Build and Run

### Backend

```bash
cmake -S . -B build
cmake --build build
./build/my_app
```

Backend URL: `http://localhost:8080`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5176`

Vite proxies `/api/*` to `http://localhost:8080`.

## 9. Notes

- Backend data is not persistent across restarts.
- Backend remains in a single large source file (`main.cpp`).
- Profile edits in UI are still session/client-side behavior unless routed to backend endpoints.
