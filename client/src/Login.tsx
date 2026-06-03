import { useState } from "react";
import { X } from "lucide-react";
import { api } from "./api";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface Props {
  onSuccess: (user: AuthUser) => void;
  onClose: () => void;
}

export function AuthModal({ onSuccess, onClose }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchTab(next: "login" | "register") {
    setTab(next);
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result =
        tab === "login"
          ? await api.login(email, password)
          : await api.register(email, password, name.trim() || undefined);
      api.setToken(result.token);
      onSuccess(result.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message.replace(/^.*returned 4\d\d.*$/, tab === "login" ? "Invalid email or password." : "Email already registered or password too short (min 6 chars)."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="auth-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="ClariFi sign in">
        <button className="auth-close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-brand">
          <span className="auth-brand-symbol">
            <img src="/logo.png" alt="ClariFi Logo" />
          </span>
          <div>
            <p className="auth-brand-name">ClariFi</p>
            <p className="auth-brand-caption">AI-Guided Finance</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "login"}
            onClick={() => switchTab("login")}
          >
            Sign in
          </button>
          <button
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "register"}
            onClick={() => switchTab("register")}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          {tab === "register" && (
            <label className="auth-field">
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Working…" : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button className="auth-demo-link" type="button" onClick={onClose}>
          Continue as Demo Household
        </button>
      </div>
    </div>
  );
}
