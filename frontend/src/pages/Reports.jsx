import React, { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { api, downloadCsv } from '../services/api';
import { PageHead, Field } from '../components/common/UI';

const YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];
const SECTIONS = ['A', 'B', 'C'];

export default function Reports() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({
    eventId: '',
    course: '',
    yearLevel: '',
    section: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/events')
      .then((data) => setEvents(data.items || []))
      .catch((err) => setError(err.message || 'Unable to load events.'));
  }, []);

  async function exportReport() {
    setBusy(true);
    setError('');
    try {
      await downloadCsv(filters);
    } catch (err) {
      setError(err.message || 'Unable to download report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="DATA EXPORT"
        title="Reports"
        desc="Export attendance records by event, course, year level, and section."
      />
      <section className="panel report-panel">
        <div className="report-icon"><FileDown size={28} /></div>
        <div>
          <h2>Attendance report (CSV)</h2>
          <p className="muted">
            Export student number, student name, course, year level, section, event,
            Time-In, Time-Out, and attendance source. Choose a specific section to
            export only that class, or leave filters blank to export all records.
          </p>
          <div className="report-filters">
            <Field label="Event filter">
              <select value={filters.eventId} onChange={(event) => setFilters({ ...filters, eventId: event.target.value })}>
                <option value="">All events</option>
                {events.map((event) => <option key={event._id} value={event._id}>{event.title}</option>)}
              </select>
            </Field>
            <Field label="Course">
              <select value={filters.course} onChange={(event) => setFilters({ ...filters, course: event.target.value })}>
                <option value="">All courses</option>
                <option value="BSIT">BSIT</option>
              </select>
            </Field>
            <Field label="Year level">
              <select value={filters.yearLevel} onChange={(event) => setFilters({ ...filters, yearLevel: event.target.value })}>
                <option value="">All year levels</option>
                {YEARS.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select value={filters.section} onChange={(event) => setFilters({ ...filters, section: event.target.value })}>
                <option value="">All sections</option>
                {SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </Field>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn primary" onClick={exportReport} disabled={busy}>
            <FileDown size={16} /> {busy ? 'Preparing report…' : 'Download CSV'}
          </button>
        </div>
      </section>
    </>
  );
}
