import React, { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { PageHead, Modal, Field, Empty } from '../components/common/UI';
import FaceEnrollment from '../components/students/FaceEnrollment';

const COURSE_OPTIONS = ['BSIT'];
const YEAR_OPTIONS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];
const SECTION_OPTIONS = ['A', 'B', 'C'];

function normalizeYear(value) {
  const match = String(value || '').match(/[1-4]/);
  return match ? match[0] : '';
}

export default function Students() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const empty = {
    studentNumber: '',
    firstName: '',
    lastName: '',
    course: 'BSIT',
    yearLevel: '',
    section: '',
    email: '',
  };
  const [form, setForm] = useState(empty);

  async function load() {
    try {
      const data = await api(`/students?q=${encodeURIComponent(q)}&limit=100`);
      setItems(data.items || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load students.');
    }
  }

  useEffect(() => { load(); }, []);

  function openForm(student = null) {
    setEditing(student);
    setForm(student ? {
      ...empty,
      ...student,
      course: student.course || 'BSIT',
      yearLevel: normalizeYear(student.yearLevel),
      section: String(student.section || '').toUpperCase(),
    } : { ...empty });
    setModal(true);
    setError('');
    setSuccess('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        course: 'BSIT',
        yearLevel: form.yearLevel,
        section: form.section,
      };
      await api(editing ? `/students/${editing._id}` : '/students', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setModal(false);
      setSuccess(editing ? 'Student profile updated.' : 'Student added successfully.');
      await load();
    } catch (err) {
      setError(err.message || 'Unable to save student.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(student) {
    try {
      await api(`/students/${student._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !student.active }),
      });
      await load();
    } catch (err) {
      setError(err.message || 'Unable to update student status.');
    }
  }

  const yearLabel = (value) => YEAR_OPTIONS.find((item) => item.value === normalizeYear(value))?.label || value || '—';

  return (
    <>
      <PageHead
        eyebrow="DIRECTORY"
        title="Students"
        desc="Manage student profiles, course assignments, sections, and biometric enrollment."
        action={<button className="btn primary" onClick={() => openForm()}><Plus size={17} /> Add student</button>}
      />

      {success && <div className="success-message" role="status">{success}</div>}
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Search student number, name, course, year, or section…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && load()}
          />
        </div>
        <button className="btn ghost" onClick={load}><Search size={16} /> Search</button>
        <button className="btn ghost" onClick={load}><RefreshCw size={16} /></button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Course</th><th>Year level</th>
                <th>Section</th><th>Email</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((student) => (
                <tr key={student._id}>
                  <td><b>{student.lastName}, {student.firstName}</b><small>{student.studentNumber}</small></td>
                  <td>{student.course || '—'}</td>
                  <td>{yearLabel(student.yearLevel)}</td>
                  <td>{student.section || '—'}</td>
                  <td>{student.email || '—'}</td>
                  <td><span className={student.active ? 'pill green' : 'pill gray'}>{student.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn mini ghost" onClick={() => openForm(student)}>Edit</button>
                      <button className="btn mini ghost" onClick={() => setEnrolling(student)}>Enroll face</button>
                      <button className="btn mini ghost" onClick={() => toggle(student)}>{student.active ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <Empty text="No students found. Add a student to get started." />}
      </section>

      {enrolling && (
        <Modal title="Face enrollment" onClose={() => setEnrolling(null)}>
          <FaceEnrollment
            student={enrolling}
            onClose={() => setEnrolling(null)}
            onSaved={() => setSuccess('Face descriptor enrolled successfully.')}
          />
        </Modal>
      )}

      {modal && (
        <Modal title={editing ? 'Edit student' : 'Add student'} onClose={() => !busy && setModal(false)}>
          <form className="form-grid" onSubmit={save}>
            <Field label="Student number">
              <input value={form.studentNumber} onChange={(event) => setForm({ ...form, studentNumber: event.target.value })} required />
            </Field>
            <Field label="First name">
              <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            </Field>
            <Field label="Last name">
              <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
            </Field>
            <Field label="Course">
              <select value={form.course} onChange={(event) => setForm({ ...form, course: event.target.value })} required>
                {COURSE_OPTIONS.map((course) => <option key={course} value={course}>{course}</option>)}
              </select>
            </Field>
            <Field label="Year level">
              <select value={form.yearLevel} onChange={(event) => setForm({ ...form, yearLevel: event.target.value })} required>
                <option value="">Select year level</option>
                {YEAR_OPTIONS.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} required>
                <option value="">Select section</option>
                {SECTION_OPTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </Field>
            <Field label="Email">
              <input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            {error && <div className="error span-2" role="alert">{error}</div>}
            <div className="modal-actions span-2">
              <button type="button" className="btn ghost" onClick={() => setModal(false)} disabled={busy}>Cancel</button>
              <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save student'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
