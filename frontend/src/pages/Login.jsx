import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api, setToken } from '../services/api';
import PccLogo from '../assets/pcc-logo.jpg';
import SoictLogo from '../assets/soict-logo.jpg';
import '../styles/pcc-login.css';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@pcc.edu.ph');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!data.token || !data.admin) {
        throw new Error('Invalid login response from server.');
      }

      setToken(data.token);
      onLogin(data.admin);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pcc-login-wrap">
      <section className="pcc-login-card">
        <header className="pcc-login-brand">
          <div className="pcc-login-logos">
            <div className="pcc-login-logo-frame pcc-login-logo-frame-main">
              <img
                src={PccLogo}
                alt="Passi City College logo"
                className="pcc-login-logo"
              />
            </div>
            <div className="pcc-login-logo-frame pcc-login-logo-frame-soict">
              <img
                src={SoictLogo}
                alt="School of Information and Communication Technology logo"
                className="pcc-login-soict-logo"
              />
            </div>
          </div>

          <p className="pcc-login-eyebrow">PASSI CITY COLLEGE</p>
          <h1>Attendance Portal</h1>
          <p className="pcc-login-subtitle">Administrator sign in</p>
          <p className="pcc-login-program">
            Under the Passi City College<br />
            Bachelor of Science in Information<br />
            and Communication Technology
          </p>
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
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label htmlFor="pcc-login-password">
            Password
            <span className="pcc-password-control">
              <input
                id="pcc-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="pcc-password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>

          <button className="pcc-login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="pcc-login-note">
          Use the administrator account configured in backend/.env.
        </p>
      </section>
    </main>
  );
}
