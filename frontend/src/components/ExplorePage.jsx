import { useState, useEffect, useCallback } from "react";
import {
	addComment,
	fetchFeed,
	fetchPosts,
	getMediaUrl,
	likePost,
	fetchAllUsers,
} from "../api";
import { useNavigate } from "react-router-dom";
import { seedDemoData } from "../seedDemoData";
import { getUserProfilePic } from "../utils/userProfilePic";
import "./ExplorePage.css";

const EXPLORE_FILLER_USERS = [
	"dailyvibes",
	"cityframes",
	"visualdiary",
	"weekendmood",
	"luxegrid",
	"coastallens",
	"fooddrop",
	"pixelnotes",
];

const EXPLORE_FILLER_CAPTIONS = [
	"Weekend drop",
	"Fresh on the grid",
	"Saved this moment",
	"Late night mood",
	"Tiny details matter",
	"Soft light, sharp focus",
	"Main character energy",
	"Just posted this one",
];

const BLOCKED_EXPLORE_CAPTIONS = new Set([
	"Good friends + good coffee = perfect day ☕",
]);

const EXPLORE_FILLER_SEEDS = [
	"coastline",
	"studio-shot",
	"street-food",
	"mountain-air",
	"coffee-break",
	"sunset-drive",
	"city-night",
	"minimal-desk",
	"fashion-frame",
	"weekend-hike",
	"summer-market",
	"late-lunch",
	"art-corner",
	"neon-room",
	"rooftop-view",
	"film-camera",
	"ocean-light",
	"quiet-morning",
	"gallery-wall",
	"road-trip",
	"rain-window",
	"book-table",
	"design-detail",
	"travel-note",
	"garden-path",
	"gym-session",
	"soft-portrait",
	"bistro-night",
	"lake-view",
	"urban-lines",
	"golden-hour",
	"after-hours",
];

function resolveMediaSrc(value) {
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

function normalizeInstagramFeedItems(items = []) {
	return items.map((item) => {
		const media = Array.isArray(item?.media) ? item.media : [];
		return {
			id: item.id,
			source: item.source || "instagram",
			readOnly: true,
			permalink: item.permalink || "",
			authorUserName: item.author?.userName || "instagram",
			authorDisplayName:
				item.author?.displayName || item.author?.userName || "Instagram",
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

function matchesExploreQuery(post, query) {
	if (BLOCKED_EXPLORE_CAPTIONS.has(post.caption || "")) return false;
	if (!query) return true;
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return [post.caption, post.authorUserName, post.authorDisplayName]
		.filter(Boolean)
		.some((value) => value.toLowerCase().includes(q));
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

function prioritizeBeltranReels(items = []) {
	const featured = [];
	const rest = [];

	for (const post of items) {
		if (
			post?.authorUserName === "beltran" &&
			(post?.mediaTypes || []).some((type) => type === "video")
		) {
			featured.push(post);
		} else {
			rest.push(post);
		}
	}

	return [...featured, ...rest];
}

function createExploreFillerPosts(count, existingPosts = []) {
	if (count <= 0 || EXPLORE_FILLER_SEEDS.length === 0) return [];

	return Array.from({ length: count }, (_, index) => {
		const seed =
			EXPLORE_FILLER_SEEDS[
				Math.floor(Math.random() * EXPLORE_FILLER_SEEDS.length)
			];
		const assetPath = `https://picsum.photos/seed/${encodeURIComponent(
			`${seed}-${index}-${Date.now()}`,
		)}/900/900`;
		const userName =
			EXPLORE_FILLER_USERS[
				Math.floor(Math.random() * EXPLORE_FILLER_USERS.length)
			];
		const caption =
			EXPLORE_FILLER_CAPTIONS[
				Math.floor(Math.random() * EXPLORE_FILLER_CAPTIONS.length)
			];
		const hourOffset = existingPosts.length + index + 1;
		const createdAt = new Date(
			Date.now() - hourOffset * 60 * 60 * 1000,
		).toISOString();

		return {
			id: `explore-filler-${index}-${assetPath}`,
			source: "explore-filler",
			readOnly: true,
			permalink: "",
			authorUserName: userName,
			authorDisplayName: userName,
			caption,
			createdAt,
			media: [{ url: assetPath, type: "image", thumbnailUrl: "" }],
			mediaIds: [assetPath],
			mediaTypes: ["image"],
			likedBy: [],
			comments: [],
			likeCount: Math.floor(Math.random() * 9000) + 100,
			commentCount: Math.floor(Math.random() * 200) + 5,
		};
	});
}

// ─── Seed Progress Overlay ────────────────────────────────────────────────────

function SeedOverlay({ onDone, onCancel }) {
	const [log, setLog] = useState([]);
	const [percent, setPercent] = useState(0);
	const [status, setStatus] = useState("running"); // running | done | error
	const [summary, setSummary] = useState(null);

	useEffect(() => {
		let cancelled = false;
		seedDemoData((msg, pct) => {
			if (cancelled) return;
			setLog((prev) => [...prev.slice(-30), msg]); // keep last 30 lines
			setPercent(pct);
		})
			.then((result) => {
				if (cancelled) return;
				setSummary(result);
				setStatus("done");
			})
			.catch((err) => {
				if (cancelled) return;
				setLog((prev) => [...prev, "❌ " + err.message]);
				setStatus("error");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="ig-seed-overlay">
			<div className="ig-seed-modal">
				<div className="ig-seed-header">
					<span className="ig-seed-icon">
						{status === "running" ?
							"⚙️"
						: status === "done" ?
							"✅"
						:	"❌"}
					</span>
					<h2>
						{status === "running" ?
							"Generating demo posts…"
						: status === "done" ?
							"Demo data ready!"
						:	"Something went wrong"}
					</h2>
				</div>

				{/* Progress bar */}
				<div className="ig-seed-progress-bar">
					<div
						className="ig-seed-progress-fill"
						style={{
							width: `${percent}%`,
							background:
								status === "done" ? "#4caf50" : undefined,
						}}
					/>
				</div>
				<p className="ig-seed-percent">{percent}%</p>

				{/* Log */}
				<div className="ig-seed-log">
					{log.map((line, i) => (
						<div key={i} className="ig-seed-log-line">
							{line}
						</div>
					))}
				</div>

				{/* Summary / actions */}
				{status === "done" && summary && (
					<div className="ig-seed-summary">
						<p>
							Created <strong>{summary.usersCreated}</strong>{" "}
							users &amp; <strong>{summary.postsCreated}</strong>{" "}
							posts.
						</p>
						<button className="ig-seed-done-btn" onClick={onDone}>
							View explore →
						</button>
					</div>
				)}

				{status === "error" && (
					<div className="ig-seed-summary">
						<button className="ig-seed-done-btn" onClick={onDone}>
							Close
						</button>
					</div>
				)}

				{status === "running" && (
					<button className="ig-seed-cancel-btn" onClick={onCancel}>
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}

// ─── Explore Page ─────────────────────────────────────────────────────────────

export default function ExplorePage({
	currentUser,
	searchQuery,
	setSearchQuery,
}) {
	const navigate = useNavigate();
	const [posts, setPosts] = useState([]);
	const [suggestions, setSuggestions] = useState([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [loading, setLoading] = useState(true);
	const [searching, setSearching] = useState(false);
	const [selected, setSelected] = useState(null);
	const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
	const [commentDraft, setCommentDraft] = useState("");
	const [submittingComment, setSubmittingComment] = useState(false);
	const [seeding, setSeeding] = useState(false);
	const [autoSeeded, setAutoSeeded] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [localResult, igResult] = await Promise.allSettled([
				fetchPosts(currentUser.userName, 1, 60, searchQuery || ""),
				fetchFeed({ limit: 60, source: "instagram" }),
			]);
			const localPosts =
				localResult.status === "fulfilled" ? (localResult.value.posts || []) : [];
			const instagramPosts =
				igResult.status === "fulfilled" ?
					normalizeInstagramFeedItems(igResult.value.items || []).filter(
						(post) => matchesExploreQuery(post, searchQuery || ""),
					)
				:	[];
			const combinedPosts = sortPostsNewestFirst([
				...localPosts,
				...instagramPosts,
			]);
			const fillerPosts =
				!searchQuery && combinedPosts.length < 24 ?
					createExploreFillerPosts(24 - combinedPosts.length, combinedPosts)
				:	[];
			setPosts(
				prioritizeBeltranReels(
					sortPostsNewestFirst([...combinedPosts, ...fillerPosts]),
				),
			);
		} catch {
			/* silent */
		} finally {
			setLoading(false);
		}
	}, [currentUser.userName, searchQuery]);

	useEffect(() => {
		load();
	}, [load]);

	// Fetch suggestions as searching
	useEffect(() => {
		if (!searchQuery) {
			setSuggestions([]);
			setSearching(false);
			return;
		}

		const delay = setTimeout(async () => {
			setSearching(true);
			try {
				// We'll search for users as primary suggestions (Insta-style)
				const { users } = await fetchAllUsers();
				const q = searchQuery.toLowerCase();
				const filteredUsers = users
					.filter(
						(u) =>
							u.userName?.toLowerCase().includes(q) ||
							u.name?.toLowerCase().includes(q),
					)
					.slice(0, 8); // top 8

				setSuggestions(filteredUsers);
			} catch (err) {
				console.error("Suggestion fetch failed:", err);
			} finally {
				setSearching(false);
			}
		}, 300); // 300ms debounce

		return () => clearTimeout(delay);
	}, [searchQuery]);

	const handleSelectSuggestion = (user) => {
		setShowSuggestions(false);
		navigate(`/profile/${user.userName}`);
	};

	// Auto-seed if the explore feed is completely empty
	useEffect(() => {
		if (
			!loading &&
			posts.length === 0 &&
			!searchQuery &&
			!autoSeeded &&
			!seeding
		) {
			setSeeding(true);
		}
	}, [loading, posts.length, searchQuery, autoSeeded, seeding]);

	const handleLike = async (post) => {
		if (post?.readOnly) {
			if (post.permalink) window.open(post.permalink, "_blank", "noopener,noreferrer");
			return;
		}
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

	const handleOpenPost = (post) => {
		setSelected(post);
		setSelectedMediaIndex(0);
		setCommentDraft("");
	};

	const handleClosePost = () => {
		setSelected(null);
		setSelectedMediaIndex(0);
		setCommentDraft("");
	};

	const handleSubmitComment = async () => {
		if (!selected || !commentDraft.trim() || submittingComment) return;
		if (selected.readOnly) {
			if (selected.permalink)
				window.open(selected.permalink, "_blank", "noopener,noreferrer");
			return;
		}
		try {
			setSubmittingComment(true);
			const res = await addComment(
				selected.id,
				currentUser.userName,
				commentDraft.trim(),
			);
			setPosts((prev) =>
				prev.map((p) => (p.id === selected.id ? res.post : p)),
			);
			setSelected(res.post);
			setCommentDraft("");
		} catch {
			/* silent */
		} finally {
			setSubmittingComment(false);
		}
	};

	const handleSeedDone = async () => {
		setSeeding(false);
		setAutoSeeded(true);
		await load();
	};

	const selectedMedia = selected?.mediaIds || [];
	const selectedMediaType = selected?.mediaTypes?.[selectedMediaIndex];
	const selectedMediaId = selectedMedia[selectedMediaIndex];
	const selectedIsVideo =
		selectedMediaType === "video" ||
		selectedMediaId?.includes("video");
	const selectedLikes = (selected?.likedBy || []).length;
	const selectedComments = selected?.comments || [];
	const isSelectedLiked = (selected?.likedBy || []).includes(
		currentUser.userName,
	);
	const selectedIsReadOnly = Boolean(selected?.readOnly);

	// ── render ──
	const isEmpty = !loading && posts.length === 0;

	return (
		<div className="ig-explore-page">
			<div className="ig-explore-header">
				<div className="ig-explore-search-wrap">
					<svg
						className="ig-explore-search-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						className="ig-explore-search-input"
						placeholder="Search posts, captions, or users..."
						value={searchQuery || ""}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setShowSuggestions(true);
						}}
						onFocus={() => setShowSuggestions(true)}
						autoFocus
					/>
					{searchQuery && (
						<button
							className="ig-explore-search-clear"
							onClick={() => {
								setSearchQuery("");
								setSuggestions([]);
							}}
						>
							✕
						</button>
					)}

					{/* Search Dropdown */}
					{showSuggestions && searchQuery && (
						<div className="ig-explore-search-dropdown animate-scale-in">
							{searching ?
								<div className="ig-dropdown-loading">
									<div className="ig-spinner ig-spinner--sm" />
									Searching...
								</div>
							: suggestions.length > 0 ?
								<div className="ig-dropdown-results">
									<p className="ig-dropdown-section-title">
										Accounts
									</p>
									{suggestions.map((u) => (
										<button
											key={u.userName}
											className="ig-dropdown-item"
											onClick={() =>
												handleSelectSuggestion(u)
											}
										>
											<div className="ig-dropdown-avatar">
												{getUserProfilePic(u) ?
													<img
														src={getUserProfilePic(u)}
														alt={u.userName}
													/>
												:	(u.name ||
														u.userName ||
														"U")[0].toUpperCase()
												}
											</div>
											<div className="ig-dropdown-info">
												<span className="ig-dropdown-username">
													{u.userName}
												</span>
												<span className="ig-dropdown-name">
													{u.name}
												</span>
											</div>
										</button>
									))}
								</div>
							:	<div className="ig-dropdown-no-results">
									No results found for "{searchQuery}"
								</div>
							}
						</div>
					)}
				</div>
				{/* Click away from dropdown */}
				{showSuggestions && (
					<div
						className="ig-dropdown-backdrop"
						onClick={() => setShowSuggestions(false)}
					/>
				)}
				<h1 className="ig-explore-title">Explore</h1>
			</div>

			{/* Empty state handles */}
			{isEmpty && autoSeeded ?
				<div className="ig-explore-seed-prompt">
					<div className="ig-explore-seed-icon">🖼️</div>
					<h2>No posts available</h2>
					<p>
						Demo post generation finished, but the feed is still
						empty.
					</p>
				</div>
			: isEmpty && !autoSeeded ?
				<div className="ig-explore-seed-prompt">
					<div className="ig-explore-seed-icon">⏳</div>
					<h2>Preparing Explore Feed…</h2>
					<p>
						We are automatically generating sample posts so you can
						see how things look.
					</p>
				</div>
			: loading ?
				<div className="ig-explore-grid">
					{Array.from({ length: 18 }).map((_, i) => (
						<div key={i} className="ig-explore-skeleton" />
					))}
				</div>
			:	<div className="ig-explore-grid">
					{posts.map((post, i) => {
						const firstMedia = post.mediaIds?.[0];
						const liked = (post.likedBy || []).includes(
							currentUser.userName,
						);
						const isLarge = i % 7 === 0;
						return (
							<button
								key={post.id}
								className={`ig-explore-cell ${isLarge ? "ig-explore-cell--large" : ""}`}
								onClick={() => handleOpenPost(post)}
							>
								{firstMedia ?
									(
										post.mediaTypes?.[0] === "video" ||
										firstMedia.includes("video")
									) ?
										<div className="ig-explore-video-wrap">
											<video
												src={resolveMediaSrc(firstMedia)}
												className="ig-explore-img"
												autoPlay
												loop
												muted
												playsInline
												preload="metadata"
											/>
											<div className="ig-reels-icon-overlay">
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
													<path d="M9 2v20" />
													<path d="M2 9h20" />
												</svg>
											</div>
										</div>
									:	<img
											src={resolveMediaSrc(firstMedia)}
											alt={post.caption || "post"}
											className="ig-explore-img"
											loading="lazy"
										/>

								:	<div className="ig-explore-text-cell">
										<p>{post.caption}</p>
									</div>
								}
								{post.readOnly && (
									<div className="ig-explore-source-badge">
										Instagram
									</div>
								)}
								{/* Author badge */}
								<div className="ig-explore-author-badge">
									@{post.authorUserName}
								</div>
								<div className="ig-explore-overlay">
									<span
										className={liked ? "liked-count" : ""}
									>
										♥ {(post.likedBy || []).length}
									</span>
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
					onClick={handleClosePost}
				>
					<div
						className="ig-lightbox"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="ig-lightbox-close"
							onClick={handleClosePost}
						>
							✕
						</button>
						<div className="ig-lightbox-media">
							{selectedMediaId ?
								selectedIsVideo ?
									<video
										src={resolveMediaSrc(selectedMediaId)}
										className="ig-lightbox-img"
										controls
										autoPlay
										playsInline
									/>
								:	<img
										src={resolveMediaSrc(selectedMediaId)}
										alt=""
										className="ig-lightbox-img"
									/>

							:	<div className="ig-lightbox-no-media">
									<p>{selected.caption}</p>
								</div>
							}
							{selectedMedia.length > 1 && (
								<>
									<button
										className="ig-lightbox-nav ig-lightbox-nav--prev"
										onClick={() =>
											setSelectedMediaIndex((prev) =>
												prev === 0 ?
													selectedMedia.length - 1
												:	prev - 1,
											)
										}
									>
										‹
									</button>
									<button
										className="ig-lightbox-nav ig-lightbox-nav--next"
										onClick={() =>
											setSelectedMediaIndex((prev) =>
												(prev + 1) % selectedMedia.length,
											)
										}
									>
										›
									</button>
									<div className="ig-lightbox-dots">
										{selectedMedia.map((_, index) => (
											<button
												key={index}
												className={`ig-lightbox-dot${index === selectedMediaIndex ? " active" : ""}`}
												onClick={() =>
													setSelectedMediaIndex(index)
												}
											/>
										))}
									</div>
								</>
							)}
						</div>
						<div className="ig-lightbox-info">
							<div className="ig-lightbox-header">
								<div className="ig-lightbox-author">
									<div className="ig-lightbox-avatar">
										{(
											selected.authorDisplayName ||
											selected.authorUserName ||
											"U"
										)[0].toUpperCase()}
									</div>
									<div className="ig-lightbox-author-meta">
										<strong>@{selected.authorUserName}</strong>
										<span>
											{selected.authorDisplayName ||
												"EricGram creator"}
										</span>
									</div>
								</div>
								<button className="ig-lightbox-more">•••</button>
							</div>

							<div className="ig-lightbox-thread">
								<div className="ig-lightbox-thread-item">
									<div className="ig-lightbox-avatar">
										{(
											selected.authorDisplayName ||
											selected.authorUserName ||
											"U"
										)[0].toUpperCase()}
									</div>
									<div className="ig-lightbox-thread-body">
										<p className="ig-lightbox-caption">
											<strong>
												@{selected.authorUserName}
											</strong>{" "}
											{selected.caption || "New post"}
										</p>
										<span className="ig-lightbox-meta">
											{selected.createdAt || "Just now"}
										</span>
									</div>
								</div>
								{selectedComments.map((c) => (
									<div
										key={c.id}
										className="ig-lightbox-thread-item"
									>
										<div className="ig-lightbox-avatar">
											{(c.authorUserName || "U")[0].toUpperCase()}
										</div>
										<div className="ig-lightbox-thread-body">
											<div className="ig-lightbox-comment-row">
												<p className="ig-lightbox-comment">
													<strong>
														@{c.authorUserName}
													</strong>{" "}
													{c.text}
												</p>
												<button className="ig-lightbox-comment-like">
													♡
												</button>
											</div>
											<span className="ig-lightbox-meta">
												{c.createdAt || "Moments ago"}
											</span>
										</div>
									</div>
								))}
							</div>

							<div className="ig-lightbox-actions">
								<button
									className={`ig-lightbox-like ${(selected.likedBy || []).includes(currentUser.userName) ? "liked" : ""}`}
									onClick={() => handleLike(selected)}
								>
									<svg
										viewBox="0 0 24 24"
										fill={isSelectedLiked ? "currentColor" : "none"}
										stroke="currentColor"
										strokeWidth="1.8"
										aria-hidden="true"
									>
										<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
									</svg>
								</button>
								<button
									className="ig-lightbox-icon-btn"
									onClick={() => {
										if (selectedIsReadOnly && selected.permalink)
											window.open(
												selected.permalink,
												"_blank",
												"noopener,noreferrer",
											);
									}}
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
										aria-hidden="true"
									>
										<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
									</svg>
								</button>
								<button
									className="ig-lightbox-icon-btn"
									onClick={() => {
										if (selected.permalink)
											window.open(
												selected.permalink,
												"_blank",
												"noopener,noreferrer",
											);
									}}
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
										aria-hidden="true"
									>
										<line x1="22" y1="2" x2="11" y2="13" />
										<polygon points="22 2 15 22 11 13 2 9 22 2" />
									</svg>
								</button>
								<button
									className="ig-lightbox-save"
									onClick={() => {
										if (selected.permalink)
											window.open(
												selected.permalink,
												"_blank",
												"noopener,noreferrer",
											);
									}}
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
										aria-hidden="true"
									>
										<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
									</svg>
								</button>
							</div>

							<div className="ig-lightbox-stats">
								<strong>{selectedLikes} likes</strong>
								<span>{selectedComments.length} comments</span>
								<span>{selected.createdAt || "Just now"}</span>
							</div>

							{selectedIsReadOnly ?
								(selected.permalink && (
									<div className="ig-lightbox-compose">
										<a
											href={selected.permalink}
											target="_blank"
											rel="noreferrer"
											className="ig-lightbox-input"
											style={{ textDecoration: "none" }}
										>
											Open this post on Instagram
										</a>
									</div>
								))
							:	<div className="ig-lightbox-compose">
									<input
										type="text"
										value={commentDraft}
										onChange={(e) =>
											setCommentDraft(e.target.value)
										}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleSubmitComment();
											}
										}}
										placeholder="Add a comment..."
										className="ig-lightbox-input"
									/>
									<button
										className="ig-lightbox-post-btn"
										onClick={handleSubmitComment}
										disabled={
											!commentDraft.trim() ||
											submittingComment
										}
									>
										{submittingComment ? "Posting..." : "Post"}
									</button>
								</div>
							}
						</div>
					</div>
				</div>
			)}

			{/* Seed progress overlay */}
			{seeding && (
				<SeedOverlay
					onDone={handleSeedDone}
					onCancel={() => setSeeding(false)}
				/>
			)}
		</div>
	);
}
