import { Router } from 'express';
import { Attendance, Student, Event } from '../models.js';
import { asyncHandler, cleanText } from '../utils.js';
import { audit } from '../services/audit.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.eventId) filter.event = req.query.eventId;
  if (req.query.studentId) filter.student = req.query.studentId;
  const items = await Attendance.find(filter)
    .populate('student', 'studentNumber firstName lastName course')
    .populate('event', 'title startsAt')
    .sort({ timeIn: -1 }).limit(500);
  res.json({ items });
}));

router.post('/record', asyncHandler(async (req, res) => {
  const { studentId, eventId } = req.body;
  const action = req.body.action === 'timeOut' ? 'timeOut' : 'timeIn';
  const [student, event] = await Promise.all([Student.findById(studentId), Event.findById(eventId)]);
  if (!student || !student.active) return res.status(404).json({ message: 'Active student not found' });
  if (!event || event.archived || event.status === 'cancelled') return res.status(404).json({ message: 'Available event not found' });

  let record = await Attendance.findOne({ student: studentId, event: eventId });
  if (!record) {
    if (action === 'timeOut') return res.status(400).json({ message: 'Student has no Time-In record for this event' });
    try {
      record = await Attendance.create({ student: studentId, event: eventId, timeIn: new Date(), source: req.body.source === 'scanner' ? 'scanner' : 'manual', recordedBy: req.admin._id });
    } catch (error) {
      if (error.code === 11000) record = await Attendance.findOne({ student: studentId, event: eventId });
      else throw error;
    }
  } else if (action === 'timeIn') {
    return res.status(409).json({ message: 'Student is already timed in for this event' });
  } else {
    if (!record.timeIn) return res.status(400).json({ message: 'Time-In is required first' });
    if (record.timeOut) return res.status(409).json({ message: 'Student is already timed out' });
    record.timeOut = new Date();
    record.source = req.body.source === 'scanner' ? 'scanner' : 'manual';
    await record.save();
  }
  await audit(req, action === 'timeIn' ? 'ATTENDANCE_TIME_IN' : 'ATTENDANCE_TIME_OUT', 'Attendance', record._id.toString(), { studentId, eventId, source: record.source });
  res.json({ record });
}));

router.patch('/:id/correct', asyncHandler(async (req, res) => {
  const reason = cleanText(req.body.reason, 500);
  if (!reason) return res.status(400).json({ message: 'A correction reason is required' });
  const update = { correctionReason: reason };
  if (req.body.timeIn !== undefined) update.timeIn = req.body.timeIn ? new Date(req.body.timeIn) : null;
  if (req.body.timeOut !== undefined) update.timeOut = req.body.timeOut ? new Date(req.body.timeOut) : null;
  const record = await Attendance.findByIdAndUpdate(req.params.id, update, { new: true })
    .populate('student', 'studentNumber firstName lastName')
    .populate('event', 'title');
  if (!record) return res.status(404).json({ message: 'Attendance record not found' });
  await audit(req, 'ATTENDANCE_CORRECTED', 'Attendance', record._id.toString(), { reason });
  res.json({ record });
}));

export default router;
