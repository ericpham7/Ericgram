import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllUsers, sendMessage, getMessages, getMediaUrl } from "../api";
import { DEFAULT_PROFILE_PIC } from "../utils/defaultProfilePic";
import { getUserProfilePic } from "../utils/userProfilePic";
import { navigateToProfile } from "../utils/profileNavigation";
import "./MessagesPage.css";

function timeStr(ts) {
	if (!ts) return "";
	const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timestampValue(ts) {
	if (!ts) return 0;
	const n = new Date(ts).getTime();
	return Number.isFinite(n) ? n : 0;
}

function buildThread(user, threadMessages, currentUserName) {
	const messages = Array.isArray(threadMessages) ? threadMessages : [];
	const lastMessage = messages[messages.length - 1] || null;
	const previewText =
		lastMessage ?
			`${lastMessage.from === currentUserName ? "You: " : ""}${lastMessage.text}`
		:	"Start a conversation";

	return {
		user,
		hasMessages: messages.length > 0,
		messageCount: messages.length,
		lastMessage,
		previewText,
		lastTimestamp: lastMessage?.timestamp || lastMessage?.sentAt || "",
	};
}

function sortThreads(threads) {
	return [...threads].sort((a, b) => {
		if (a.hasMessages !== b.hasMessages) {
			return a.hasMessages ? -1 : 1;
		}

		const timeDiff =
			timestampValue(b.lastTimestamp) - timestampValue(a.lastTimestamp);
		if (timeDiff !== 0) {
			return timeDiff;
		}

		return a.user.userName.localeCompare(b.user.userName);
	});
}

function Avatar({ user, size = 36 }) {
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
					flexShrink: 0,
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
				flexShrink: 0,
			}}
		>
			{initials}
		</div>
	);
}

export default function MessagesPage({ currentUser }) {
	const navigate = useNavigate();
	const [threads, setThreads] = useState([]);
	const [selectedUserName, setSelectedUserName] = useState("");
	const [messages, setMessages] = useState([]);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(false);
	const [directoryLoading, setDirectoryLoading] = useState(true);
	const [directoryError, setDirectoryError] = useState("");
	const [activeTab, setActiveTab] = useState("primary");
	const [composerOpen, setComposerOpen] = useState(false);
	const [composerQuery, setComposerQuery] = useState("");
	const [imageFile, setImageFile] = useState(null);
	const [imagePreview, setImagePreview] = useState("");
	const fileInputRef = useRef();
	const bottomRef = useRef();
	const pollRef = useRef();

	const updateThreadSummary = useCallback(
		(userName, nextMessages) => {
			setThreads((prev) =>
				sortThreads(
					prev.map((thread) =>
						thread.user.userName === userName ?
							buildThread(
								thread.user,
								nextMessages,
								currentUser.userName,
							)
						:	thread,
					),
				),
			);
		},
		[currentUser.userName],
	);

	const loadDirectory = useCallback(async () => {
		setDirectoryLoading(true);
		setDirectoryError("");
		try {
			const data = await fetchAllUsers();
			const otherUsers = (data.users || []).filter(
				(u) => u.userName !== currentUser.userName,
			);
			const threadEntries = await Promise.all(
				otherUsers.map(async (user) => {
					try {
						const conversation = await getMessages(
							currentUser.userName,
							user.userName,
						);
						return buildThread(
							user,
							conversation.messages || [],
							currentUser.userName,
						);
					} catch {
						return buildThread(user, [], currentUser.userName);
					}
				}),
			);

			const sortedThreads = sortThreads(threadEntries);
			setThreads(sortedThreads);
			setSelectedUserName((prev) =>
				sortedThreads.some((thread) => thread.user.userName === prev) ?
					prev
				:	"",
			);
		} catch (err) {
			setThreads([]);
			setSelectedUserName("");
			setDirectoryError(err.message || "Could not load messages.");
		} finally {
			setDirectoryLoading(false);
		}
	}, [currentUser.userName]);

	useEffect(() => {
		loadDirectory();
	}, [loadDirectory]);

	const loadMessages = useCallback(
		async (targetUserName = selectedUserName) => {
			if (!targetUserName) return;
			const data = await getMessages(
				currentUser.userName,
				targetUserName,
			);
			const nextMessages = data.messages || [];
			setMessages(nextMessages);
			updateThreadSummary(targetUserName, nextMessages);
		},
		[currentUser.userName, selectedUserName, updateThreadSummary],
	);

	useEffect(() => {
		if (!selectedUserName) {
			setMessages([]);
			clearInterval(pollRef.current);
			return;
		}

		setLoading(true);
		setMessages([]);
		loadMessages(selectedUserName)
			.catch(() => {})
			.finally(() => setLoading(false));

		clearInterval(pollRef.current);
		pollRef.current = setInterval(() => {
			loadMessages(selectedUserName).catch(() => {});
		}, 3000);

		return () => clearInterval(pollRef.current);
	}, [selectedUserName, loadMessages]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const openConversation = useCallback(
		(userName) => {
			const thread = threads.find(
				(item) => item.user.userName === userName,
			);
			if (!thread) return;
			setSelectedUserName(userName);
			setActiveTab(thread.hasMessages ? "primary" : "general");
			setComposerOpen(false);
			setComposerQuery("");
		},
		[threads],
	);

	const handleProfileClick = useCallback(
		(userName) => {
			setComposerOpen(false);
			navigateToProfile(navigate, userName, currentUser.userName);
		},
		[currentUser.userName, navigate],
	);

	const handleFileChange = (e) => {
		const file = e.target.files?.[0];
		if (file) {
			setImageFile(file);
			const reader = new FileReader();
			reader.onload = (event) => setImagePreview(event.target.result);
			reader.readAsDataURL(file);
		}
		// Reset input so choosing same file works
		e.target.value = "";
	};

	const removeImage = () => {
		setImageFile(null);
		setImagePreview("");
	};

	const handleSend = async (e) => {
		if (e) e.preventDefault();
		if (sending || !selectedUserName) return;
		if (!text.trim() && !imageFile) return;

		const msg = text.trim();
		const file = imageFile;

		setSending(true);
		setText("");
		setImageFile(null);
		setImagePreview("");

		try {
			await sendMessage(
				currentUser.userName,
				selectedUserName,
				msg,
				file,
			);
			await loadMessages(selectedUserName);
			setActiveTab("primary");
		} catch {
			setText(msg);
			setImageFile(file);
			// Re-read preview if needed or just keep it simple
		} finally {
			setSending(false);
		}
	};

	const selectedThread =
		threads.find((thread) => thread.user.userName === selectedUserName) ||
		null;
	const visibleThreads = threads.filter((thread) =>
		activeTab === "primary" ? thread.hasMessages : !thread.hasMessages,
	);
	const filteredComposerThreads = threads.filter((thread) => {
		const query = composerQuery.trim().toLowerCase();
		if (!query) return true;
		return (
			thread.user.userName.toLowerCase().includes(query) ||
			(thread.user.name || "").toLowerCase().includes(query)
		);
	});
	const emptyListCopy =
		activeTab === "primary" ?
			"No primary conversations yet."
		:	"No users waiting in General.";

	return (
		<div className="ig-messages-page">
			<aside className="ig-dm-sidebar">
				<div className="ig-dm-sidebar-header">
					<strong>{currentUser.userName}</strong>
					<button
						type="button"
						className="ig-dm-compose-btn"
						onClick={() => setComposerOpen(true)}
						title="New message"
						aria-label="New message"
					>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
						</svg>
					</button>
				</div>

				<div className="ig-dm-tabs">
					<button
						type="button"
						className={`ig-dm-tab ${activeTab === "primary" ? "active" : ""}`}
						onClick={() => setActiveTab("primary")}
					>
						Primary
					</button>
					<button
						type="button"
						className={`ig-dm-tab ${activeTab === "general" ? "active" : ""}`}
						onClick={() => setActiveTab("general")}
					>
						General
					</button>
				</div>

				<div className="ig-dm-list">
					{directoryLoading && (
						<p className="ig-dm-empty-hint">
							Loading conversations…
						</p>
					)}

					{!directoryLoading && directoryError && (
						<div className="ig-dm-error-state">
							<p>{directoryError}</p>
							<button
								type="button"
								className="ig-dm-retry-btn"
								onClick={loadDirectory}
							>
								Retry
							</button>
						</div>
					)}

					{!directoryLoading &&
						!directoryError &&
						visibleThreads.length === 0 && (
							<p className="ig-dm-empty-hint">{emptyListCopy}</p>
						)}

					{!directoryLoading &&
						!directoryError &&
						visibleThreads.map((thread) => (
							<div
								key={thread.user.userName}
								className={`ig-dm-item ${selectedUserName === thread.user.userName ? "active" : ""}`}
								onClick={() =>
									openConversation(thread.user.userName)
								}
								onKeyDown={(event) => {
									if (
										event.key === "Enter" ||
										event.key === " "
									) {
										event.preventDefault();
										openConversation(
											thread.user.userName,
										);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<button
									type="button"
									className="ig-dm-avatar-btn"
									onClick={(event) => {
										event.stopPropagation();
										handleProfileClick(
											thread.user.userName,
										);
									}}
									aria-label={`Open ${thread.user.userName}'s profile`}
								>
									<Avatar user={thread.user} size={44} />
								</button>
								<div className="ig-dm-item-info">
									<div className="ig-dm-item-topline">
										<span className="ig-dm-item-username">
											{thread.user.userName}
										</span>
										{thread.lastTimestamp && (
											<time className="ig-dm-item-time">
												{timeStr(thread.lastTimestamp)}
											</time>
										)}
									</div>
									<span className="ig-dm-item-name">
										{thread.hasMessages ?
											thread.previewText
										:	thread.user.name}
									</span>
								</div>
							</div>
						))}
				</div>
			</aside>

			<main className="ig-chat-pane">
				{!selectedThread ?
					<div className="ig-chat-empty">
						<svg
							width="64"
							height="64"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1"
						>
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>
						<h2>Your messages</h2>
						<p>Send a message to start a conversation.</p>
						<button
							type="button"
							className="ig-chat-empty-btn"
							onClick={() => setComposerOpen(true)}
							disabled={threads.length === 0}
						>
							Send message
						</button>
					</div>
				:	<>
						<div className="ig-chat-header">
							<button
								type="button"
								className="ig-chat-avatar-btn"
								onClick={() =>
									handleProfileClick(
										selectedThread.user.userName,
									)
								}
								aria-label={`Open ${selectedThread.user.userName}'s profile`}
							>
								<Avatar user={selectedThread.user} size={32} />
							</button>
							<div className="ig-chat-header-meta">
								<span className="ig-chat-header-name">
									{selectedThread.user.userName}
								</span>
								<span className="ig-chat-header-subtitle">
									{selectedThread.user.name || "EricGram"}
								</span>
							</div>
						</div>

						<div className="ig-chat-messages">
							{loading && (
								<div className="ig-chat-loading">Loading…</div>
							)}
							{!loading && messages.length === 0 && (
								<div className="ig-chat-no-messages">
									<button
										type="button"
										className="ig-chat-avatar-btn"
										onClick={() =>
											handleProfileClick(
												selectedThread.user.userName,
											)
										}
										aria-label={`Open ${selectedThread.user.userName}'s profile`}
									>
										<Avatar
											user={selectedThread.user}
											size={56}
										/>
									</button>
									<p>
										<strong>
											{selectedThread.user.name ||
												selectedThread.user.userName}
										</strong>
									</p>
									<span>
										{selectedThread.user.userName} ·
										EricGram
									</span>
									<p className="ig-chat-starter-copy">
										Start a conversation from the input
										below.
									</p>
								</div>
							)}
							{messages.map((m, i) => {
								const mine = m.from === currentUser.userName;
								const mUrl =
									m.mediaId ?
										getMediaUrl(m.mediaId)
									:	m.mediaUrl;
								const hasText = !!m.text;

								return (
									<div
										key={`${m.timestamp || "msg"}-${i}`}
										className={`ig-message-bubble-wrap ${mine ? "mine" : "theirs"}`}
									>
										{!mine && (
											<button
												type="button"
												className="ig-chat-avatar-btn"
												onClick={() =>
													handleProfileClick(
														selectedThread.user.userName,
													)
												}
												aria-label={`Open ${selectedThread.user.userName}'s profile`}
											>
												<Avatar
													user={selectedThread.user}
													size={24}
												/>
											</button>
										)}
										<div
											className={`ig-message-bubble ${mine ? "mine" : "theirs"} ${mUrl ? "has-image" : ""} ${mUrl && !hasText ? "image-only" : ""}`}
										>
											{mUrl && (
												<div className="ig-message-image-wrap">
													<img
														src={mUrl}
														alt="sent"
														className="ig-message-image"
														loading="lazy"
													/>
												</div>
											)}
											{m.text && <span>{m.text}</span>}
											<time className="ig-message-time">
												{timeStr(
													m.sentAt || m.timestamp,
												)}
											</time>
										</div>
									</div>
								);
							})}
							<div ref={bottomRef} />
						</div>

						<form
							className="ig-chat-input-container"
							onSubmit={handleSend}
						>
							{imagePreview && (
								<div className="ig-chat-preview-bar">
									<div className="ig-chat-preview-thumb">
										<img src={imagePreview} alt="preview" />
										<button
											type="button"
											className="ig-chat-preview-remove"
											onClick={removeImage}
										>
											✕
										</button>
									</div>
								</div>
							)}
							<div className="ig-chat-input-row">
								<input
									type="file"
									accept="image/*"
									style={{ display: "none" }}
									ref={fileInputRef}
									onChange={handleFileChange}
								/>
								<button
									type="button"
									className="ig-chat-media-btn"
									onClick={() =>
										fileInputRef.current?.click()
									}
									title="Choose photo"
								>
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<rect
											x="3"
											y="3"
											width="18"
											height="18"
											rx="2"
											ry="2"
										/>
										<circle cx="8.5" cy="8.5" r="1.5" />
										<polyline points="21 15 16 10 5 21" />
									</svg>
								</button>
								<input
									className="ig-chat-input"
									placeholder={`Message ${selectedThread.user.userName}…`}
									value={text}
									onChange={(e) => setText(e.target.value)}
									autoComplete="off"
								/>
								<button
									type="submit"
									className={`ig-chat-send ${text.trim() || imageFile ? "active" : ""}`}
									disabled={
										(!text.trim() && !imageFile) || sending
									}
								>
									Send
								</button>
							</div>
						</form>
					</>
				}
			</main>

			{composerOpen && (
				<div
					className="ig-dm-compose-overlay"
					onClick={() => setComposerOpen(false)}
				>
					<div
						className="ig-dm-compose-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="ig-dm-compose-modal-header">
							<strong>New message</strong>
							<button
								type="button"
								className="ig-dm-compose-close"
								onClick={() => setComposerOpen(false)}
								aria-label="Close new message dialog"
							>
								✕
							</button>
						</div>

						<div className="ig-dm-compose-search">
							<label htmlFor="dm-compose-search">To:</label>
							<input
								id="dm-compose-search"
								type="text"
								value={composerQuery}
								onChange={(e) =>
									setComposerQuery(e.target.value)
								}
								placeholder="Search by username or name"
								autoComplete="off"
							/>
						</div>

						<div className="ig-dm-compose-list">
							{filteredComposerThreads.length === 0 ?
								<p className="ig-dm-empty-hint">
									No users match that search.
								</p>
							:	filteredComposerThreads.map((thread) => (
									<div
										key={thread.user.userName}
										className="ig-dm-compose-item"
										onClick={() =>
											openConversation(
												thread.user.userName,
											)
										}
										onKeyDown={(event) => {
											if (
												event.key === "Enter" ||
												event.key === " "
											) {
												event.preventDefault();
												openConversation(
													thread.user.userName,
												);
											}
										}}
										role="button"
										tabIndex={0}
									>
										<button
											type="button"
											className="ig-dm-avatar-btn"
											onClick={(event) => {
												event.stopPropagation();
												handleProfileClick(
													thread.user.userName,
												);
											}}
											aria-label={`Open ${thread.user.userName}'s profile`}
										>
											<Avatar
												user={thread.user}
												size={40}
											/>
										</button>
										<div className="ig-dm-item-info">
											<span className="ig-dm-item-username">
												{thread.user.userName}
											</span>
											<span className="ig-dm-item-name">
												{thread.user.name}
											</span>
										</div>
									</div>
								))
							}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
