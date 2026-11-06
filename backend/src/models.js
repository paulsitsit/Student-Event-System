import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const adminSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  active: { type: Boolean, default: true },
  lastLoginAt: Date
}, { timestamps: true });

const studentSchema = new Schema({
  studentNumber: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  course: { type: String, default: 'BSIT', trim: true },
  yearLevel: { type: String, default: '' },
  section: { type: String, default: '', uppercase: true, trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  active: { type: Boolean, default: true },
  faceDescriptor: { type: [Number], default: undefined, select: false },
  faceDescriptors: { type: [[Number]], default: undefined, select: false },
  faceEnrolledAt: Date,
  faceEnrollmentCount: { type: Number, default: 0 }
}, { timestamps: true });

studentSchema.index({ lastName: 1, firstName: 1 });
studentSchema.index({ studentNumber: 1 });
studentSchema.index({ course: 1, yearLevel: 1, section: 1 });

const eventSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  venue: { type: String, default: '' },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  archived: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

const attendanceSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  timeIn: Date,
  timeOut: Date,
  source: { type: String, enum: ['scanner', 'manual'], default: 'manual' },
  note: { type: String, default: '' },
  correctionReason: { type: String, default: '' },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });
attendanceSchema.index({ student: 1, event: 1 }, { unique: true });

const auditSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'Admin' },
  action: { type: String, required: true },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
  details: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' }
}, { timestamps: true });

export const Admin = model('Admin', adminSchema);
export const Student = model('Student', studentSchema);
export const Event = model('Event', eventSchema);
export const Attendance = model('Attendance', attendanceSchema);
export const AuditLog = model('AuditLog', auditSchema);
