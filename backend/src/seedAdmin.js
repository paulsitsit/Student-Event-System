import { connectDatabase } from './db.js';
import { Admin } from './models.js';
import { hashPassword } from './security.js';

await connectDatabase();
const email = String(process.env.SEED_ADMIN_EMAIL || 'adminhanz@pcc.edu.ph').toLowerCase();
const existing = await Admin.findOne({ email });
if (existing) {
  console.log(`Admin ${email} already exists; no changes made.`);
} else {
  const password = process.env.SEED_ADMIN_PASSWORD || 'Adminhanz5421';
  if (password.length < 10) throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters');
  await Admin.create({
    name: process.env.SEED_ADMIN_NAME || 'System Administrator',
    email,
    passwordHash: await hashPassword(password)
  });
  console.log(`Created admin ${email}. Change the password after first login.`);
}
process.exit(0);
