import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
	fetchPosts,
	fetchAllUsers,
	followUser,
	unfollowUser,
	likePost,
} from "../api";
import InstagramEditProfileModal from "./InstagramEditProfileModal";
import { DEFAULT_PROFILE_PIC } from "../utils/defaultProfilePic";
import { getUserProfilePic } from "../utils/userProfilePic";
import { navigateToProfile } from "../utils/profileNavigation";
import "./ProfilePage.css";

const MEDIA_BASE = "/api/posts/media?mediaId=";
function mediaUrl(id) {
	return id ? `${MEDIA_BASE}${encodeURIComponent(id)}` : null;
}

function Avatar({ user, size = 77 }) {
	const [imageError, setImageError] = useState(false);
	const initials = (user?.name || user?.userName || "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	useEffect(() => {
		setImageError(false);
	}, [user?.profilePic, user?.userName]);

	const imageSrc = getUserProfilePic(user) || DEFAULT_PROFILE_PIC;

	if (imageSrc && !imageError) {
		return (
			<img
				src={imageSrc}
				alt={user.userName}
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
			className="ig-avatar-fallback"
			style={{
				width: size,
				height: size,
				fontSize: size * 0.35,
				borderRadius: "50%",
			}}
		>
			{initials}
		</div>
	);
}

function ConnectionsModal({ title, users, emptyLabel, onClose, onUserClick }) {
	return (
		<div
			className="ig-profile-dialog-overlay"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
		>
			<div
				className="ig-profile-dialog"
				onClick={(event) => event.stopPropagation()}
			>
				<header className="ig-profile-dialog-header">
					<h2>{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label={`Close ${title.toLowerCase()} list`}
					>
						×
					</button>
				</header>

				<div className="ig-profile-dialog-list">
					{users.length === 0 ?
						<p className="ig-profile-dialog-empty">{emptyLabel}</p>
					:	users.map((user) => (
							<div
								key={user.userName}
								className="ig-profile-connection-row"
								onClick={() => onUserClick?.(user.userName)}
								onKeyDown={(event) => {
									if (
										event.key === "Enter" ||
										event.key === " "
									) {
										event.preventDefault();
										onUserClick?.(user.userName);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<Avatar user={user} size={44} />
								<div className="ig-profile-connection-meta">
									<strong className="ig-profile-connection-name">
										{user.userName}
									</strong>
									<span className="ig-profile-connection-handle">
										{user.name ||
											user.instagramHandle ||
											"EricGram user"}
									</span>
								</div>
							</div>
						))
					}
				</div>
			</div>
		</div>
	);
}

export default function ProfilePage({
	currentUser,
	targetUserName,
	onUpdateUser,
}) {
	const navigate = useNavigate();
	const viewingUserName = targetUserName || currentUser.userName;
	const isSelf = viewingUserName === currentUser.userName;

	const [profileUser, setProfileUser] = useState(null);
	const [allUsers, setAllUsers] = useState([]);
	const [posts, setPosts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("posts");
	const [isFollowing, setIsFollowing] = useState(false);
	const [selected, setSelected] = useState(null);
	const [connectionsView, setConnectionsView] = useState("");
	const [editProfileOpen, setEditProfileOpen] = useState(false);

	const handleProfileClick = useCallback(
		(userName) => {
			setConnectionsView("");
			navigateToProfile(navigate, userName, currentUser.userName);
		},
		[currentUser.userName, navigate],
	);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [postsData, usersData] = await Promise.all([
				fetchPosts(currentUser.userName, 1, 50),
				fetchAllUsers(),
			]);
			const users = usersData.users || [];
			const fetchedUser = users.find(
				(user) => user.userName === viewingUserName,
			);
			const mergedProfileUser =
				isSelf ?
					{ ...(fetchedUser || {}), ...currentUser }
				:	fetchedUser || currentUser;

			setAllUsers(users);
			setProfileUser(mergedProfileUser);
			setIsFollowing(
				(currentUser.friends || []).includes(viewingUserName),
			);

			const userPosts = (postsData.posts || []).filter(
				(p) => p.authorUserName === viewingUserName,
			);
			setPosts(userPosts);
		} catch {
			/* silent */
		} finally {
			setLoading(false);
		}
	}, [currentUser, viewingUserName, isSelf]);

	useEffect(() => {
		load();
	}, [load]);

	const handleFollow = async () => {
		if (isFollowing) {
			try {
				await unfollowUser(currentUser.userName, viewingUserName);
				const nextFriends = (currentUser.friends || []).filter(
					(u) => u !== viewingUserName,
				);
				onUpdateUser?.({
					...currentUser,
					friends: nextFriends,
					friendsCount: nextFriends.length,
				});
				setIsFollowing(false);
				await load();
			} catch {
				/* silent */
			}
		} else {
			try {
				await followUser(currentUser.userName, viewingUserName);
				const nextFriends = Array.from(
					new Set([...(currentUser.friends || []), viewingUserName]),
				);
				onUpdateUser?.({
					...currentUser,
					friends: nextFriends,
					friendsCount: nextFriends.length,
				});
				setIsFollowing(true);
				await load();
			} catch {
				/* silent */
			}
		}
	};

	const handleLike = async (post) => {
		try {
			const res = await likePost(post.id, currentUser.userName);
			setPosts((prev) =>
				prev.map((p) => (p.id === post.id ? res.post : p)),
			);
			if (selected?.id === post.id) setSelected(res.post);
		} catch {
			/* silent */
		}
	};

	const handleSaveProfile = (updatedUser) => {
		const mergedUser = { ...currentUser, ...updatedUser };
		onUpdateUser?.(mergedUser);
		setProfileUser((prev) => ({ ...(prev || {}), ...mergedUser }));
		setAllUsers((prev) =>
			prev.some((user) => user.userName === mergedUser.userName) ?
				prev.map((user) =>
					user.userName === mergedUser.userName ?
						{ ...user, ...mergedUser }
					:	user,
				)
			:	[...prev, mergedUser],
		);
		setEditProfileOpen(false);
	};

	const likedPosts = posts.filter((p) =>
		(p.likedBy || []).includes(currentUser.userName),
	);
	const reelPosts = posts.filter((p) =>
		(p.mediaTypes || []).some((type) => type === "video"),
	);
	const savedPosts = [];
	const followers = allUsers.filter((user) =>
		(user.friends || []).includes(viewingUserName),
	);
	const following = (profileUser?.friends || [])
		.map(
			(userName) =>
				allUsers.find((user) => user.userName === userName) ||
				(userName === currentUser.userName ? currentUser : null),
		)
		.filter(Boolean);

	let displayPosts = posts;
	if (activeTab === "reels") {
		displayPosts = reelPosts;
	} else if (activeTab === "liked") {
		displayPosts = likedPosts;
	} else if (activeTab === "saved") {
		displayPosts = savedPosts;
	}

	const emptyStateCopy = {
		posts: "No posts yet.",
		reels: "No reels yet.",
		liked: "No liked posts yet.",
		saved: "No saved posts yet.",
	};

	const visibleConnections =
		connectionsView === "followers" ? followers : following;
	const connectionsTitle =
		connectionsView === "followers" ? "Followers" : "Following";
	const connectionsEmptyLabel =
		connectionsView === "followers" ? "No followers yet." : (
			"Not following anyone yet."
		);

	if (loading) {
		return (
			<div className="ig-profile-page">
				<div className="ig-profile-skeleton">
					<div
						className="ig-skeleton-avatar"
						style={{ width: 77, height: 77, borderRadius: "50%" }}
					/>
					<div style={{ flex: 1 }}>
						<div
							className="ig-skeleton-line"
							style={{ width: "30%", marginBottom: 8 }}
						/>
						<div className="ig-skeleton-line shorter" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="ig-profile-page">
			{/* Profile header */}
			<header className="ig-profile-header">
				{isSelf ?
					<button
						type="button"
						className="ig-profile-avatar-wrap ig-profile-avatar-button"
						onClick={() => setEditProfileOpen(true)}
						aria-label="Edit profile photo"
					>
						<Avatar user={profileUser} size={77} />
						<span
							className="ig-profile-avatar-camera"
							aria-hidden="true"
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.9"
							>
								<path d="M4 7h4l1.7-2h4.6L16 7h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
								<circle cx="12" cy="13" r="3.5" />
							</svg>
						</span>
					</button>
				:	<div className="ig-profile-avatar-wrap">
						<Avatar user={profileUser} size={77} />
					</div>
				}

				<div className="ig-profile-info">
					<div className="ig-profile-top-row">
						<h1 className="ig-profile-username">
							{viewingUserName}
						</h1>
						{isSelf ?
							<button
								className="ig-profile-edit-btn"
								type="button"
								onClick={() => setEditProfileOpen(true)}
							>
								Edit profile
							</button>
						:	<button
								type="button"
								className={`ig-profile-follow-btn ${isFollowing ? "following" : ""}`}
								onClick={handleFollow}
							>
								{isFollowing ? "Following" : "Follow"}
							</button>
						}
					</div>

					<div className="ig-profile-stats">
						<span className="ig-profile-stat-pill">
							<strong>{posts.length}</strong> posts
						</span>
						<button
							type="button"
							className="ig-profile-stat-btn"
							onClick={() => setConnectionsView("followers")}
						>
							<strong>{followers.length}</strong> followers
						</button>
						<button
							type="button"
							className="ig-profile-stat-btn"
							onClick={() => setConnectionsView("following")}
						>
							<strong>{following.length}</strong> following
						</button>
					</div>

					<div className="ig-profile-bio">
						<strong className="ig-profile-name">
							{profileUser?.name || viewingUserName}
						</strong>
						{profileUser?.bio && (
							<p className="ig-profile-bio-text">
								{profileUser.bio}
							</p>
						)}
						{profileUser?.instagramHandle && (
							<p className="ig-profile-bio-text">
								📸 @{profileUser.instagramHandle} on Instagram
							</p>
						)}
						{profileUser?.website && (
							<a
								className="ig-profile-link"
								href={
									profileUser.website.startsWith("http") ?
										profileUser.website
									:	`https://${profileUser.website}`
								}
								target="_blank"
								rel="noreferrer"
							>
								{profileUser.website}
							</a>
						)}
					</div>
				</div>
			</header>

			{/* Tabs */}
			<div className="ig-profile-tabs">
				<button
					className={`ig-profile-tab ${activeTab === "posts" ? "active" : ""}`}
					onClick={() => setActiveTab("posts")}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="currentColor"
					>
						<rect x="3" y="3" width="7" height="7" />
						<rect x="14" y="3" width="7" height="7" />
						<rect x="3" y="14" width="7" height="7" />
						<rect x="14" y="14" width="7" height="7" />
					</svg>
					POSTS
				</button>
				<button
					className={`ig-profile-tab ${activeTab === "reels" ? "active" : ""}`}
					onClick={() => setActiveTab("reels")}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<rect x="3" y="3" width="18" height="18" rx="4" />
						<path d="M9 3v18" />
						<path d="M3 9h18" />
					</svg>
					REELS
				</button>
				{isSelf && (
					<button
						className={`ig-profile-tab ${activeTab === "liked" ? "active" : ""}`}
						onClick={() => setActiveTab("liked")}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
						</svg>
						LIKED
					</button>
				)}
				{isSelf && (
					<button
						className={`ig-profile-tab ${activeTab === "saved" ? "active" : ""}`}
						onClick={() => setActiveTab("saved")}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
						</svg>
						SAVED
					</button>
				)}
			</div>

			{/* Posts grid */}
			{displayPosts.length === 0 ?
				<div className="ig-profile-empty">
					<svg
						width="48"
						height="48"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<circle cx="8.5" cy="8.5" r="1.5" />
						<polyline points="21 15 16 10 5 21" />
					</svg>
					<p>{emptyStateCopy[activeTab] || "No posts yet."}</p>
				</div>
			:	<div className="ig-profile-grid">
					{displayPosts.map((post) => {
						const firstMedia = post.mediaIds?.[0];
						return (
							<button
								key={post.id}
								className="ig-profile-grid-cell"
								onClick={() => setSelected(post)}
							>
								{firstMedia ?
									(
										post.mediaTypes?.[0] === "video" ||
										firstMedia.includes("video")
									) ?
										<div className="ig-profile-video-wrap">
											<video
												src={mediaUrl(firstMedia)}
												className="ig-profile-grid-img"
											/>
											<div className="ig-profile-reels-icon">
												<svg
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
												>
													<rect
														x="2"
														y="2"
														width="20"
														height="20"
														rx="5"
													/>
													<path d="M9 3v18" />
													<path d="M3 9h18" />
												</svg>
											</div>
										</div>
									:	<img
											src={mediaUrl(firstMedia)}
											alt=""
											className="ig-profile-grid-img"
										/>

								:	<div className="ig-profile-grid-text">
										<p>{post.caption}</p>
									</div>
								}
								<div className="ig-profile-grid-overlay">
									<span>♥ {(post.likedBy || []).length}</span>
									<span>
										💬 {(post.comments || []).length}
									</span>
								</div>
							</button>
						);
					})}
				</div>
			}

			{/* Lightbox */}
			{selected && (
				<div
					className="ig-lightbox-overlay"
					onClick={() => setSelected(null)}
				>
					<div
						className="ig-lightbox"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="ig-lightbox-close"
							onClick={() => setSelected(null)}
						>
							✕
						</button>
						<div className="ig-lightbox-media">
							{selected.mediaIds?.[0] ?
								(
									selected.mediaTypes?.[0] === "video" ||
									selected.mediaIds[0].includes("video")
								) ?
									<video
										src={mediaUrl(selected.mediaIds[0])}
										className="ig-lightbox-img"
										controls
										autoPlay
										playsInline
									/>
								:	<img
										src={mediaUrl(selected.mediaIds[0])}
										alt=""
										className="ig-lightbox-img"
									/>

							:	<div className="ig-lightbox-no-media">
									<p>{selected.caption}</p>
								</div>
							}
						</div>
						<div className="ig-lightbox-info">
							<div className="ig-lightbox-author">
								<strong>@{selected.authorUserName}</strong>
							</div>
							{selected.caption && (
								<p className="ig-lightbox-caption">
									{selected.caption}
								</p>
							)}
							<div className="ig-lightbox-actions">
								<button
									className={`ig-lightbox-like ${(selected.likedBy || []).includes(currentUser.userName) ? "liked" : ""}`}
									onClick={() => handleLike(selected)}
								>
									♥ {(selected.likedBy || []).length}
								</button>
								<span>
									💬 {(selected.comments || []).length}
								</span>
							</div>
							{(selected.comments || []).slice(-5).map((c) => (
								<div
									key={c.id}
									className="ig-profile-lightbox-comment-row"
								>
									<div className="ig-profile-lightbox-comment-avatar">
										<Avatar
											user={
												c.authorUserName === currentUser.userName ?
													currentUser
												:	{
														userName: c.authorUserName,
														name: c.authorUserName,
													}
											}
											size={24}
										/>
									</div>
									<div className="ig-profile-lightbox-comment">
										<strong>{c.authorUserName}</strong> {c.text}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{connectionsView && (
				<ConnectionsModal
					title={connectionsTitle}
					users={visibleConnections}
					emptyLabel={connectionsEmptyLabel}
					onClose={() => setConnectionsView("")}
					onUserClick={handleProfileClick}
				/>
			)}

			{isSelf && (
				<InstagramEditProfileModal
					isOpen={editProfileOpen}
					user={profileUser || currentUser}
					onClose={() => setEditProfileOpen(false)}
					onSave={handleSaveProfile}
				/>
			)}
		</div>
	);
}
