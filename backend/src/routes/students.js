import { Router } from 'express';
import { Student } from '../models.js';
import { asyncHandler, cleanText } from '../utils.js';
import { audit } from '../services/audit.js';

const router = Router();
const validCourses = ['BSIT'];
const validYears = ['1', '2', '3', '4'];
const validSections = ['A', 'B', 'C'];

function studentFields(body, partial = false) {
  const payload = {};
  const textFields = ['studentNumber', 'firstName', 'lastName', 'email'];
  for (const key of textFields) {
    if (!partial || body[key] !== undefined) {
      payload[key] = cleanText(body[key], key === 'email' ? 120 : 100);
    }
  }
  if (!partial || body.course !== undefined) {
    payload.course = cleanText(body.course || 'BSIT', 20).toUpperCase();
    if (!validCourses.includes(payload.course)) {
      const error = new Error('Please select a valid course.');
      error.status = 400;
      throw error;
    }
  }
  if (!partial || body.yearLevel !== undefined) {
    payload.yearLevel = cleanText(body.yearLevel, 10);
    if (!validYears.includes(payload.yearLevel)) {
      const error = new Error('Please select a valid year level (1 to 4).');
      error.status = 400;
      throw error;
    }
  }
  if (!partial || body.section !== undefined) {
    payload.section = cleanText(body.section, 5).toUpperCase();
    if (!validSections.includes(payload.section)) {
      const error = new Error('Please select a valid section (A, B, or C).');
      error.status = 400;
      throw error;
    }
  }
  if (payload.email !== undefined) payload.email = payload.email.toLowerCase();
  return payload;
}

router.get('/', asyncHandler(async (req, res) => {
  const q = cleanText(req.query.q, 100);
  const filter = q ? {
    $or: [
      { studentNumber: { $regex: q, $options: 'i' } },
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { course: { $regex: q, $options: 'i' } },
      { yearLevel: { $regex: q, $options: 'i' } },
      { section: { $regex: q, $options: 'i' } }
    ]
  } : {};
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    Student.find(filter).select('-faceDescriptor').sort({ lastName: 1, firstName: 1 }).skip((page - 1) * limit).limit(limit),
    Student.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = studentFields(req.body);
  if (!payload.studentNumber || !payload.firstName || !payload.lastName) {
    return res.status(400).json({ message: 'Student number, first name, and last name are required.' });
  }
  const student = await Student.create(payload);
  await audit(req, 'STUDENT_CREATED', 'Student', student._id.toString(), {
    studentNumber: student.studentNumber,
    course: student.course,
    yearLevel: student.yearLevel,
    section: student.section
  });
  res.status(201).json({ student });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const update = {};
  for (const key of ['studentNumber', 'firstName', 'lastName', 'email', 'course', 'yearLevel', 'section']) {
    if (req.body[key] !== undefined) update[key] = studentFields({ ...req.body, [key]: req.body[key] }, true)[key];
  }
  if (req.body.active !== undefined) update.active = Boolean(req.body.active);
  const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-faceDescriptor');
  if (!student) return res.status(404).json({ message: 'Student not found' });
  await audit(req, 'STUDENT_UPDATED', 'Student', student._id.toString(), update);
  res.json({ student });
}));

router.put('/:id/face', asyncHandler(async (req, res) => {
  const descriptors = req.body.descriptors;
  const valid = Array.isArray(descriptors) && descriptors.length === 5 &&
    descriptors.every(d => Array.isArray(d) && d.length >= 64 && d.length <= 1024 && d.every(n => Number.isFinite(n)));
  if (!valid) return res.status(400).json({ message: 'Exactly five valid descriptors are required: front, left, right, up, down' });
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  student.faceDescriptors = descriptors;
  student.faceDescriptor = descriptors[0];
  student.faceEnrollmentCount = 5;
  student.faceEnrolledAt = new Date();
  await student.save();
  await audit(req, 'STUDENT_FACE_ENROLLED', 'Student', student._id.toString(), { descriptorCount: 5 });
  res.json({ message: 'Five-angle face enrollment saved', descriptorCount: 5 });
}));

router.delete('/:id/face', asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  student.faceDescriptor = undefined;
  student.faceDescriptors = undefined;
  student.faceEnrollmentCount = 0;
  student.faceEnrolledAt = undefined;
  await student.save();
  await audit(req, 'STUDENT_FACE_DELETED', 'Student', student._id.toString());
  res.json({ message: 'Face descriptor deleted' });
}));

router.get('/face-templates', asyncHandler(async (req, res) => {
  const items = await Student.find({
    active: true,
    $or: [{ faceDescriptors: { $exists: true, $ne: [] } }, { faceDescriptor: { $exists: true } }]
  }).select('+faceDescriptors +faceDescriptor studentNumber firstName lastName');
  res.json({ items });
}));

export default router;
