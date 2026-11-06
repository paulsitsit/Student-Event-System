import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Clock3 } from 'lucide-react';
import { api } from '../services/api';
import { PageHead, Modal, Field, Empty } from '../components/common/UI';

const fmt = (value) => value ? new Date(value).toLocaleString() : '—';

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function Attendance() {
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [students, setStudents] = useState([]);
  const [modal, setModal] = useState(false);
  const [correction, setCorrection] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ timeIn: '', reason: '' });
  const [form, setForm] = useState({ studentId: '', eventId: '', action: 'timeIn' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api(`/attendance${eventId ? `?eventId=${eventId}` : ''}`);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || 'Unable to load attendance records.');
    }
  }

  useEffect(() => {
    api('/events')
      .then((data) => setEvents(data.items || []))
      .catch((err) => setError(err.message || 'Unable to load events.'));
    api('/students?limit=100')
      .then((data) => setStudents(data.items || []))
      .catch((err) => setError(err.message || 'Unable to load students.'));
  }, []);

  useEffect(() => {
    load();
  }, [eventId]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/attendance/record', {
        method: 'POST',
        body: JSON.stringify({ ...form, source: 'manual' }),
      });
      setModal(false);
      setForm({ studentId: '', eventId: '', action: 'timeIn' });
      await load();
    } catch (err) {
      setError(err.message || 'Unable to record attendance.');
    } finally {
      setBusy(false);
    }
  }

  function openCorrection(record) {
    setCorrection(record);
    setCorrectionForm({
      timeIn: toLocalDateTime(record.timeIn),
      reason: '',
    });
    setError('');
  }

  async function saveCorrection(event) {
    event.preventDefault();
    if (!correction) return;

    if (!correctionForm.reason.trim()) {
      setError('Please provide a reason for this correction.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api(`/attendance/${correction._id}/correct`, {
        method: 'PATCH',
        body: JSON.stringify({
          timeIn: correctionForm.timeIn
            ? new Date(correctionForm.timeIn).toISOString()
            : undefined,
          reason: correctionForm.reason.trim(),
        }),
      });
      setCorrection(null);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to save attendance correction.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="RECORD MANAGEMENT"
        title="Attendance Records"
        desc="Review time logs and add supervised manual attendance."
        action={
          <button className="btn primary" onClick={() => { setError(''); setModal(true); }}>
            <Plus size={17} /> Manual attendance
          </button>
        }
      />

      <div className="toolbar">
        <Field label="Filter by event">
          <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>{event.title}</option>
            ))}
          </select>
        </Field>
        <button className="btn ghost" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Event</th><th>Time-In</th>
                <th>Time-Out</th><th>Source</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((record) => (
                <tr key={record._id}>
                  <td>
                    <b>{record.student?.lastName}, {record.student?.firstName}</b>
                    <small>{record.student?.studentNumber}</small>
                  </td>
                  <td>{record.event?.title}</td>
                  <td>{fmt(record.timeIn)}</td>
                  <td>{fmt(record.timeOut)}</td>
                  <td><span className="pill gray">{record.source}</span></td>
                  <td>
                    <button className="btn mini ghost" onClick={() => openCorrection(record)}>
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <Empty text="No attendance records for this filter." />}
      </section>

      {modal && (
        <Modal title="Manual attendance" onClose={() => !busy && setModal(false)}>
          <form className="form-grid" onSubmit={submit}>
            <Field label="Student">
              <select required value={form.studentId}
                onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
                <option value="">Select student</option>
                {students.filter((student) => student.active).map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.studentNumber} — {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event">
              <select required value={form.eventId}
                onChange={(event) => setForm({ ...form, eventId: event.target.value })}>
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>{event.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Action">
              <select value={form.action}
                onChange={(event) => setForm({ ...form, action: event.target.value })}>
                <option value="timeIn">Time-In</option>
                <option value="timeOut">Time-Out</option>
              </select>
            </Field>
            {error && <div className="error span-2" role="alert">{error}</div>}
            <div className="modal-actions span-2">
              <button type="button" className="btn ghost"
                onClick={() => setModal(false)} disabled={busy}>Cancel</button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Recording…' : 'Record attendance'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {correction && (
        <Modal title="Correct attendance time"
          onClose={() => !busy && setCorrection(null)}>
          <form className="form-grid" onSubmit={saveCorrection}>
            <div className="span-2 correction-context">
              <Clock3 size={18} />
              <span>
                Correcting <strong>{correction.student?.firstName} {correction.student?.lastName}</strong>
                {' — '}{correction.event?.title || 'Attendance record'}
              </span>
            </div>

            <Field label="Correct Time-In (leave blank to keep unchanged)">
              <input
                type="datetime-local"
                value={correctionForm.timeIn}
                onChange={(event) => setCorrectionForm({ ...correctionForm, timeIn: event.target.value })}
              />
            </Field>

            <Field label="Correction reason">
              <textarea
                rows="3"
                required
                value={correctionForm.reason}
                onChange={(event) => setCorrectionForm({ ...correctionForm, reason: event.target.value })}
                placeholder="Explain why this attendance record needs correction"
              />
            </Field>

            {error && <div className="error span-2" role="alert">{error}</div>}

            <div className="modal-actions span-2">
              <button type="button" className="btn ghost"
                onClick={() => setCorrection(null)} disabled={busy}>Cancel</button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save correction'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
