import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import FeedPage from "./components/FeedPage";
import Navbar from "./components/Navbar";
import MediaFeedPage from "./components/MediaFeedPage";
import { fetchAuthSession, logoutUser } from "./api";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetchAuthSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session.user || null);
        setRole(session.role || "user");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setRole("user");
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleLogin = (authPayload) => {
    if (authPayload?.user) {
      setUser(authPayload.user);
      setRole(authPayload.role || "user");
    } else {
      setUser(authPayload);
      setRole("user");
    }
    navigate("/");
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch { /* best-effort */ }
    setUser(null);
    setRole("user");
    navigate("/login");
  };

  if (checkingSession) {
    return (
      <div className="app-loading">
        <div className="ig-spinner" />
      </div>
    );
  }

  return (
    <div className="app" id="app">
      {user && (
        <Navbar
          user={user}
          onLogout={handleLogout}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onUpdateUser={setUser}
        />
      )}

      <Routes>
        <Route
          path="/login"
          element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/"
          element={
            user ? (
              <MediaFeedPage currentUser={user} searchQuery={searchQuery} role={role} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/people"
          element={
            user ? (
              <FeedPage currentUser={user} searchQuery={searchQuery} onUpdateUser={setUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/explore"
          element={
            user ? (
              <MediaFeedPage currentUser={user} searchQuery={searchQuery} role={role} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </div>
  );
}

export default App;
