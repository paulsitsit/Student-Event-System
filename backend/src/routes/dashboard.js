import { Router } from 'express';
import { Student, Event, Attendance } from '../models.js';
import { asyncHandler } from '../utils.js';

const router = Router();
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const [students, activeStudents, events, todayAttendance, recent] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ active: true }),
    Event.countDocuments({ archived: false }),
    Attendance.countDocuments({ timeIn: { $gte: new Date(now.setHours(0,0,0,0)) } }),
    Attendance.find().populate('student', 'studentNumber firstName lastName').populate('event', 'title').sort({ createdAt: -1 }).limit(8)
  ]);
  res.json({ stats: { students, activeStudents, events, todayAttendance }, recent });
}));
export default router;
