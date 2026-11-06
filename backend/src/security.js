import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export const createToken = (admin) => jwt.sign(
  { sub: admin._id.toString(), email: admin.email, role: 'admin' },
  config.jwtSecret,
  { expiresIn: config.jwtExpiresIn }
);
export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);
