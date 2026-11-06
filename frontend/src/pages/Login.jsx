import React, { useState } from "react";
import { api, setToken } from "../services/api";
import PccLogo from "../assets/pcc-logo.jpg";
import "../styles/pcc-login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@pcc.edu.ph");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!data.token || !data.admin) {
        throw new Error("Invalid login response from server.");
      }

      setToken(data.token);
      onLogin(data.admin);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pcc-login-wrap">
      <section className="pcc-login-card">
        <header className="pcc-login-brand">
          <img
            src={PccLogo}
            alt="Passi City College - School of Information and Communication Technology"
            className="pcc-login-logo"
          />
          <p className="pcc-login-eyebrow">PASSI CITY COLLEGE</p>
          <h1>Attendance Portal</h1>
          <p className="pcc-login-subtitle">Administrator sign in</p>
        </header>

        {error && <div className="pcc-login-error" role="alert">{error}</div>}

        <form className="pcc-login-form" onSubmit={submit}>
          <label htmlFor="pcc-login-email">
            Email address
            <input
              id="pcc-login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label htmlFor="pcc-login-password">
            Password
            <input
              id="pcc-login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="pcc-login-submit" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="pcc-login-note">
          Use the administrator account configured in backend/.env.
        </p>
      </section>
    </main>
  );
}
