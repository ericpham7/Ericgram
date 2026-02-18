// ============================================
// FEED PAGE COMPONENT
// Shown after login. Displays a welcome banner and a grid of all users.
// Fetches user data from the C++ backend via GET /api/users.
// ============================================

// useState = store values that change (users list, loading state, errors)
// useEffect = run code when the component first appears on screen (like "on page load")
import { useState, useEffect } from "react";

// Import the API functions that talk to the C++ backend
import { fetchAllUsers, addFriend } from "../api";

// Import child components — each renders a single piece of the UI
import UserCard from "./UserCard";
import ProfileModal from "./ProfileModal";
import ChatModal from "./ChatModal";

// Import the CSS styles for this component
import "./FeedPage.css";

//     so currentUser = the logged-in user's data from the C++ server
export default function FeedPage({ currentUser, searchQuery, onUpdateUser }) {
  // ---- STATE VARIABLES ----
  // users: array of all users fetched from the backend, starts as empty []
  const [users, setUsers] = useState([]);

  // loading: true while waiting for the server response (shows skeleton animation)
  const [loading, setLoading] = useState(true);

  // error: error message string if the fetch fails
  const [error, setError] = useState("");

  // selectedUser: which user's profile modal is open (null = no modal)
  const [selectedUser, setSelectedUser] = useState(null);

  // chatUser: which user's chat modal is open (null = no chat)
  const [chatUser, setChatUser] = useState(null);

  // ---- CURRENT USER STATS ----
  const nameHash =
    currentUser?.userName
      ?.split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0) || 0;
  const currentUserPosts = (nameHash % 50) + 5;

  // ---- FILTERING LOGIC ----
  // .filter() creates a NEW array containing only items that pass the test
  //   → For each user, check if their name or username includes the search text
  //   → .toLowerCase() makes the search case-insensitive ("eric" matches "Eric")
  //   → If searchQuery is "", every user passes ("Eric".includes("") → true)
  // This runs on every render, so the list updates instantly as you type
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase(); // normalize the search text
    return (
      user.name?.toLowerCase().includes(query) || // match by full name
      user.userName?.toLowerCase().includes(query) || // match by @username
      user.email?.toLowerCase().includes(query) // match by email
    );
  });

  // ---- useEffect HOOK ----
  // useEffect(function, dependencyArray) runs the function at specific times:
  //   → [] (empty array) = run ONCE when the component first mounts (appears on screen)
  //   → [someVar] = run when someVar changes
  //   → no array = run on EVERY render (rarely used)
  // This is like "componentDidMount" in class-based React
  useEffect(() => {
    loadUsers(); // fetch all users from C++ backend when FeedPage first appears
  }, []); // ← empty dependency array = only run once

  // ---- LOAD USERS FUNCTION ----
  // "const loadUsers = async () => { ... }" = arrow function syntax for declaring a function
  //   → equivalent to: async function loadUsers() { ... }
  //   → "async" because it calls "await fetchAllUsers()" (network request)
  const loadUsers = async () => {
    try {
      setLoading(true); // show loading skeletons

      // fetchAllUsers() sends GET /api/users → C++ server → returns array of user objects
      // "await" pauses here until the server responds
      const data = await fetchAllUsers();

      // setUsers(data) updates the "users" state with the array from the server
      //   → React re-renders → the user cards appear on screen
      setUsers(data);
    } catch {
      // If the C++ backend isn't running or the request fails, show an error
      setError(
        "Could not connect to server. Make sure the C++ backend is running on port 8080.",
      );
    } finally {
      // "finally" always runs, whether try succeeded or catch ran
      setLoading(false); // hide loading skeletons
    }
  };

  // ---- ADD FRIEND HANDLER ----
  // Called when "Add Friend" is clicked on a UserCard or ProfileModal
  // Sends POST /api/friends/add to C++ server, then refreshes user list
  const handleAddFriend = async (friendUserName) => {
    try {
      const updatedUser = await addFriend(currentUser.userName, friendUserName);

      // Update the logged-in user's data in the root App state
      // This ensures currentUser.friends is up-to-date for the "Friends ✓" check
      if (onUpdateUser) onUpdateUser(updatedUser);

      // Reload users from backend so friend counts update everywhere in the grid
      await loadUsers();

      // If the profile modal is open for the person we just added,
      // update THAT user's count in the modal too
      if (selectedUser && selectedUser.userName === friendUserName) {
        setSelectedUser((prev) => ({
          ...prev,
          friendsCount: (prev.friendsCount || 0) + 1,
          friends: [...(prev.friends || []), currentUser.userName],
        }));
      }
    } catch (err) {
      console.error("Failed to add friend:", err.message);
    }
  };

  // ---- OPEN CHAT HANDLER ----
  // Called when "Message" is clicked — closes the profile modal and opens the chat
  const handleOpenChat = (user) => {
    setSelectedUser(null); // close profile modal
    setChatUser(user); // open chat modal
  };

  // ---- JSX RETURN ----
  return (
    <div className="feed-page" id="feed-page">
      {/* ====== WELCOME BANNER ====== */}
      <section className="welcome-banner" id="welcome-banner">
        <div className="welcome-content">
          <div className="welcome-text">
            <h1 className="welcome-heading">
              {/* "Welcome back, " — the {" "} adds a literal space in JSX */}
              {/* Without {" "}, React would collapse whitespace between elements */}
              Welcome back,{" "}
              <span className="gradient-text">
                {/* OPTIONAL CHAINING: currentUser?.name?.split(" ")[0] */}
                {/* "?." = if the value before ?. is null/undefined, return undefined instead of crashing */}
                {/* Without ?.: if currentUser is null → currentUser.name → ERROR! */}
                {/* .split(" ") = splits "Eric Pham" into ["Eric", "Pham"] */}
                {/* [0] = takes the first element → "Eric" */}
                {/* || "User" = if the result is undefined/null, use "User" as fallback */}
                {currentUser?.name?.split(" ")[0] || "EricGram User"}
              </span>{" "}
              👋
            </h1>
            <p className="welcome-subtitle">
              {/* {users.length} = the number of items in the users array */}
              {/* This is a JavaScript expression inside JSX curly braces */}
              See what's happening in your network. You have {users.length}{" "}
              connections on EricGram.
            </p>
          </div>

          {/* Stats cards showing live network metrics */}
          <div className="welcome-stats">
            {/* 1. Following button - shows how many people the current user has added */}
            <button
              className="welcome-stat-card clickable"
              onClick={() =>
                alert(
                  `You are following ${currentUser?.friendsCount || 0} people!`,
                )
              }
            >
              <span className="welcome-stat-number">
                {currentUser?.friendsCount || 0}
              </span>
              <span className="welcome-stat-label">Following</span>
            </button>

            {/* 2. Followers button - in this mutual model, same as following, but conceptually separate for the UI */}
            <button
              className="welcome-stat-card clickable"
              onClick={() =>
                alert(`You have ${currentUser?.friendsCount || 0} followers!`)
              }
            >
              <span className="welcome-stat-number">
                {currentUser?.friendsCount || 0}
              </span>
              <span className="welcome-stat-label">Followers</span>
            </button>

            {/* 3. Posts button - showing total posts by the current user */}
            <button
              className="welcome-stat-card clickable"
              onClick={() =>
                alert(
                  `You have published ${currentUserPosts} posts on EricGram!`,
                )
              }
            >
              <span className="welcome-stat-number">{currentUserPosts}</span>
              <span className="welcome-stat-label">Posts</span>
            </button>
          </div>
        </div>
        {/* Decorative gradient accent behind the banner */}
        <div className="welcome-bg-accent" />
      </section>

      {/* ====== USERS GRID SECTION ====== */}
      <section className="users-section" id="users-section">
        <div className="section-header">
          <h2 className="section-title">
            {/* Inline SVG icon — people/group icon */}
            <svg
              width="20"
              height="20"
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
            People on EricGram
          </h2>

          {/* Refresh button — onClick={loadUsers} calls loadUsers WITHOUT parentheses */}
          {/* loadUsers = pass the function reference (called when clicked) */}
          {/* loadUsers() = call the function immediately on render (WRONG!) */}
          <button
            className="refresh-btn"
            onClick={loadUsers}
            id="refresh-btn"
            title="Refresh users"
          >
            {/* Circular arrow refresh icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        </div>

        {/* TERNARY CHAIN: loading ? (...) : error ? (...) : (...) */}
        {/* This is like an if/else if/else for JSX: */}
        {/*   if loading → show skeletons */}
        {/*   else if error → show error message */}
        {/*   else → show the user cards */}
        {loading ?
          <div className="loading-state" id="loading-state">
            <div className="loading-grid">
              {/* [1, 2, 3, 4].map() = create 4 skeleton placeholder cards */}
              {/* .map() creates a new array by running the function on each element */}
              {/* (i) => (...) = for each number, return a skeleton card */}
              {/* key={i} = React needs a unique "key" prop for each item in a list */}
              {/*   → This helps React efficiently update the DOM when the list changes */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-card">
                  {/* "shimmer" class = CSS animation that creates a loading shimmer effect */}
                  <div className="skeleton-avatar shimmer" />
                  <div className="skeleton-line wide shimmer" />
                  <div className="skeleton-line narrow shimmer" />
                  <div className="skeleton-stats shimmer" />
                  <div className="skeleton-btn shimmer" />
                </div>
              ))}
            </div>
          </div>
        : error ?
          <div className="error-state" id="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Connection Error</h3>
            <p>{error}</p>
            {/* Retry button — same as refresh, calls loadUsers again */}
            <button className="retry-btn" onClick={loadUsers}>
              Try Again
            </button>
          </div>
          // else — show the actual user cards
        : <div className="users-grid" id="users-grid">
            {/* users.map() = loop through each user object and render a UserCard */}
            {/* (user, index) = each user object + its position in the array (0, 1, 2, ...) */}
            {/* Now using filteredUsers instead of users — only shows matching results */}
            {filteredUsers.map((user, index) => (
              // <UserCard /> = renders the UserCard component for each user
              // key={user.userName} = unique identifier for React's list diffing
              // user={user} = passes the user object as a prop
              // index={index} = used for stagger animation delay
              // onClick={setSelectedUser} = when card is clicked, open the profile modal
              //   → equivalent to: onClick={(user) => setSelectedUser(user)}
              <UserCard
                key={user.userName}
                user={user}
                index={index}
                onClick={setSelectedUser}
                currentUser={currentUser}
                onAddFriend={handleAddFriend}
              />
            ))}
          </div>
        }
      </section>

      {/* ====== PROFILE MODAL ====== */}
      {/* CONDITIONAL RENDERING: {selectedUser && (...)} */}
      {/* If selectedUser is not null (a user card was clicked), show the modal */}
      {/* If selectedUser is null, this entire block is skipped */}
      {selectedUser && (
        <ProfileModal
          user={selectedUser}
          currentUser={currentUser}
          onClose={() => setSelectedUser(null)}
          onAddFriend={handleAddFriend}
          onMessage={handleOpenChat}
        />
      )}

      {/* ====== CHAT MODAL ====== */}
      {chatUser && (
        <ChatModal
          currentUser={currentUser}
          chatUser={chatUser}
          onClose={() => setChatUser(null)}
        />
      )}
    </div>
  );
}
