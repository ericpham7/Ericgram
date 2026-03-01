const LOCAL_API_BASE = "http://127.0.0.1:8080/api";
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
const isLocalBrowser =
	typeof window !== "undefined" &&
	["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
const API_BASE =
	configuredApiBase || (isLocalBrowser ? LOCAL_API_BASE : "/api");
const API_ORIGIN =
	API_BASE.startsWith("http") ? API_BASE.replace(/\/api$/, "") : "";
const BLOCKED_POST_MEDIA_FRAGMENTS = ["/assets/ebkjaaybo.jpg"];

// ─── Current-user tracking ───────────────────────────────────────────────────
// Call setCurrentUser(userName) after login / session restore so that all
// authorizeActor-protected endpoints automatically receive X-Auth-User.

let _currentUserName = "";

export function setCurrentUser(userName) {
	_currentUserName = userName || "";
}

/** Returns headers that include X-Auth-User whenever we have a logged-in user */
function authHeaders(extra = {}) {
	const h = { ...extra };
	if (_currentUserName) h["X-Auth-User"] = _currentUserName;
	return h;
}

async function parseError(response, fallbackMessage) {
	try {
		const data = await response.json();
		return data?.error || fallbackMessage;
	} catch {
		if (response.status >= 500) {
			return `Server error (${response.status})`;
		}
		return fallbackMessage;
	}
}

function makeHttpError(message, status) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function buildApiUrl(path) {
	return `${API_BASE}${path}`;
}

function resolveApiAssetUrl(url) {
	if (!url) return "";
	if (
		/^(?:https?:)?\/\//.test(url) ||
		url.startsWith("data:") ||
		!url.startsWith("/")
	) {
		return url;
	}
	return API_ORIGIN ? `${API_ORIGIN}${url}` : url;
}

function normalizePost(post) {
	if (!post || typeof post !== "object") {
		return post;
	}

	const media =
		Array.isArray(post.media) ?
			post.media.map((item) => ({
				...item,
				url: resolveApiAssetUrl(item?.url || ""),
			}))
		:	[];

	const mediaIds = media.map((item) => item?.mediaId).filter(Boolean);

	const mediaTypes = media.map((item) => {
		if (item?.kind) return item.kind;
		return item?.mimeType?.startsWith("video/") ? "video" : "image";
	});

	return {
		...post,
		media,
		mediaIds,
		mediaTypes,
		likeCount:
			post.likeCount ??
			(Array.isArray(post.likedBy) ? post.likedBy.length : 0),
		commentCount:
			post.commentCount ??
			(Array.isArray(post.comments) ? post.comments.length : 0),
	};
}

function isBlockedPost(post) {
	if (!post || typeof post !== "object") return false;

	const mediaUrls =
		Array.isArray(post.media) ?
			post.media.map((item) => item?.url || "")
		:	[];
	const mediaIds = Array.isArray(post.mediaIds) ? post.mediaIds : [];

	return [...mediaUrls, ...mediaIds].some((value) =>
		BLOCKED_POST_MEDIA_FRAGMENTS.some((fragment) =>
			String(value || "").includes(fragment),
		),
	);
}

function normalizePostListPayload(payload) {
	const items =
		Array.isArray(payload?.items) ? payload.items
		: Array.isArray(payload?.posts) ? payload.posts
		: [];
	const normalizedPosts = items
		.map(normalizePost)
		.filter((post) => !isBlockedPost(post));
	return {
		...payload,
		items: normalizedPosts,
		posts: normalizedPosts,
	};
}

function normalizeSinglePostPayload(payload) {
	if (!payload || typeof payload !== "object" || !payload.post) {
		return payload;
	}
	return {
		...payload,
		post: normalizePost(payload.post),
	};
}

function normalizeUsersPayload(payload) {
	const users =
		Array.isArray(payload) ? payload
		: Array.isArray(payload?.users) ? payload.users
		: [];
	return {
		users,
	};
}

function normalizeMessagesPayload(payload) {
	const messages =
		Array.isArray(payload) ? payload
		: Array.isArray(payload?.messages) ? payload.messages
		: [];
	return {
		messages,
	};
}

async function apiFetch(path, options) {
	try {
		return await fetch(buildApiUrl(path), options);
	} catch {
		const backendLabel =
			API_BASE.startsWith("http") ?
				API_BASE.replace(/\/api$/, "")
			:	"the EricGram API";
		throw new Error(
			`Cannot reach ${backendLabel}. Start the C++ backend on port 8080.`,
		);
	}
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginUser(email, password) {
	const response = await apiFetch("/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ email, password }),
	});
	if (!response.ok) {
		throw makeHttpError(
			await parseError(response, "Invalid email or password"),
			response.status,
		);
	}
	return response.json();
}

export async function loginWithGoogle({
	email,
	name = "",
	profilePic = "",
	suggestedUserName = "",
}) {
	const response = await apiFetch("/auth/google", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ email, name, profilePic, suggestedUserName }),
	});
	if (!response.ok) {
		throw makeHttpError(
			await parseError(response, "Google sign in failed"),
			response.status,
		);
	}
	return response.json();
}

export async function fetchAuthSession() {
	const response = await apiFetch("/auth/me", { credentials: "include" });
	if (!response.ok)
		throw new Error(await parseError(response, "No active session"));
	return response.json();
}

export async function logoutUser() {
	const response = await apiFetch("/auth/logout", {
		method: "POST",
		credentials: "include",
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Logout failed"));
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
	const response = await apiFetch("/signup", {
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
		throw makeHttpError(
			await parseError(response, "Sign up failed"),
			response.status,
		);
	}
	return response.json();
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function fetchAllUsers() {
	const response = await apiFetch("/users");
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to fetch users"));
	return normalizeUsersPayload(await response.json());
}

export async function followUser(userName, friendUserName) {
	const response = await apiFetch("/friends/add", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userName, friendUserName }),
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to follow user"));
	return response.json();
}

export async function unfollowUser(userName, friendUserName) {
	const response = await apiFetch("/friends/remove", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userName, friendUserName }),
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to unfollow user"));
	return response.json();
}

// alias
export const addFriend = followUser;
export const removeFriend = unfollowUser;

// ─── Posts ───────────────────────────────────────────────────────────────────

export async function fetchPosts(
	viewerUserName,
	page = 1,
	limit = 30,
	query = "",
) {
	const params = new URLSearchParams({
		viewer: viewerUserName || "",
		page: String(page),
		limit: String(limit),
		q: query || "",
	});
	const response = await apiFetch(`/posts?${params}`);
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to fetch posts"));
	return normalizePostListPayload(await response.json());
}

export async function createPost(authorUserName, caption, files) {
	const form = new FormData();
	form.append("authorUserName", authorUserName);
	form.append("caption", caption);
	for (const file of files) {
		form.append("mediaFiles", file);
	}
	const response = await apiFetch("/posts/create", {
		method: "POST",
		credentials: "include",
		headers: authHeaders(), // ← X-Auth-User
		body: form,
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to create post"));
	return normalizeSinglePostPayload(await response.json());
}

export async function likePost(postId, actorUserName) {
	const response = await apiFetch("/posts/like", {
		method: "POST",
		headers: authHeaders({ "Content-Type": "application/json" }), // ← X-Auth-User
		credentials: "include",
		body: JSON.stringify({ postId, actorUserName }),
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to like post"));
	return normalizeSinglePostPayload(await response.json());
}

export async function savePost(postId, actorUserName) {
	const response = await apiFetch("/posts/save", {
		method: "POST",
		headers: authHeaders({ "Content-Type": "application/json" }), // ← X-Auth-User
		credentials: "include",
		body: JSON.stringify({ postId, actorUserName }),
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to save post"));
	return response.json();
}

export async function addComment(postId, actorUserName, text) {
	const form = new FormData();
	form.append("postId", postId);
	form.append("actorUserName", actorUserName);
	form.append("text", text);
	const response = await apiFetch("/posts/comment/add", {
		method: "POST",
		credentials: "include",
		headers: authHeaders(), // ← X-Auth-User
		body: form,
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to add comment"));
	return normalizeSinglePostPayload(await response.json());
}

export async function deleteComment(postId, commentId, actorUserName) {
	const response = await apiFetch("/posts/comment/delete", {
		method: "POST",
		headers: authHeaders({ "Content-Type": "application/json" }), // ← X-Auth-User
		credentials: "include",
		body: JSON.stringify({ postId, commentId, actorUserName }),
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to delete comment"));
	return normalizeSinglePostPayload(await response.json());
}

export async function deletePost(postId, actorUserName) {
	const response = await apiFetch("/posts/delete", {
		method: "POST",
		headers: authHeaders({ "Content-Type": "application/json" }), // ← X-Auth-User
		credentials: "include",
		body: JSON.stringify({ postId, actorUserName }),
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to delete post"));
	return normalizeSinglePostPayload(await response.json());
}

export function getMediaUrl(mediaId) {
	return buildApiUrl(`/posts/media?mediaId=${encodeURIComponent(mediaId)}`);
}

// ─── Feed (Instagram-synced) ─────────────────────────────────────────────────

export async function fetchFeed({
	cursor = "",
	limit = 15,
	source = "instagram",
} = {}) {
	const params = new URLSearchParams();
	if (cursor) params.set("cursor", cursor);
	params.set("limit", String(limit));
	if (source && source !== "all") params.set("source", source);
	const response = await apiFetch(`/feed?${params}`);
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to fetch feed"));
	return response.json();
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function sendMessage(from, to, text, file = null) {
	let body;
	let headers = {};

	if (file) {
		body = new FormData();
		body.append("from", from);
		body.append("to", to);
		body.append("text", text || "");
		body.append("mediaFile", file);
		// Note: Fetch sets correct multipart boundary when body is FormData
	} else {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify({ from, to, text });
	}

	const response = await apiFetch("/messages/send", {
		method: "POST",
		headers,
		body,
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to send message"));
	return response.json();
}

export async function getMessages(user1, user2) {
	const response = await apiFetch(
		`/messages?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`,
	);
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to fetch messages"));
	return normalizeMessagesPayload(await response.json());
}

// ─── Admin Instagram ─────────────────────────────────────────────────────────

export async function listInstagramConnections() {
	const response = await apiFetch("/admin/instagram/connections", {
		credentials: "include",
	});
	if (!response.ok)
		throw new Error(
			await parseError(response, "Failed to list connections"),
		);
	return response.json();
}

export async function startInstagramOAuth() {
	const response = await apiFetch("/admin/instagram/oauth/start", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to start OAuth"));
	return response.json();
}

export async function syncInstagramConnection(connectionId) {
	const response = await apiFetch(
		`/admin/instagram/connections/${connectionId}/sync`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to sync"));
	return response.json();
}

export async function disconnectInstagramConnection(connectionId) {
	const response = await apiFetch(
		`/admin/instagram/connections/${connectionId}`,
		{ method: "DELETE", credentials: "include" },
	);
	if (!response.ok)
		throw new Error(await parseError(response, "Failed to disconnect"));
	return response.json();
}
