import { Router } from 'express';
import { Attendance } from '../models.js';
import { asyncHandler } from '../utils.js';
const router = Router();

router.get('/attendance.csv', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.eventId) filter.event = req.query.eventId;
  const rows = await Attendance.find(filter).populate('student', 'studentNumber firstName lastName course').populate('event', 'title').sort({ timeIn: -1 }).limit(10000);
  const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ['Student Number','Student Name','Course','Event','Time In','Time Out','Source'].map(cell).join(','),
    ...rows.map(r => [
      r.student?.studentNumber,
      `${r.student?.firstName || ''} ${r.student?.lastName || ''}`.trim(),
      r.student?.course, r.event?.title,
      r.timeIn?.toISOString(), r.timeOut?.toISOString(), r.source
    ].map(cell).join(','))
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
  res.send(lines.join('\r\n'));
}));
export default router;
