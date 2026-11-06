import { Router } from 'express';
import { Event } from '../models.js';
import { asyncHandler, cleanText } from '../utils.js';
import { audit } from '../services/audit.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const filter = req.query.includeArchived === 'true' ? {} : { archived: false };
  const items = await Event.find(filter).sort({ startsAt: -1 });
  res.json({ items });
}));

router.post('/', asyncHandler(async (req, res) => {
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);
  if (!req.body.title || Number.isNaN(+startsAt) || Number.isNaN(+endsAt) || endsAt <= startsAt) return res.status(400).json({ message: 'Provide a title and a valid event date range' });
  const event = await Event.create({
    title: cleanText(req.body.title, 160),
    description: cleanText(req.body.description, 1000),
    venue: cleanText(req.body.venue, 160),
    startsAt, endsAt, createdBy: req.admin._id
  });
  await audit(req, 'EVENT_CREATED', 'Event', event._id.toString());
  res.status(201).json({ event });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const update = {};
  for (const key of ['title', 'description', 'venue', 'status', 'archived']) {
    if (req.body[key] !== undefined) update[key] = typeof req.body[key] === 'string' ? cleanText(req.body[key], 1000) : req.body[key];
  }
  for (const key of ['startsAt', 'endsAt']) if (req.body[key]) update[key] = new Date(req.body[key]);
  const event = await Event.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.endsAt <= event.startsAt) return res.status(400).json({ message: 'Event end must be after start' });
  await audit(req, 'EVENT_UPDATED', 'Event', event._id.toString(), update);
  res.json({ event });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  await audit(req, 'EVENT_ARCHIVED', 'Event', event._id.toString());
  res.json({ message: 'Event archived' });
}));

export default router;
