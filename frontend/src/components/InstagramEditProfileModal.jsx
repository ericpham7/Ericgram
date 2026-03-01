import { useEffect, useRef, useState } from "react";
import "./InstagramEditProfileModal.css";

export default function InstagramEditProfileModal({ isOpen, user, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    instagramHandle: "",
    bio: "",
    website: "",
    profilePic: "",
    isPrivate: false,
  });
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setFormData({
      name: user?.name || "",
      instagramHandle: user?.instagramHandle || "",
      bio: user?.bio || "",
      website: user?.website || "",
      profilePic: user?.profilePic || "",
      isPrivate: Boolean(user?.isPrivate),
    });
  }, [isOpen, user]);

  if (!isOpen) return null;

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleProfilePicChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("profilePic", String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    onSave?.({
      ...user,
      name: formData.name.trim(),
      instagramHandle: formData.instagramHandle.trim(),
      bio: formData.bio.trim(),
      website: formData.website.trim(),
      profilePic: formData.profilePic.trim(),
      isPrivate: formData.isPrivate,
    });
  };

  return (
    <div className="ig-edit-overlay" role="dialog" aria-modal="true">
      <div className="ig-edit-modal">
        <header className="ig-edit-header">
          <h2>Edit Instagram Profile</h2>
          <button type="button" onClick={onClose} aria-label="Close edit profile">
            ×
          </button>
        </header>

        <form className="ig-edit-form" onSubmit={handleSave}>
          <div className="ig-edit-avatar-section">
            <button
              type="button"
              className="ig-edit-avatar-button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile picture"
            >
              {formData.profilePic ? (
                <img src={formData.profilePic} alt={user?.userName || "Profile"} className="ig-edit-avatar-image" />
              ) : (
                <div className="ig-edit-avatar-fallback" />
              )}
              <span className="ig-edit-avatar-camera" aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M4 7h4l1.7-2h4.6L16 7h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
            </button>
            <div className="ig-edit-avatar-meta">
              <strong>Profile photo</strong>
              <span>Click the circle to upload a new photo from your device.</span>
              <div className="ig-edit-avatar-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  Change photo
                </button>
                {formData.profilePic && (
                  <button type="button" className="secondary" onClick={() => setField("profilePic", "")}>
                    Remove current
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleProfilePicChange}
            />
          </div>

          <label>
            Name
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Display name"
            />
          </label>

          <label>
            Username
            <input type="text" value={user?.userName || ""} disabled />
          </label>

          <label>
            Instagram Handle
            <input
              type="text"
              value={formData.instagramHandle}
              onChange={(e) => setField("instagramHandle", e.target.value)}
              placeholder="example_handle"
            />
          </label>

          <label>
            Bio
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setField("bio", e.target.value)}
              placeholder="Write a short bio..."
            />
          </label>

          <label>
            Website
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setField("website", e.target.value)}
              placeholder="your-site.com"
            />
          </label>

          <label className="ig-edit-toggle">
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => setField("isPrivate", e.target.checked)}
            />
            Private account
          </label>

          {error && <p className="ig-edit-error">{error}</p>}

          <div className="ig-edit-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
