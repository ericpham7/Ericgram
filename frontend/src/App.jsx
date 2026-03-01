import { useEffect, useState } from "react";
import {
	Navigate,
	Route,
	Routes,
	useNavigate,
	useParams,
} from "react-router-dom";
import LoginPage from "./components/LoginPage";
import MediaFeedPage from "./components/MediaFeedPage";
import ExplorePage from "./components/ExplorePage";
import ReelsPage from "./components/ReelsPage";
import MessagesPage from "./components/MessagesPage";
import ProfilePage from "./components/ProfilePage";
import FeedPage from "./components/FeedPage";
import Navbar from "./components/Navbar";
import { fetchAuthSession, logoutUser, setCurrentUser } from "./api";
import "./App.css";

// ─── Route guard ─────────────────────────────────────────────────────────────
// Declared OUTSIDE of any component so React never recreates it mid-render.

function RequireAuth({ user, children }) {
	return user ? children : <Navigate to="/login" replace />;
}

// ─── Profile route wrapper (needs useParams) ──────────────────────────────────
function ProfileRoute({ currentUser, onUpdateUser }) {
	const { username } = useParams();
	return (
		<ProfilePage
			currentUser={currentUser}
			targetUserName={username}
			onUpdateUser={onUpdateUser}
		/>
	);
}

// ─── Notifications placeholder ────────────────────────────────────────────────
function NotificationsPage() {
	return (
		<div className="ig-placeholder-page">
			<div className="ig-placeholder-card">
				<svg
					width="52"
					height="52"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
				>
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
					<path d="M13.73 21a2 2 0 0 1-3.46 0" />
				</svg>
				<h2>Notifications</h2>
				<p>You're all caught up!</p>
				<span className="ig-placeholder-pill">No new alerts</span>
			</div>
		</div>
	);
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
	const [user, setUser] = useState(null);
	const [role, setRole] = useState("user");
	const [searchQuery, setSearchQuery] = useState("");
	const [checkingSession, setCheckingSession] = useState(true);
	const navigate = useNavigate();

	useEffect(() => {
		let cancelled = false;
		fetchAuthSession()
			.then((session) => {
				if (cancelled) return;
				const u = session.user || null;
				setUser(u);
				setRole(session.role || "user");
				setCurrentUser(u?.userName || ""); // ← register for X-Auth-User
			})
			.catch(() => {
				if (cancelled) return;
				setUser(null);
				setRole("user");
				setCurrentUser("");
			})
			.finally(() => {
				if (!cancelled) setCheckingSession(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleLogin = (authPayload) => {
		const u = authPayload?.user ?? authPayload;
		setUser(u);
		setRole(authPayload?.role || "user");
		setCurrentUser(u?.userName || ""); // ← register for X-Auth-User
		navigate("/");
	};

	const handleLogout = async () => {
		try {
			await logoutUser();
		} catch {
			/* best-effort */
		}
		setCurrentUser(""); // ← clear
		setUser(null);
		setRole("user");
		navigate("/login");
	};

	if (checkingSession) {
		return (
			<div className="app-loading">
				<div className="ig-spinner" />
			</div>
		);
	}

	return (
		<div className="app" id="app">
			{user && (
				<Navbar
					user={user}
					onLogout={handleLogout}
					onUpdateUser={setUser}
				/>
			)}

			<Routes>
				{/* ── Public ── */}
				<Route
					path="/login"
					element={
						!user ?
							<LoginPage onLogin={handleLogin} />
						:	<Navigate to="/" replace />
					}
				/>

				{/* ── Home feed ── */}
				<Route
					path="/"
					element={
						<RequireAuth user={user}>
							<MediaFeedPage
								currentUser={user}
								searchQuery={searchQuery}
								role={role}
								onUpdateUser={setUser}
							/>
						</RequireAuth>
					}
				/>

				{/* ── Explore ── */}
				<Route
					path="/explore"
					element={
						<RequireAuth user={user}>
							<ExplorePage
								currentUser={user}
								searchQuery={searchQuery}
								setSearchQuery={setSearchQuery}
							/>
						</RequireAuth>
					}
				/>

				{/* ── Reels ── */}
				<Route
					path="/reels"
					element={
						<RequireAuth user={user}>
							<ReelsPage currentUser={user} />
						</RequireAuth>
					}
				/>

				{/* ── Direct messages ── */}
				<Route
					path="/messages"
					element={
						<RequireAuth user={user}>
							<MessagesPage currentUser={user} />
						</RequireAuth>
					}
				/>

				{/* ── Own profile ── */}
				<Route
					path="/profile"
					element={
						<RequireAuth user={user}>
							<ProfilePage
								currentUser={user}
								onUpdateUser={setUser}
							/>
						</RequireAuth>
					}
				/>

				{/* ── Another user's profile ── */}
				<Route
					path="/profile/:username"
					element={
						<RequireAuth user={user}>
							<ProfileRoute
								currentUser={user}
								onUpdateUser={setUser}
							/>
						</RequireAuth>
					}
				/>

				{/* ── People / friends ── */}
				<Route
					path="/people"
					element={
						<RequireAuth user={user}>
							<FeedPage
								currentUser={user}
								searchQuery={searchQuery}
								onUpdateUser={setUser}
							/>
						</RequireAuth>
					}
				/>

				{/* ── Notifications ── */}
				<Route
					path="/notifications"
					element={
						<RequireAuth user={user}>
							<NotificationsPage />
						</RequireAuth>
					}
				/>

				{/* ── Catch-all ── */}
				<Route
					path="*"
					element={<Navigate to={user ? "/" : "/login"} replace />}
				/>
			</Routes>
		</div>
	);
}

export default App;
