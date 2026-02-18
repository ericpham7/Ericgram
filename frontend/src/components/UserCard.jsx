import { useState } from "react";
// ============================================
// USER CARD COMPONENT
// Displays a single user as a card in the FeedPage grid.
// Shows: avatar with color gradient, name, username, stats, and "Add Friend" button.
// ============================================

// Import the CSS styles for this component
import "./UserCard.css";

// ---- VERIFIED USERS ----
// Usernames that get a blue verified badge next to their name
// .toLowerCase() is used when checking so capitalization doesn't matter
const VERIFIED_USERS = [
  "beltran",
  "ebkjaaybo",
  "ragieban",
  "mochakk",
  "officialgreenvelvet",
  "chasewest",
  "johnsummit",
];

// ---- AVATAR COLOR PALETTE ----
// Each sub-array has two colors used for a gradient background
// const = can't reassign this variable, but the array contents could change
// "const" is used for values that shouldn't be reassigned
const AVATAR_COLORS = [
  ["#8B5CF6", "#6D28D9"], // purple
  ["#EC4899", "#DB2777"], // pink
  ["#3B82F6", "#2563EB"], // blue
  ["#10B981", "#059669"], // green
  ["#F59E0B", "#D97706"], // amber
  ["#EF4444", "#DC2626"], // red
  ["#06B6D4", "#0891B2"], // cyan
  ["#F97316", "#EA580C"], // orange
];

// ---- HELPER FUNCTION ----
// Picks a color pair based on the first letter of the user's name
// This ensures the same user always gets the same color
function getAvatarColor(name) {
  // name?.charCodeAt(0) = get the ASCII code of the first character
  //   "E" → 69, "A" → 65, "B" → 66, etc.
  // || 0 = if name is null/undefined, use 0 as fallback
  // % AVATAR_COLORS.length = modulo operator, wraps around the array
  //   69 % 8 = 5, so "Eric" → AVATAR_COLORS[5] → red
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// Props:
//   user = user object { userName, name, email, friendsCount, friends }
//   index = position in the array (0, 1, 2, 3) — used for stagger animation
//   onClick = function to open the ProfileModal when this card is clicked
//   currentUser = the logged-in user — used to check if already friends
//   onAddFriend = function to call when "Add Friend" is clicked
export default function UserCard({
  user,
  index,
  onClick,
  currentUser,
  onAddFriend,
}) {
  // ARRAY DESTRUCTURING: const [c1, c2] = getAvatarColor(...)
  //   → getAvatarColor returns an array like ["#8B5CF6", "#6D28D9"]
  //   → c1 gets the first element, c2 gets the second
  //   → Equivalent to:
  //     const colors = getAvatarColor(user.name);
  //     const c1 = colors[0];
  //     const c2 = colors[1];
  const [c1, c2] = getAvatarColor(user.name);

  // ---- DETERMINISTIC "RANDOM" STATUS ----
  // We can't use Math.random() during render (React says it's "impure").
  // Instead, we derive a number from the username's characters.
  // Same username → same result every time → stable, no flickering.
  // charCodeAt(0) gets the ASCII code: "e" → 101, "a" → 97, "b" → 98, etc.
  // The sum of all character codes gives us a unique-ish number per username.
  const nameHash = user.userName
    .split("") // "alice123" → ["a","l","i","c","e","1","2","3"]
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0); // add up all ASCII codes
  const isOnline = nameHash % 2 === 0; // even = online, odd = offline
  const postCount = (nameHash % 50) + 5; // deterministic "random" number 5-54

  // Check if this user is already friends with the logged-in user
  // currentUser.friends is an array of username strings from the C++ backend
  const isFriend = currentUser?.friends?.includes(user.userName);

  // Don't show "Add Friend" on your own card
  const isSelf = currentUser?.userName === user.userName;

  // Check if this user has a verified badge
  const isVerified = VERIFIED_USERS.includes(user.userName?.toLowerCase());

  // State to track if the profile image failed to load
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className="user-card"
      // TEMPLATE LITERAL for id: creates unique IDs like "user-card-ericphXm"
      id={`user-card-${user.userName}`}
      // INLINE STYLE: style={{ property: value }}
      //   → Double curly braces because:
      //     outer {} = JSX expression
      //     inner {} = JavaScript object literal
      // animationDelay: staggers the fade-in animation
      //   → Card 0 = 0ms delay, Card 1 = 80ms, Card 2 = 160ms, etc.
      //   → Creates a cascading entrance effect
      style={{ animationDelay: `${index * 80}ms` }}
      // onClick?.() = optional chaining on a function call
      //   → If onClick exists, call it with the user object
      //   → If onClick is undefined, do nothing (no crash)
      //   → This passes the user to setSelectedUser in FeedPage → opens ProfileModal
      onClick={() => onClick?.(user)}
    >
      {/* AVATAR SECTION */}
      <div className="user-card-top">
        <div
          className="user-card-avatar"
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
        {/* Dot indicating online/offline status — randomly assigned per user */}
        {/* isOnline ? "online" : "offline" adds the CSS class that controls the color */}
        <div
          className={`user-card-online-dot ${isOnline ? "online" : "offline"}`}
        />
      </div>

      {/* USER INFO */}
      <div className="user-card-info">
        <h3 className="user-card-name">
          {user.name}
          {/* Show verified badge (blue checkmark star) for select users */}
          {isVerified && (
            <svg
              className="verified-badge"
              width="16"
              height="16"
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
        </h3>
        {/* Template literal in JSX: @{user.userName} → shows "@ericphXm" */}
        <p className="user-card-username">@{user.userName}</p>
      </div>

      {/* STATS ROW */}
      <div className="user-card-stats">
        <div className="user-card-stat">
          {/* user.friendsCount comes directly from the C++ toJSON() response */}
          <span className="stat-value">{user.friendsCount}</span>
          <span className="stat-label">Friends</span>
        </div>
        <div className="user-card-stat">
          <span className="stat-value">
            {/* Math.floor() rounds down, Math.random() gives 0-0.999... */}
            {/* Uses the deterministic postCount from the nameHash above */}
            {postCount}
          </span>
          <span className="stat-label">Posts</span>
        </div>
      </div>

      {/* ADD FRIEND BUTTON */}
      {/* Only show if this is NOT the logged-in user's own card */}
      {!isSelf && (
        <button
          className={`user-card-btn ${isFriend ? "added" : ""}`}
          id={`follow-btn-${user.userName}`}
          onClick={(e) => {
            // e.stopPropagation() prevents the click from bubbling up to
            // the card's onClick (which would open the ProfileModal)
            e.stopPropagation();
            if (!isFriend) onAddFriend?.(user.userName);
          }}
          disabled={isFriend}
        >
          {
            isFriend ?
              // Show checkmark if already friends
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Friends
              </>
              // Show plus-person icon if not friends
            : <>
                <svg
                  width="14"
                  height="14"
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
    </div>
  );
}
