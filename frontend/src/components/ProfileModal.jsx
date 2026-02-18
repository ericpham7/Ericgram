import { useState } from "react";
// ============================================
// PROFILE MODAL COMPONENT
// A popup overlay that shows detailed information about a user.
// Appears when you click a UserCard in the FeedPage grid.
// ============================================

// Import styles for the modal
import "./ProfileModal.css";

// ---- VERIFIED USERS ----
const VERIFIED_USERS = [
  "beltran",
  "ebkjaaybo",
  "ragieban",
  "mochakk",
  "officialgreenvelvet",
  "chasewest",
  "johnsummit",
];

// ---- AVATAR COLORS (same as UserCard) ----
// Duplicated here so the modal avatar matches the card avatar color
const AVATAR_COLORS = [
  ["#8B5CF6", "#6D28D9"],
  ["#EC4899", "#DB2777"],
  ["#3B82F6", "#2563EB"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#D97706"],
  ["#EF4444", "#DC2626"],
  ["#06B6D4", "#0891B2"],
  ["#F97316", "#EA580C"],
  ["#8B5CF6", "#6D28D9"],
  ["#EC4899", "#DB2777"],
  ["#3B82F6", "#2563EB"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#D97706"],
  ["#EF4444", "#DC2626"],
  ["#06B6D4", "#0891B2"],
  ["#F97316", "#EA580C"],
  ["#8B5CF6", "#6D28D9"],
  ["#EC4899", "#DB2777"],
  ["#3B82F6", "#2563EB"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#D97706"],
  ["#EF4444", "#DC2626"],
  ["#06B6D4", "#0891B2"],
  ["#F97316", "#EA580C"],
];

// Same color-picking logic as UserCard
function getAvatarColor(name) {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ---- COMPONENT ----
// Props:
//   user = the user object to display { userName, name, email, friendsCount, friends }
//   currentUser = the logged-in user (to check friend status)
//   onClose = function to close the modal
//   onAddFriend = function to add this user as a friend
//   onMessage = function to open the chat with this user
export default function ProfileModal({
  user,
  currentUser,
  onClose,
  onAddFriend,
  onMessage,
}) {
  // Get the gradient colors for this user's avatar
  const [c1, c2] = getAvatarColor(user.name);

  // Check friend status using the logged-in user's friends array
  const isFriend = currentUser?.friends?.includes(user.userName);
  const isSelf = currentUser?.userName === user.userName;
  const isVerified = VERIFIED_USERS.includes(user.userName?.toLowerCase());

  // State to track if the profile image failed to load
  const [imageError, setImageError] = useState(false);

  // ---- KEYBOARD EVENT HANDLER ----
  // Allows closing the modal by pressing the Escape key
  // (e) = the keyboard event object
  // e.key = which key was pressed (e.g., "Escape", "Enter", "a", etc.)
  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    // OVERLAY — the dark semi-transparent background behind the modal
    <div
      className="modal-overlay"
      // Clicking the dark overlay closes the modal
      onClick={onClose}
      // Pressing Escape also closes it
      onKeyDown={handleKeyDown}
      // tabIndex={-1} makes this div focusable (so it can receive keyboard events)
      //   → -1 means it can receive focus programmatically but not via Tab key
      tabIndex={-1}
      id="profile-modal-overlay"
    >
      {/* MODAL CONTENT — the actual white/dark card that appears */}
      <div
        className="modal-content animate-slide-up"
        // e.stopPropagation() prevents the click from reaching the overlay
        //   → Without this, clicking inside the modal would also trigger onClick={onClose}
        //     on the overlay, closing the modal when you don't want it to
        //   → stopPropagation says: "this click stops here, don't pass it to parent elements"
        onClick={(e) => e.stopPropagation()}
        id="profile-modal"
      >
        {/* CLOSE BUTTON — X icon in top-right corner */}
        <button className="modal-close" onClick={onClose} id="modal-close-btn">
          {/* X icon made of two crossing lines */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* BANNER — colored gradient strip at top of modal */}
        <div
          className="modal-banner"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          {/* Large avatar overlapping the banner */}
          <div
            className="modal-avatar"
            style={{
              background:
                user.profilePic && !imageError ?
                  "none"
                : `linear-gradient(135deg, ${c1}, ${c2})`,
              overflow: "hidden",
            }}
          >
            {user.profilePic && !imageError ?
              <img
                src={user.profilePic}
                alt={user.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => setImageError(true)}
              />
            : user.name?.charAt(0)?.toUpperCase()}
          </div>
        </div>

        {/* PROFILE BODY — detailed user info */}
        <div className="modal-body">
          <h2 className="modal-name">
            {user.name}
            {isVerified && (
              <svg
                className="verified-badge"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="#1DA1F2"
                aria-label="Verified"
              >
                <path
                  d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67.63 13.43 0 12 0S9.33.63 8.66 1.94c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 7.33 2 8.57 2 10c0 1.43.63 2.67 1.94 3.34-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81C9.33 19.37 10.57 20 12 20s2.67-.63 3.34-1.94c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
                  transform="translate(0,2) scale(1.1)"
                />
                <path
                  d="M9.5 13.09l-1.29-1.29a.75.75 0 0 0-1.06 1.06l1.82 1.82a.75.75 0 0 0 1.06 0l4.08-4.08a.75.75 0 0 0-1.06-1.06L9.5 13.09z"
                  fill="white"
                  transform="translate(0,2) scale(1.1)"
                />
              </svg>
            )}
          </h2>
          <p className="modal-username">@{user.userName}</p>

          {/* Bio — auto-generated using the user's first name */}
          <p className="modal-bio">
            {/* user.name.split(" ")[0] = "Eric Pham" → ["Eric", "Pham"] → "Eric" */}
            Hey there! I'm {user.name.split(" ")[0]}, exploring the world of
            EricGram. Let's connect! 🌟
          </p>

          {/* DETAIL ROWS — each row shows an icon + text */}
          <div className="modal-details">
            {/* EMAIL ROW */}
            <div className="modal-detail-row">
              {/* Email envelope icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              {/* {user.email} displays the email from the C++ server response */}
              <span>{user.email}</span>
            </div>

            {/* INSTAGRAM LINK ROW */}
            {user.instagramHandle && (
              <div className="modal-detail-row" id="modal-instagram-row">
                {/* Instagram icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <a
                  href={`https://instagram.com/${user.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="instagram-link"
                  id="modal-instagram-link"
                >
                  @{user.instagramHandle}
                </a>
              </div>
            )}

            {/* FRIENDS COUNT ROW */}
            <div className="modal-detail-row">
              {/* People/friends icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>
                {user.friendsCount} {/* TERNARY for pluralization: */}
                {/* If friendsCount is exactly 1 → "friend" (singular) */}
                {/* Otherwise → "friends" (plural) */}
                {user.friendsCount === 1 ? "friend" : "friends"}
              </span>
            </div>

            {/* JOINED DATE ROW */}
            <div className="modal-detail-row">
              {/* Clock icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Joined EricGram recently</span>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="modal-actions">
            {/* Only show Add Friend if not viewing own profile */}
            {!isSelf && (
              <button
                className={`modal-action-btn ${isFriend ? "friended" : "primary"}`}
                id="modal-add-friend-btn"
                onClick={() => {
                  if (!isFriend) onAddFriend?.(user.userName);
                }}
                disabled={isFriend}
              >
                {isFriend ?
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Friends
                  </>
                : <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Add Friend
                  </>
                }
              </button>
            )}

            {/* Message button — opens the ChatModal */}
            {!isSelf && (
              <button
                className="modal-action-btn secondary"
                id="modal-message-btn"
                onClick={() => onMessage?.(user)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
                </svg>
                Message
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
