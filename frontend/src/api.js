const API_BASE = "/api";

async function parseError(response, fallbackMessage) {
  try {
    const data = await response.json();
    return data?.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Invalid email or password"));
  }

  return response.json();
}

export async function fetchAuthSession() {
  const response = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "No active session"));
  }

  return response.json();
}

export async function logoutUser() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Logout failed"));
  }

  return response.json();
}

export async function signupUser({
  userName,
  name,
  phoneNumber,
  email,
  password,
  instagramHandle = "",
  profilePic = "",
}) {
  const response = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName,
      name,
      phoneNumber,
      email,
      password,
      instagramHandle,
      profilePic,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Sign up failed"));
  }

  return response.json();
}

export async function fetchAllUsers() {
  const response = await fetch(`${API_BASE}/users`);

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch users"));
  }

  return response.json();
}

export async function fetchPosts(viewerUserName, page = 1, limit = 30, query = "") {
  const safeViewer = encodeURIComponent(viewerUserName || "");
  const safePage = encodeURIComponent(String(page));
  const safeLimit = encodeURIComponent(String(limit));
  const safeQuery = encodeURIComponent(query || "");

  const response = await fetch(
    `${API_BASE}/posts?viewer=${safeViewer}&page=${safePage}&limit=${safeLimit}&q=${safeQuery}`,
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch posts"));
  }

  return response.json();
}

export async function fetchFeed({ cursor = "", limit = 15, source = "instagram" } = {}) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));
  if (source && source !== "all") params.set("source", source);

  const response = await fetch(`${API_BASE}/feed?${params.toString()}`);

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch feed"));
  }

  return response.json();
}

export async function addFriend(userName, friendUserName) {
  const response = await fetch(`${API_BASE}/friends/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, friendUserName }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to add friend"));
  }

  return response.json();
}

export async function sendMessage(from, to, text) {
  const response = await fetch(`${API_BASE}/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, text }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to send message"));
  }

  return response.json();
}

export async function getMessages(user1, user2) {
  const response = await fetch(
    `${API_BASE}/messages?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`,
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch messages"));
  }

  return response.json();
}

// Admin Instagram (OAuth connections, sync, disconnect)
export async function listInstagramConnections() {
  const response = await fetch(`${API_BASE}/admin/instagram/connections`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to list Instagram connections"));
  }

  return response.json();
}

export async function startInstagramOAuth() {
  const response = await fetch(`${API_BASE}/admin/instagram/oauth/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to start Instagram OAuth"));
  }

  return response.json();
}

export async function syncInstagramConnection(connectionId) {
  const response = await fetch(
    `${API_BASE}/admin/instagram/connections/${connectionId}/sync`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to sync connection"));
  }

  return response.json();
}

export async function disconnectInstagramConnection(connectionId) {
  const response = await fetch(
    `${API_BASE}/admin/instagram/connections/${connectionId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to disconnect connection"));
  }

  return response.json();
}
