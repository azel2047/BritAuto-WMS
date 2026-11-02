import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../domain/src/auth.ts';
import { AppError } from './errors.ts';
import { db } from '../db/connection.ts';

const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  console.warn('[PERINGATAN KEAMANAN] JWT_SECRET belum diatur di environment. Menggunakan secret default mode pengembangan.');
}
export const JWT_SECRET = envSecret || 'brit-auto-wms-dev-secret-2026';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!token) {
    return next(new AppError(401, 'BELUM_LOGIN', 'Sesi tidak ditemukan. Silakan login terlebih dahulu.'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const row = db.prepare('SELECT id, name, username, role, active FROM users WHERE id = ?').get(decoded.id) as
      | { id: number; name: string; username: string; role: Role; active: number }
      | undefined;
    if (!row || !row.active) {
      return next(new AppError(401, 'AKUN_NONAKTIF', 'Akun pengguna tidak aktif atau tidak ditemukan.'));
    }
    req.user = { id: row.id, username: row.username, name: row.name, role: row.role };
    next();
  } catch {
    next(new AppError(401, 'TOKEN_TIDAK_VALID', 'Sesi telah berakhir atau token tidak valid. Silakan login kembali.'));
  }
}
