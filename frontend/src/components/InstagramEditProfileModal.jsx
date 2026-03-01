import { useEffect, useState } from "react";
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

          <label>
            Profile Photo URL
            <input
              type="text"
              value={formData.profilePic}
              onChange={(e) => setField("profilePic", e.target.value)}
              placeholder="https://..."
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
