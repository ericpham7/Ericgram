// ============================================
// NAVBAR COMPONENT
// The top navigation bar shown after login.
// Displays the logo, a search bar, and a user dropdown menu.
// ============================================

// useState = React hook to track whether the dropdown menu is open or closed
import { useState } from "react";

// Import the logo image — becomes a URL string you can use in <img src={logo}>
import logo from "../assets/logo.png";

// Import styles specific to the Navbar
import "./Navbar.css";

// "export default function Navbar({ user, onLogout })" =
//   → Receives two props from App.jsx:
//     user = the logged-in user object { userName, name, email, friendsCount }
//     onLogout = function to call when user clicks "Log Out" → sets user to null in App.jsx
// Props from App.jsx:
//   user = logged-in user object
//   onLogout = function to log out
//   searchQuery = current search text (lives in App.jsx)
//   setSearchQuery = function to update search text (lives in App.jsx)
export default function Navbar({
  user,
  onLogout,
  searchQuery,
  setSearchQuery,
}) {
  // menuOpen tracks whether the dropdown menu is visible
  //   false = hidden, true = visible
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    // "glass" class = CSS glassmorphism effect (semi-transparent with blur)
    <nav className="navbar glass" id="navbar">
      <div className="navbar-inner">
        {/* ====== BRAND / LOGO ====== */}
        <div className="navbar-brand" id="navbar-brand">
          <img src={logo} alt="EricGram" className="navbar-logo" />
          {/* "gradient-text" = CSS class that applies a gradient color to the text */}
          <span className="navbar-title gradient-text">EricGram</span>
        </div>

        {/* ====== SEARCH BAR (decorative — not functional yet) ====== */}
        <div className="navbar-search" id="navbar-search">
          {/* Magnifying glass search icon (SVG) */}
          {/* SVG attributes in React use camelCase: strokeLinecap instead of stroke-linecap */}
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search EricGram..."
            className="search-input"
            id="search-input"
            value={searchQuery} // CONTROLLED INPUT: displays whatever searchQuery contains
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ====== USER DROPDOWN MENU ====== */}
        <div className="navbar-user" id="navbar-user">
          {/* CLICKABLE AREA — toggles the dropdown open/closed */}
          <div
            className="user-avatar-btn"
            // () => setMenuOpen(!menuOpen)
            //   → "!" flips the boolean — if menu is open, close it; if closed, open it
            onClick={() => setMenuOpen(!menuOpen)}
            id="user-menu-toggle"
          >
            {/* Avatar circle with the user's first initial */}
            <div className="avatar-circle">
              {/* user?.name?.charAt(0)?.toUpperCase() chains: */}
              {/*   1. user?.name — get the name (e.g., "Eric Pham"), null if undefined */}
              {/*   2. ?.charAt(0) — get first character (e.g., "E") */}
              {/*   3. ?.toUpperCase() — make it uppercase */}
              {/*   || "U" — fallback to "U" if anything in the chain is null */}
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            {/* Display the user's full name next to the avatar */}
            <span className="user-display-name">{user?.name || "User"}</span>

            {/* Chevron (down arrow) — rotates when menu opens */}
            <svg
              // Template literal in className:
              // `chevron ${menuOpen ? "open" : ""}` →
              //   "chevron open" when menu is open (CSS rotates it 180°)
              //   "chevron" when menu is closed
              className={`chevron ${menuOpen ? "open" : ""}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          {/* DROPDOWN MENU — only rendered when menuOpen is true */}
          {/* {menuOpen && (...)} = conditional rendering using logical AND */}
          {menuOpen && (
            <div className="dropdown-menu animate-fade-in" id="user-dropdown">
              {/* Dropdown header — shows avatar + name + email */}
              <div className="dropdown-header">
                <div className="avatar-circle large">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="dropdown-name">{user?.name}</p>
                  <p className="dropdown-email">{user?.email}</p>
                </div>
              </div>

              {/* Visual separator line */}
              <div className="dropdown-divider" />

              {/* Profile button (not wired up yet — placeholder) */}
              <button className="dropdown-item" id="profile-btn">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </button>

              {/* Settings button (not wired up yet — placeholder) */}
              <button className="dropdown-item" id="settings-btn">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Settings
              </button>

              <div className="dropdown-divider" />

              {/* LOGOUT BUTTON — onClick={onLogout} calls the function from App.jsx */}
              {/* This sets user to null → App re-renders → shows LoginPage again */}
              <button
                className="dropdown-item logout"
                onClick={onLogout}
                id="logout-btn"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
