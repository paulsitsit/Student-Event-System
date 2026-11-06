import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { api } from '../services/api';
import { PageHead, Field } from '../components/common/UI';
import institutionalHeader from '../assets/pcc-institutional-header.jpg';
import {
  exportAttendanceCsv,
  exportAttendancePdf,
  exportAttendanceWord,
} from '../utils/attendance-report-export';
import '../attendance-print.css';
import './reports-page.css';

const YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];
const SECTIONS = ['A', 'B', 'C'];
const COURSE = 'BSIT';
const PAGE_SIZE = 10;

const dateLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const timeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
};

const studentName = (student = {}) =>
  [student.lastName, student.firstName].filter(Boolean).join(', ') ||
  student.name ||
  '';

function splitPages(items) {
  const pages = [];
  for (let index = 0; index < items.length; index += PAGE_SIZE) {
    pages.push(items.slice(index, index + PAGE_SIZE));
  }
  return pages.length ? pages : [[]];
}

function PrintSheet({ event, students, attendance, filters }) {
  const attendanceByStudent = useMemo(() => {
    const map = new Map();
    attendance.forEach((record) => {
      const key = record.student?._id || record.student;
      if (key) map.set(String(key), record);
    });
    return map;
  }, [attendance]);

  const pages = useMemo(() => splitPages(students), [students]);
  const yearLabel = filters.yearLevel
    ? `${filters.yearLevel}${filters.yearLevel === '1' ? 'st' : filters.yearLevel === '2' ? 'nd' : filters.yearLevel === '3' ? 'rd' : 'th'} Year`
    : '';
  const classLabel = [COURSE, yearLabel, filters.section ? `Section ${filters.section}` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="attendance-print-root">
      {pages.map((pageStudents, pageIndex) => (
        <article className="attendance-print-page" key={pageIndex}>
          <header className="attendance-print-brand">
            <img
              className="attendance-print-institutional-header"
              src={institutionalHeader}
              alt="Passi City College and partner institutional logos"
            />
          </header>

          <div className="attendance-print-title">
            <span>{event?.title || 'EVENT'}</span>
            <small>Event Attendance</small>
          </div>

          <section className="attendance-print-details">
            <div className="attendance-print-detail-left">
              <div><b>Name of Event :</b><span>{event?.title || ''}</span></div>
              <div><b>Course &amp; Year Section :</b><span>{classLabel}</span></div>
            </div>
            <div className="attendance-print-detail-right">
              <div><b>Date :</b><span>{dateLabel(event?.startsAt)}</span></div>
              <div><b>Venue :</b><span>{event?.venue || ''}</span></div>
            </div>
          </section>

          <table className="attendance-print-table">
            <colgroup>
              <col className="col-number" />
              <col className="col-id" />
              <col className="col-name" />
              <col className="col-time" />
              <col className="col-time" />
              <col className="col-time" />
              <col className="col-time" />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan="2">No.</th>
                <th rowSpan="2">Student ID #</th>
                <th rowSpan="2">Student Name</th>
                <th colSpan="2">AM</th>
                <th colSpan="2">PM</th>
              </tr>
              <tr>
                <th>Time In</th><th>Time Out</th>
                <th>Time In</th><th>Time Out</th>
              </tr>
            </thead>
            <tbody>
              {pageStudents.map((student, rowIndex) => {
                const record = attendanceByStudent.get(String(student._id));
                const isPm = Boolean(record?.timeIn && new Date(record.timeIn).getHours() >= 12);
                return (
                  <tr key={student._id}>
                    <td className="attendance-print-number">{pageIndex * PAGE_SIZE + rowIndex + 1}</td>
                    <td>{student.studentNumber || student.studentId || ''}</td>
                    <td className="attendance-print-student-name">{studentName(student)}</td>
                    <td>{record?.timeIn && !isPm ? timeLabel(record.timeIn) : ''}</td>
                    <td>{record?.timeOut && !isPm ? timeLabel(record.timeOut) : ''}</td>
                    <td>{record?.timeIn && isPm ? timeLabel(record.timeIn) : ''}</td>
                    <td>{record?.timeOut && isPm ? timeLabel(record.timeOut) : ''}</td>
                  </tr>
                );
              })}
              {Array.from({ length: PAGE_SIZE - pageStudents.length }).map((_, index) => (
                <tr key={`blank-${index}`} className="attendance-print-blank-row">
                  <td>{pageIndex * PAGE_SIZE + pageStudents.length + index + 1}</td>
                  <td /><td /><td /><td /><td /><td />
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="attendance-print-footer">
            <span>Passi City College • Student Event Attendance System</span>
            <span>Page {pageIndex + 1} of {pages.length}</span>
          </footer>
        </article>
      ))}
    </div>
  );
}

export default function Reports() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ eventId: '', yearLevel: '', section: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    api('/events')
      .then((data) => setEvents(data.items || []))
      .catch((err) => setError(err.message || 'Unable to load events.'));
  }, []);

  async function preparePrint() {
    if (!filters.eventId) {
      setError('Please select an event before preparing the attendance sheet.');
      return;
    }

    setBusy(true);
    setError('');
    setPrintData(null);

    try {
      const selectedEvent = events.find((item) => item._id === filters.eventId);
      if (!selectedEvent) throw new Error('Selected event could not be found.');

      // Keep the BSIT query on every page. The backend paginates at 100 records.
      const firstPage = await api(`/students?${new URLSearchParams({
        limit: '100',
        page: '1',
        q: COURSE,
      }).toString()}`);

      let allStudents = firstPage.items || [];
      const totalPages = Math.max(1, Number(firstPage.pages) || 1);

      for (let page = 2; page <= totalPages; page += 1) {
        const query = new URLSearchParams({
          limit: '100',
          page: String(page),
          q: COURSE,
        });
        const data = await api(`/students?${query.toString()}`);
        allStudents = allStudents.concat(data.items || []);
      }

      allStudents = allStudents
        .filter((student) => student.active !== false && student.course === COURSE)
        .filter((student) => !filters.yearLevel || String(student.yearLevel) === filters.yearLevel)
        .filter((student) => !filters.section || student.section === filters.section)
        .sort((a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`));

      const attendanceData = await api(`/attendance?eventId=${encodeURIComponent(filters.eventId)}`);

      setPrintData({
        event: selectedEvent,
        students: allStudents,
        attendance: attendanceData.items || [],
        filters: { ...filters, course: COURSE },
      });
    } catch (err) {
      setError(err.message || 'Unable to prepare printable attendance sheet.');
    } finally {
      setBusy(false);
    }
  }

  async function exportFormatted(format) {
    if (!printData) return;
    setExporting(format);
    setError('');
    try {
      if (format === 'csv') exportAttendanceCsv(printData);
      if (format === 'pdf') await exportAttendancePdf(printData, institutionalHeader);
      if (format === 'word') await exportAttendanceWord(printData, institutionalHeader);
    } catch (err) {
      setError(err.message || `Unable to create ${format.toUpperCase()} report.`);
    } finally {
      setExporting('');
    }
  }

  function printSheet() {
    if (printData) window.print();
  }

  return (
    <>
      <PageHead
        eyebrow="DATA EXPORT"
        title="Reports"
        desc="Prepare a printable BSIT event attendance sheet or export attendance records as CSV, PDF, or Word."
      />

      <section className="panel report-panel report-panel-fixed-course">
        <div className="report-icon"><Printer size={28} /></div>
        <div className="report-panel-content">
          <h2>Printable attendance sheet</h2>
          <p className="muted">
            Print a landscape attendance sheet for BSIT students with event details,
            student roster, and grouped AM/PM Time-In and Time-Out columns.
            Select an event and optionally filter by year level and section.
          </p>

          <div className="report-course-static" aria-label="Course filter fixed to BSIT">
            <span>Course</span>
            <strong>BSIT</strong>
            <small>Fixed course</small>
          </div>

          <div className="report-filters">
            <Field label="Event (required)">
              <select
                value={filters.eventId}
                onChange={(event) => setFilters((current) => ({ ...current, eventId: event.target.value }))}
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>{event.title}</option>
                ))}
              </select>
            </Field>

            <Field label="Year level">
              <select
                value={filters.yearLevel}
                onChange={(event) => setFilters((current) => ({ ...current, yearLevel: event.target.value }))}
              >
                <option value="">All year levels</option>
                {YEARS.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
              </select>
            </Field>

            <Field label="Section">
              <select
                value={filters.section}
                onChange={(event) => setFilters((current) => ({ ...current, section: event.target.value }))}
              >
                <option value="">All sections</option>
                {SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </Field>
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <div className="report-actions">
            <button className="btn primary" onClick={preparePrint} disabled={busy}>
              <Printer size={16} /> {busy ? 'Preparing sheet…' : 'Prepare print sheet'}
            </button>
          </div>

          {printData && (
            <div className="report-print-ready">
              <span>Report ready: {printData.students.length} BSIT students. Choose an export format.</span>
              <div className="report-export-buttons">
                <button className="btn primary" onClick={() => exportFormatted('csv')} disabled={Boolean(exporting)}>
                  <FileDown size={16} /> {exporting === 'csv' ? 'Creating CSV…' : 'Download CSV'}
                </button>
                <button className="btn primary" onClick={() => exportFormatted('pdf')} disabled={Boolean(exporting)}>
                  <FileDown size={16} /> {exporting === 'pdf' ? 'Creating PDF…' : 'Download PDF'}
                </button>
                <button className="btn primary" onClick={() => exportFormatted('word')} disabled={Boolean(exporting)}>
                  <FileDown size={16} /> {exporting === 'word' ? 'Creating Word…' : 'Download Word'}
                </button>
                <button className="btn ghost" onClick={printSheet}>
                  <Printer size={16} /> Print attendance sheet
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {printData && (
        <div className="attendance-print-preview">
          <div className="attendance-print-preview-head">
            <strong>Print preview</strong>
            <span>{printData.event.title} · {printData.students.length} BSIT students</span>
          </div>
          <PrintSheet {...printData} />
        </div>
      )}
    </>
  );
}
