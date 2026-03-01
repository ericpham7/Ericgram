import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import logo from "../assets/logo.svg";
import "./LoginPage.css";
import { loginUser, loginWithGoogle, signupUser } from "../api";
import { seedDemoData } from "../seedDemoData";

const HERO_GIF_URLS = [
  "/assets/hero-yogabbagabba-coachella.gif",
  "https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif",
  "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
  "/assets/hero-terrydavis-templeos.gif",
  "/assets/hero-youtube-clip.gif",
  "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d\s().-]+$/;

function normalizePhoneDigits(value) {
  return value.replace(/[^\d]/g, "");
}

function phoneDigitsToAuthEmail(phoneDigits) {
  return `phone-${phoneDigits}@ericgram.local`;
}

function fallbackPhoneForEmail(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) % 9000000000;
  }
  return String(1000000000 + hash);
}

function parseContactInput(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    throw new Error("Email or phone number is required");
  }

  const email = value.toLowerCase();
  if (EMAIL_PATTERN.test(email)) {
    return { type: "email", email };
  }

  if (!PHONE_PATTERN.test(value)) {
    throw new Error("Enter a valid email address or phone number");
  }

  const phoneDigits = normalizePhoneDigits(value);
  if (!phoneDigits || !/[1-9]/.test(phoneDigits)) {
    throw new Error("Phone number must include at least one non-zero digit");
  }

  if (phoneDigits.length > 18) {
    throw new Error("Phone number is too long");
  }

  return { type: "phone", phoneDigits };
}

function isInvalidCredentialsError(error) {
  return error?.status === 401;
}

function isExistingDemoAccountError(error) {
  return error?.status === 409;
}

function GoogleSignInButton({ disabled, onGoogleUser, onError }) {
  const googleLogin = useGoogleLogin({
    scope: "openid profile email",
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load Google profile");
        }

        const googleUser = await response.json();
        await onGoogleUser(googleUser);
      } catch (err) {
        onError(err.message || "Google sign in failed");
      }
    },
    onError: () => {
      onError("Google sign in was cancelled or failed");
    },
  });

  return (
    <button
      type="button"
      className="google-signin-btn"
      onClick={googleLogin}
      disabled={disabled}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M21.805 10.023H12v3.955h5.617c-.242 1.271-.967 2.348-2.061 3.072v2.553h3.338c1.954-1.8 3.111-4.451 3.111-7.603 0-.659-.067-1.296-.2-1.977z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.811 0 5.165-.922 6.893-2.397l-3.338-2.553c-.928.614-2.116.977-3.555.977-2.725 0-5.031-1.838-5.855-4.311H2.7v2.634A10.001 10.001 0 0 0 12 22z"
          fill="#34A853"
        />
        <path
          d="M6.145 13.716A6.01 6.01 0 0 1 5.818 12c0-.596.116-1.173.327-1.716V7.65H2.7A9.997 9.997 0 0 0 2 12c0 1.611.386 3.133 1.067 4.35l3.078-2.634z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.973c1.53 0 2.904.526 3.984 1.558l2.988-2.988C17.158 2.857 14.81 2 12 2a10 10 0 0 0-9.3 5.65l3.445 2.634C6.969 7.811 9.275 5.973 12 5.973z"
          fill="#EA4335"
        />
      </svg>
      Sign in with Google
    </button>
  );
}

export default function LoginPage({ onLogin }) {
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    userName: "",
    profilePic: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const hasGoogleClientId = Boolean(
    googleClientId && !googleClientId.includes("your-google-client-id"),
  );

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleMode = () => {
    setIsSignupMode((prev) => !prev);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      let user = null;
      if (isSignupMode) {
        const contact = parseContactInput(formData.email);
        const signupEmail =
          contact.type === "email" ? contact.email : phoneDigitsToAuthEmail(contact.phoneDigits);
        const signupPhoneNumber =
          contact.type === "email" ?
            fallbackPhoneForEmail(contact.email)
          : contact.phoneDigits;

        user = await signupUser({
          userName: formData.userName.trim(),
          name: formData.name.trim(),
          phoneNumber: signupPhoneNumber,
          email: signupEmail,
          password: formData.password,
          instagramHandle: "",
          profilePic: "",
        });
      } else {
        const contact = parseContactInput(formData.email);
        const loginEmail =
          contact.type === "email" ? contact.email : phoneDigitsToAuthEmail(contact.phoneDigits);
        user = await loginUser(
          loginEmail,
          formData.password,
        );
      }

      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Demo login: prefer the backend's seeded demo user, then fall back to
  // creating the frontend-only demo account if needed. ──────────────────────
  const SEEDED_DEMO_EMAIL = "averagejoe@emaill.com";
  const SEEDED_DEMO_PASSWORD = "1234";
  const DEMO_EMAIL = "demo@ericgram.local";
  const DEMO_PASSWORD = "EricgramDemo2024!";

  const handleDemoLogin = async () => {
    setError("");
    setDemoLoading(true);
    try {
      try {
        // The C++ backend already seeds this account on startup, so this avoids
        // relying on signup just to enter the demo.
        const seededDemoUser = await loginUser(SEEDED_DEMO_EMAIL, SEEDED_DEMO_PASSWORD);
        await seedDemoData();
        onLogin(seededDemoUser);
        return;
      } catch (err) {
        if (!isInvalidCredentialsError(err)) {
          throw err;
        }
      }

      try {
        const existingDemoUser = await loginUser(DEMO_EMAIL, DEMO_PASSWORD);
        onLogin(existingDemoUser);
        return;
      } catch (err) {
        if (!isInvalidCredentialsError(err)) {
          throw err;
        }
      }

      try {
        await signupUser({
          userName: "demo_viewer",
          name: "Demo User",
          phoneNumber: "5550000000",
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          instagramHandle: "",
          profilePic: "",
        });
      } catch (err) {
        if (!isExistingDemoAccountError(err)) {
          throw err;
        }
      }

      const user = await loginUser(DEMO_EMAIL, DEMO_PASSWORD);
      onLogin(user);
    } catch (err) {
      setError("Demo login failed: " + (err.message || "please try again."));
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGoogleUser = async (googleUser) => {
    const googleEmail = String(googleUser.email || "").trim().toLowerCase();
    if (!googleEmail) {
      throw new Error("Google account did not provide an email");
    }
    if (googleUser.email_verified === false) {
      throw new Error("Google account email is not verified");
    }

    const safeUserNameBase =
      googleEmail.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) ||
      `user${Date.now()}`;
    const suggestedUserName = `${safeUserNameBase}${Math.floor(Math.random() * 10000)}`;

    const authPayload = await loginWithGoogle({
      email: googleEmail,
      name: googleUser.name || googleEmail,
      profilePic: googleUser.picture || "",
      suggestedUserName,
    });

    onLogin(authPayload);
  };

  return (
    <div className="login-page" id="login-page">
      <div className="login-bg-orb orb-1" />
      <div className="login-bg-orb orb-2" />

      <div className="login-layout">
        <section className="login-hero">
          <div className="login-hero-gif-wall" aria-hidden="true">
            {HERO_GIF_URLS.map((gifUrl, index) => {
              const isTerryDavisGif = gifUrl.includes("terrydavis");
              return (
                <div className="login-hero-gif-cell" key={gifUrl}>
                  <img
                    className={isTerryDavisGif ? "login-hero-gif-terry" : ""}
                    src={gifUrl}
                    alt=""
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              );
            })}
          </div>
          <div className="login-hero-content">
            <img src={logo} alt="EricGram" className="login-hero-logo" />
            <h2 className="login-hero-quote">
              Build everyday moments with your{" "}
              <span className="quote-accent">EricGram people.</span>
            </h2>
            <p className="login-hero-subtext">
              An Instagram clone showcasing full-stack engineering with an object-oriented C++ backend and a React.js frontend.
            </p>
          </div>
        </section>

        <section className="login-auth-panel">
          <div className="login-card animate-slide-up" id="login-card">
            <div className="login-logo-section">
              <img src={logo} alt="EricGram" className="login-logo" />
              <h1 className="login-title gradient-text">EricGram</h1>
              <p className="login-subtitle">
                {isSignupMode ? "Create your account" : "Eric's Instagram Emulator"}
              </p>
            </div>

            {/* ── Demo CTA — shown only on the login view ── */}
            {!isSignupMode && (
              <div className="demo-cta-block">
                <button
                  type="button"
                  id="demo-login-btn"
                  className={`demo-btn ${demoLoading ? "demo-btn--loading" : ""}`}
                  onClick={handleDemoLogin}
                  disabled={demoLoading || loading}
                >
                  {demoLoading ? (
                    <><div className="spinner demo-spinner" /> Signing in…</>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/>
                      </svg>
                      Try Demo — one click, no sign‑up
                    </>
                  )}
                </button>
                <p className="demo-cta-hint">
                  Instant access &middot; pre-loaded portfolio data
                </p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="login-form"
              id="login-form"
              autoComplete="on"
            >
              {error && (
                <div className="login-error animate-fade-in" id="login-error">
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
                  {error}
                </div>
              )}

              {isSignupMode && (
                <>
                  <div className="input-group">
                    <label htmlFor="name-input" className="input-label">
                      Full Name
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="name-input"
                        name="name"
                        value={formData.name}
                        onChange={(e) => setField("name", e.target.value)}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="username-input" className="input-label">
                      Username
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="username-input"
                        name="username"
                        value={formData.userName}
                        onChange={(e) => setField("userName", e.target.value)}
                        placeholder="Choose a username"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="input-group">
                <label htmlFor="email-input" className="input-label">
                  {isSignupMode ? "Email or Phone" : "Email"}
                </label>
                <div className="input-wrapper">
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
                    type="text"
                    id="email-input"
                    name="email"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder={isSignupMode ? "Enter your email or phone number" : "Enter your email"}
                    required
                    autoComplete={isSignupMode ? "email" : "username"}
                    inputMode={isSignupMode ? "text" : "email"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password-input" className="input-label">
                  Password
                </label>
                <div className="input-wrapper">
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
                    type={showPassword ? "text" : "password"}
                    id="password-input"
                    name="password"
                    value={formData.password}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete={isSignupMode ? "new-password" : "current-password"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    id="password-toggle"
                    tabIndex={-1}
                  >
                    {showPassword ?
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

              <button
                type="submit"
                className={`login-btn ${loading ? "loading" : ""}`}
                disabled={loading}
                id="login-submit-btn"
              >
                {loading ? <div className="spinner" /> : isSignupMode ? "Create Account" : "Sign In"}
              </button>

              {!isSignupMode && (
                <>
                  <div className="auth-divider" aria-hidden="true">
                    <span>or</span>
                  </div>
                  {hasGoogleClientId ? (
                    <GoogleSignInButton
                      disabled={loading}
                      onGoogleUser={async (googleUser) => {
                        setError("");
                        setLoading(true);
                        try {
                          await handleGoogleUser(googleUser);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      onError={(message) => setError(message)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="google-signin-btn google-signin-btn--disabled-hint"
                      onClick={() =>
                        setError(
                          "Google sign-in is not configured. Add your real VITE_GOOGLE_CLIENT_ID in frontend/.env and restart the frontend server.",
                        )}
                      disabled={loading}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M21.805 10.023H12v3.955h5.617c-.242 1.271-.967 2.348-2.061 3.072v2.553h3.338c1.954-1.8 3.111-4.451 3.111-7.603 0-.659-.067-1.296-.2-1.977z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 22c2.811 0 5.165-.922 6.893-2.397l-3.338-2.553c-.928.614-2.116.977-3.555.977-2.725 0-5.031-1.838-5.855-4.311H2.7v2.634A10.001 10.001 0 0 0 12 22z"
                          fill="#34A853"
                        />
                        <path
                          d="M6.145 13.716A6.01 6.01 0 0 1 5.818 12c0-.596.116-1.173.327-1.716V7.65H2.7A9.997 9.997 0 0 0 2 12c0 1.611.386 3.133 1.067 4.35l3.078-2.634z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.973c1.53 0 2.904.526 3.984 1.558l2.988-2.988C17.158 2.857 14.81 2 12 2a10 10 0 0 0-9.3 5.65l3.445 2.634C6.969 7.811 9.275 5.973 12 5.973z"
                          fill="#EA4335"
                        />
                      </svg>
                      Sign in with Google
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                className="mode-toggle-btn"
                onClick={handleToggleMode}
                disabled={loading}
              >
                {isSignupMode ? "Back to Sign In" : "Create Account"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
