# EricGram — Full-Stack Social Media Application

## Detailed Documentation (Beginner-Friendly)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [How the Project is Structured](#how-the-project-is-structured)
3. [The Backend (C++)](#the-backend-c)
4. [The Frontend (React)](#the-frontend-react)
5. [How Frontend & Backend Talk to Each Other](#how-frontend--backend-talk-to-each-other)
6. [How to Run the Project](#how-to-run-the-project)
7. [Step-by-Step Walkthrough of a Login](#step-by-step-walkthrough-of-a-login)
8. [File-by-File Breakdown](#file-by-file-breakdown)

---

## 1. Project Overview

EricGram is a **full-stack social media application** with two major parts:

| Part | Technology | What it does |
|------|-----------|--------------|
| **Backend** | C++ with `httplib` | Stores user data in memory, handles login, serves user data via a REST API |
| **Frontend** | React (JavaScript) with Vite | The visual interface users see in their browser — login screen, user feed, profile cards |

**Think of it like a restaurant:**
- The **backend** is the kitchen — it stores the food (data) and prepares orders (processes requests)
- The **frontend** is the dining room — it's what customers (users) see and interact with
- **API requests** are the waiters — they carry orders from the dining room to the kitchen and bring food back

---

## 2. How the Project is Structured

```
socialMediaProj2/
├── main.cpp              ← The entire C++ backend (server + data)
├── server.hpp            ← Helper functions for the server
├── include/
│   └── httplib.h         ← HTTP library (lets C++ act as a web server)
├── CMakeLists.txt        ← Build instructions for the C++ code
├── build/                ← Compiled C++ output
└── frontend/             ← The React app (everything the user sees)
    ├── index.html        ← The single HTML page React mounts into
    ├── vite.config.js    ← Dev server config (including API proxy)
    ├── package.json      ← JavaScript dependencies
    ├── public/
    │   └── logo.png      ← App favicon/logo
    └── src/
        ├── main.jsx      ← Entry point — mounts React into the HTML
        ├── App.jsx        ← Root component — decides login vs feed
        ├── App.css        ← Root layout styles
        ├── index.css      ← Global design system (colors, fonts, animations)
        ├── api.js         ← Functions that talk to the C++ backend
        ├── assets/
        │   └── logo.png  ← Logo image used in components
        └── components/
            ├── LoginPage.jsx   ← Login form UI
            ├── LoginPage.css   ← Login form styles
            ├── Navbar.jsx      ← Top navigation bar
            ├── Navbar.css      ← Navigation bar styles
            ├── FeedPage.jsx    ← Main feed displaying all users
            ├── FeedPage.css    ← Feed page styles
            ├── UserCard.jsx    ← Individual user card in the grid
            ├── UserCard.css    ← User card styles
            ├── ProfileModal.jsx ← Popup when you click a user
            └── ProfileModal.css ← Profile popup styles
```

---

## 3. The Backend (C++)

### What is a backend?
The backend is the **server** — a program running on your computer that **listens for requests** and **sends back data**. Users never see the backend directly; they interact with it through the frontend.

### Key Classes

#### `User` class (main.cpp, line 12)
Represents a single person on EricGram. Each user has:

```cpp
string userName;      // unique identifier, e.g. "ericphXm"
string name;          // display name, e.g. "Eric Pham"
long long phoneNumber; // phone number
string email;         // email for login
string password;      // password for login
vector<User*> *friends; // list of friends
```

**Important method — `toJSON()`:**
Since the frontend (JavaScript) can't understand C++ objects, we convert each User into a **JSON string** before sending it. JSON is a universal text format both languages can understand.

```cpp
// Example output:
// {
// "userName":"ericphXm",
// "name":"Eric Pham",
// "email":"ERICPHAM0902@GMAIL.COM",
// "friendsCount":0
// }
```

#### `SocialNetwork` class (main.cpp, line 66)
Acts as an **in-memory database** — a list of all users. Provides CRUD operations:

| Method | What it does |
|--------|-------------|
| `addUser(User*)` | Adds a new user to the network |
| `findUser(userName)` | Finds a user by their username |
| `findUserByEmail(email)` | Finds a user by their email (used for login) |
| `getAllUsersJSON()` | Returns ALL users as a JSON array string |
| `getUserCount()` | Returns how many users exist |

### API Endpoints (the "menu" of available requests)

The backend creates a **web server** on `localhost:8080` and defines these endpoints:

#### `POST /api/login`
- **What it does:** Checks if an email/password combination is valid
- **Input:** `{"email": "...", "password": "..."}`
- **Success (200):** Returns the user's data as JSON
- **Failure (401):** Returns `{"error": "Invalid email or password"}`

#### `GET /api/users`
- **What it does:** Returns all users in the network
- **Output:** A JSON array like `[{"userName":"ericphXm",...}, {"userName":"alice123",...}]`

#### `OPTIONS /api/*` (CORS Preflight)
- **What it does:** Tells the browser "yes, the frontend is allowed to talk to me"
- **Why it's needed:** Browsers block requests between different origins (ports) by default for security. This is called **CORS** (Cross-Origin Resource Sharing). The backend must explicitly say "I allow requests from other origins."

### Helper Functions (server.hpp)

| Function | What it does |
|----------|-------------|
| `getJSONValue(json, key)` | Extracts a value from a JSON string by key name. For example: `getJSONValue('{"email":"a@b.com"}', "email")` → `"a@b.com"` |
| `startServer(server, host, port)` | Starts the HTTP server and prints a message to the console |

---

## 4. The Frontend (React)

### What is React?
React is a JavaScript library for building user interfaces. Instead of writing raw HTML, you write **components** — reusable pieces of UI that manage their own state and render themselves.

### What is Vite?
Vite is a **development tool** that:
- Serves your React app locally with hot-reload (changes appear instantly)
- Bundles your code for production
- Can **proxy** API requests to your backend (more on this below)

### Components (what the user sees)

#### `App.jsx` — The Root
The brain of the frontend. It decides what to show:

```
Is the user logged in?
├── NO  → Show <LoginPage />
└── YES → Show <Navbar /> + <FeedPage />
```

It stores the logged-in user in React **state** (`useState`). When the user logs in, `setUser(userData)` is called, which triggers React to re-render and show the feed. When they log out, `setUser(null)` brings them back to login.

#### `LoginPage.jsx` — Sign In Screen
A form with email and password fields that:
1. User types their email and password
2. User clicks "Sign In"
3. The `loginUser()` function from `api.js` sends a `POST` request to the C++ backend at `/api/login`
4. If successful → calls `onLogin(user)` which tells `App.jsx` to show the feed
5. If failed → shows an error message

**Visual features:**
- Animated gradient orbs in the background
- Password show/hide toggle
- Loading spinner on the button
- Demo account hint at the bottom

#### `Navbar.jsx` — Top Navigation Bar
Shows at the top of every page after login:
- **Logo + brand name** on the left
- **Search bar** in the middle (decorative for now)
- **User menu** on the right — click to open a dropdown with Profile, Settings, and Log Out

Uses **glassmorphism** (semi-transparent background with blur effect).

#### `FeedPage.jsx` — Main Content
The home page after login. It:
1. On mount, calls `fetchAllUsers()` from `api.js` to get all users from the backend
2. Shows a **welcome banner** with the user's name and network stats
3. Displays all users in a **responsive grid** of `UserCard` components
4. Clicking a user card opens the `ProfileModal`

**States it handles:**
- **Loading** → Shows animated skeleton placeholders
- **Error** → Shows a friendly error message with retry button
- **Success** → Shows the user grid

#### `UserCard.jsx` — User Card in the Grid
Each card shows:
- A gradient avatar (color based on the first letter of their name)
- Name and @username
- Friend count and post count
- An "Add Friend" button
- Green online indicator dot

Cards have **staggered animation** — each one fades in slightly after the previous one.

#### `ProfileModal.jsx` — User Profile Popup
When you click a user card, a modal overlay appears with:
- A color-matched banner/header
- Large avatar
- User's full name, username, email
- Friend count and join info
- "Add Friend" and "Message" buttons
- Closes when you click outside or press Escape

### The API Service Layer (`api.js`)
A small file with two functions that handle communication with the C++ backend:

```javascript
loginUser(email, password)   // POST /api/login → returns user object or throws error
fetchAllUsers()              // GET  /api/users → returns array of user objects
```

These use the browser's built-in `fetch()` function to make HTTP requests.

### The Design System (`index.css`)
Defines the visual language for the entire app using **CSS custom properties** (variables):

- **Colors:** Dark theme with purple-to-pink gradient accents
- **Typography:** Inter font from Google Fonts
- **Animations:** fadeIn, slideUp, shimmer, float, pulse-glow, spin
- **Utility classes:** `.gradient-text`, `.glass`, `.animate-fade-in`

Every component references these variables (e.g., `var(--bg-card)`) so the entire app stays consistent.

---

## 5. How Frontend & Backend Talk to Each Other

```
  Browser (React App)                    C++ Server
  localhost:5173                         localhost:8080
  ─────────────────                      ──────────────
       │                                       │
       │  1. User clicks "Sign In"             │
       │                                       │
       │  2. fetch("/api/login", {             │
       │       method: "POST",                 │
       │       body: {email, password}    ───►  │  3. Server receives request
       │     })                                │     findUserByEmail(email)
       │                                       │     checkPassword(password)
       │                                       │
       │  5. React updates state,         ◄─── │  4. Server sends back user JSON
       │     shows the Feed page               │     or 401 error
       │                                       │
       │  6. FeedPage mounts,                  │
       │     fetch("/api/users")          ───►  │  7. Server runs getAllUsersJSON()
       │                                       │
       │  9. React renders UserCards      ◄─── │  8. Server sends JSON array
       │     in a grid                         │     of all users
       │                                       │
```

### The Proxy (vite.config.js)
During development, the React app runs on port `5173` and the C++ server runs on port `8080`. Normally, the browser would block requests between these two ports (CORS).

The Vite proxy solves this elegantly:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8080',  // Forward /api/* to the C++ server
    changeOrigin: true,
  },
}
```

When React calls `fetch('/api/users')`, Vite intercepts it and forwards it to `http://localhost:8080/api/users` behind the scenes. The browser thinks it's talking to the same server!

---

## 6. How to Run the Project

### Step 1: Build & start the C++ backend
```bash
cd socialMediaProj2
mkdir -p build && cd build
cmake ..
make
./my_app
# Output: "Server starting on http://localhost:8080"
```
Keep this terminal open — the server must stay running.

### Step 2: Start the React frontend (in a new terminal)
```bash
cd socialMediaProj2/frontend
npm run dev
# Output: "Local: http://localhost:5173/"
```

### Step 3: Open in browser
Go to **http://localhost:5173** and log in with:
- **Email:** `ERICPHAM0902@GMAIL.COM`
- **Password:** `password123`

---

## 7. Step-by-Step Walkthrough of a Login

Here is exactly what happens when you type in credentials and press "Sign In":

1. **You type** your email and password into the `<input>` fields in `LoginPage.jsx`
2. React stores each keystroke in component state via `useState` and `onChange`
3. **You click "Sign In"** → triggers `handleSubmit()` in `LoginPage.jsx`
4. `handleSubmit()` calls `loginUser(email, password)` from `api.js`
5. `api.js` uses `fetch()` to send a **POST request** to `/api/login` with the email and password as JSON
6. **Vite proxy** forwards the request from `localhost:5173` → `localhost:8080`
7. **C++ server** receives the request in the `server.Post("/api/login", ...)` handler
8. It uses `getJSONValue()` to extract the email and password from the request body
9. It calls `network->findUserByEmail(email)` to look up the user
10. It calls `user->checkPassword(password)` to verify the password
11. **If valid:** Server calls `user->toJSON()` and sends the JSON string back with status 200
12. **If invalid:** Server sends `{"error":"Invalid email or password"}` with status 401
13. Back in the browser, `fetch()` receives the response
14. `api.js` parses the JSON and returns the user object (or throws an error)
15. `LoginPage.jsx` calls `onLogin(user)` which is actually `setUser(userData)` in `App.jsx`
16. React re-renders: since `user` is no longer `null`, `App.jsx` now renders `<Navbar>` + `<FeedPage>`
17. `FeedPage` mounts and immediately calls `fetchAllUsers()` to populate the user grid

---

## 8. File-by-File Breakdown

### Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `main.cpp` | ~208 | Everything: User class, SocialNetwork class, test data, API endpoints, main() |
| `server.hpp` | ~38 | Helper functions: JSON parsing, server startup |
| `include/httplib.h` | Large | Third-party library that lets C++ act as an HTTP server |
| `CMakeLists.txt` | 7 | Tells CMake how to compile the project |

### Frontend Files

| File | Purpose |
|------|---------|
| `index.html` | Single HTML page with Inter font, meta tags, and the `<div id="root">` that React mounts into |
| `vite.config.js` | Dev server config: port 5173, API proxy to port 8080 |
| `src/main.jsx` | Entry point — renders `<App />` into the DOM |
| `src/App.jsx` | Root component — manages login state, shows Login or Feed |
| `src/App.css` | Minimal root styles |
| `src/index.css` | **Design system** — all colors, fonts, animations, utility classes |
| `src/api.js` | **API layer** — `loginUser()` and `fetchAllUsers()` functions |
| `src/components/LoginPage.jsx` | Login form with validation, loading state, error handling |
| `src/components/LoginPage.css` | Login styles — animated orbs, glassmorphic card, gradient button |
| `src/components/Navbar.jsx` | Top navbar with logo, search, user dropdown menu |
| `src/components/Navbar.css` | Navbar styles — glassmorphism, responsive layout |
| `src/components/FeedPage.jsx` | Main feed — fetches users, shows welcome banner + user grid |
| `src/components/FeedPage.css` | Feed styles — responsive grid, skeleton loaders, error state |
| `src/components/UserCard.jsx` | Individual user card — avatar, stats, add friend button |
| `src/components/UserCard.css` | Card styles — hover lift, staggered animation |
| `src/components/ProfileModal.jsx` | Profile popup — banner, details, action buttons |
| `src/components/ProfileModal.css` | Modal styles — blurred overlay, slide-up animation |

---

> **Key takeaway:** The C++ backend is the data layer (like a database + API), and the React frontend is the presentation layer (what users see). They communicate over HTTP using JSON — the universal language both sides understand. Vite's proxy makes this seamless during development.
