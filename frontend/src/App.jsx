// ============================================
// APP COMPONENT — The root of the entire application
// This decides: show LoginPage OR show the main app (Navbar + Feed)
// ============================================

// useState = a React "hook" that lets a component remember values between renders
// When you call setUser(), React re-renders this component with the new value
import { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ReactSpringComponent from "./components/ReactSpringComponent";
import LoginPage from "./components/LoginPage";
import FeedPage from "./components/FeedPage";
import Navbar from "./components/Navbar";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleLogin = (userData) => {
    setUser(userData);
    navigate("/");
  };

  const handleLogout = () => {
    setUser(null);
    navigate("/login");
  };

  return (
    <div className="app" id="app">
      {user && (
        <Navbar
          user={user}
          onLogout={handleLogout}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}

      <Routes>
        <Route path="/login" element={ !user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" replace />}
        />
        <Route path="/" element={ user ? <FeedPage currentUser={user} searchQuery={searchQuery} onUpdateUser={setUser} /> : <Navigate to="/login" replace />}
        />
        <Route path="/login.Google" element={ user ? <FeedPage currentUser={user} searchQuery={searchQuery} onUpdateUser={setUser} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </div>
  );
}

export default App;
