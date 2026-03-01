import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import instagramMark from "../assets/instagram-mark.svg";
import { DEFAULT_PROFILE_PIC } from "../utils/defaultProfilePic";
import { getUserProfilePic } from "../utils/userProfilePic";
import "./Navbar.css";

function Avatar({ user, size = 26 }) {
	const [imageError, setImageError] = useState(false);
	const initials = (user?.name || user?.userName || "U")
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	useEffect(() => {
		setImageError(false);
	}, [user?.profilePic, user?.userName]);

	const imageSrc = getUserProfilePic(user) || DEFAULT_PROFILE_PIC;

	if (imageSrc && !imageError) {
		return (
			<img
				src={imageSrc}
				alt={user?.name}
				onError={() => setImageError(true)}
				style={{
					width: size,
					height: size,
					borderRadius: "50%",
					objectFit: "cover",
					display: "block",
				}}
			/>
		);
	}
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				background: "#333",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: size * 0.38,
				fontWeight: 700,
				color: "#fff",
			}}
		>
			{initials}
		</div>
	);
}

export default function Navbar({ user, onLogout, onUpdateUser }) {
	const navigate = useNavigate();
	const location = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [displayName, setDisplayName] = useState(user?.name || "");
	const [profilePicDraft, setProfilePicDraft] = useState(
		user?.profilePic || "",
	);
	const [settingsMsg, setSettingsMsg] = useState("");
	const [settingsError, setSettingsError] = useState(false);
	const moreRef = useRef(null);
	const profilePicInputRef = useRef(null);

	// Sync display name / avatar draft when the user object changes externally
	// Use refs to avoid setState-in-effect anti-pattern
	const prevName = useRef(user?.name);
	const prevPic = useRef(user?.profilePic);
	if (prevName.current !== user?.name) {
		prevName.current = user?.name;
		setDisplayName(user?.name || "");
	}
	if (prevPic.current !== user?.profilePic) {
		prevPic.current = user?.profilePic;
		setProfilePicDraft(user?.profilePic || "");
	}

	// Close more menu on outside click
	useEffect(() => {
		const handler = (e) => {
			if (moreRef.current && !moreRef.current.contains(e.target)) {
				setMoreOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const currentPath = location.pathname;

	const navItems = [
		{
			id: "home",
			label: "Home",
			path: "/",
			icon: (active) => (
				<svg viewBox="0 0 24 24">
					<path
						d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
						fill={active ? "currentColor" : "none"}
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinejoin="round"
					/>
				</svg>
			),
		},
		{
			id: "search",
			label: "Search",
			path: "/explore",
			icon: () => (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				>
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
			),
		},
		{
			id: "reels",
			label: "Reels",
			path: "/reels",
			icon: () => (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<rect x="2" y="2" width="20" height="20" rx="5" />
					<path d="M9 2v20" />
					<path d="M2 9h20" />
					<path d="M15 2l-4 7" />
					<path d="M2 15l7-4" />
				</svg>
			),
		},
		{
			id: "messages",
			label: "Messages",
			path: "/messages",
			icon: () => (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polygon points="3 11 22 2 13 21 11 13 3 11" />
				</svg>
			),
		},
		{
			id: "notifications",
			label: "Notifications",
			path: "/notifications",
			icon: () => (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
					<path d="M13.73 21a2 2 0 0 1-3.46 0" />
				</svg>
			),
		},
		{
			id: "create",
			label: "Create",
			path: "/",
			icon: () => (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				>
					<rect x="3" y="3" width="18" height="18" rx="4" />
					<line x1="12" y1="8" x2="12" y2="16" />
					<line x1="8" y1="12" x2="16" y2="12" />
				</svg>
			),
		},
		{
			id: "profile",
			label: "Profile",
			path: "/profile",
			icon: null, // uses avatar
		},
	];

	const handleNavClick = (item) => {
		if (item.action) {
			item.action();
		} else if (item.path) {
			navigate(item.path);
		}
		setMoreOpen(false);
	};

	const handleSaveSettings = (e) => {
		e.preventDefault();
		const trimmed = displayName.trim();
		if (!trimmed) {
			setSettingsError(true);
			setSettingsMsg("Display name can't be empty.");
			return;
		}
		onUpdateUser?.({ ...user, name: trimmed, profilePic: profilePicDraft });
		setSettingsError(false);
		setSettingsMsg("Saved successfully!");
	};

	const handleProfilePicChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => setProfilePicDraft(reader.result);
		reader.readAsDataURL(file);
	};

	const isActive = (item) => {
		if (!item.path) return false;
		if (item.path === "/") return currentPath === "/";
		return currentPath.startsWith(item.path);
	};

	return (
		<>
			<nav className="ig-sidebar collapsed">
				{/* Logo */}
				<div className="ig-sidebar-logo">
					<span className="ig-sidebar-logo-icon">
						<img src={instagramMark} alt="Instagram" />
					</span>
				</div>

				{/* Nav items */}
				<div className="ig-sidebar-nav">
					{navItems.map((item) => {
						const active = isActive(item);
						return (
							<button
								key={item.id}
								className={`ig-nav-item${active ? " active" : ""}`}
								data-nav={item.id}
								onClick={() => handleNavClick(item)}
								title={item.label}
							>
								<div className="ig-nav-item-icon">
									{item.id === "profile" ?
										<Avatar user={user} size={26} />
									:	item.icon(active)}
								</div>
							</button>
						);
					})}
				</div>

				{/* Bottom - More */}
				<div className="ig-sidebar-bottom" ref={moreRef}>
					<button
						className="ig-nav-item"
						onClick={() => setMoreOpen((p) => !p)}
						title="More"
					>
						<div className="ig-nav-item-icon">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
							>
								<line x1="3" y1="12" x2="21" y2="12" />
								<line x1="3" y1="6" x2="21" y2="6" />
								<line x1="3" y1="18" x2="21" y2="18" />
							</svg>
						</div>
					</button>

					{moreOpen && (
						<div className="ig-more-menu">
							<button
								className="ig-more-menu-item"
								onClick={() => {
									setSettingsOpen(true);
									setMoreOpen(false);
								}}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeLinecap="round"
								>
									<circle cx="12" cy="12" r="3" />
									<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06A2 2 0 0 1 17 19.4a2 2 0 0 1-.06-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H15a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 16.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 21 4.68V4.5A2 2 0 0 1 19.5 2.5h-.09a1.65 1.65 0 0 0-1.51 1A1.65 1.65 0 0 0 16.6 5a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 0 1-2.83-2.83" />
								</svg>
								Settings
							</button>
							<div className="ig-more-menu-divider" />
							<button
								className="ig-more-menu-item danger"
								onClick={() => {
									setMoreOpen(false);
									onLogout?.();
								}}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeLinecap="round"
								>
									<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
									<polyline points="16 17 21 12 16 7" />
									<line x1="21" y1="12" x2="9" y2="12" />
								</svg>
								Log out
							</button>
						</div>
					)}
				</div>
			</nav>

			{/* Settings modal */}
			{settingsOpen && (
				<div
					className="ig-settings-overlay"
					onClick={() => setSettingsOpen(false)}
				>
					<div
						className="ig-settings-modal animate-scale-in"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="ig-settings-header">
							<h2>Edit profile</h2>
							<button
								className="ig-settings-close"
								onClick={() => setSettingsOpen(false)}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>

						<form onSubmit={handleSaveSettings}>
							<div className="ig-settings-body">
								{/* Avatar row */}
								<div className="ig-settings-photo-row">
									<div className="ig-settings-avatar">
										{profilePicDraft ?
											<img
												src={profilePicDraft}
												alt="preview"
											/>
										:	(displayName || "U")[0].toUpperCase()}
									</div>
									<div className="ig-settings-photo-btns">
										<p
											style={{
												fontWeight: 600,
												fontSize: 15,
												marginBottom: 4,
											}}
										>
											{user?.userName}
										</p>
										<button
											type="button"
											className="ig-settings-upload-btn"
											onClick={() =>
												profilePicInputRef.current?.click()
											}
										>
											Change profile photo
										</button>
										{profilePicDraft && (
											<button
												type="button"
												className="ig-settings-remove-btn"
												onClick={() =>
													setProfilePicDraft("")
												}
											>
												Remove photo
											</button>
										)}
										<input
											ref={profilePicInputRef}
											type="file"
											accept="image/*"
											style={{ display: "none" }}
											onChange={handleProfilePicChange}
										/>
									</div>
								</div>

								{/* Name field */}
								<div className="ig-settings-field">
									<label className="ig-settings-label">
										Name
									</label>
									<input
										className="ig-settings-input"
										type="text"
										value={displayName}
										maxLength={50}
										onChange={(e) =>
											setDisplayName(e.target.value)
										}
									/>
								</div>

								{settingsMsg && (
									<div
										className={`ig-settings-message${settingsError ? " error" : ""}`}
									>
										{settingsMsg}
									</div>
								)}
							</div>

							<div className="ig-settings-actions">
								<button
									type="button"
									className="ig-btn ig-btn-secondary"
									onClick={() => setSettingsOpen(false)}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="ig-btn ig-btn-primary"
								>
									Submit
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
