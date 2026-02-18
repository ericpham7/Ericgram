// ============================================
// API SERVICE LAYER
// This file contains functions that send HTTP requests to the C++ backend
// It's the BRIDGE between React (frontend) and C++ (backend)
// ============================================

// const = declares a variable that can't be reassigned (but its contents can change)
// "/api" = the base URL path — Vite's proxy forwards anything starting with /api to port 8080
const API_BASE = "/api";

// ============================================
// LOGIN FUNCTION
// Called by: LoginPage.jsx when user clicks "Sign In"
// Sends: POST request with email + password to C++ server
// Returns: user object { userName, name, email, friendsCount } on success
// Throws: Error on failure (caught by LoginPage's try/catch)
// ============================================

// "export" = makes this function importable by other files
// "async" = marks this function as asynchronous (it does network requests that take time)
//           allows using "await" inside it
// "function loginUser(email, password)" = takes the two values from the login form
export async function loginUser(email, password) {
  // "await" = pause here until fetch() completes (the server responds)
  //           without await, the code would continue before the response arrives
  // "fetch()" = built-in browser function that sends an HTTP request
  // `${API_BASE}/login` = template literal, evaluates to "/api/login"
  //   → backticks (`) allow ${variable} interpolation inside strings
  const response = await fetch(`${API_BASE}/login`, {
    // The second argument to fetch() is an options object { key: value, ... }

    // method: "POST" = we're SENDING data to the server (not just requesting)
    //         This matches server.Post("/api/login", ...) in main.cpp
    method: "POST",

    // headers: metadata about the request
    // "Content-Type": "application/json" = tells the server "the body is JSON format"
    //   → This is why CORS needs to allow "Content-Type" in Access-Control-Allow-Headers
    headers: { "Content-Type": "application/json" },

    // body: the actual data being sent
    // JSON.stringify() converts a JavaScript object → a JSON string
    // { email, password } is shorthand for { email: email, password: password }
    //   → Result: '{"email":"ERICPHAM0902@GMAIL.COM","password":"password123"}'
    //   → This string becomes req.body in the C++ server
    body: JSON.stringify({ email, password }),
  });

  // response.ok = true if status code is 200-299 (success), false otherwise
  // The C++ server returns status 401 if login fails, so response.ok would be false
  if (!response.ok) {
    // response.json() = parse the response body from a JSON string into a JS object
    //   → The C++ server sends: {"error":"Invalid email or password"}
    //   → .json() converts it to: { error: "Invalid email or password" }
    // .catch(() => ...) = if parsing fails for any reason, use a fallback error object
    const error = await response
      .json()
      .catch(() => ({ error: "Login failed" }));

    // "throw new Error()" = creates an error and exits this function immediately
    //   → The calling code (LoginPage) catches this in its catch(err) block
    // error.error = the "error" property from the JSON object
    //   → "Invalid email or password" (from C++ server) OR fallback string
    throw new Error(error.error || "Invalid email or password");
  }

  // If we reach here, login was successful (status 200)
  // response.json() parses the C++ server's response:
  //   '{"userName":"ericphXm","name":"Eric Pham",...}' → { userName: "ericphXm", name: "Eric Pham", ... }
  // This returned object becomes the "user" in: const user = await loginUser(email, password)
  return response.json();
}

// ============================================
// FETCH ALL USERS FUNCTION
// Called by: FeedPage.jsx when it loads (and when refresh button is clicked)
// Sends: GET request to C++ server
// Returns: array of user objects [{ userName, name, email, friendsCount }, ...]
// ============================================
export async function fetchAllUsers() {
  // GET is the default method for fetch(), so no options object needed
  // This matches server.Get("/api/users", ...) in main.cpp
  const response = await fetch(`${API_BASE}/users`);

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  // Parse the JSON array from C++ server:
  //   '[{"userName":"ericphXm",...},{"userName":"alice123",...}]'
  //   → [ { userName: "ericphXm", ... }, { userName: "alice123", ... } ]
  return response.json();
}

// ============================================
// ADD FRIEND FUNCTION
// Called by: UserCard and ProfileModal when "Add Friend" is clicked
// Sends: POST with { userName, friendUserName } to C++ server
// Returns: updated user object with new friendsCount
// ============================================
export async function addFriend(userName, friendUserName) {
  const response = await fetch(`${API_BASE}/friends/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // userName = the logged-in user, friendUserName = the user to add
    body: JSON.stringify({ userName, friendUserName }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to add friend" }));
    throw new Error(error.error || "Failed to add friend");
  }

  return response.json();
}

// ============================================
// SEND MESSAGE FUNCTION
// Called by: ChatModal when user sends a message
// Sends: POST with { from, to, text } to C++ server
// ============================================
export async function sendMessage(from, to, text) {
  const response = await fetch(`${API_BASE}/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, text }),
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  return response.json();
}

// ============================================
// GET MESSAGES FUNCTION
// Called by: ChatModal when it opens (loads conversation history)
// Sends: GET with query params ?user1=X&user2=Y to C++ server
// Returns: array of message objects [{ from, to, text, timestamp }, ...]
// ============================================
export async function getMessages(user1, user2) {
  // Template literal builds URL with query parameters:
  //   "/api/messages?user1=ericphXm&user2=alice123"
  const response = await fetch(
    `${API_BASE}/messages?user1=${user1}&user2=${user2}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }

  return response.json();
}
