import { Router } from 'express';
import mongoose from 'mongoose';
import { Student, SchoolYearOperation } from '../models.js';
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


// Returns the current active roster for the guided school-year workflow.
router.get('/school-year/eligible', asyncHandler(async (_req, res) => {
  const [students, latest] = await Promise.all([
    Student.find({ active: true }).select('studentNumber firstName lastName course yearLevel section').sort({ yearLevel: 1, lastName: 1, firstName: 1 }).lean(),
    SchoolYearOperation.findOne({ status: 'completed' }).sort({ completedAt: -1 }).lean()
  ]);
  res.json({ items: students, currentAcademicYear: latest?.academicYear || '' });
}));

router.post('/school-year/process', asyncHandler(async (req, res) => {
  const enteredAcademicYear = cleanText(req.body.academicYear, 20);
  const yearMatch = enteredAcademicYear.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  const academicYear = yearMatch ? `${yearMatch[1]}-${yearMatch[2]}` : enteredAcademicYear;
  const promotedIds = Array.isArray(req.body.promotedStudentIds) ? [...new Set(req.body.promotedStudentIds.map(String))] : [];
  const graduatedIds = Array.isArray(req.body.graduatedStudentIds) ? [...new Set(req.body.graduatedStudentIds.map(String))] : [];
  const overlap = promotedIds.some(id => graduatedIds.includes(id));
  if (!yearMatch || Number(yearMatch[2]) !== Number(yearMatch[1]) + 1) {
    return res.status(400).json({ message: 'Enter an academic year in the format 2026-2027.' });
  }
  const alreadyProcessed = await SchoolYearOperation.exists({ academicYear });
  if (alreadyProcessed) return res.status(409).json({ message: `The school year ${academicYear} has already been processed.` });
  const latestOperation = await SchoolYearOperation.findOne({ status: 'completed' }).sort({ completedAt: -1 }).lean();
  if (latestOperation) {
    const previousEndYear = Number(String(latestOperation.academicYear).slice(-4));
    if (Number(yearMatch[1]) !== previousEndYear) {
      return res.status(409).json({ message: `The next academic year should begin in ${previousEndYear}. Enter ${previousEndYear}-${previousEndYear + 1}.` });
    }
  }
  if (overlap) return res.status(400).json({ message: 'A student cannot be promoted and archived in the same operation.' });
  if (promotedIds.length + graduatedIds.length === 0) {
    return res.status(400).json({ message: 'Select at least one student to promote or archive as a graduate.' });
  }

  const activeRosterCount = await Student.countDocuments({ active: true });
  const selectedIds = [...promotedIds, ...graduatedIds];
  if (selectedIds.some(id => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: 'One or more selected student records are invalid.' });
  }
  const selected = await Student.find({ _id: { $in: selectedIds }, active: true }).select('_id yearLevel');
  if (selected.length !== selectedIds.length) {
    return res.status(409).json({ message: 'Some selected students are no longer active or no longer exist. Refresh and review the list.' });
  }
  const byId = new Map(selected.map(student => [student._id.toString(), String(student.yearLevel)]));
  if (promotedIds.some(id => !['1', '2', '3'].includes(byId.get(id)))) {
    return res.status(400).json({ message: 'Only active 1st, 2nd, and 3rd year students can be promoted.' });
  }
  if (graduatedIds.some(id => byId.get(id) !== '4')) {
    return res.status(400).json({ message: 'Only active 4th year students can be archived as graduates.' });
  }

  const session = await mongoose.startSession();
  let operation;
  try {
    await session.withTransaction(async () => {
      const [created] = await SchoolYearOperation.create([{
        academicYear,
        initiatedBy: req.admin._id,
        status: 'completed',
        completedAt: new Date(),
        promotedStudentIds: promotedIds,
        graduatedStudentIds: graduatedIds,
        summary: { promoted: promotedIds.length, graduated: graduatedIds.length, retained: 0 }
      }], { session });
      operation = created;

      for (const id of promotedIds) {
        const fromYear = byId.get(id);
        const result = await Student.updateOne({ _id: id, active: true, yearLevel: fromYear }, {
          $set: { yearLevel: String(Number(fromYear) + 1) },
          $push: { promotionHistory: { academicYear, fromYear, toYear: String(Number(fromYear) + 1), processedAt: new Date(), operationId: created._id.toString() } }
        }, { session });
        if (result.matchedCount !== 1) throw new Error('A selected student changed during processing. No school-year changes were committed; refresh and try again.');
      }
      for (const id of graduatedIds) {
        const result = await Student.updateOne({ _id: id, active: true, yearLevel: '4' }, {
          $set: { active: false, archiveType: 'graduation', archivedAt: new Date(), archivedBy: req.admin._id, graduationAcademicYear: academicYear }
        }, { session });
        if (result.matchedCount !== 1) throw new Error('A selected graduate changed during processing. No school-year changes were committed; refresh and try again.');
      }
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: `The school year ${academicYear} has already been processed.` });
    throw error;
  } finally {
    await session.endSession();
  }

  const [promoted, graduated] = await Promise.all([
    Student.find({ _id: { $in: promotedIds } }).select('yearLevel'),
    Student.countDocuments({ _id: { $in: graduatedIds }, archiveType: 'graduation', graduationAcademicYear: academicYear })
  ]);
  const retained = Math.max(0, activeRosterCount - promoted.length - graduated);
  operation.summary = { promoted: promoted.length, graduated, retained };
  operation.retainedStudentIds = [];
  await operation.save();
  await audit(req, 'SCHOOL_YEAR_STARTED', 'SchoolYearOperation', operation._id.toString(), {
    academicYear, promoted: promoted.length, graduated, retained,
    promotedStudentIds: promotedIds, graduatedStudentIds: graduatedIds
  });
  res.status(201).json({ message: `School year ${academicYear} started successfully.`, operation: { academicYear, ...operation.summary } });
}));

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
  if (req.query.yearLevel) filter.yearLevel = cleanText(req.query.yearLevel, 10);
  if (req.query.active === 'true') filter.active = true;
  if (req.query.active === 'false') filter.active = false;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 20));
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
  if (req.body.active !== undefined) {
    update.active = Boolean(req.body.active);
    if (update.active) { update.archiveType = ''; update.archivedAt = null; update.archivedBy = null; update.graduationAcademicYear = ''; }
  }
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
