
import React, { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, CalendarDays, GraduationCap, ArrowUpRight } from 'lucide-react';
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
  const [sortBy, setSortBy] = useState('name-asc');
  const [yearFilter, setYearFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [schoolYearOpen, setSchoolYearOpen] = useState(false);
  const [schoolYearBusy, setSchoolYearBusy] = useState(false);
  const [schoolYearError, setSchoolYearError] = useState('');
  const [schoolYearSuccess, setSchoolYearSuccess] = useState('');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [currentAcademicYear, setCurrentAcademicYear] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [selectedPromotions, setSelectedPromotions] = useState([]);
  const [selectedGraduates, setSelectedGraduates] = useState([]);

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
      const data = await api(`/students?q=${encodeURIComponent(q)}&limit=1000`);
      setItems(data.items || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load students.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openSchoolYear() {
    setSchoolYearOpen(true);
    setSchoolYearError('');
    setSchoolYearSuccess('');
    setSelectedPromotions([]);
    setSelectedGraduates([]);
    setSchoolYearBusy(true);

    try {
      const data = await api('/students/school-year/eligible');
      setEligibleStudents(data.items || []);

      const current = data.currentAcademicYear || '';
      setCurrentAcademicYear(current);

      if (current) {
        const match = current.match(/(\d{4})\s*[-–]\s*(\d{4})/);
        setSchoolYear(
          match
            ? `${Number(match[2])}-${Number(match[2]) + 1}`
            : '2026-2027'
        );
      } else {
        const year = new Date().getFullYear();
        setSchoolYear(`${year}-${year + 1}`);
      }
    } catch (err) {
      setSchoolYearError(err.message || 'Unable to load eligible students.');
    } finally {
      setSchoolYearBusy(false);
    }
  }

  const toggleSelected = (id, type) => {
    const setter =
      type === 'graduate'
        ? setSelectedGraduates
        : setSelectedPromotions;

    setter((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  // Select or deselect all students in one year-level group.
  // This does not affect selections in other groups.
  const toggleGroupSelection = (students, type) => {
    const ids = students.map((student) => student._id);

    if (!ids.length) return;

    const selected =
      type === 'graduate'
        ? selectedGraduates
        : selectedPromotions;

    const setter =
      type === 'graduate'
        ? setSelectedGraduates
        : setSelectedPromotions;

    const allSelected = ids.every((id) => selected.includes(id));

    setter((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])]
    );
  };

  async function startSchoolYear() {
    setSchoolYearBusy(true);
    setSchoolYearError('');
    setSchoolYearSuccess('');

    try {
      const result = await api('/students/school-year/process', {
        method: 'POST',
        body: JSON.stringify({
          academicYear: schoolYear,
          promotedStudentIds: selectedPromotions,
          graduatedStudentIds: selectedGraduates,
        }),
      });

      setSchoolYearSuccess(
        result.message || 'New school year started successfully.'
      );

      setSchoolYearOpen(false);
      setSelectedPromotions([]);
      setSelectedGraduates([]);

      await load();
    } catch (err) {
      setSchoolYearError(
        err.message || 'Unable to start the new school year.'
      );
    } finally {
      setSchoolYearBusy(false);
    }
  }

  function openForm(student = null) {
    setEditing(student);

    setForm(
      student
        ? {
            ...empty,
            ...student,
            course: student.course || 'BSIT',
            yearLevel: normalizeYear(student.yearLevel),
            section: String(student.section || '').toUpperCase(),
          }
        : { ...empty }
    );

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
      setSuccess(
        editing
          ? 'Student profile updated.'
          : 'Student added successfully.'
      );

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

  const yearLabel = (value) =>
    YEAR_OPTIONS.find(
      (item) => item.value === normalizeYear(value)
    )?.label || value || '—';

  const filtersActive = Boolean(yearFilter || sectionFilter || statusFilter);

  const fullName = (student) =>
    `${student.lastName || ''} ${student.firstName || ''}`.trim();

  const byName = (a, b) => fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' });
  const byNumber = (a, b) =>
    String(a.studentNumber || '').localeCompare(String(b.studentNumber || ''), undefined, { numeric: true });
  const byYear = (a, b) =>
    Number(normalizeYear(a.yearLevel) || 9) - Number(normalizeYear(b.yearLevel) || 9);

  const sorters = {
    'name-asc': byName,
    'name-desc': (a, b) => byName(b, a),
    'number-asc': byNumber,
    'number-desc': (a, b) => byNumber(b, a),
    'year-asc': (a, b) => byYear(a, b) || byName(a, b),
    'year-desc': (a, b) => byYear(b, a) || byName(a, b),
    'section-asc': (a, b) =>
      String(a.section || 'Z').localeCompare(String(b.section || 'Z')) || byYear(a, b) || byName(a, b),
    newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  };

  const visibleStudents = items
    .filter((student) => !yearFilter || normalizeYear(student.yearLevel) === yearFilter)
    .filter((student) => !sectionFilter || String(student.section || '').toUpperCase() === sectionFilter)
    .filter((student) =>
      !statusFilter || (statusFilter === 'active' ? student.active : !student.active)
    )
    .sort(sorters[sortBy] || byName);

  function clearFilters() {
    setYearFilter('');
    setSectionFilter('');
    setStatusFilter('');
    setSortBy('name-asc');
  }

  const fourthYearStudents = eligibleStudents.filter(
    (student) => String(student.yearLevel) === '4'
  );

  return (
    <>
      <PageHead
        eyebrow="DIRECTORY"
        title="Students"
        desc="Manage student profiles, course assignments, sections, and biometric enrollment."
        action={
          <div className="actions">
            <button
              className="btn ghost"
              onClick={openSchoolYear}
            >
              <CalendarDays size={16} />
              Start New School Year
            </button>

            <button
              className="btn primary"
              onClick={() => openForm()}
            >
              <Plus size={17} />
              Add student
            </button>
          </div>
        }
      />

      {success && (
        <div className="success-message" role="status">
          {success}
        </div>
      )}

      {schoolYearSuccess && (
        <div className="success-message" role="status">
          {schoolYearSuccess}
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <Search size={17} />

          <input
            placeholder="Search student number, name, course, year, or section…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) =>
              event.key === 'Enter' && load()
            }
          />
        </div>

        <button className="btn ghost" onClick={load}>
          <Search size={16} />
          Search
        </button>

        <button className="btn ghost" onClick={load}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="student-filters">
        <label>
          Sort by
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="number-asc">Student number (low to high)</option>
            <option value="number-desc">Student number (high to low)</option>
            <option value="year-asc">Year level (1st to 4th)</option>
            <option value="year-desc">Year level (4th to 1st)</option>
            <option value="section-asc">Section (A–C)</option>
            <option value="newest">Recently added</option>
          </select>
        </label>

        <label>
          Year level
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="">All years</option>
            {YEAR_OPTIONS.map((year) => (
              <option key={year.value} value={year.value}>{year.label}</option>
            ))}
          </select>
        </label>

        <label>
          Section
          <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
            <option value="">All sections</option>
            {SECTION_OPTIONS.map((section) => (
              <option key={section} value={section}>Section {section}</option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        {(filtersActive || sortBy !== 'name-asc') && (
          <button type="button" className="btn ghost mini" onClick={clearFilters}>
            Reset
          </button>
        )}

        <span className="student-count">
          Showing {visibleStudents.length} of {items.length}
        </span>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Year level</th>
                <th>Section</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student._id}>
                  <td>
                    <b>
                      {student.lastName}, {student.firstName}
                    </b>
                    <small>{student.studentNumber}</small>
                  </td>

                  <td>{student.course || '—'}</td>
                  <td>{yearLabel(student.yearLevel)}</td>
                  <td>{student.section || '—'}</td>
                  <td>{student.email || '—'}</td>

                  <td>
                    <span
                      className={
                        student.active
                          ? 'pill green'
                          : 'pill gray'
                      }
                    >
                      {student.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td>
                    <div className="actions">
                      <button
                        className="btn mini ghost"
                        onClick={() => openForm(student)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn mini ghost"
                        onClick={() => setEnrolling(student)}
                      >
                        Enroll face
                      </button>

                      <button
                        className="btn mini ghost"
                        onClick={() => toggle(student)}
                      >
                        {student.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <Empty text="No students found. Add a student to get started." />
        )}

        {items.length > 0 && visibleStudents.length === 0 && (
          <Empty text="No students match the selected filters." />
        )}
      </section>

      {schoolYearOpen && (
        <Modal
          title="Start New School Year"
          onClose={() =>
            !schoolYearBusy && setSchoolYearOpen(false)
          }
        >
          <div className="form-grid">
            <div className="span-2">
              <p className="muted">
                Review the active roster, select students who passed
                and should move up, then select actual 4th-year
                graduates. Students you leave unselected will remain
                at their current year level.
              </p>

              {currentAcademicYear && (
                <p className="muted">
                  <b>Current academic year:</b> {currentAcademicYear}.
                  The new year will become the system's current
                  academic year after confirmation.
                </p>
              )}
            </div>

            <Field label="New academic year">
              <input
                value={schoolYear}
                onChange={(event) =>
                  setSchoolYear(event.target.value)
                }
                placeholder="2026-2027"
                pattern="[0-9]{4}\s*[-–]\s*[0-9]{4}"
                required
              />
            </Field>

            <div className="span-2">
              <h3>
                <ArrowUpRight size={16} />
                Promote students
              </h3>

              <p className="muted">
                1st → 2nd year · 2nd → 3rd year · 3rd → 4th year
              </p>

              {['1', '2', '3'].map((year) => {
                const group = eligibleStudents.filter(
                  (student) =>
                    String(student.yearLevel) === year
                );

                const allSelected =
                  group.length > 0 &&
                  group.every((student) =>
                    selectedPromotions.includes(student._id)
                  );

                return (
                  <div
                    className="school-year-group"
                    key={year}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <b>
                        {year}. {year === '1'
                          ? '1st'
                          : year === '2'
                            ? '2nd'
                            : '3rd'} Year{' '}
                        <small>({group.length})</small>
                      </b>

                      <button
                        type="button"
                        className="btn mini ghost"
                        disabled={!group.length || schoolYearBusy}
                        onClick={() =>
                          toggleGroupSelection(group, 'promote')
                        }
                      >
                        {allSelected
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    </div>

                    {group.length ? (
                      group.map((student) => (
                        <label
                          className="school-year-student"
                          key={student._id}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPromotions.includes(
                              student._id
                            )}
                            onChange={() =>
                              toggleSelected(
                                student._id,
                                'promote'
                              )
                            }
                            disabled={schoolYearBusy}
                          />

                          <span>
                            {student.lastName}, {student.firstName}
                            <small>
                              {student.studentNumber} ·{' '}
                              {student.course} · Section{' '}
                              {student.section || '—'}
                            </small>
                          </span>

                          <span className="pill green">
                            → Year {Number(year) + 1}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="muted">
                        No active students in this year level.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="span-2">
              <h3>
                <GraduationCap size={17} />
                Archive graduates
              </h3>

              <p className="muted">
                Select only students who have actually graduated.
                They will be marked inactive and moved to Archive;
                attendance history will be preserved.
              </p>

              <div className="school-year-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <b>
                    4th Year <small>({fourthYearStudents.length})</small>
                  </b>

                  <button
                    type="button"
                    className="btn mini ghost"
                    disabled={
                      !fourthYearStudents.length || schoolYearBusy
                    }
                    onClick={() =>
                      toggleGroupSelection(
                        fourthYearStudents,
                        'graduate'
                      )
                    }
                  >
                    {fourthYearStudents.length > 0 &&
                    fourthYearStudents.every((student) =>
                      selectedGraduates.includes(student._id)
                    )
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                {fourthYearStudents.map((student) => (
                  <label
                    className="school-year-student"
                    key={student._id}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGraduates.includes(
                        student._id
                      )}
                      onChange={() =>
                        toggleSelected(student._id, 'graduate')
                      }
                      disabled={schoolYearBusy}
                    />

                    <span>
                      {student.lastName}, {student.firstName}
                      <small>
                        {student.studentNumber} · {student.course} ·
                        Section {student.section || '—'}
                      </small>
                    </span>

                    <span className="pill gray">
                      Graduate
                    </span>
                  </label>
                ))}

                {!fourthYearStudents.length && (
                  <p className="muted">
                    No active 4th-year students.
                  </p>
                )}
              </div>
            </div>

            <div className="span-2 school-year-summary">
              <b>Review summary</b>

              <div className="archive-summary">
                <article className="panel archive-stat">
                  <div>
                    <strong>{selectedPromotions.length}</strong>
                    <span>To promote</span>
                  </div>
                </article>

                <article className="panel archive-stat">
                  <div>
                    <strong>{selectedGraduates.length}</strong>
                    <span>To archive as graduates</span>
                  </div>
                </article>

                <article className="panel archive-stat">
                  <div>
                    <strong>
                      {Math.max(
                        0,
                        eligibleStudents.length -
                          selectedPromotions.length -
                          selectedGraduates.length
                      )}
                    </strong>
                    <span>Remain unchanged</span>
                  </div>
                </article>
              </div>
            </div>

            {schoolYearError && (
              <div className="error span-2" role="alert">
                {schoolYearError}
              </div>
            )}

            <div className="modal-actions span-2">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setSchoolYearOpen(false)}
                disabled={schoolYearBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={startSchoolYear}
                disabled={
                  schoolYearBusy ||
                  (!selectedPromotions.length &&
                    !selectedGraduates.length)
                }
              >
                {schoolYearBusy
                  ? 'Processing…'
                  : 'Confirm & Start School Year'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {enrolling && (
        <Modal
          title="Face enrollment"
          onClose={() => setEnrolling(null)}
        >
          <FaceEnrollment
            student={enrolling}
            onClose={() => setEnrolling(null)}
            onSaved={() =>
              setSuccess('Face descriptor enrolled successfully.')
            }
          />
        </Modal>
      )}

      {modal && (
        <Modal
          title={editing ? 'Edit student' : 'Add student'}
          onClose={() => !busy && setModal(false)}
        >
          <form className="form-grid" onSubmit={save}>
            <Field label="Student Number">
              <input
                value={form.studentNumber}
                onChange={(event) =>
                  setForm({
                    ...form,
                    studentNumber: event.target.value,
                  })
                }
                required
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email || ''}
                onChange={(event) =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="First Name">
              <input
                value={form.firstName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    firstName: event.target.value,
                  })
                }
                required
              />
            </Field>

            <Field label="Last Name">
              <input
                value={form.lastName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    lastName: event.target.value,
                  })
                }
                required
              />
            </Field>

            <Field label="Course">
              <select
                value={form.course}
                onChange={(event) =>
                  setForm({
                    ...form,
                    course: event.target.value,
                  })
                }
                required
              >
                {COURSE_OPTIONS.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Year Level">
              <select
                value={form.yearLevel}
                onChange={(event) =>
                  setForm({
                    ...form,
                    yearLevel: event.target.value,
                  })
                }
                required
              >
                <option value="">Select year level</option>

                {YEAR_OPTIONS.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Section">
              <select
                value={form.section}
                onChange={(event) =>
                  setForm({
                    ...form,
                    section: event.target.value,
                  })
                }
                required
              >
                <option value="">Select section</option>

                {SECTION_OPTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </Field>

            {error && (
              <div className="error span-2" role="alert">
                {error}
              </div>
            )}

            <div className="modal-actions span-2">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setModal(false)}
                disabled={busy}
              >
                Cancel
              </button>

              <button className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save student'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
