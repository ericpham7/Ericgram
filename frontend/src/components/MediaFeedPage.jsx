import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchFeed,
  listInstagramConnections,
  startInstagramOAuth,
  syncInstagramConnection,
} from "../api";
import "./MediaFeedPage.css";

/* ─── Helpers ─────────────────────────────────────────────── */

function getInitials(name) {
  if (!name) return "??";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (isNaN(parsed)) return value;
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

/* ─── Avatar ──────────────────────────────────────────────── */
function Avatar({ src, name, size = 42 }) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);
  const style = {
    width: size, height: size, borderRadius: "50%",
    overflow: "hidden", flexShrink: 0,
    background: "#333",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: Math.round(size * 0.36), fontWeight: 700, color: "#fff",
  };
  if (src && !failed) {
    return (
      <div style={style}>
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setFailed(true)} />
      </div>
    );
  }
  return <div style={style}>{initials}</div>;
}

/* ─── SVG Icons ───────────────────────────────────────────── */
function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill={filled ? "#ed4956" : "none"}
        stroke={filled ? "#ed4956" : "currentColor"}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
    </svg>
  );
}

/* ─── Post Card ───────────────────────────────────────────── */
function PostCard({ item, currentUser, onActionNotice }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const menuRef = useRef(null);

  const displayName = item.author?.displayName || item.author?.userName || "Unknown";
  const userName = item.author?.userName || "user";
  const postedAt = formatTime(item.createdAt);
  const media = item.media || [];
  const currentMedia = media[mediaIndex];

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLike = () => {
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikeCount((c) => (nowLiked ? c + 1 : Math.max(0, c - 1)));
  };

  const handleShare = async () => {
    const link = item.permalink?.startsWith("http") ? item.permalink : window.location.href;
    const ok = await copyText(link);
    onActionNotice?.(ok ? "Link copied to clipboard." : "Could not copy link.");
  };

  const handlePostMenu = async (action) => {
    setMenuOpen(false);
    if (action === "open" && item.permalink?.startsWith("http")) {
      window.open(item.permalink, "_blank", "noopener,noreferrer");
    } else if (action === "copy") {
      const ok = await copyText(item.caption || "");
      onActionNotice?.(ok ? "Caption copied." : "Could not copy caption.");
    } else if (action === "report") {
      onActionNotice?.("Reported (demo behavior).");
    }
  };

  const caption = item.caption || "";
  const longCaption = caption.length > 120;
  const displayCaption = (!captionExpanded && longCaption) ? caption.slice(0, 120) + "…" : caption;

  return (
    <article className="ig-post-card">
      {/* Header */}
      <div className="ig-post-header">
        <div className="ig-author-row">
          <div className="ig-author-avatar-wrap">
            <div className="ig-author-avatar has-story">
              <Avatar src={item.author?.avatarUrl} name={displayName} size={42} />
            </div>
          </div>
          <div className="ig-author-info">
            <span className="ig-author-handle">{userName}</span>
            {item.source && <span className="ig-author-meta">{item.source} · {postedAt}</span>}
          </div>
          {!following && (
            <>
              <span style={{ color: "var(--ig-text-secondary)", fontSize: 14 }}>•</span>
              <button className="ig-author-follow-btn" onClick={() => setFollowing(true)}>
                Follow
              </button>
            </>
          )}
        </div>

        {/* Three-dot */}
        <div className="ig-post-menu-wrap" ref={menuRef}>
          <button className="ig-post-more" onClick={() => setMenuOpen((p) => !p)} aria-label="Post options">
            <svg viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.2" fill="currentColor" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
              <circle cx="19" cy="12" r="1.2" fill="currentColor" />
            </svg>
          </button>
          {menuOpen && (
            <div className="ig-post-menu animate-scale-in">
              {item.permalink?.startsWith("http") && (
                <>
                  <button onClick={() => handlePostMenu("open")}>Open on Instagram</button>
                  <div className="ig-post-menu-divider" />
                </>
              )}
              <button onClick={() => handlePostMenu("copy")}>Copy caption</button>
              <div className="ig-post-menu-divider" />
              <button className="danger" onClick={() => handlePostMenu("report")}>Report</button>
              <div className="ig-post-menu-divider" />
              <button onClick={() => setMenuOpen(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Media */}
      <div className="ig-media-frame">
        {currentMedia?.type === "video" ? (
          <video
            className="ig-post-media cover"
            src={currentMedia.url}
            poster={currentMedia.thumbnailUrl}
            autoPlay muted loop playsInline
          />
        ) : currentMedia?.url ? (
          <img
            className="ig-post-media"
            src={currentMedia.url}
            alt={caption || item.id}
            loading="lazy"
          />
        ) : (
          <div className="ig-post-media ig-post-media-empty">No media available</div>
        )}

        {media.length > 1 && (
          <>
            <div className="ig-media-count-indicator">{mediaIndex + 1}/{media.length}</div>
            <div className="ig-media-dots">
              {media.map((_, i) => (
                <div
                  key={i}
                  className={`ig-media-dot${i === mediaIndex ? " active" : ""}`}
                  onClick={() => setMediaIndex(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="ig-post-actions">
        <div className="ig-action-cluster">
          <button
            className={`ig-action-btn${liked ? " liked" : ""}`}
            aria-label={liked ? "Unlike" : "Like"}
            onDoubleClick={handleLike}
            onClick={handleLike}
          >
            <HeartIcon filled={liked} />
          </button>
          <button className="ig-action-btn" aria-label="Comment">
            <CommentIcon />
          </button>
          <button className="ig-action-btn" aria-label="Share" onClick={handleShare}>
            <ShareIcon />
          </button>
        </div>
        <button
          className={`ig-action-btn${saved ? " saved" : ""}`}
          aria-label={saved ? "Unsave" : "Save"}
          onClick={() => setSaved((p) => !p)}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>

      {/* Caption block */}
      <div className="ig-post-caption-block">
        {likeCount > 0 && (
          <div className="ig-like-count">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</div>
        )}

        {caption && (
          <p className="ig-post-caption">
            <strong>{userName}</strong>
            {displayCaption}
            {longCaption && !captionExpanded && (
              <button className="ig-caption-more" onClick={() => setCaptionExpanded(true)}>more</button>
            )}
          </p>
        )}

        <time className="ig-post-time">{postedAt || item.createdAt}</time>

        {/* Add comment */}
        <div className="ig-add-comment-row">
          <span style={{ flexShrink: 0 }}>
            <EmojiIcon />
          </span>
          <input
            className="ig-add-comment-input"
            type="text"
            placeholder="Add a comment…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          {commentText && (
            <button className="ig-add-comment-post active" onClick={() => {
              onActionNotice?.("Instagram media is read-only.");
              setCommentText("");
            }}>
              Post
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function MediaFeedPage({ currentUser, searchQuery, role }) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [syncingInstagram, setSyncingInstagram] = useState(false);
  const [followingByUser, setFollowingByUser] = useState({});

  const loadFeed = async ({ cursor = "", append = false } = {}) => {
    const setL = append ? setLoadingMore : setLoading;
    try {
      setL(true);
      setError("");
      const data = await fetchFeed({ cursor, limit: 15, source: "instagram" });
      const loaded = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => (append ? [...prev, ...loaded] : loaded));
      setNextCursor(data.nextCursor || "");
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err.message || "Failed to load feed");
    } finally {
      setL(false);
    }
  };

  useEffect(() => { loadFeed(); }, []);

  useEffect(() => {
    if (!actionNotice) return;
    const t = setTimeout(() => setActionNotice(""), 3000);
    return () => clearTimeout(t);
  }, [actionNotice]);

  const filteredItems = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const cap = item.caption?.toLowerCase() || "";
      const u = item.author?.userName?.toLowerCase() || "";
      const d = item.author?.displayName?.toLowerCase() || "";
      return cap.includes(q) || u.includes(q) || d.includes(q);
    });
  }, [items, searchQuery]);

  const storyUsers = useMemo(() => {
    const unique = [];
    const seen = new Set();
    if (currentUser?.userName) {
      unique.push({ key: "me", userName: currentUser.userName, displayName: currentUser.name, avatarUrl: currentUser.profilePic, isOwn: true });
      seen.add(currentUser.userName.toLowerCase());
    }
    for (const item of filteredItems) {
      const u = item.author?.userName || "";
      if (!u || seen.has(u.toLowerCase())) continue;
      seen.add(u.toLowerCase());
      unique.push({ key: item.id, userName: u, displayName: item.author?.displayName || u, avatarUrl: item.author?.avatarUrl || "" });
      if (unique.length >= 12) break;
    }
    return unique;
  }, [filteredItems, currentUser]);

  const suggestedUsers = useMemo(() => {
    const mine = currentUser?.userName?.toLowerCase() || "";
    const map = new Map();
    for (const item of items) {
      const u = item.author?.userName || "";
      if (!u || u.toLowerCase() === mine || map.has(u.toLowerCase())) continue;
      map.set(u.toLowerCase(), { id: item.id, userName: u, displayName: item.author?.displayName || u, avatarUrl: item.author?.avatarUrl || "" });
    }
    return Array.from(map.values()).slice(0, 6);
  }, [items, currentUser]);

  const handleConnectInstagram = async () => {
    try {
      const data = await startInstagramOAuth();
      if (data.authorizationUrl) window.location.href = data.authorizationUrl;
    } catch (err) { setError(err.message); }
  };

  const handleSyncInstagram = async () => {
    try {
      setSyncingInstagram(true);
      const data = await listInstagramConnections();
      const active = (data.items || []).filter((c) => c.status === "active");
      if (active.length === 0) { setActionNotice("No active Instagram accounts connected."); return; }
      for (const c of active) await syncInstagramConnection(c.id);
      setActionNotice(`Synced ${active.length} account(s).`);
      await loadFeed();
    } catch (err) { setError(err.message); }
    finally { setSyncingInstagram(false); }
  };

  return (
    <div className="ig-home-page">
      <div className="ig-home-shell">

        {/* ── FEED COLUMN ── */}
        <main className="ig-main-column">

          {/* Admin controls */}
          {role === "admin" && (
            <div className="ig-feed-controls">
              <div className="ig-feed-action-buttons">
                <button className="ig-feed-btn" onClick={() => loadFeed()}>Refresh</button>
                <button className="ig-feed-btn" onClick={handleSyncInstagram} disabled={syncingInstagram}>
                  {syncingInstagram ? "Syncing…" : "Sync Instagram"}
                </button>
                <button className="ig-feed-btn" onClick={handleConnectInstagram}>Connect IG</button>
              </div>
              {actionNotice && <p className="ig-feed-note">{actionNotice}</p>}
            </div>
          )}

          {/* Stories strip */}
          <div className="ig-stories-strip">
            {storyUsers.map((su) => (
              <div key={su.key} className="ig-story-card">
                <div className={`ig-story-ring${su.isOwn ? " own-story" : ""}`}>
                  <div className="ig-story-ring-inner">
                    {su.avatarUrl ? (
                      <img src={su.avatarUrl} alt={su.displayName} />
                    ) : (
                      <span className="ig-story-initials">{getInitials(su.displayName)}</span>
                    )}
                  </div>
                </div>
                <p className="ig-story-label">{su.isOwn ? "Your story" : su.userName}</p>
              </div>
            ))}
          </div>

          {/* Feed content */}
          {loading ? (
            <div className="ig-state-card">
              <div className="ig-spinner" style={{ margin: "0 auto" }} />
            </div>
          ) : error ? (
            <div className="ig-state-card ig-state-card-error">
              <p style={{ color: "var(--ig-text-secondary)" }}>{error}</p>
              <button onClick={() => loadFeed()}>Try again</button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="ig-empty-state">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="var(--ig-border)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <h3>No posts yet</h3>
              <p>
                {role === "admin"
                  ? "Connect an Instagram account or sync to populate the feed."
                  : "No posts available. Check back later."}
              </p>
              {role === "admin" && (
                <button className="ig-feed-btn" onClick={handleConnectInstagram}>
                  Connect Instagram
                </button>
              )}
            </div>
          ) : (
            <div className="ig-post-list">
              {filteredItems.map((item) => (
                <PostCard
                  key={item.id}
                  item={item}
                  currentUser={currentUser}
                  onActionNotice={setActionNotice}
                />
              ))}
            </div>
          )}

          {!loading && hasMore && (
            <div className="ig-load-more-wrap">
              <button
                className="ig-load-more-btn"
                disabled={loadingMore}
                onClick={() => loadFeed({ cursor: nextCursor, append: true })}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </main>

        {/* ── RIGHT RAIL ── */}
        <aside className="ig-right-rail">
          {/* Current user */}
          <div className="ig-account-card">
            <div className="ig-account-avatar">
              <Avatar src={currentUser?.profilePic} name={currentUser?.name || currentUser?.userName} size={56} />
            </div>
            <div className="ig-account-info">
              <p className="ig-account-handle">{currentUser?.userName}</p>
              <p className="ig-account-name">{currentUser?.name}</p>
            </div>
            <button className="ig-switch-btn">Switch</button>
          </div>

          {/* Suggested for you */}
          {suggestedUsers.length > 0 && (
            <div>
              <div className="ig-suggestions-section-head">
                <p>Suggested for you</p>
                <button onClick={() => loadFeed()}>See all</button>
              </div>
              <div className="ig-suggestions-list">
                {suggestedUsers.map((person) => {
                  const key = person.userName.toLowerCase();
                  const following = Boolean(followingByUser[key]);
                  return (
                    <div key={person.id} className="ig-suggestion-item">
                      <div className="ig-suggestion-avatar">
                        <Avatar src={person.avatarUrl} name={person.displayName} size={36} />
                      </div>
                      <div className="ig-suggestion-info">
                        <p className="ig-suggestion-handle">{person.userName}</p>
                        <p className="ig-suggestion-meta">Suggested for you</p>
                      </div>
                      <button
                        className={`ig-follow-btn${following ? " following" : ""}`}
                        onClick={() => setFollowingByUser((p) => ({ ...p, [key]: !p[key] }))}
                      >
                        {following ? "Following" : "Follow"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer links */}
          <div className="ig-right-footer">
            <div>
              <a href="#">About</a> <a href="#">Help</a> <a href="#">Press</a> <a href="#">API</a>
              <a href="#">Jobs</a> <a href="#">Privacy</a> <a href="#">Terms</a>
            </div>
            <div style={{ marginTop: 10 }}>© 2026 ERICGRAM</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
