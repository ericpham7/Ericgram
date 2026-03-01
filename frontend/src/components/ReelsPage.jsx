import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllUsers, fetchFeed, fetchPosts, getMediaUrl } from "../api";
import { DEFAULT_PROFILE_PIC } from "../utils/defaultProfilePic";
import { getUserProfilePic } from "../utils/userProfilePic";
import { navigateToProfile } from "../utils/profileNavigation";
import "./ReelsPage.css";

const REEL_FALLBACK_MEDIA = [
	{ url: "/assets/hero-terrydavis-templeos.gif", type: "gif" },
	{ url: "/assets/hero-yogabbagabba-coachella.gif", type: "gif" },
	{ url: "/assets/hero-youtube-clip.gif", type: "gif" },
];

const REEL_FILLER_USERS = [
	"loopculture",
	"nightshift",
	"editvault",
	"motiondrop",
];
const REEL_FALLBACK_CAPTIONS = [
	"Late night edit dump.",
	"POV: one more take and it worked.",
	"Clean loop, no notes.",
	"Saved this cut for the reels tab.",
	"Short clip, strong timing.",
	"Draft from the camera roll.",
];

function resolveReelSrc(value) {
	if (
		typeof value === "string" &&
		(/^(?:https?:)?\/\//.test(value) ||
			value.startsWith("data:") ||
			value.startsWith("/assets/"))
	) {
		return value;
	}
	return getMediaUrl(value);
}

function normalizeInstagramReels(items = []) {
	return items
		.filter((item) =>
			(Array.isArray(item?.media) ? item.media : []).some(
				(entry) => entry?.type === "video",
			),
		)
		.map((item) => {
			const media = Array.isArray(item?.media) ? item.media : [];
			const firstVideo = media.find((entry) => entry?.type === "video");
			return {
				id: item.id,
				source: "instagram",
				readOnly: true,
				permalink: item.permalink || "",
				authorUserName: item.author?.userName || "instagram",
				authorDisplayName:
					item.author?.displayName || item.author?.userName || "Instagram",
				caption: item.caption || "Instagram reel",
				createdAt: item.createdAt || "",
				previewSrc: firstVideo?.thumbnailUrl || firstVideo?.url || "",
				mediaSrc: firstVideo?.url || "",
				mediaKind: "video",
				likeCount: 0,
				commentCount: 0,
			};
		});
}

function normalizeLocalReels(posts = []) {
	return posts
		.filter((post) => (post.mediaTypes || []).some((type) => type === "video"))
		.map((post) => {
			const index = (post.mediaTypes || []).findIndex((type) => type === "video");
			const mediaId = post.mediaIds?.[index] || post.mediaIds?.[0] || "";
			return {
				id: post.id,
				source: "local",
				readOnly: false,
				permalink: "",
				authorUserName: post.authorUserName,
				authorDisplayName: post.authorName || post.authorUserName,
				caption: post.caption || "New reel",
				createdAt: post.createdAt || "",
				previewSrc: resolveReelSrc(mediaId),
				mediaSrc: resolveReelSrc(mediaId),
				mediaKind: "video",
				likeCount:
					post.likeCount ?? (Array.isArray(post.likedBy) ? post.likedBy.length : 0),
				commentCount:
					post.commentCount ??
					(Array.isArray(post.comments) ? post.comments.length : 0),
			};
		});
}

function createFallbackReels(count = 4) {
	return Array.from({ length: count }, (_, index) => {
		const media = REEL_FALLBACK_MEDIA[index % REEL_FALLBACK_MEDIA.length];
		const user = REEL_FILLER_USERS[index % REEL_FILLER_USERS.length];
		const caption =
			REEL_FALLBACK_CAPTIONS[
				Math.floor(Math.random() * REEL_FALLBACK_CAPTIONS.length)
			];
		return {
			id: `fallback-reel-${index}`,
			source: "fallback",
			readOnly: true,
			permalink: "",
			authorUserName: user,
			authorDisplayName: user,
			caption,
			createdAt: new Date(Date.now() - index * 60000).toISOString(),
			previewSrc: media.url,
			mediaSrc: media.url,
			mediaKind: media.type,
			likeCount: 1200 + index * 137,
			commentCount: 30 + index * 5,
		};
	});
}

function sortNewestFirst(items = []) {
	return [...items].sort((a, b) => {
		const aTs = new Date(a.createdAt || 0).getTime();
		const bTs = new Date(b.createdAt || 0).getTime();
		return bTs - aTs;
	});
}

export default function ReelsPage({ currentUser }) {
	const navigate = useNavigate();
	const [reels, setReels] = useState([]);
	const [usersByUserName, setUsersByUserName] = useState({});
	const [loading, setLoading] = useState(true);
	const [activeIndex, setActiveIndex] = useState(0);
	const [likedById, setLikedById] = useState({});
	const [savedById, setSavedById] = useState({});
	const [followedById, setFollowedById] = useState({});
	const [likeDeltaById, setLikeDeltaById] = useState({});
	const [commentDraft, setCommentDraft] = useState("");
	const [commentEntriesById, setCommentEntriesById] = useState({});
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [statusMessage, setStatusMessage] = useState("");
	const [isMuted, setIsMuted] = useState(true);
	const videoRef = useRef(null);

	const loadReels = useCallback(async () => {
		setLoading(true);
		try {
			const [localResult, igResult, usersResult] = await Promise.allSettled([
				fetchPosts(currentUser?.userName, 1, 50, ""),
				fetchFeed({ limit: 24, source: "instagram" }),
				fetchAllUsers(),
			]);

			const localReels =
				localResult.status === "fulfilled" ?
					normalizeLocalReels(localResult.value.posts || [])
				:	[];
			const instagramReels =
				igResult.status === "fulfilled" ?
					normalizeInstagramReels(igResult.value.items || [])
				:	[];

			const merged = sortNewestFirst([...localReels, ...instagramReels]);
			setReels(merged.length ? merged : createFallbackReels());
			if (usersResult.status === "fulfilled") {
				const nextUsersByUserName = Object.fromEntries(
					(usersResult.value.users || []).map((user) => [user.userName, user]),
				);
				if (currentUser?.userName) {
					nextUsersByUserName[currentUser.userName] = currentUser;
				}
				setUsersByUserName(nextUsersByUserName);
			}
		} catch {
			setReels(createFallbackReels());
		} finally {
			setLoading(false);
		}
	}, [currentUser?.userName]);

	useEffect(() => {
		loadReels();
	}, [loadReels]);

	const feedItems = useMemo(
		() => (reels.length ? reels : loading ? [] : createFallbackReels()),
		[loading, reels],
	);

	useEffect(() => {
		if (activeIndex >= feedItems.length) {
			setActiveIndex(0);
		}
	}, [activeIndex, feedItems.length]);

	useEffect(() => {
		setCommentsOpen(false);
		setCommentDraft("");
		setStatusMessage("");
	}, [activeIndex]);

	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.key === "ArrowDown") {
				setActiveIndex((prev) =>
					feedItems.length ? (prev + 1) % feedItems.length : 0,
				);
			}
			if (event.key === "ArrowUp") {
				setActiveIndex((prev) =>
					feedItems.length ? (prev - 1 + feedItems.length) % feedItems.length : 0,
				);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [feedItems.length]);

	useEffect(() => {
		let locked = false;

		const handleWheel = (event) => {
			if (!feedItems.length || locked) return;
			if (Math.abs(event.deltaY) < 8) return;
			event.preventDefault();
			locked = true;
			setActiveIndex((prev) =>
				event.deltaY > 0 ?
					(prev + 1) % feedItems.length
				:	(prev - 1 + feedItems.length) % feedItems.length,
			);
			window.setTimeout(() => {
				locked = false;
			}, 220);
		};

		window.addEventListener("wheel", handleWheel, { passive: false });
		return () => window.removeEventListener("wheel", handleWheel);
	}, [feedItems.length]);

	const activeReel = feedItems[activeIndex] || null;
	const activeComments = activeReel ? (commentEntriesById[activeReel.id] || []) : [];
	const activeLiked = activeReel ? Boolean(likedById[activeReel.id]) : false;
	const activeSaved = activeReel ? Boolean(savedById[activeReel.id]) : false;
	const activeFollowed = activeReel ? Boolean(followedById[activeReel.id]) : false;
	const activeLikeCount =
		activeReel ?
			Math.max(0, (activeReel.likeCount || 0) + (likeDeltaById[activeReel.id] || 0))
		:	0;
	const activeCommentCount =
		activeReel ? (activeReel.commentCount || 0) + activeComments.length : 0;

	function formatCount(value) {
		if (!value) return "0";
		if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
		if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
		return String(value);
	}

	const setTimedStatus = useCallback((message) => {
		setStatusMessage(message);
		window.setTimeout(() => {
			setStatusMessage((prev) => (prev === message ? "" : prev));
		}, 1600);
	}, []);

	const handleToggleLike = () => {
		if (!activeReel) return;
		const nextLiked = !activeLiked;
		setLikedById((prev) => ({ ...prev, [activeReel.id]: nextLiked }));
		setLikeDeltaById((prev) => ({
			...prev,
			[activeReel.id]: (prev[activeReel.id] || 0) + (nextLiked ? 1 : -1),
		}));
	};

	const handleToggleSave = () => {
		if (!activeReel) return;
		const nextSaved = !activeSaved;
		setSavedById((prev) => ({ ...prev, [activeReel.id]: nextSaved }));
		setTimedStatus(nextSaved ? "Saved" : "Removed from saved");
	};

	const handleToggleFollow = () => {
		if (!activeReel) return;
		const nextFollowed = !activeFollowed;
		setFollowedById((prev) => ({ ...prev, [activeReel.id]: nextFollowed }));
		setTimedStatus(
			nextFollowed ?
				`Following @${activeReel.authorUserName}`
			:	`Unfollowed @${activeReel.authorUserName}`,
		);
	};

	const handleToggleComments = () => {
		setCommentsOpen((prev) => !prev);
	};

	const handleSubmitComment = (event) => {
		event.preventDefault();
		if (!activeReel || !commentDraft.trim()) return;
		setCommentEntriesById((prev) => ({
			...prev,
			[activeReel.id]: [
				...(prev[activeReel.id] || []),
				{
					id: `reel-comment-${activeReel.id}-${Date.now()}`,
					authorUserName: currentUser?.userName || "viewer",
					text: commentDraft.trim(),
				},
			],
		}));
		setCommentDraft("");
	};

	const handleShare = async () => {
		if (!activeReel) return;
		const shareUrl = activeReel.mediaSrc || activeReel.permalink || window.location.href;
		try {
			if (navigator.share) {
				await navigator.share({
					title: `@${activeReel.authorUserName}`,
					text: activeReel.caption,
					url: shareUrl,
				});
				setTimedStatus("Shared");
				return;
			}
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(shareUrl);
				setTimedStatus("Link copied");
				return;
			}
		} catch (error) {
			if (error?.name === "AbortError") return;
		}
		setTimedStatus("Share unavailable");
	};

	const handleMore = () => {
		if (!activeReel) return;
		setTimedStatus(
			activeReel.readOnly ?
				"External reel preview"
			:	`Posted by @${activeReel.authorUserName}`,
		);
	};

	const handleToggleMute = () => {
		if (!videoRef.current) return;
		const nextMuted = !videoRef.current.muted;
		videoRef.current.muted = nextMuted;
		if (!nextMuted) {
			videoRef.current.play().catch(() => {
				/* no-op */
			});
		}
		setIsMuted(nextMuted);
	};

	const handleProfileClick = () => {
		if (!activeReel?.authorUserName) return;
		navigateToProfile(
			navigate,
			activeReel.authorUserName,
			currentUser?.userName || "",
		);
	};

	const activeReelUser =
		(activeReel?.authorUserName && usersByUserName[activeReel.authorUserName]) ||
		(activeReel?.authorUserName === currentUser?.userName ? currentUser : null);

	useEffect(() => {
		if (!videoRef.current) return;
		videoRef.current.muted = isMuted;
	}, [activeReel, isMuted]);

	return (
		<div className="ig-reels-page">
			{loading && !activeReel ?
				<div className="ig-reels-loading">Loading reels...</div>
			:	activeReel && (
					<div className="ig-reels-stage">
						<div className="ig-reels-viewer">
							<section key={activeReel.id} className="ig-reel-card">
								<div className="ig-reel-media">
									{activeReel.mediaKind === "video" ?
										<video
											ref={videoRef}
											className="ig-reel-video"
											src={activeReel.mediaSrc}
											poster={activeReel.previewSrc || undefined}
											autoPlay
											loop
											muted
											playsInline
											controls={false}
										/>
									:	<img
											className="ig-reel-video"
											src={activeReel.previewSrc}
											alt={activeReel.caption}
										/>
									}

									<div className="ig-reel-gradient" />
									{activeReel.mediaKind === "video" && (
										<button
											type="button"
											className={`ig-reel-audio-btn ${isMuted ? "muted" : "live"}`}
											onClick={handleToggleMute}
											aria-label={isMuted ? "Unmute reel" : "Mute reel"}
											title={isMuted ? "Unmute" : "Mute"}
										>
											{isMuted ?
												<svg viewBox="0 0 24 24" aria-hidden="true">
													<path
														d="M5 9h4l5-4v14l-5-4H5z"
														fill="none"
														stroke="currentColor"
														strokeWidth="1.8"
														strokeLinejoin="round"
													/>
													<line
														x1="4"
														y1="4"
														x2="20"
														y2="20"
														stroke="currentColor"
														strokeWidth="1.8"
														strokeLinecap="round"
													/>
												</svg>
											:	<svg viewBox="0 0 24 24" aria-hidden="true">
													<path
														d="M5 9h4l5-4v14l-5-4H5z"
														fill="none"
														stroke="currentColor"
														strokeWidth="1.8"
														strokeLinejoin="round"
													/>
													<path
														d="M16 9a4.5 4.5 0 0 1 0 6"
														fill="none"
														stroke="currentColor"
														strokeWidth="1.8"
														strokeLinecap="round"
													/>
													<path
														d="M18.7 6.6a8 8 0 0 1 0 10.8"
														fill="none"
														stroke="currentColor"
														strokeWidth="1.8"
														strokeLinecap="round"
													/>
												</svg>
											}
										</button>
									)}
									<div className="ig-reel-overlay">
										{commentsOpen && (
											<div className="ig-reel-comments-panel">
												<div className="ig-reel-comments-header">
													<span>Comments</span>
													<button
														type="button"
														onClick={handleToggleComments}
													>
														✕
													</button>
												</div>
												<div className="ig-reel-comments-list">
													{activeComments.length === 0 ?
														<p className="ig-reel-comments-empty">
															No comments yet.
														</p>
													:	activeComments.map((comment) => (
															<div
																key={comment.id}
																className="ig-reel-comment-row"
															>
																<strong>@{comment.authorUserName}</strong>
																<span>{comment.text}</span>
															</div>
														))
													}
												</div>
												<form
													className="ig-reel-comment-form"
													onSubmit={handleSubmitComment}
												>
													<input
														value={commentDraft}
														onChange={(event) =>
															setCommentDraft(event.target.value)
														}
														placeholder="Add a comment..."
														maxLength={220}
													/>
													<button type="submit">Post</button>
												</form>
											</div>
										)}
										<div className="ig-reel-meta">
											<div className="ig-reel-user-row">
												<button
													type="button"
													className="ig-reel-avatar-btn"
													onClick={handleProfileClick}
													aria-label={`Open @${activeReel.authorUserName} profile`}
												>
													<img
														className="ig-reel-avatar-image"
														src={
															getUserProfilePic(activeReelUser) ||
															DEFAULT_PROFILE_PIC
														}
														alt={activeReel.authorUserName}
													/>
												</button>
												<div className="ig-reel-user-copy">
													<div className="ig-reel-user-line">
														<strong>@{activeReel.authorUserName}</strong>
														<button
															type="button"
															className={`ig-reel-follow-btn ${activeFollowed ? "active" : ""}`}
															onClick={handleToggleFollow}
														>
															{activeFollowed ? "Following" : "Follow"}
														</button>
													</div>
													<span>{activeReel.authorDisplayName}</span>
												</div>
											</div>
											<p className="ig-reel-caption">{activeReel.caption}</p>
											{statusMessage && (
												<div className="ig-reel-status-message">
													{statusMessage}
												</div>
											)}
										</div>

										<div className="ig-reel-actions">
											<button
												type="button"
												className={`ig-reel-action-btn ${activeLiked ? "active" : ""}`}
												title="Like"
												onClick={handleToggleLike}
											>
												<svg
													viewBox="0 0 24 24"
													fill={activeLiked ? "currentColor" : "none"}
													stroke="currentColor"
													strokeWidth="1.8"
												>
													<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
												</svg>
											</button>
											<span>{formatCount(activeLikeCount)}</span>
											<button
												type="button"
												className={`ig-reel-action-btn ${commentsOpen ? "active" : ""}`}
												title="Comment"
												onClick={handleToggleComments}
											>
												<svg
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="1.8"
												>
													<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
												</svg>
											</button>
											<span>{formatCount(activeCommentCount)}</span>
											<button
												type="button"
												className="ig-reel-action-btn"
												title="Share"
												onClick={handleShare}
											>
												<svg
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="1.8"
												>
													<line x1="22" y1="2" x2="11" y2="13" />
													<polygon points="22 2 15 22 11 13 2 9 22 2" />
												</svg>
											</button>
											<button
												type="button"
												className={`ig-reel-action-btn ${activeSaved ? "active" : ""}`}
												title="Save"
												onClick={handleToggleSave}
											>
												<svg
													viewBox="0 0 24 24"
													fill={activeSaved ? "currentColor" : "none"}
													stroke="currentColor"
													strokeWidth="1.8"
												>
													<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
												</svg>
											</button>
											<button
												type="button"
												className="ig-reel-action-btn"
												title="More"
												onClick={handleMore}
											>
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
												>
													<circle
														cx="12"
														cy="5"
														r="1"
														fill="currentColor"
													/>
													<circle
														cx="12"
														cy="12"
														r="1"
														fill="currentColor"
													/>
													<circle
														cx="12"
														cy="19"
														r="1"
														fill="currentColor"
													/>
												</svg>
											</button>
										</div>
									</div>
								</div>
							</section>
						</div>

						<aside className="ig-reels-side-rail ig-reels-side-rail--right">
							<div className="ig-reels-nav">
								<button
									className="ig-reels-nav-btn"
									type="button"
									onClick={() =>
										setActiveIndex((prev) =>
											feedItems.length ?
												(prev - 1 + feedItems.length) %
													feedItems.length
											:	0,
										)
									}
									aria-label="Previous reel"
								>
									↑
								</button>
								<button
									className="ig-reels-nav-btn"
									type="button"
									onClick={() =>
										setActiveIndex((prev) =>
											feedItems.length ? (prev + 1) % feedItems.length : 0,
										)
									}
									aria-label="Next reel"
								>
									↓
								</button>
							</div>
							<div className="ig-reels-index">
								{activeIndex + 1} / {feedItems.length}
							</div>
						</aside>
					</div>
				)
			}
		</div>
	);
}
