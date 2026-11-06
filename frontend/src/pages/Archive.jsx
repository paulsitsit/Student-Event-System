import React, { useEffect, useMemo, useState } from 'react';
import { Archive as ArchiveIcon, Users, CalendarDays, RotateCcw, Search, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { PageHead, ConfirmModal, Empty } from '../components/common/UI';

const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '—';
const yearLabel = (value) => ({
  '1': '1st Year',
  '2': '2nd Year',
  '3': '3rd Year',
  '4': '4th Year',
}[String(value)] || value || '—');

export default function Archive() {
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [studentData, eventData] = await Promise.all([
        api('/students?limit=100'),
        api('/events?includeArchived=true'),
      ]);
      setStudents((studentData.items || []).filter((student) => student.active === false));
      setEvents((eventData.items || []).filter((event) => event.archived === true));
    } catch (err) {
      setError(err.message || 'Unable to load archived records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) => [
      student.studentNumber, student.firstName, student.lastName,
      student.course, student.yearLevel, student.section, student.email,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [students, query]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => [
      event.title, event.description, event.venue, event.status,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [events, query]);

  async function restore() {
    if (!target) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (target.type === 'student') {
        await api(`/students/${target.record._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active: true }),
        });
        setSuccess(`${target.record.firstName} ${target.record.lastName} was restored to Students.`);
      } else {
        await api(`/events/${target.record._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ archived: false }),
        });
        setSuccess(`"${target.record.title}" was restored to Events.`);
      }
      setTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to restore this record.');
    } finally {
      setBusy(false);
    }
  }

  const count = tab === 'students' ? filteredStudents.length : filteredEvents.length;

  return (
    <>
      <PageHead
        eyebrow="RECORD RECOVERY"
        title="Archive"
        desc="View and restore deactivated students and archived events. Historical attendance records are preserved."
        action={<button className="btn ghost" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>}
      />

      <div className="archive-summary">
        <article className="panel archive-stat">
          <span className="archive-stat-icon"><Users size={19} /></span>
          <div><strong>{students.length}</strong><span>Archived students</span></div>
        </article>
        <article className="panel archive-stat">
          <span className="archive-stat-icon"><CalendarDays size={19} /></span>
          <div><strong>{events.length}</strong><span>Archived events</span></div>
        </article>
      </div>

      {success && <div className="success-message" role="status">{success}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <section className="panel archive-panel">
        <div className="archive-toolbar">
          <div className="archive-tabs" role="tablist" aria-label="Archived record type">
            <button type="button" role="tab" aria-selected={tab === 'students'}
              className={tab === 'students' ? 'active' : ''}
              onClick={() => { setTab('students'); setQuery(''); }}>
              <Users size={16} /> Students <span>{students.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'events'}
              className={tab === 'events' ? 'active' : ''}
              onClick={() => { setTab('events'); setQuery(''); }}>
              <CalendarDays size={16} /> Events <span>{events.length}</span>
            </button>
          </div>
          <div className="search archive-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'students' ? 'Search archived students…' : 'Search archived events…'} />
          </div>
        </div>

        {loading ? (
          <div className="archive-loading"><ArchiveIcon size={20} /> Loading archived records…</div>
        ) : tab === 'students' ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Course</th><th>Year level</th><th>Section</th><th>Email</th><th>Action</th></tr></thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student._id}>
                    <td><b>{student.lastName}, {student.firstName}</b><small>{student.studentNumber}</small></td>
                    <td>{student.course || '—'}</td>
                    <td>{yearLabel(student.yearLevel)}</td>
                    <td>{student.section || '—'}</td>
                    <td>{student.email || '—'}</td>
                    <td><button className="btn mini primary" onClick={() => setTarget({ type: 'student', record: student })}><RotateCcw size={14} /> Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && <Empty text={students.length ? 'No archived students match your search.' : 'No deactivated students in the archive.'} />}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Venue</th><th>Start date</th><th>End date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event._id}>
                    <td><b>{event.title}</b><small>{event.description || 'No description'}</small></td>
                    <td>{event.venue || '—'}</td>
                    <td>{dateLabel(event.startsAt)}</td>
                    <td>{dateLabel(event.endsAt)}</td>
                    <td><span className="pill gray">Archived</span></td>
                    <td><button className="btn mini primary" onClick={() => setTarget({ type: 'event', record: event })}><RotateCcw size={14} /> Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEvents.length === 0 && <Empty text={events.length ? 'No archived events match your search.' : 'No archived events.'} />}
          </div>
        )}
        <div className="archive-footer"><ArchiveIcon size={14} /> {count} {tab === 'students' ? 'student' : 'event'} record{count === 1 ? '' : 's'} shown</div>
      </section>

      {target && (
        <ConfirmModal
          title={target.type === 'student' ? 'Restore student?' : 'Restore event?'}
          message={target.type === 'student'
            ? `Restore ${target.record.firstName} ${target.record.lastName}? This will reactivate the student and make the profile available in the Students page and attendance workflows.`
            : `Restore "${target.record.title}"? This will make the event visible again on the Events page.`}
          confirmText="Restore"
          busy={busy}
          onCancel={() => !busy && setTarget(null)}
          onConfirm={restore}
        />
      )}
    </>
  );
}
