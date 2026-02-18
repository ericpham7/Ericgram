// ============================================
// LOGIN PAGE COMPONENT
// This is the first screen users see. It shows a form for email/password,
// sends credentials to the C++ backend, and reports success/failure.
// ============================================
import LogInGoogle from "./LogInGoogle";
// { useState } = React hook for storing values that change (form inputs, errors, etc.)
import { useState } from "react";

// Import the logo image file — Vite resolves this to the actual image URL at build time
// "logo" becomes a string like "/src/assets/logo.png" that you can use in <img src={logo}>
import logo from "../assets/logo.png";

// Import the CSS file that styles this component
// "./" = current directory (components/), "../" would go up one level
import "./LoginPage.css";

// { loginUser } = named import — grabs the specific function from api.js
// (as opposed to "import loginUser from ..." which would grab the default export)
import { loginUser } from "../api";

// "export default function" = this is the main thing this file exports
// { onLogin } = "destructuring" the props object
//   → The parent component (App.jsx) passes: <LoginPage onLogin={handleLogin} />
//   → Here, { onLogin } extracts just the onLogin prop from the props object
//   → Equivalent to: function LoginPage(props) { const onLogin = props.onLogin; ... }
export default function LoginPage({ onLogin }) {
  // ---- STATE VARIABLES ----
  // Each useState() creates a [value, setter] pair
  // When you call the setter, React RE-RENDERS this component with the new value

  const [email, setEmail] = useState(""); // what the user typed in the email field
  const [password, setPassword] = useState(""); // what the user typed in the password field
  const [error, setError] = useState(""); // error message to display (empty = no error)
  const [loading, setLoading] = useState(false); // true while waiting for server response
  const [showPassword, setShowPassword] = useState(false); // toggle password visibility

  // ---- FORM SUBMIT HANDLER ----
  // "async" because it calls await loginUser() which is an async network request
  // "(e)" = the event object that the browser passes when a form is submitted
  //   → "e" is short for "event"
  const handleSubmit = async (e) => {
    // e.preventDefault() stops the browser's default form behavior
    //   → Without this, the page would REFRESH and lose all your React state
    e.preventDefault();

    setError(""); // clear any previous error message
    setLoading(true); // show the loading spinner on the button

    // try/catch = error handling
    //   → "try" runs the code, if anything throws an error, "catch" handles it
    try {
      // await loginUser() sends POST /api/login to C++ server
      //   → Returns: { userName, name, email, friendsCount } on success
      //   → Throws: Error on failure (goes to catch block)
      const user = await loginUser(email, password);

      // onLogin(user) calls handleLogin in App.jsx → setUser(userData)
      //   → This causes App.jsx to re-render and show FeedPage instead of LoginPage
      onLogin(user);
    } catch (err) {
      // "err" = the Error object thrown by loginUser()
      // err.message = the error text (e.g., "Invalid email or password")
      setError(err.message);
    } finally {
      // "finally" runs whether try succeeded OR catch ran
      // Always stop the loading spinner
      setLoading(false);
    }
  };

  // ---- JSX RETURN ----
  return (
    <div className="login-page" id="login-page">
      {/* Ambient background effects — decorative animated gradient circles */}
      {/* {/* ... * is a JSX comment — regular // comments don't work inside JSX */}
      <div className="login-bg-orb orb-1" />
      <div className="login-bg-orb orb-2" />
      <div className="login-bg-orb orb-3" />
      <div className="login-bg-orb orb-4" />
      <div className="login-bg-orb orb-5" />
      <div className="login-bg-orb orb-6" />

      {/* "animate-slide-up" = CSS class that makes the card slide up when it appears */}
      <div className="login-card animate-slide-up" id="login-card">
        {/* Logo Section */}
        <div className="login-logo-section">
          {/* src={logo} = uses the imported logo variable (resolved to actual image path) */}
          <img src={logo} alt="EricGram" className="login-logo" />
          <h1 className="login-title gradient-text">EricGram</h1>
          <p className="login-subtitle">Eric's Instagram Emulator</p>
        </div>

        {/* Form — onSubmit fires handleSubmit when user clicks Submit or presses Enter */}
        <form onSubmit={handleSubmit} className="login-form" id="login-form">
          {/* CONDITIONAL RENDERING: {error && (...)} */}
          {/* "&&" = logical AND — if "error" is truthy (not empty string), render the <div> */}
          {/* If error is "" (falsy), this entire block is skipped */}
          {error && (
            <div className="login-error animate-fade-in" id="login-error">
              {/* Inline SVG = drawing an "X" icon directly in the code */}
              {/* SVG attributes are camelCase in React: strokeWidth not stroke-width */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {/* {error} displays the error message string */}
              {error}
            </div>
          )}

          {/* EMAIL INPUT GROUP */}
          <div className="input-group">
            {/* "htmlFor" = React's version of HTML's "for" attribute */}
            {/* Links this label to the input with id="email-input" (accessibility) */}
            <label htmlFor="email-input" className="input-label">
              Email
            </label>
            <div className="input-wrapper">
              {/* Email envelope icon (SVG) */}
              <svg
                className="input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                type="email" // tells browser to validate email format
                id="email-input" // unique ID, matches the label's htmlFor
                value={email} // "controlled input" — React controls what's displayed
                // onChange fires on every keystroke
                // (e) => setEmail(e.target.value):
                //   e = the event object
                //   e.target = the input element itself
                //   e.target.value = the current text in the input
                //   setEmail() updates the state → React re-renders → input shows new value
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="Enter your email"
                required // browser prevents form submit if this is empty
                autoComplete="email" // tells browser to suggest saved emails
              />
            </div>
          </div>

          {/* PASSWORD INPUT GROUP */}
          <div className="input-group">
            <label htmlFor="password-input" className="input-label">
              Password
            </label>
            <div className="input-wrapper">
              {/* Lock icon (SVG) */}
              <svg
                className="input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                // TERNARY OPERATOR: condition ? valueIfTrue : valueIfFalse
                // If showPassword is true → type="text" (visible)
                // If showPassword is false → type="password" (dots/bullets)
                type={showPassword ? "text" : "password"}
                id="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button" // "button" (not "submit") so clicking doesn't submit the form
                className="password-toggle"
                // () => setShowPassword(!showPassword)
                //   → "!" flips the boolean: true becomes false, false becomes true
                //   → Toggles between showing/hiding the password
                onClick={() => setShowPassword(!showPassword)}
                id="password-toggle"
                tabIndex={-1} // -1 = skip this element when user presses Tab (UX choice)
              >
                {/* TERNARY in JSX: show different icons based on showPassword state */}
                {
                  showPassword ?
                    // reveal passwordicon (password is visible, click to hide)
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    // Eye icon (password is hidden, click to show)
                  : <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>

                }
              </button>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit" // "submit" = clicking this triggers the form's onSubmit
            // Template literal in className: adds "loading" class when loading is true
            // `login-btn ${loading ? "loading" : ""}` →
            //   → "login-btn loading" when loading=true
            //   → "login-btn " when loading=false
            className={`login-btn ${loading ? "loading" : ""}`}
            disabled={loading} // disabled=true prevents clicking while request is in progress
            id="login-submit-btn"
          >
            {loading ? <div className="spinner" /> : "Sign In"}
          </button>

        </form>
    
        {/* Footer with demo account hint */}
        <div className="login-footer">
          <p className="login-hint">
            <span className="hint-label">Demo accounts:</span>
            {/* <code> = monospace font, used for displaying code/credentials */}
            <code>ERICPHAM0902@GMAIL.COM</code> / <code>password123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
