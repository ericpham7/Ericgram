// ============================================
// ENTRY POINT — This is the FIRST JavaScript file that runs
// index.html loads this file via: <script type="module" src="/src/main.jsx">
// ============================================

// { StrictMode } = a React wrapper that helps catch bugs during development
// It doesn't render anything visible — it just adds extra checks
import { StrictMode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

// { createRoot } = the function that connects React to the actual HTML page
// "react-dom" = React's bridge to the browser's DOM (Document Object Model)
// "/client" = the browser-side version (as opposed to server-side rendering)
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Import the global CSS styles (applies to the entire app)
// "./" means "in the same directory as this file"
import "./index.css";

// Import the root App component — the top-level component of the entire app
// ".jsx" extension means it's a React component file (JavaScript + XML/HTML)
import App from "./App.jsx";

const rawGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const googleClientId = rawGoogleClientId.includes("your-google-client-id")
  ? ""
  : rawGoogleClientId;

// createRoot() finds the HTML element with id="root" in index.html
//   → This is the <div id="root"></div> in your index.html
// .render() tells React: "put this component tree inside that div"
createRoot(document.getElementById("root")).render(
  // StrictMode wrapper — enables extra development warnings
  // In production builds, StrictMode does nothing (zero performance cost)
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        {/* <App /> renders the App component — this is where your whole app starts */}
        {/* The "/" means it's a self-closing tag (no children between open/close tags) */}
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
);
