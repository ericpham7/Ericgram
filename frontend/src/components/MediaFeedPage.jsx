import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	fetchPosts,
	fetchFeed,
	createPost,
	likePost,
	addComment,
	deleteComment,
	deletePost,
	fetchAllUsers,
	followUser,
	loginUser,
	listInstagramConnections,
	startInstagramOAuth,
	syncInstagramConnection,
	setCurrentUser,
	savePost,
} from "../api";
import { navigateToProfile } from "../utils/profileNavigation";
import { DEFAULT_PROFILE_PIC } from "../utils/defaultProfilePic";
import {
	getRandomAssetProfilePic,
	getUserProfilePic,
} from "../utils/userProfilePic";
import "./MediaFeedPage.css";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MEDIA_BASE = "/api/posts/media?mediaId=";
const HOME_POSTS_PER_PAGE = 12;
const HOME_INITIAL_PAGE_COUNT = 4;

function mediaUrl(id) {
	if (
		typeof id === "string" &&
		(/^(?:https?:)?\/\//.test(id) ||
			id.startsWith("data:") ||
			id.startsWith("/assets/"))
	) {
		return id;
	}
	return id ? `${MEDIA_BASE}${encodeURIComponent(id)}` : null;
}

function normalizeInstagramFeedItems(items = []) {
	return items.map((item) => {
		const media = Array.isArray(item?.media) ? item.media : [];
		return {
			id: item.id,
			source: item.source || "instagram",
			readOnly: true,
			permalink: item.permalink || "",
			authorUserName: item.author?.userName || "instagram",
			authorName:
				item.author?.displayName || item.author?.userName || "Instagram",
			authorProfilePic: item.author?.avatarUrl || "",
			caption: item.caption || "",
			createdAt: item.createdAt || "",
			media,
			mediaIds: media.map((entry) => entry?.url).filter(Boolean),
			mediaTypes: media.map((entry) => entry?.type || "image"),
			likedBy: [],
			comments: [],
			likeCount: 0,
			commentCount: 0,
		};
	});
}

function sortPostsNewestFirst(items = []) {
	return [...items].sort((a, b) => {
		const aTs = new Date(a?.createdAt || 0).getTime();
		const bTs = new Date(b?.createdAt || 0).getTime();
		if (aTs === bTs) {
			return String(b?.id || "").localeCompare(String(a?.id || ""));
		}
		return bTs - aTs;
	});
}

function prioritizeBeltranReel(items = []) {
	const posts = [...items];
	const featuredIndex = posts.findIndex(
		(post) =>
			post?.authorUserName === "beltran" &&
			(post?.mediaTypes || []).some((type) => type === "video"),
	);
	if (featuredIndex <= 0) {
		return posts;
	}
	const [featuredPost] = posts.splice(featuredIndex, 1);
	return [featuredPost, ...posts];
}

function avoidConsecutiveDuplicateProfilePics(items = []) {
	const ordered = [...items];

	for (let i = 1; i < ordered.length; i += 1) {
		const currentPic = getUserProfilePic(ordered[i]);
		const previousPic = getUserProfilePic(ordered[i - 1]);
		if (!currentPic || currentPic !== previousPic) continue;

		const swapIndex = ordered.findIndex(
			(candidate, candidateIndex) =>
				candidateIndex > i &&
				getUserProfilePic(candidate) !== previousPic,
		);
		if (swapIndex === -1) continue;

		[ordered[i], ordered[swapIndex]] = [ordered[swapIndex], ordered[i]];
	}

	return ordered;
}

function timeAgo(isoOrTs) {
	if (!isoOrTs) return "";
	const ts =
		typeof isoOrTs === "number" ?
			isoOrTs * 1000
		:	new Date(isoOrTs).getTime();
	const diff = (Date.now() - ts) / 1000;
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
	return new Date(ts).toLocaleDateString();
}

function Avatar({ user, size = 32, className = "" }) {
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
				}}
				className={className}
			/>
		);
	}
	return (
		<div
			className={`ig-avatar-fallback ${className}`}
			style={{ width: size, height: size, fontSize: size * 0.35 }}
		>
			{initials}
		</div>
	);
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

// Preloaded sample posts for the demo user — fetched from Picsum (no upload)
const SAMPLE_POSTS = [
	{ picsumId: 10, caption: "Every journey begins with a single step 🌍✈️" },
	{
		picsumId: 20,
		caption: "Art is not what you see, but what you make others see 🎨",
	},
	{ picsumId: 15, caption: "The mountains are calling and I must go 🏔️" },
	{ picsumId: 40, caption: "Golden hour hits different out here 🌅" },
	{ picsumId: 50, caption: "Not all those who wander are lost 🧭" },
	{ picsumId: 60, caption: "Sipping on good vibes only ☕🌿" },
	{ picsumId: 70, caption: "Nature is the best therapy 🌲💚" },
	{ picsumId: 80, caption: "Find beauty in the ordinary ✨" },
	{ picsumId: 37, caption: "Keep close to nature's heart 🍃" },
	{ picsumId: 160, caption: "Minimal vibes, maximal feelings 🤍" },
	{
		picsumId: 190,
		caption: "Light is the brush, the world is the canvas 🌤️",
	},
	{ picsumId: 200, caption: "Good friends + good coffee = perfect day ☕" },
];

const DEMO_USER_NAMES = new Set(["demo_viewer", "averagejoe"]);
const HOME_FILLER_USERS = [
	{ userName: "maya.stills", name: "Maya", seed: "maya" },
	{ userName: "noah.frames", name: "Noah", seed: "noah" },
	{ userName: "zoe.citylight", name: "Zoe", seed: "zoe" },
	{ userName: "leo.weekends", name: "Leo", seed: "leo" },
	{ userName: "iris.roam", name: "Iris", seed: "iris" },
	{ userName: "nina.palette", name: "Nina", seed: "nina" },
];
const HOME_FILLER_CAPTIONS = [
	"Weekend reset and a little extra sunlight.",
	"Saved this moment before it disappeared.",
	"Soft light, clean lines, no notes.",
	"Random stop. Best photo of the day.",
	"Coffee, camera roll, and no real plan.",
	"Main feed energy today.",
	"A quick post before heading back out.",
	"Kept this one simple and it worked.",
	"Low effort, high vibe.",
	"One of those frames that just lands.",
];
const HOME_FILLER_INTERVAL = 3;
const HOME_FILLER_MIN_COUNT = 3;

function createHomeFillerPosts(count = 9) {
	return Array.from({ length: count }, (_, index) => {
		const author =
			HOME_FILLER_USERS[
				Math.floor(Math.random() * HOME_FILLER_USERS.length)
			];
		const caption =
			HOME_FILLER_CAPTIONS[
				Math.floor(Math.random() * HOME_FILLER_CAPTIONS.length)
			];
		const uniqueSeed = `${author.seed}-${index}-${Date.now()}-${Math.floor(
			Math.random() * 10000,
		)}`;
		const likeCount = Math.floor(Math.random() * 48) + 8;
		const commentCount = Math.floor(Math.random() * 5);
		const createdAt = new Date(
			Date.now() - (index + 1) * (Math.floor(Math.random() * 3) + 1) * 3600000,
		).toISOString();
		const mediaSrc =
			`https://picsum.photos/seed/${encodeURIComponent(uniqueSeed)}/900/900`;

		return {
			id: `home-filler-${uniqueSeed}`,
			source: "home-filler",
			readOnly: true,
			permalink: mediaSrc,
			authorUserName: author.userName,
			authorName: author.name,
			authorProfilePic:
				`https://picsum.photos/seed/avatar-${encodeURIComponent(author.seed)}/96/96`,
			caption,
			createdAt,
			location: Math.random() > 0.5 ? "For You" : "",
			media: [
				{
					url: mediaSrc,
					type: "image",
				},
			],
			mediaIds: [mediaSrc],
			mediaTypes: ["image"],
			likedBy: Array.from(
				{ length: likeCount },
				(_, likeIndex) => `viewer_${index}_${likeIndex}`,
			),
			comments: Array.from({ length: commentCount }, (_, commentIndex) => ({
				id: `home-filler-comment-${uniqueSeed}-${commentIndex}`,
				authorUserName:
					HOME_FILLER_USERS[
						(author.seed.length + commentIndex) %
							HOME_FILLER_USERS.length
					].userName,
				text: "Looks good",
			})),
			commentCount,
		};
	});
}

function interleaveHomeFillerPosts(posts = [], fillerPosts = []) {
	if (fillerPosts.length === 0) return posts;
	if (posts.length === 0) return fillerPosts;

	const merged = [];
	let fillerIndex = 0;

	posts.forEach((post, index) => {
		merged.push(post);
		if (
			(index + 1) % HOME_FILLER_INTERVAL === 0 &&
			fillerIndex < fillerPosts.length
		) {
			merged.push(fillerPosts[fillerIndex]);
			fillerIndex++;
		}
	});

	while (fillerIndex < fillerPosts.length) {
		merged.push(fillerPosts[fillerIndex]);
		fillerIndex++;
	}

	return merged;
}

function CreatePostModal({ currentUser, onClose, onCreated }) {
	const [tab] = useState("upload");
	const [caption, setCaption] = useState("");
	const [files, setFiles] = useState([]);
	const [previews, setPreviews] = useState([]);
	const [selectedSample, setSelectedSample] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const fileRef = useRef();

	const handleFiles = (e) => {
		const selected = Array.from(e.target.files);
		setFiles(selected);
		setPreviews(selected.map((f) => URL.createObjectURL(f)));
	};

	const handleSubmit = async () => {
		// Ensure X-Auth-User is set (belt-and-suspenders for demo timing edge cases)
		setCurrentUser(currentUser.userName);

		if (tab === "sample") {
			if (!selectedSample) {
				setError("Pick a sample photo first.");
				return;
			}
			setLoading(true);
			setError("");
			try {
				const url = `https://picsum.photos/id/${selectedSample.picsumId}/800/800`;
				const blob = await fetch(url).then((r) => r.blob());
				const file = new File(
					[blob],
					`sample_${selectedSample.picsumId}.jpg`,
					{ type: "image/jpeg" },
				);
				const finalCaption = caption.trim() || selectedSample.caption;
				const result = await createPost(
					currentUser.userName,
					finalCaption,
					[file],
				);
				onCreated(result.post);
				onClose();
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
			return;
		}

		if (tab === "text") {
			if (!caption.trim()) {
				setError("Write something to post.");
				return;
			}
			setLoading(true);
			setError("");
			try {
				const result = await createPost(
					currentUser.userName,
					caption,
					[],
				);
				onCreated(result.post);
				onClose();
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
			return;
		}

		// upload tab
		if (!caption.trim() && files.length === 0) {
			setError("Add a caption or media to post.");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const result = await createPost(
				currentUser.userName,
				caption,
				files,
			);
			onCreated(result.post);
			onClose();
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="ig-modal-overlay" onClick={onClose}>
			<div
				className="ig-create-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="ig-modal-header">
					<button className="ig-modal-x" onClick={onClose}>
						✕
					</button>
					<h2>Create new post</h2>
					<button
						className="ig-modal-share"
						onClick={handleSubmit}
						disabled={loading}
					>
						{loading ? "Sharing…" : "Share"}
					</button>
				</div>

				<div className="ig-create-body">
					{/* ── Upload tab ── */}
					{tab === "upload" && (
						<>
							{previews.length > 0 ?
								<div className="ig-create-previews">
									{previews.map((p, i) => (
										<img
											key={i}
											src={p}
											alt=""
											className="ig-create-preview-img"
										/>
									))}
								</div>
							:	<button
									className="ig-create-upload-zone"
									onClick={() => fileRef.current.click()}
								>
									<svg
										width="48"
										height="48"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.2"
									>
										<rect
											x="3"
											y="3"
											width="18"
											height="18"
											rx="2"
										/>
										<circle cx="8.5" cy="8.5" r="1.5" />
										<polyline points="21 15 16 10 5 21" />
									</svg>
									<p>Drag photos and videos here</p>
									<span className="ig-create-browse">
										Select from computer
									</span>
								</button>
							}
							<input
								ref={fileRef}
								type="file"
								accept="image/*,video/*"
								multiple
								hidden
								onChange={handleFiles}
							/>
						</>
					)}

					{/* ── Sample photos tab ── */}
					{tab === "sample" && (
						<div className="ig-sample-grid">
							{SAMPLE_POSTS.map((s) => (
								<button
									key={s.picsumId}
									className={`ig-sample-cell ${selectedSample?.picsumId === s.picsumId ? "selected" : ""}`}
									onClick={() => {
										setSelectedSample(s);
										if (!caption) setCaption(s.caption);
									}}
								>
									<img
										src={`https://picsum.photos/id/${s.picsumId}/200/200`}
										alt={s.caption}
										loading="lazy"
									/>
									{selectedSample?.picsumId ===
										s.picsumId && (
										<div className="ig-sample-check">✓</div>
									)}
								</button>
							))}
						</div>
					)}

					{/* ── Text-only tab ── */}
					{tab === "text" && (
						<div className="ig-text-post-zone">
							<Avatar user={currentUser} size={40} />
							<div className="ig-text-post-inner">
								<strong>{currentUser.userName}</strong>
								<textarea
									className="ig-text-post-input"
									placeholder="What's on your mind?"
									value={caption}
									onChange={(e) => setCaption(e.target.value)}
									maxLength={2200}
									autoFocus
								/>
								<div className="ig-create-caption-count">
									{caption.length}/2,200
								</div>
							</div>
						</div>
					)}

					{/* Right panel (caption + controls) — shown for upload and sample */}
					{tab !== "text" && (
						<div className="ig-create-right">
							<div className="ig-create-user-row">
								<Avatar user={currentUser} size={28} />
								<strong>{currentUser.userName}</strong>
							</div>
							<textarea
								className="ig-create-caption"
								placeholder="Write a caption…"
								value={caption}
								onChange={(e) => setCaption(e.target.value)}
								maxLength={2200}
							/>
							<div className="ig-create-caption-count">
								{caption.length}/2,200
							</div>
							{tab === "upload" && previews.length > 0 && (
								<button
									className="ig-create-change-media"
									onClick={() => fileRef.current.click()}
								>
									+ Add more media
								</button>
							)}
							{tab === "sample" && selectedSample && (
								<p className="ig-sample-selected-hint">
									📷 Photo #{selectedSample.picsumId} selected
									— edit caption above or keep the default.
								</p>
							)}
							{error && (
								<p className="ig-create-error">{error}</p>
							)}
						</div>
					)}

					{tab === "text" && error && (
						<p
							className="ig-create-error"
							style={{ padding: "0 16px 12px" }}
						>
							{error}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── Single Post Card ─────────────────────────────────────────────────────────

function PostCard({
	post,
	currentUser,
	onPostUpdated,
	onPostDeleted,
	onProfileClick,
	onFollow,
	followingIds,
}) {
	const [commentText, setCommentText] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [showAllComments, setShowAllComments] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [liking, setLiking] = useState(false);
	const inputRef = useRef();
	const videoRef = useRef(null);
	const isReadOnly = Boolean(post.readOnly);
	const isGeneratedPost = post.source === "home-filler";

	const mediaIds = post.mediaIds || [];
	const [mediaIdx, setMediaIdx] = useState(0);
	const [readOnlyLiked, setReadOnlyLiked] = useState(
		(post.likedBy || []).includes(currentUser.userName),
	);
	const [readOnlyLikeCount, setReadOnlyLikeCount] = useState(
		(post.likedBy || []).length,
	);
	const [readOnlyComments, setReadOnlyComments] = useState(post.comments || []);
	const [shareFeedback, setShareFeedback] = useState("");
	const [isVideoMuted, setIsVideoMuted] = useState(false);

	useEffect(() => {
		setReadOnlyLiked((post.likedBy || []).includes(currentUser.userName));
		setReadOnlyLikeCount((post.likedBy || []).length);
		setReadOnlyComments(post.comments || []);
		setMediaIdx(0);
		setIsVideoMuted(false);
	}, [post.id, post.likedBy, post.comments, currentUser.userName]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return undefined;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					video.muted = isVideoMuted;
					video.play().catch(() => {
						/* Browser may block autoplay with audio until user interaction. */
					});
					return;
				}
				video.pause();
			},
			{ threshold: 0.65 },
		);

		observer.observe(video);
		return () => {
			observer.disconnect();
			video.pause();
		};
	}, [post.id, mediaIdx, isVideoMuted]);

	const liked =
		isReadOnly ? readOnlyLiked : (post.likedBy || []).includes(currentUser.userName);
	const likeCount = isReadOnly ? readOnlyLikeCount : (post.likedBy || []).length;
	const comments = isReadOnly ? readOnlyComments : (post.comments || []);

	const [saving, setSaving] = useState(false);
	const [isSaved, setIsSaved] = useState(
		(currentUser.savedPostIds || []).includes(post.id),
	);

	const handleLike = async () => {
		if (isReadOnly) {
			setReadOnlyLiked((prev) => !prev);
			setReadOnlyLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
			return;
		}
		if (liking) return;
		setLiking(true);
		try {
			const res = await likePost(post.id, currentUser.userName);
			onPostUpdated(res.post);
		} catch {
			/* silent */
		} finally {
			setLiking(false);
		}
	};

	const handleSave = async () => {
		if (isReadOnly) {
			setIsSaved((prev) => !prev);
			return;
		}
		if (saving) return;
		setSaving(true);
		try {
			const res = await savePost(post.id, currentUser.userName);
			// The backend toggles the saved state for the user and returns the updated user payload.
			// Ideally we would update the global currentUser state, but for immediate UI feedback:
			setIsSaved(res.alreadySaved === false);
		} catch {
			/* silent */
		} finally {
			setSaving(false);
		}
	};

	const handleComment = async (e) => {
		e.preventDefault();
		if (isReadOnly) {
			if (!commentText.trim() || submitting) return;
			setSubmitting(true);
			setReadOnlyComments((prev) => [
				...prev,
				{
					id: `local-comment-${post.id}-${Date.now()}`,
					authorUserName: currentUser.userName,
					text: commentText.trim(),
				},
			]);
			setCommentText("");
			setShowAllComments(true);
			setSubmitting(false);
			return;
		}
		if (!commentText.trim() || submitting) return;
		setSubmitting(true);
		try {
			const res = await addComment(
				post.id,
				currentUser.userName,
				commentText.trim(),
			);
			onPostUpdated(res.post);
			setCommentText("");
		} catch {
			/* silent */
		} finally {
			setSubmitting(false);
		}
	};

	const handleDeleteComment = async (commentId) => {
		if (isReadOnly) {
			setReadOnlyComments((prev) =>
				prev.filter((comment) => comment.id !== commentId),
			);
			return;
		}
		try {
			const res = await deleteComment(
				post.id,
				commentId,
				currentUser.userName,
			);
			onPostUpdated(res.post);
		} catch {
			/* silent */
		}
	};

	const handleDeletePost = async () => {
		if (isReadOnly) return;
		if (!confirm("Delete this post?")) return;
		try {
			await deletePost(post.id, currentUser.userName);
			onPostDeleted(post.id);
		} catch {
			/* silent */
		}
	};

	const displayedComments = showAllComments ? comments : comments.slice(-2);
	const isOwner = currentUser.userName === post.authorUserName;
	const getCommentAvatarUser = (comment) => {
		if (comment.authorUserName === currentUser.userName) {
			return currentUser;
		}
		if (comment.authorUserName === post.authorUserName) {
			return {
				userName: post.authorUserName,
				name: post.authorName,
				profilePic: post.authorProfilePic,
			};
		}
		return {
			userName: comment.authorUserName,
			name: comment.authorUserName,
		};
	};

	const handleReadOnlyPreview = () => {
		setExpanded(true);
		setShowAllComments(true);
		inputRef.current?.focus();
	};

	const handleShare = async () => {
		const shareUrl =
			post.permalink ||
			mediaUrl(mediaIds[mediaIdx]) ||
			(typeof window !== "undefined" ? window.location.href : "");
		const shareText = post.caption || `Post by ${post.authorUserName}`;

		try {
			if (navigator.share && shareUrl) {
				await navigator.share({
					title: `@${post.authorUserName}`,
					text: shareText,
					url: shareUrl,
				});
				setShareFeedback("Shared");
			} else if (navigator.clipboard?.writeText && shareUrl) {
				await navigator.clipboard.writeText(shareUrl);
				setShareFeedback("Copied");
			} else {
				setShareFeedback("Ready");
			}
		} catch (error) {
			if (error?.name === "AbortError") return;
			setShareFeedback("Unavailable");
		}

		window.setTimeout(() => {
			setShareFeedback("");
		}, 1600);
	};

	const postAuthorProfilePic =
		post.authorProfilePic || getRandomAssetProfilePic(post.authorUserName);

	const handleToggleVideoMute = () => {
		if (!videoRef.current) return;
		const nextMuted = !videoRef.current.muted;
		videoRef.current.muted = nextMuted;
		if (!nextMuted) {
			videoRef.current.play().catch(() => {
				/* no-op */
			});
		}
		setIsVideoMuted(nextMuted);
	};

	return (
		<article className="ig-post-card">
			{/* Header */}
			<div className="ig-post-header">
				<button
					className="ig-post-author-btn"
					onClick={() => {
						if (isReadOnly) {
							handleReadOnlyPreview();
							return;
						}
						onProfileClick?.(post.authorUserName);
					}}
				>
					<div className="ig-story-ring">
						<div className="ig-story-ring-inner">
							{postAuthorProfilePic ?
								<img
									src={postAuthorProfilePic}
									alt={post.authorUserName}
								/>
							:	<span className="ig-story-initials">
									{(post.authorName ||
										post.authorUserName ||
										"?")[0].toUpperCase()}
								</span>
							}
						</div>
					</div>
					<div className="ig-post-author-info">
						<div style={{ display: "flex", alignItems: "center" }}>
							<span className="ig-post-username">
								{post.authorUserName}
							</span>
							{!isReadOnly &&
								!(currentUser.friends || []).includes(
								post.authorUserName,
							) &&
								currentUser.userName !==
									post.authorUserName && (
									<>
										<span
											style={{
												color: "var(--ig-text-secondary)",
												margin: "0 4px",
												fontSize: "12px",
											}}
										>
											•
										</span>
										<button
											className="ig-author-follow-btn"
											disabled={followingIds?.has(
												post.authorUserName,
											)}
											onClick={(e) => {
												e.stopPropagation();
												onFollow(post.authorUserName);
											}}
										>
											{(
												followingIds?.has(
													post.authorUserName,
												)
											) ?
												"..."
											:	"Follow"}
										</button>
									</>
								)}
						</div>
						{post.location && (
							<span className="ig-post-location">
								{post.location}
							</span>
						)}
					</div>
				</button>
				<div className="ig-post-header-right">
					{isReadOnly && (
						<button
							type="button"
							className="ig-post-chip-btn"
							onClick={handleReadOnlyPreview}
						>
							{isGeneratedPost ? "Suggested" : "Preview"}
						</button>
					)}
					{!isReadOnly && isOwner && (
						<button
							className="ig-post-dots"
							onClick={handleDeletePost}
							title="Delete post"
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
					)}
				</div>
			</div>

			{/* Media */}
			{mediaIds.length > 0 && (
				<div className="ig-post-media">
					{(
						mediaIds[mediaIdx].includes("video") ||
						post.mediaTypes?.[mediaIdx] === "video"
					) ?
						<>
							<video
								ref={videoRef}
								className="ig-post-img"
								src={mediaUrl(mediaIds[mediaIdx])}
								autoPlay
								loop
								muted={isVideoMuted}
								controls
								playsInline
							/>
							<button
								type="button"
								className={`ig-post-audio-btn ${isVideoMuted ? "muted" : "live"}`}
								onClick={handleToggleVideoMute}
								aria-label={isVideoMuted ? "Unmute video" : "Mute video"}
								title={isVideoMuted ? "Unmute" : "Mute"}
							>
								{isVideoMuted ?
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
						</>
					:	<img
							className="ig-post-img"
							src={mediaUrl(mediaIds[mediaIdx])}
							alt={post.caption || "post"}
						/>
					}
					{mediaIds.length > 1 && (
						<div className="ig-carousel-controls">
							<button
								className="ig-carousel-btn"
								disabled={mediaIdx === 0}
								onClick={() => setMediaIdx((i) => i - 1)}
							>
								‹
							</button>
							<div className="ig-carousel-dots">
								{mediaIds.map((_, i) => (
									<span
										key={i}
										className={`ig-carousel-dot ${i === mediaIdx ? "active" : ""}`}
										onClick={() => setMediaIdx(i)}
									/>
								))}
							</div>
							<button
								className="ig-carousel-btn"
								disabled={mediaIdx === mediaIds.length - 1}
								onClick={() => setMediaIdx((i) => i + 1)}
							>
								›
							</button>
						</div>
					)}
				</div>
			)}

			{/* Actions */}
			<div className="ig-post-actions">
				<div className="ig-post-actions-left">
					<button
						className={`ig-action-btn ${liked ? "liked" : ""}`}
						onClick={handleLike}
						disabled={liking}
						title={liked ? "Unlike" : "Like"}
					>
						<svg
							viewBox="0 0 24 24"
							fill={liked ? "currentColor" : "none"}
							stroke="currentColor"
							strokeWidth="1.8"
						>
							<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
						</svg>
					</button>
					<button
						className="ig-action-btn"
						onClick={() => inputRef.current?.focus()}
						title="Comment"
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
					<button
						className="ig-action-btn"
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
				</div>
				<button
					className={`ig-action-btn ig-save-btn ${isSaved ? "saved" : ""}`}
					onClick={handleSave}
					disabled={saving}
					title={isSaved ? "Unsave" : "Save"}
				>
					<svg
						viewBox="0 0 24 24"
						fill={isSaved ? "currentColor" : "none"}
						stroke="currentColor"
						strokeWidth="1.8"
					>
						<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
					</svg>
				</button>
			</div>

			{/* Like count */}
			{likeCount > 0 && (
				<div className="ig-post-likes">
					{likeCount.toLocaleString()}{" "}
					{likeCount === 1 ? "like" : "likes"}
				</div>
			)}
			{shareFeedback && (
				<div className="ig-post-inline-feedback">{shareFeedback}</div>
			)}

			{/* Caption */}
			{post.caption && (
				<div className="ig-post-caption-block">
					<p
						className={`ig-post-caption ${expanded ? "expanded" : ""}`}
					>
						<strong>{post.authorUserName}</strong> {post.caption}
					</p>
					{!expanded && post.caption.length > 125 && (
						<button
							className="ig-caption-more"
							onClick={() => setExpanded(true)}
						>
							more
						</button>
					)}
				</div>
			)}

			{/* Comments */}
			{comments.length > 2 && !showAllComments && (
				<button
					className="ig-view-comments"
					onClick={() => setShowAllComments(true)}
				>
					View all {comments.length} comments
				</button>
			)}
			<div className="ig-comments-list">
				{displayedComments.map((c) => (
					<div key={c.id} className="ig-comment-row">
						<div className="ig-comment-avatar">
							<Avatar user={getCommentAvatarUser(c)} size={24} />
						</div>
						<div className="ig-comment-body">
							<span className="ig-comment-author">
								{c.authorUserName}
							</span>
							<span className="ig-comment-text">{c.text}</span>
						</div>
						{(c.authorUserName === currentUser.userName ||
							isOwner) && (
							<button
								className="ig-comment-delete"
								onClick={() => handleDeleteComment(c.id)}
								title="Delete"
							>
								✕
							</button>
						)}
					</div>
				))}
			</div>

			{/* Timestamp */}
			<time className="ig-post-time">{timeAgo(post.createdAt)}</time>

			{/* Comment input */}
			<form className="ig-add-comment-row" onSubmit={handleComment}>
				<input
					ref={inputRef}
					className="ig-add-comment-input"
					placeholder="Add a comment…"
					value={commentText}
					onChange={(e) => setCommentText(e.target.value)}
					maxLength={500}
				/>
				{commentText.trim() && (
					<button
						type="submit"
						className="ig-add-comment-post"
						disabled={submitting}
					>
						{submitting ? "…" : "Post"}
					</button>
				)}
			</form>
		</article>
	);
}

// ─── Right Rail ───────────────────────────────────────────────────────────────

function RightRail({
	currentUser,
	users,
	onFollow,
	onProfileClick,
	followingIds,
	onSwitchUser,
}) {
	const suggestions = avoidConsecutiveDuplicateProfilePics(
		users
			.filter((u) => u.userName !== currentUser.userName)
			.filter((u) => u.userName !== "Ebkjaaybo")
			.filter((u) => !(currentUser.friends || []).includes(u.userName))
			.slice(0, 5),
	);

	return (
		<aside className="ig-right-rail">
			{/* Current user card */}
			<div className="ig-right-user-card">
				<button
					className="ig-right-user-avatar-btn"
					onClick={() => onProfileClick?.(currentUser.userName)}
				>
					<Avatar user={currentUser} size={44} />
				</button>
				<div className="ig-right-user-info">
					<span className="ig-right-username">
						{currentUser.userName}
					</span>
					<span className="ig-right-name">{currentUser.name}</span>
				</div>
				<button
					type="button"
					className="ig-right-switch-btn"
					onClick={onSwitchUser}
				>
					Switch
				</button>
			</div>

			{suggestions.length > 0 && (
				<>
					<div className="ig-right-suggestions-header">
						<span>Suggested for you</span>
						<button>See all</button>
					</div>
					{suggestions.map((u) => {
						const isFollowing = followingIds.has(u.userName);
						return (
							<div key={u.userName} className="ig-suggestion-row">
								<button
									className="ig-suggestion-avatar-btn"
									onClick={() => onProfileClick?.(u.userName)}
								>
									<Avatar user={u} size={32} />
								</button>
								<div className="ig-suggestion-info">
									<span className="ig-suggestion-username">
										{u.userName}
									</span>
									<span className="ig-suggestion-sub">
										{u.name || "Suggested for you"}
									</span>
								</div>
								<button
									className="ig-suggestion-follow"
									type="button"
									disabled={isFollowing}
									onClick={() => onFollow(u.userName)}
								>
									{isFollowing ? "Following..." : "Follow"}
								</button>
							</div>
						);
					})}
				</>
			)}

			<div className="ig-right-footer">
				<span>
					About · Help · Press · API · Jobs · Privacy · Terms ·
					Locations · Language · Meta Verified
				</span>
				<span style={{ marginTop: 8, display: "block" }}>
					© 2026 INSTAGRAM FROM META
				</span>
			</div>
		</aside>
	);
}

// ─── Main Feed Page ───────────────────────────────────────────────────────────

export default function MediaFeedPage({
	currentUser,
	searchQuery,
	role,
	onUpdateUser,
}) {
	const navigate = useNavigate();
	const [posts, setPosts] = useState([]);
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [igConnections, setIgConnections] = useState([]);
	const [followingIds, setFollowingIds] = useState(new Set());
	const isAdmin = role === "admin";
	const loaderRef = useRef();

	const loadPosts = useCallback(
		async (pg = 1, reset = false) => {
			setLoading(true);
			try {
				const pageNumbers =
					reset && pg === 1 ?
						Array.from(
							{ length: HOME_INITIAL_PAGE_COUNT },
							(_, index) => index + 1,
						)
					:	[pg];
				const localRequests = pageNumbers.map((pageNumber) =>
					fetchPosts(
						currentUser.userName,
						pageNumber,
						HOME_POSTS_PER_PAGE,
						searchQuery || "",
					),
				);
				const [localResults, igResult] = await Promise.all([
					Promise.allSettled(localRequests),
					pg === 1 ?
						fetchFeed({
							limit: HOME_POSTS_PER_PAGE,
							source: "instagram",
						})
					:	Promise.resolve({ items: [] }),
				]);
				const localPosts = localResults.flatMap((result) =>
					result.status === "fulfilled" ? (result.value.posts || []) : [],
				);
				const lastLocalPage =
					localResults.length > 0 ?
						localResults[localResults.length - 1]
					:	null;
				const instagramPosts =
					igResult.status === "fulfilled" ?
						normalizeInstagramFeedItems(igResult.value.items || [])
					:	[];
				const incoming = sortPostsNewestFirst([
					...localPosts,
					...instagramPosts,
				]);
				const shouldMixGeneratedFeed =
					reset && pg === 1 && !searchQuery;
				const fillerCount =
					shouldMixGeneratedFeed ?
						Math.max(
							HOME_FILLER_MIN_COUNT,
							Math.ceil(incoming.length / HOME_FILLER_INTERVAL),
						)
					:	0;
				const fillerPosts =
					shouldMixGeneratedFeed ?
						createHomeFillerPosts(fillerCount)
					:	[];
				const nextPosts =
					shouldMixGeneratedFeed ?
						interleaveHomeFillerPosts(incoming, fillerPosts)
					:	incoming;
				setPosts((prev) =>
					reset ?
						prioritizeBeltranReel(nextPosts)
					:	sortPostsNewestFirst([...prev, ...incoming]),
				);
				const localHasMore =
					lastLocalPage?.status === "fulfilled" &&
					Array.isArray(lastLocalPage.value?.posts) &&
					lastLocalPage.value.posts.length === HOME_POSTS_PER_PAGE;
				setHasMore(localHasMore);
				setPage(pageNumbers[pageNumbers.length - 1]);
			} catch {
				if (reset && pg === 1 && !searchQuery) {
					setPosts(createHomeFillerPosts(HOME_FILLER_MIN_COUNT));
					setHasMore(false);
					setPage(pg);
				}
			} finally {
				setLoading(false);
			}
		},
		[currentUser.userName, searchQuery],
	);

	const loadUsers = useCallback(async () => {
		try {
			const data = await fetchAllUsers();
			setUsers(data.users || []);
		} catch {
			/* silent */
		}
	}, []);

	const loadIgConnections = useCallback(async () => {
		if (!isAdmin) return;
		try {
			const data = await listInstagramConnections();
			setIgConnections(data.connections || []);
		} catch {
			/* silent */
		}
	}, [isAdmin]);

	useEffect(() => {
		loadPosts(1, true);
	}, [loadPosts]);
	useEffect(() => {
		loadUsers();
	}, [loadUsers]);
	useEffect(() => {
		loadIgConnections();
	}, [loadIgConnections]);

	// Infinite scroll
	useEffect(() => {
		const el = loaderRef.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					loadPosts(page + 1);
				}
			},
			{ threshold: 0.5 },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [hasMore, loading, page, loadPosts]);

	const handlePostUpdated = useCallback((updatedPost) => {
		setPosts((prev) =>
			prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
		);
	}, []);

	const handlePostDeleted = useCallback((postId) => {
		setPosts((prev) => prev.filter((p) => p.id !== postId));
	}, []);

	const handleFollow = async (targetUserName) => {
		if (followingIds.has(targetUserName)) return;
		try {
			setFollowingIds((prev) => {
				const next = new Set(prev);
				next.add(targetUserName);
				return next;
			});
			const updatedUser = await followUser(
				currentUser.userName,
				targetUserName,
			);
			onUpdateUser?.({ ...currentUser, ...updatedUser });
			await loadUsers();
		} catch {
			/* silent */
		} finally {
			setFollowingIds((prev) => {
				const next = new Set(prev);
				next.delete(targetUserName);
				return next;
			});
		}
	};

	const handleConnectIG = async () => {
		try {
			const res = await startInstagramOAuth();
			if (res.url) window.location.href = res.url;
		} catch (err) {
			alert("Could not start Instagram OAuth: " + err.message);
		}
	};

	const handleSyncIG = async () => {
		if (!igConnections.length) {
			alert("No Instagram accounts connected.");
			return;
		}
		try {
			await syncInstagramConnection(igConnections[0].id);
			await loadPosts(1, true);
		} catch (err) {
			alert("Sync failed: " + err.message);
		}
	};

	const handleProfileClick = useCallback(
		(username) => {
			navigateToProfile(navigate, username, currentUser.userName);
		},
		[currentUser.userName, navigate],
	);

	const handleSwitchUser = useCallback(async () => {
		const switchableAccounts = [
			{ userName: "averagejoe", email: "averagejoe@emaill.com", password: "1234" },
			{ userName: "demo_viewer", email: "demo@ericgram.local", password: "EricgramDemo2024!" },
			{ userName: "alice123", email: "alice@email.com", password: "password123" },
			{ userName: "JensenHuang", email: "bob@email.com", password: "mypassword" },
			{ userName: "charlie789", email: "charlie@email.com", password: "secret123" },
			{ userName: "beltran", email: "jaymanigorman@gmail.com", password: "password123" },
		];
		const currentIndex = switchableAccounts.findIndex(
			(account) => account.userName === currentUser.userName,
		);
		const nextAccount =
			switchableAccounts[
				(currentIndex + 1 + switchableAccounts.length) %
					switchableAccounts.length
			];

		try {
			const authPayload = await loginUser(nextAccount.email, nextAccount.password);
			const nextUser = authPayload?.user ?? authPayload;
			setCurrentUser(nextUser?.userName || nextAccount.userName);
			onUpdateUser?.(nextUser);
			navigate("/");
		} catch {
			/* silent */
		}
	}, [currentUser.userName, navigate, onUpdateUser]);

	return (
		<div className="ig-home-page">
			<div className="ig-home-shell">
				<main className="ig-main-column">
					{/* Stories + admin controls */}
					<div className="ig-stories-strip">
						{/* Your story */}
						<div
							className="ig-story-card"
							onClick={() => setShowCreate(true)}
						>
							<div className="ig-story-ring own-story">
								<div className="ig-story-ring-inner">
									{getUserProfilePic(currentUser) ?
										<img
											src={getUserProfilePic(currentUser)}
											alt="You"
										/>
									:	<span
											className="ig-story-initials"
											style={{ fontSize: 22 }}
										>
											+
										</span>
									}
								</div>
							</div>
							<span className="ig-story-label">Your story</span>
						</div>
					</div>

					{/* Admin controls */}
					{isAdmin && (
						<div className="ig-admin-bar">
							<button
								className="ig-admin-btn"
								onClick={() => loadPosts(1, true)}
							>
								↻ Refresh
							</button>
							<button
								className="ig-admin-btn"
								onClick={handleSyncIG}
							>
								⟳ Sync Instagram
							</button>
							<button
								className="ig-admin-btn"
								onClick={handleConnectIG}
							>
								+ Connect IG
							</button>
						</div>
					)}

					{/* Create post shortcut */}
					<div
						className="ig-create-shortcut"
						onClick={() => setShowCreate(true)}
					>
						<Avatar user={currentUser} size={32} />
						<span className="ig-create-shortcut-placeholder">
							What's on your mind,{" "}
							{currentUser.name?.split(" ")[0] ||
								currentUser.userName}
							?
						</span>
						<button className="ig-create-shortcut-btn">Post</button>
					</div>

					{/* Feed */}
					{posts.length === 0 && !loading ?
						<div className="ig-empty-state">
							<svg
								width="62"
								height="62"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1"
							>
								<rect
									x="3"
									y="3"
									width="18"
									height="18"
									rx="2"
								/>
								<circle cx="8.5" cy="8.5" r="1.5" />
								<polyline points="21 15 16 10 5 21" />
							</svg>
							<h3>No posts yet</h3>
							<p>
								Create your first post or connect an Instagram
								account to populate the feed.
							</p>
							<button
								className="ig-empty-action-btn"
								onClick={() => setShowCreate(true)}
							>
								Create Post
							</button>
							{isAdmin && (
								<button
									className="ig-empty-action-btn ig-empty-action-btn--outline"
									onClick={handleConnectIG}
								>
									Connect Instagram
								</button>
							)}
						</div>
					:	posts.map((post) => (
							<PostCard
								key={post.id}
								post={post}
								currentUser={currentUser}
								onPostUpdated={handlePostUpdated}
								onPostDeleted={handlePostDeleted}
								onProfileClick={handleProfileClick}
								onFollow={handleFollow}
								followingIds={followingIds}
							/>
						))
					}

					{loading && (
						<div className="ig-feed-loading">
							{[1, 2, 3].map((i) => (
								<div key={i} className="ig-post-skeleton">
									<div className="ig-skeleton-header">
										<div className="ig-skeleton-avatar" />
										<div className="ig-skeleton-lines">
											<div className="ig-skeleton-line short" />
											<div className="ig-skeleton-line shorter" />
										</div>
									</div>
									<div className="ig-skeleton-img" />
								</div>
							))}
						</div>
					)}

					<div ref={loaderRef} style={{ height: 40 }} />
				</main>

				<RightRail
					currentUser={currentUser}
					users={users}
					onFollow={handleFollow}
					onProfileClick={handleProfileClick}
					followingIds={followingIds}
					onSwitchUser={handleSwitchUser}
				/>
			</div>

			{showCreate && (
				<CreatePostModal
					currentUser={currentUser}
					onClose={() => setShowCreate(false)}
					onCreated={(newPost) => {
						setPosts((prev) => [newPost, ...prev]);
						setShowCreate(false);
					}}
				/>
			)}
		</div>
	);
}
