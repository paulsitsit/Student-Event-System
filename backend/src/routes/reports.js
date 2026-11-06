import { Router } from 'express';
import { Attendance, Student } from '../models.js';
import { asyncHandler } from '../utils.js';

const router = Router();

router.get('/attendance.csv', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.eventId) filter.event = req.query.eventId;

  const studentFilter = {};
  if (req.query.course) studentFilter.course = req.query.course;
  if (req.query.yearLevel) studentFilter.yearLevel = req.query.yearLevel;
  if (req.query.section) studentFilter.section = req.query.section;

  if (Object.keys(studentFilter).length) {
    const matchingStudents = await Student.find(studentFilter).distinct('_id');
    studentFilter._id = { $in: matchingStudents };
    filter.student = studentFilter._id;
  }

  const rows = await Attendance.find(filter)
    .populate('student', 'studentNumber firstName lastName course yearLevel section')
    .populate('event', 'title')
    .sort({ timeIn: -1 })
    .limit(10000);

  const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ['Student Number', 'Student Name', 'Course', 'Year Level', 'Section', 'Event', 'Time In', 'Time Out', 'Source'].map(cell).join(','),
    ...rows.map((row) => [
      row.student?.studentNumber,
      `${row.student?.firstName || ''} ${row.student?.lastName || ''}`.trim(),
      row.student?.course,
      row.student?.yearLevel ? `${row.student.yearLevel}${row.student.yearLevel === '1' ? 'st' : row.student.yearLevel === '2' ? 'nd' : row.student.yearLevel === '3' ? 'rd' : 'th'} Year` : '',
      row.student?.section,
      row.event?.title,
      row.timeIn?.toISOString(),
      row.timeOut?.toISOString(),
      row.source
    ].map(cell).join(','))
  ];

  const suffix = [req.query.course, req.query.yearLevel && `year-${req.query.yearLevel}`, req.query.section && `section-${req.query.section}`]
    .filter(Boolean).join('-');
  const filename = `attendance-report${suffix ? `-${suffix}` : ''}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + lines.join('\r\n'));
}));

export default router;
