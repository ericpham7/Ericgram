import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllUsers, fetchPosts } from "../api";
import InstagramEditProfileModal from "./InstagramEditProfileModal";
import { DEFAULT_PROFILE_PIC } from "../utils/defaultProfilePic";
import { getUserProfilePic } from "../utils/userProfilePic";
import { navigateToProfile } from "../utils/profileNavigation";
import "./FeedPage.css";

function normalizeWebsiteUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
}

export default function FeedPage({ currentUser, searchQuery, onUpdateUser }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, [currentUser?.userName, searchQuery]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError("");
      const [usersData, postsData] = await Promise.all([
        fetchAllUsers(),
        fetchPosts(currentUser?.userName, 1, 50, searchQuery || ""),
      ]);
      setUsers(usersData.users || []);
      setPosts(Array.isArray(postsData?.items) ? postsData.items : []);
    } catch {
      setError(
        "Could not connect to server. Make sure the C++ backend is running on port 8080.",
      );
    } finally {
      setLoading(false);
    }
  };

  const profileImage = getUserProfilePic(currentUser) || DEFAULT_PROFILE_PIC;
  const userName = currentUser?.userName || "profile";
  const fullName = currentUser?.name || "EricGram User";
  const profilePosts = posts.filter((post) => post.authorUserName === userName);
  const postsCount = profilePosts.length;
  const followersCount = Math.max(100, users.length * 153 + 49);
  const followingCount = Math.max(1, currentUser?.friendsCount || 1);
  const initials = fullName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const highlightLabels = [
    "Highlights",
    "Behind the Scenes",
    "Studio",
    "New Music",
    "Friends",
    "Archive",
  ];
  const websiteUrl = normalizeWebsiteUrl(currentUser?.website || "");

  const handleSaveProfile = (updatedUser) => {
    onUpdateUser?.(updatedUser);
    setEditProfileOpen(false);
  };

  return (
    <div className="feed-page" id="feed-page">
      <section className="profile-shell">
        <header className="profile-header">
          <button
            type="button"
            className="profile-avatar-wrap"
            onClick={() =>
              navigateToProfile(navigate, currentUser?.userName, currentUser?.userName)
            }
            aria-label={`Open ${userName}'s profile`}
          >
            {profileImage ?
              <img src={profileImage} alt={fullName} className="profile-avatar" />
            : <div className="profile-avatar fallback">{initials || "EG"}</div>}
          </button>

          <div className="profile-meta">
            <div className="profile-top-line">
              <h1 className="profile-username">{userName}</h1>
              <button
                type="button"
                className="profile-edit-btn"
                onClick={() => setEditProfileOpen(true)}
              >
                Edit Profile
              </button>
            </div>

            <div className="profile-stats">
              <p><strong>{postsCount}</strong> posts</p>
              <p><strong>{followersCount.toLocaleString()}</strong> followers</p>
              <p><strong>{followingCount}</strong> following</p>
            </div>

            <div className="profile-bio">
              <p className="profile-name">{fullName}</p>
              <p>{currentUser?.bio || "Built on EricGram C++ backend."}</p>
              {currentUser?.instagramHandle && (
                <p>@{currentUser.instagramHandle}</p>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noreferrer">
                  {currentUser.website}
                </a>
              )}
              <a href={`mailto:${currentUser?.email || ""}`}>{currentUser?.email}</a>
            </div>
          </div>
        </header>

        <section className="profile-highlights">
          <div className="highlights-scroll">
            {highlightLabels.map((label) => (
              <div key={label} className="highlight-item">
                <div className="highlight-ring">
                  {profileImage ?
                    <img src={profileImage} alt={label} className="highlight-image" />
                  : <span>{initials || "EG"}</span>}
                </div>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="profile-tabs">
          <button className="tab-button active" type="button">Posts</button>
          <button className="tab-button" type="button">Reels</button>
          <button className="tab-button" type="button">Tagged</button>
        </section>

        {loading && <p className="profile-status">Loading profile posts...</p>}
        {!loading && error && (
          <div className="profile-error">
            <p>{error}</p>
            <button type="button" onClick={loadProfileData}>Retry</button>
          </div>
        )}

        {!loading && !error && profilePosts.length === 0 && (
          <p className="profile-status">No posts yet for this profile.</p>
        )}

        <section className="profile-grid" id="profile-grid">
          {profilePosts.map((post) => {
            const primaryMedia = Array.isArray(post.media) ? post.media[0] : null;
            const isVideo = primaryMedia?.kind === "video";

            return (
              <article key={post.id} className="profile-tile">
                {primaryMedia ?
                  (isVideo ?
                    <video
                      className="profile-tile-video"
                      src={primaryMedia.url}
                      muted
                      loop
                      playsInline
                    />
                  : <img
                      src={primaryMedia.url}
                      alt={post.caption || post.id}
                      className="profile-tile-image"
                    />)
                : <div className="profile-tile-fallback">No media</div>}
              <div className="profile-tile-overlay">
                <span>{post.likeCount || 0} likes</span>
                <span>{post.commentCount || 0} comments</span>
              </div>
            </article>
            );
          })}
        </section>
      </section>

      <InstagramEditProfileModal
        isOpen={editProfileOpen}
        user={currentUser}
        onClose={() => setEditProfileOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
