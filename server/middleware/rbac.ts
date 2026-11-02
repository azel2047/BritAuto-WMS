import type { Request, Response, NextFunction } from 'express';
import { authorize, type Role } from '../domain/src/auth.ts';
import { AppError } from './errors.ts';
import { writeAuditLog } from '../repositories/audit.ts';

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return next(new AppError(401, 'BELUM_LOGIN', 'Silakan login terlebih dahulu.'));
    }
    if (!allowedRoles.includes(user.role)) {
      writeAuditLog({
        userId: user.id,
        action: 'AKSES_DITOLAK',
        entity: req.baseUrl + req.path,
        entityId: req.method,
        after: { role: user.role, requiredRoles: allowedRoles },
      });
      return next(new AppError(403, 'AKSES_DITOLAK', `Peran ${user.role} tidak memiliki izin untuk mengakses fitur ini.`));
    }
    next();
  };
}

export function checkAccess(
  user: { id: number; role: Role },
  resource: string,
  action: 'read' | 'write',
  isOwner = false
) {
  const allowed = authorize(user.role, resource, action, isOwner);
  if (!allowed) {
    writeAuditLog({
      userId: user.id,
      action: 'AKSES_DITOLAK',
      entity: resource,
      entityId: action,
      after: { role: user.role, isOwner },
    });
    throw new AppError(403, 'AKSES_DITOLAK', `Peran ${user.role} tidak diizinkan melakukan aksi ${action} pada ${resource}.`);
  }
}
