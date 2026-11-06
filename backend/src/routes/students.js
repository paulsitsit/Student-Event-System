import { Router } from 'express';
import { Student } from '../models.js';
import { asyncHandler, cleanText } from '../utils.js';
import { audit } from '../services/audit.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const q = cleanText(req.query.q, 100);
  const filter = q ? {
    $or: [
      { studentNumber: { $regex: q, $options: 'i' } },
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { course: { $regex: q, $options: 'i' } }
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
  const payload = {
    studentNumber: cleanText(req.body.studentNumber, 40),
    firstName: cleanText(req.body.firstName, 80),
    lastName: cleanText(req.body.lastName, 80),
    course: cleanText(req.body.course, 100),
    yearLevel: cleanText(req.body.yearLevel, 30),
    email: cleanText(req.body.email, 120).toLowerCase()
  };
  if (!payload.studentNumber || !payload.firstName || !payload.lastName) return res.status(400).json({ message: 'Student number, first name, and last name are required' });
  const student = await Student.create(payload);
  await audit(req, 'STUDENT_CREATED', 'Student', student._id.toString(), { studentNumber: student.studentNumber });
  res.status(201).json({ student });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const allowed = ['studentNumber', 'firstName', 'lastName', 'course', 'yearLevel', 'email', 'active'];
  const update = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = key === 'active' ? Boolean(req.body[key]) : cleanText(req.body[key], 120);
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
  const items = await Student.find({ active: true, $or: [{ faceDescriptors: { $exists: true, $ne: [] } }, { faceDescriptor: { $exists: true } }] }).select('+faceDescriptors +faceDescriptor studentNumber firstName lastName');
  res.json({ items });
}));

export default router;
