import React, { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api } from '../services/api';
import { PageHead, Field } from '../components/common/UI';
import './settings-page.css';

const EMPTY_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (form.newPassword.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setError('Your new password must be different from your current password.');
      return;
    }

    setBusy(true);
    try {
      const data = await api('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      setMessage(data.message || 'Password updated successfully.');
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || 'Unable to update password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="ADMINISTRATION"
        title="Settings"
        desc="Manage administrator account security."
      />

      <section className="panel settings-panel settings-panel-centered">
        <div className="settings-panel-heading">
          <span className="settings-heading-icon"><KeyRound size={20} /></span>
          <div>
            <h2>Change password</h2>
            <p className="muted">Use a unique password with at least 10 characters.</p>
          </div>
        </div>

        <form className="settings-form settings-form-centered" onSubmit={submit}>
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(event) => updateField('currentPassword', event.target.value)}
              required
            />
          </Field>

          <Field label="New password">
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={form.newPassword}
              onChange={(event) => updateField('newPassword', event.target.value)}
              required
            />
          </Field>

          <Field label="Confirm new password">
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              required
            />
          </Field>

          {error && <div className="error settings-feedback" role="alert">{error}</div>}
          {message && <div className="success-message settings-feedback" role="status">{message}</div>}

          <button className="btn primary settings-submit" type="submit" disabled={busy}>
            <Save size={16} /> {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
    </>
  );
}
