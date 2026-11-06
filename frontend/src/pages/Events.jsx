import React, { useEffect, useState } from 'react';
import { Plus, CalendarDays } from 'lucide-react';
import { api } from '../services/api';
import { PageHead, Modal, Field, Empty, ConfirmModal } from '../components/common/UI';

const fmt = (value) => value ? new Date(value).toLocaleString() : '—';

function localDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function Events() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const blank = {
    title: '',
    description: '',
    venue: '',
    startsAt: localDateTime(),
    endsAt: localDateTime(),
  };
  const [form, setForm] = useState(blank);

  async function load() {
    try {
      const data = await api('/events');
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || 'Unable to load events.');
    }
  }

  useEffect(() => { load(); }, []);

  function open(event = null) {
    setEditing(event);
    setForm(event ? {
      title: event.title || '',
      description: event.description || '',
      venue: event.venue || '',
      startsAt: localDateTime(event.startsAt),
      endsAt: localDateTime(event.endsAt),
    } : { ...blank });
    setModal(true);
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(editing ? `/events/${editing._id}` : '/events', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setModal(false);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to save event.');
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!archiveTarget) return;
    setBusy(true);
    setError('');
    try {
      await api(`/events/${archiveTarget._id}`, { method: 'DELETE' });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to archive event.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="SCHEDULING"
        title="Events"
        desc="Create and manage campus events for attendance tracking."
        action={
          <button className="btn primary" onClick={() => open()}>
            <Plus size={17} /> Create event
          </button>
        }
      />

      {error && <div className="error" role="alert">{error}</div>}

      <div className="event-grid">
        {items.map((event) => (
          <article className="event-card" key={event._id}>
            <div className="event-top">
              <span className="pill green">{event.status}</span>
              <span className="muted">{event.venue || 'Venue not set'}</span>
            </div>
            <h2>{event.title}</h2>
            <p className="muted">{event.description || 'No event description.'}</p>
            <div className="event-date">
              <CalendarDays size={17} />
              <span>{fmt(event.startsAt)}<br /><small>Until {fmt(event.endsAt)}</small></span>
            </div>
            <div className="actions">
              <button className="btn mini ghost" onClick={() => open(event)}>Edit</button>
              <button className="btn mini ghost" onClick={() => setArchiveTarget(event)}>Archive</button>
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <section className="panel">
          <Empty text="No events yet. Create your first event." />
        </section>
      )}

      {modal && (
        <Modal title={editing ? 'Edit event' : 'Create event'}
          onClose={() => !busy && setModal(false)}>
          <form className="form-grid" onSubmit={save}>
            <Field label="Event title">
              <input required value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Venue">
              <input value={form.venue}
                onChange={(event) => setForm({ ...form, venue: event.target.value })} />
            </Field>
            <Field label="Start date and time">
              <input type="datetime-local" required value={form.startsAt}
                onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </Field>
            <Field label="End date and time">
              <input type="datetime-local" required value={form.endsAt}
                onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </Field>
            <Field label="Description">
              <textarea rows="3" value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            {error && <div className="error span-2" role="alert">{error}</div>}
            <div className="modal-actions span-2">
              <button type="button" className="btn ghost"
                onClick={() => setModal(false)} disabled={busy}>Cancel</button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save event'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {archiveTarget && (
        <ConfirmModal
          title="Archive event?"
          message={`Are you sure you want to archive “${archiveTarget.title}”? The event will no longer be available for new attendance activity.`}
          confirmText="Archive event"
          danger
          busy={busy}
          onCancel={() => !busy && setArchiveTarget(null)}
          onConfirm={archive}
        />
      )}
    </>
  );
}
