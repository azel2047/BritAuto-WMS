import { Router } from 'express';
import { z } from 'zod';
import { db, hashPassword, verifyPassword } from '../db/connection.ts';
import { isLocked, registerFailedLogin, type Role } from '../domain/src/auth.ts';
import { normalizePlate, findVehicleByPlate } from '../domain/src/plates.ts';
import { isUnderWarranty, classifyComplaint } from '../domain/src/warranty.ts';
import { isBelowMin } from '../domain/src/stock.ts';
import { findRate } from '../domain/src/invoice.ts';
import { requireAuth, signToken } from '../middleware/auth.ts';
import { requireRole, checkAccess } from '../middleware/rbac.ts';
import { validateBody } from '../middleware/validate.ts';
import { AppError } from '../middleware/errors.ts';
import { writeAuditLog, listAuditLogs } from '../repositories/audit.ts';
import { listNotificationsForUser, markNotificationRead } from '../repositories/notifications.ts';
import { addSseClient, broadcastEvent } from '../events/sse.ts';
import {
  createWorkOrder,
  assignTechnicians,
  reviewWorkOrder,
  closeWorkOrder,
  cancelWorkOrder,
  getWorkOrderDetail,
  getRatesForLookup,
} from '../services/workOrderService.ts';
import { clockOnJob, clockOffJob, setWaitingPartJob } from '../services/clockService.ts';
import {
  issuePartToWorkOrder,
  receiveStockIn,
  returnWoPart,
  createOrSubmitOpname,
  submitOpname,
  approveOpname,
} from '../services/partService.ts';
import { calculateAndSyncReminders, listRemindersDue } from '../services/reminderService.ts';
import { getTechnicianPerformance } from '../services/kpiService.ts';
import { getMonthlyReport, generateMonthlyReportCsv } from '../services/reportService.ts';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const apiRouter = Router();

// Helper for masking license plates in public waiting room (e.g. "B 1234 JAG" -> "B 12** JAG")
export function maskPlate(plate: string): string {
  const parts = plate.trim().split(/\s+/);
  if (parts.length >= 3) {
    const prefix = parts[0];
    const num = parts[1];
    const suffix = parts.slice(2).join(' ');
    const maskedNum =
      num.length <= 1
        ? '*'
        : num.length === 2
        ? num[0] + '*'
        : num.slice(0, 2) + '*'.repeat(Math.max(2, num.length - 2));
    return `${prefix} ${maskedNum} ${suffix}`;
  }
  const clean = plate.trim();
  if (clean.length <= 4) return clean.slice(0, 2) + '**';
  return clean.slice(0, 2) + '**' + clean.slice(-2);
}

// ============================================================================
// 1. PUBLIC ENDPOINTS (NO AUTH, NO PERSONAL DATA)
// ============================================================================
apiRouter.get('/public/waiting-room', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT wo.id, wo.wo_number, wo.status, wo.received_at,
             v.plate_current, v.brand, v.model, v.year,
             (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id) as total_jobs,
             (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND wj.status = 'SELESAI') as done_jobs
      FROM work_orders wo
      JOIN vehicles v ON v.id = wo.vehicle_id
      WHERE wo.status IN ('MENUNGGU_PENUGASAN', 'DITUGASKAN', 'DIKERJAKAN', 'SELESAI_DIKERJAKAN', 'DIPERIKSA')
      ORDER BY wo.received_at DESC
    `)
    .all() as {
    id: number;
    wo_number: string;
    status: string;
    received_at: string;
    plate_current: string;
    brand: string;
    model: string;
    year: number;
    total_jobs: number;
    done_jobs: number;
  }[];

  const friendlyStatusMap: Record<string, string> = {
    MENUNGGU_PENUGASAN: 'Menunggu giliran',
    DITUGASKAN: 'Menunggu giliran',
    DIKERJAKAN: 'Sedang dikerjakan',
    SELESAI_DIKERJAKAN: 'Sedang diperiksa',
    DIPERIKSA: 'Siap diambil',
  };

  // Strictly strip all personal customer info (UU PDP compliance & BR rules)
  const items = rows.map(r => ({
    id: r.id,
    woNumber: r.wo_number,
    plateMasked: maskPlate(r.plate_current),
    brand: r.brand,
    model: r.model,
    year: r.year,
    status: r.status,
    friendlyStatus: friendlyStatusMap[r.status] || 'Sedang diproses',
    receivedAt: r.received_at,
    totalJobs: r.total_jobs,
    doneJobs: r.done_jobs,
  }));

  res.json({ updatedAt: new Date().toISOString(), items });
});

apiRouter.get('/public/stream', (req, res) => {
  const cleanup = addSseClient(res);
  req.on('close', cleanup);
});

// ============================================================================
// 2. AUTHENTICATION
// ============================================================================
const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

apiRouter.post('/auth/login', validateBody(loginSchema), (req, res, next) => {
  try {
    const { username, password } = req.body as z.infer<typeof loginSchema>;
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username.trim().toLowerCase()) as
      | {
          id: number;
          name: string;
          username: string;
          password_hash: string;
          role: Role;
          active: number;
          failed_logins: number;
          locked_until: number | null;
        }
      | undefined;

    const nowMs = Date.now();

    if (!user || !user.active) {
      throw new AppError(401, 'LOGIN_GAGAL', 'Username atau kata sandi salah.');
    }

    if (isLocked({ failed: user.failed_logins, lockedUntil: user.locked_until }, nowMs)) {
      const remainingMin = Math.ceil(((user.locked_until as number) - nowMs) / 60_000);
      throw new AppError(
        423,
        'AKUN_TERKUNCI',
        `Akun terkunci karena 5x gagal login. Silakan coba lagi dalam ${remainingMin} menit.`
      );
    }

    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      const lockAfterRow = db.prepare(`SELECT value FROM settings WHERE key = 'lock_after'`).get() as { value: string } | undefined;
      const lockMinRow = db.prepare(`SELECT value FROM settings WHERE key = 'lock_minutes'`).get() as { value: string } | undefined;
      const maxAttempts = lockAfterRow ? Number(lockAfterRow.value) : 5;
      const lockMinutes = lockMinRow ? Number(lockMinRow.value) : 15;

      const nextState = registerFailedLogin(
        { failed: user.failed_logins, lockedUntil: user.locked_until },
        nowMs,
        maxAttempts,
        lockMinutes
      );

      db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(
        nextState.failed,
        nextState.lockedUntil,
        user.id
      );

      writeAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user.id,
        after: { failedLogins: nextState.failed, lockedUntil: nextState.lockedUntil },
      });

      if (isLocked(nextState, nowMs)) {
        throw new AppError(
          423,
          'AKUN_TERKUNCI',
          `Akun Anda dikunci selama ${lockMinutes} menit karena ${maxAttempts} kali gagal login.`
        );
      }

      throw new AppError(401, 'LOGIN_GAGAL', 'Username atau kata sandi salah.');
    }

    // Success -> reset failed_logins & locked_until
    db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
    const authUser = { id: user.id, username: user.username, name: user.name, role: user.role };
    const token = signToken(authUser);

    writeAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'users',
      entityId: user.id,
    });

    res.json({ token, user: authUser });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/auth/logout', requireAuth, (req, res) => {
  if (req.user) {
    writeAuditLog({ userId: req.user.id, action: 'LOGOUT', entity: 'users', entityId: req.user.id });
  }
  res.json({ ok: true });
});

apiRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ============================================================================
// 3. USERS & SETTINGS (AD, PM)
// ============================================================================
apiRouter.get('/users', requireAuth, (req, res, next) => {
  try {
    // Allow KR/SA/AD/PM to read technician list if role=TK query is passed
    if (req.query.role === 'TK') {
      const techs = db
        .prepare(`SELECT id, name, username, role, active, created_at FROM users WHERE role = 'TK' AND active = 1 ORDER BY name`)
        .all();
      res.json(techs);
      return;
    }
    checkAccess(req.user!, 'users', 'read');
    const users = db
      .prepare('SELECT id, name, username, role, active, failed_logins, locked_until, created_at FROM users ORDER BY id')
      .all();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  username: z.string().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  role: z.enum(['SA', 'KR', 'TK', 'SP', 'AD', 'PM']),
});

apiRouter.post('/users', requireAuth, requireRole('AD', 'PM'), validateBody(createUserSchema), (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createUserSchema>;
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(body.username.trim().toLowerCase());
    if (existing) throw new AppError(409, 'USERNAME_SUDAH_ADA', 'Username sudah digunakan.');

    const pwHash = hashPassword(body.password);
    const result = db
      .prepare('INSERT INTO users (name, username, password_hash, role, active) VALUES (?, ?, ?, ?, 1)')
      .run(body.name.trim(), body.username.trim().toLowerCase(), pwHash, body.role);

    writeAuditLog({
      userId: req.user!.id,
      action: 'CREATE_USER',
      entity: 'users',
      entityId: Number(result.lastInsertRowid),
      after: { name: body.name, username: body.username, role: body.role },
    });

    const created = db
      .prepare('SELECT id, name, username, role, active, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

const patchUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['SA', 'KR', 'TK', 'SP', 'AD', 'PM']).optional(),
  active: z.boolean().optional(),
  unlock: z.boolean().optional(),
});

apiRouter.patch('/users/:id', requireAuth, requireRole('AD', 'PM'), validateBody(patchUserSchema), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof patchUserSchema>;
    const before = db.prepare('SELECT id, name, username, role, active, failed_logins, locked_until FROM users WHERE id = ?').get(id);
    if (!before) throw new AppError(404, 'USER_TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');

    if (body.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name.trim(), id);
    if (body.role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, id);
    if (body.active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
    if (body.unlock) db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(id);

    const after = db.prepare('SELECT id, name, username, role, active, failed_logins, locked_until, created_at FROM users WHERE id = ?').get(id);
    writeAuditLog({ userId: req.user!.id, action: 'UPDATE_USER', entity: 'users', entityId: id, before, after });
    res.json(after);
  } catch (err) {
    next(err);
  }
});

apiRouter.post(
  '/users/:id/reset-password',
  requireAuth,
  requireRole('AD', 'PM'),
  validateBody(z.object({ password: z.string().min(6, 'Kata sandi minimal 6 karakter') })),
  (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const pwHash = hashPassword(req.body.password);
      db.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').run(pwHash, id);
      writeAuditLog({ userId: req.user!.id, action: 'RESET_PASSWORD', entity: 'users', entityId: id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.get('/settings', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

apiRouter.put(
  '/settings',
  requireAuth,
  requireRole('AD', 'PM'),
  validateBody(z.record(z.string(), z.string())),
  (req, res, next) => {
    try {
      const entries = Object.entries(req.body as Record<string, string>);
      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      db.transaction(() => {
        for (const [k, v] of entries) {
          upsert.run(k, String(v));
        }
        writeAuditLog({ userId: req.user!.id, action: 'UPDATE_SETTINGS', entity: 'settings', after: req.body });
      })();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 4. CUSTOMERS & VEHICLES (+ PLATE HISTORY BR-01)
// ============================================================================
apiRouter.get('/customers', requireAuth, (req, res, next) => {
  try {
    checkAccess(req.user!, 'customer_vehicle', 'read');
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = q
      ? db
          .prepare(`
            SELECT c.*, (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) as vehicle_count
            FROM customers c
            WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
            ORDER BY c.id DESC
          `)
          .all(`%${q}%`, `%${q}%`, `%${q}%`)
      : db
          .prepare(`
            SELECT c.*, (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) as vehicle_count
            FROM customers c
            ORDER BY c.id DESC
          `)
          .all();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({
  name: z.string().min(2, 'Nama pelanggan wajib diisi'),
  phone: z.string().min(6, 'Nomor telepon wajib diisi'),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

apiRouter.post('/customers', requireAuth, validateBody(customerSchema), (req, res, next) => {
  try {
    checkAccess(req.user!, 'customer_vehicle', 'write');
    const body = req.body as z.infer<typeof customerSchema>;
    const result = db
      .prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)')
      .run(body.name.trim(), body.phone.trim(), body.email || null, body.address || null);

    const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    writeAuditLog({
      userId: req.user!.id,
      action: 'CREATE_CUSTOMER',
      entity: 'customers',
      entityId: Number(result.lastInsertRowid),
      after: created,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/customers/:id', requireAuth, (req, res, next) => {
  try {
    checkAccess(req.user!, 'customer_vehicle', 'read');
    const id = Number(req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) throw new AppError(404, 'CUSTOMER_TIDAK_DITEMUKAN', 'Pelanggan tidak ditemukan.');
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY id DESC').all(id) as { id: number }[];
    const vehiclesWithPlates = vehicles.map(v => ({
      ...v,
      plates: db.prepare('SELECT * FROM vehicle_plates WHERE vehicle_id = ? ORDER BY id DESC').all(v.id),
    }));
    res.json({ ...customer, vehicles: vehiclesWithPlates });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/customers/:id', requireAuth, validateBody(customerSchema.partial()), (req, res, next) => {
  try {
    checkAccess(req.user!, 'customer_vehicle', 'write');
    const id = Number(req.params.id);
    const before = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!before) throw new AppError(404, 'CUSTOMER_TIDAK_DITEMUKAN', 'Pelanggan tidak ditemukan.');

    const body = req.body as Partial<z.infer<typeof customerSchema>>;
    db.prepare(`
      UPDATE customers
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address)
      WHERE id = ?
    `).run(body.name ?? null, body.phone ?? null, body.email ?? null, body.address ?? null, id);

    const after = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    writeAuditLog({ userId: req.user!.id, action: 'UPDATE_CUSTOMER', entity: 'customers', entityId: id, before, after });
    res.json(after);
  } catch (err) {
    next(err);
  }
});

// BR-01: Search vehicles by old/new plate, customer name, or phone
apiRouter.get('/vehicles/search', requireAuth, (req, res, next) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const qNorm = normalizePlate(qRaw);

    // Also run domain findVehicleByPlate for exact old/new plate match priority
    const allVehiclesPlates = db.prepare('SELECT vehicle_id, plate FROM vehicle_plates').all() as {
      vehicle_id: number;
      plate: string;
    }[];
    const groupedMap = new Map<string, string[]>();
    for (const row of allVehiclesPlates) {
      const k = String(row.vehicle_id);
      if (!groupedMap.has(k)) groupedMap.set(k, []);
      groupedMap.get(k)!.push(row.plate);
    }
    const exactVehicleId = qNorm
      ? findVehicleByPlate(
          Array.from(groupedMap.entries()).map(([vehicleId, plates]) => ({ vehicleId, plates })),
          qRaw
        )
      : undefined;

    const rows = qRaw
      ? db
          .prepare(`
            SELECT DISTINCT v.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
            FROM vehicles v
            JOIN customers c ON c.id = v.customer_id
            LEFT JOIN vehicle_plates vp ON vp.vehicle_id = v.id
            WHERE vp.plate_norm LIKE ?
               OR c.name LIKE ?
               OR c.phone LIKE ?
               OR v.model LIKE ?
               OR v.brand LIKE ?
            ORDER BY CASE WHEN v.id = ? THEN 0 ELSE 1 END, v.id ASC
          `)
          .all(`%${qNorm}%`, `%${qRaw}%`, `%${qRaw}%`, `%${qRaw}%`, `%${qRaw}%`, exactVehicleId ? Number(exactVehicleId) : -1)
      : db
          .prepare(`
            SELECT v.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
            FROM vehicles v
            JOIN customers c ON c.id = v.customer_id
            ORDER BY v.id ASC
          `)
          .all();

    const todayIso = new Date().toISOString().slice(0, 10);
    const enriched = (rows as { id: number }[]).map(v => {
      const plates = db
        .prepare('SELECT id, plate, valid_from, valid_to FROM vehicle_plates WHERE vehicle_id = ? ORDER BY id DESC')
        .all(v.id);
      const rawWarranties = db
        .prepare('SELECT * FROM warranties WHERE vehicle_id = ?')
        .all(v.id) as { start_date: string; end_date: string; component_key: string }[];
      const activeWarranties = rawWarranties.filter(w => {
        const days = Math.round((Date.parse(w.end_date) - Date.parse(w.start_date)) / 86_400_000);
        return isUnderWarranty(w.start_date, days, todayIso);
      });
      return { ...v, plates, active_warranties: activeWarranties };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

const createVehicleSchema = z.object({
  customerId: z.number().int().positive(),
  plate: z.string().min(2, 'Nomor polisi wajib diisi'),
  brand: z.string().min(2, 'Merek kendaraan wajib diisi'),
  model: z.string().min(1, 'Model kendaraan wajib diisi'),
  year: z.number().int().min(1950).max(2030),
  vin: z.string().optional().nullable(),
  odometerLast: z.number().int().min(0).default(0),
});

apiRouter.post('/vehicles', requireAuth, validateBody(createVehicleSchema), (req, res, next) => {
  try {
    checkAccess(req.user!, 'customer_vehicle', 'write');
    const body = req.body as z.infer<typeof createVehicleSchema>;
    const plateClean = body.plate.trim().toUpperCase();
    const plateNorm = normalizePlate(plateClean);
    const todayIso = new Date().toISOString().slice(0, 10);

    const vehicleId = db.transaction(() => {
      const r = db
        .prepare(`
          INSERT INTO vehicles (customer_id, plate_current, brand, model, year, vin, odometer_last)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(body.customerId, plateClean, body.brand, body.model, body.year, body.vin || null, body.odometerLast);
      const vId = Number(r.lastInsertRowid);

      db.prepare(`
        INSERT INTO vehicle_plates (vehicle_id, plate, plate_norm, valid_from, valid_to)
        VALUES (?, ?, ?, ?, NULL)
      `).run(vId, plateClean, plateNorm, todayIso);

      writeAuditLog({
        userId: req.user!.id,
        action: 'CREATE_VEHICLE',
        entity: 'vehicles',
        entityId: vId,
        after: { plate: plateClean, brand: body.brand, model: body.model },
      });

      return vId;
    })();

    const created = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/vehicles/:id', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const v = db
      .prepare(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
        FROM vehicles v
        JOIN customers c ON c.id = v.customer_id
        WHERE v.id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;
    if (!v) throw new AppError(404, 'KENDARAAN_TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.');

    const plates = db.prepare('SELECT * FROM vehicle_plates WHERE vehicle_id = ? ORDER BY id DESC').all(id);
    const todayIso = new Date().toISOString().slice(0, 10);
    const rawWarranties = db
      .prepare(`
        SELECT w.*, jt.name as job_name
        FROM warranties w
        JOIN wo_jobs wj ON wj.id = w.wo_job_id
        JOIN job_types jt ON jt.id = wj.job_type_id
        WHERE w.vehicle_id = ?
        ORDER BY w.end_date DESC
      `)
      .all(id) as { start_date: string; end_date: string }[];

    const warranties = rawWarranties.map(w => {
      const days = Math.round((Date.parse(w.end_date) - Date.parse(w.start_date)) / 86_400_000);
      return { ...w, active: isUnderWarranty(w.start_date, days, todayIso) };
    });

    res.json({ ...v, plates, warranties });
  } catch (err) {
    next(err);
  }
});

// BR-01: Change license plate while preserving vehicle history
apiRouter.post(
  '/vehicles/:id/change-plate',
  requireAuth,
  validateBody(z.object({ newPlate: z.string().min(2, 'Nomor polisi baru wajib diisi') })),
  (req, res, next) => {
    try {
      checkAccess(req.user!, 'customer_vehicle', 'write');
      const id = Number(req.params.id);
      const newPlate = req.body.newPlate.trim().toUpperCase();
      const newNorm = normalizePlate(newPlate);
      const todayIso = new Date().toISOString().slice(0, 10);

      const v = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as
        | { id: number; plate_current: string }
        | undefined;
      if (!v) throw new AppError(404, 'KENDARAAN_TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.');

      db.transaction(() => {
        db.prepare('UPDATE vehicle_plates SET valid_to = ? WHERE vehicle_id = ? AND valid_to IS NULL').run(todayIso, id);
        db.prepare(`
          INSERT INTO vehicle_plates (vehicle_id, plate, plate_norm, valid_from, valid_to)
          VALUES (?, ?, ?, ?, NULL)
        `).run(id, newPlate, newNorm, todayIso);
        db.prepare('UPDATE vehicles SET plate_current = ? WHERE id = ?').run(newPlate, id);

        writeAuditLog({
          userId: req.user!.id,
          action: 'CHANGE_PLATE',
          entity: 'vehicles',
          entityId: id,
          before: { plate: v.plate_current },
          after: { plate: newPlate },
        });
      })();

      const plates = db.prepare('SELECT * FROM vehicle_plates WHERE vehicle_id = ? ORDER BY id DESC').all(id);
      res.json({ id, plate_current: newPlate, plates });
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.get('/vehicles/:id/history', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const workOrders = db
      .prepare(`
        SELECT wo.*, inv.invoice_number, inv.total as invoice_total, inv.status as invoice_status
        FROM work_orders wo
        LEFT JOIN invoices inv ON inv.work_order_id = wo.id
        WHERE wo.vehicle_id = ?
        ORDER BY wo.received_at DESC
      `)
      .all(id) as { id: number }[];

    const history = workOrders.map(wo => {
      const issues = db.prepare('SELECT * FROM wo_issues WHERE work_order_id = ?').all(wo.id);
      const jobs = db
        .prepare(`
          SELECT wj.*, jt.name as job_name, jt.component_key, u.name as technician_name
          FROM wo_jobs wj
          JOIN job_types jt ON jt.id = wj.job_type_id
          LEFT JOIN users u ON u.id = wj.technician_id
          WHERE wj.work_order_id = ?
        `)
        .all(wo.id);
      const parts = db
        .prepare(`
          SELECT wp.*, p.code as part_code, p.name as part_name, p.unit
          FROM wo_parts wp
          JOIN parts p ON p.id = wp.part_id
          WHERE wp.work_order_id = ?
        `)
        .all(wo.id);
      return { ...wo, issues, jobs, parts };
    });

    res.json(history);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. MASTER DATA (JOB TYPES, JOB RATES, SERVICE INTERVALS)
// ============================================================================
apiRouter.get('/job-types', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM job_types ORDER BY category, name').all());
});

const jobTypeSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  standard_minutes: z.number().int().positive(),
  warranty_days: z.number().int().min(0),
  component_key: z.string().min(2),
});

apiRouter.post('/job-types', requireAuth, requireRole('AD', 'PM'), validateBody(jobTypeSchema), (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof jobTypeSchema>;
    db.prepare(`
      INSERT INTO job_types (id, name, category, standard_minutes, warranty_days, component_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(b.id.trim().toUpperCase(), b.name.trim(), b.category.trim(), b.standard_minutes, b.warranty_days, b.component_key.trim().toUpperCase());
    writeAuditLog({ userId: req.user!.id, action: 'CREATE_JOB_TYPE', entity: 'job_types', entityId: b.id, after: b });
    res.status(201).json(b);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/job-types/:id', requireAuth, requireRole('AD', 'PM'), (req, res, next) => {
  try {
    const id = req.params.id;
    const b = req.body;
    db.prepare(`
      UPDATE job_types
      SET name = COALESCE(?, name),
          category = COALESCE(?, category),
          standard_minutes = COALESCE(?, standard_minutes),
          warranty_days = COALESCE(?, warranty_days),
          component_key = COALESCE(?, component_key)
      WHERE id = ?
    `).run(b.name ?? null, b.category ?? null, b.standard_minutes ?? null, b.warranty_days ?? null, b.component_key ?? null, id);
    const updated = db.prepare('SELECT * FROM job_types WHERE id = ?').get(id);
    writeAuditLog({ userId: req.user!.id, action: 'UPDATE_JOB_TYPE', entity: 'job_types', entityId: id, after: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/job-rates', requireAuth, (req, res) => {
  const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
  const model = typeof req.query.model === 'string' ? req.query.model : undefined;
  const onDate = typeof req.query.onDate === 'string' ? req.query.onDate : new Date().toISOString().slice(0, 10);

  const rows = db
    .prepare(`
      SELECT jr.*, jt.name as job_name, jt.category, jt.standard_minutes, jt.warranty_days, jt.component_key
      FROM job_rates jr
      JOIN job_types jt ON jt.id = jr.job_type_id
      ORDER BY jr.job_type_id, jr.brand, jr.model, jr.valid_from DESC
    `)
    .all();

  if (brand && model) {
    const allRates = getRatesForLookup();
    const jobTypes = db.prepare('SELECT * FROM job_types ORDER BY category, name').all() as {
      id: string;
      name: string;
      category: string;
      standard_minutes: number;
      warranty_days: number;
      component_key: string;
    }[];
    const resolved = jobTypes.map(jt => {
      let appliedRate = 0;
      try {
        appliedRate = findRate(allRates, jt.id, brand, model, onDate);
      } catch {
        appliedRate = 0;
      }
      return { ...jt, rate_applied: appliedRate };
    });
    res.json({ rates: rows, resolvedForVehicle: resolved });
    return;
  }

  res.json(rows);
});

const jobRateSchema = z.object({
  job_type_id: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().nullable().optional(),
  rate: z.number().int().min(0),
  valid_from: z.string().min(10),
});

apiRouter.post('/job-rates', requireAuth, requireRole('AD', 'PM'), validateBody(jobRateSchema), (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof jobRateSchema>;
    const r = db
      .prepare('INSERT INTO job_rates (job_type_id, brand, model, rate, valid_from) VALUES (?, ?, ?, ?, ?)')
      .run(b.job_type_id, b.brand, b.model?.trim() || null, b.rate, b.valid_from);
    const created = db.prepare('SELECT * FROM job_rates WHERE id = ?').get(r.lastInsertRowid);
    writeAuditLog({
      userId: req.user!.id,
      action: 'CREATE_JOB_RATE',
      entity: 'job_rates',
      entityId: Number(r.lastInsertRowid),
      after: created,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/job-rates/:id', requireAuth, requireRole('AD', 'PM'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rate, valid_from, model } = req.body;
    db.prepare(`
      UPDATE job_rates
      SET rate = COALESCE(?, rate),
          valid_from = COALESCE(?, valid_from),
          model = CASE WHEN ? IS NOT NULL THEN ? ELSE model END
      WHERE id = ?
    `).run(rate ?? null, valid_from ?? null, model !== undefined ? 1 : null, model || null, id);
    const updated = db.prepare('SELECT * FROM job_rates WHERE id = ?').get(id);
    writeAuditLog({ userId: req.user!.id, action: 'UPDATE_JOB_RATE', entity: 'job_rates', entityId: id, after: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/service-intervals', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM service_intervals ORDER BY brand, model').all());
});

apiRouter.post('/service-intervals', requireAuth, requireRole('AD', 'PM'), (req, res, next) => {
  try {
    const { brand, model, km_interval, month_interval } = req.body;
    const r = db
      .prepare('INSERT INTO service_intervals (brand, model, km_interval, month_interval) VALUES (?, ?, ?, ?)')
      .run(brand, model || null, Number(km_interval), Number(month_interval));
    res.status(201).json(db.prepare('SELECT * FROM service_intervals WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 6. WORK ORDERS & ASSIGNMENTS & CLOCK ON/OFF
// ============================================================================
apiRouter.get('/work-orders', requireAuth, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  let sql = `
    SELECT wo.*,
           v.plate_current, v.brand, v.model, v.year,
           c.name as customer_name, c.phone as customer_phone,
           (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id) as total_jobs,
           (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND wj.status = 'SELESAI') as done_jobs,
           (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND (wj.status = 'MENUNGGU_PART' OR wj.waiting_part = 1)) as waiting_part_jobs,
           CASE WHEN EXISTS (SELECT 1 FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND (wj.status = 'MENUNGGU_PART' OR wj.waiting_part = 1)) THEN 1 ELSE 0 END as has_waiting_part,
           (SELECT description FROM wo_issues wi WHERE wi.work_order_id = wo.id ORDER BY wi.id ASC LIMIT 1) as issue_summary,
           (SELECT GROUP_CONCAT(u.name, ', ') FROM wo_jobs wj JOIN users u ON u.id = wj.technician_id WHERE wj.work_order_id = wo.id) as technician_names
    FROM work_orders wo
    JOIN vehicles v ON v.id = wo.vehicle_id
    JOIN customers c ON c.id = v.customer_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status && status !== 'ALL') {
    sql += ` AND wo.status = ?`;
    params.push(status);
  }
  if (q) {
    sql += ` AND (wo.wo_number LIKE ? OR v.plate_current LIKE ? OR c.name LIKE ? OR v.model LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (req.user!.role === 'TK') {
    sql += ` AND EXISTS (SELECT 1 FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND wj.technician_id = ?)`;
    params.push(req.user!.id);
  }

  sql += ` ORDER BY wo.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

const createWoSchema = z.object({
  vehicleId: z.number().int().positive(),
  odometerIn: z.number().int().min(0),
  conditionNote: z.string().optional(),
  issues: z.array(z.string()).min(1, 'Minimal 1 keluhan pelanggan wajib dicatat'),
  jobTypeIds: z.array(z.string()).min(1, 'Minimal 1 pekerjaan wajib dipilih'),
  isWarrantyWo: z.boolean().optional(),
  complaintId: z.number().int().optional(),
  zeroLabor: z.boolean().optional(),
});

apiRouter.post('/work-orders', requireAuth, requireRole('SA', 'AD'), validateBody(createWoSchema), (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createWoSchema>;
    const detail = createWorkOrder({ ...body, createdBy: req.user!.id });
    res.status(201).json(detail);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/work-orders/:id', requireAuth, (req, res, next) => {
  try {
    res.json(getWorkOrderDetail(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/work-orders/:id/summary', requireAuth, (req, res, next) => {
  try {
    res.json(getWorkOrderDetail(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

const assignSchema = z.object({
  assignments: z.array(
    z.object({
      woJobId: z.number().int().positive(),
      technicianId: z.number().int().positive(),
    })
  ),
});

apiRouter.post(
  '/work-orders/:id/assignments',
  requireAuth,
  requireRole('KR', 'AD'),
  validateBody(assignSchema),
  (req, res, next) => {
    try {
      const detail = assignTechnicians(Number(req.params.id), req.body.assignments, req.user!.id);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post('/work-orders/:id/review', requireAuth, requireRole('SA', 'AD'), (req, res, next) => {
  try {
    const noPartsRequired = Boolean(req.body?.noPartsRequired);
    const detail = reviewWorkOrder(Number(req.params.id), noPartsRequired, req.user!.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

const closeWoSchema = z.object({
  otherCost: z.number().int().min(0).default(0),
  otherDescription: z.string().optional(),
  discount: z.number().int().min(0).default(0),
  noPartsRequired: z.boolean().optional(),
});

apiRouter.post(
  '/work-orders/:id/close',
  requireAuth,
  requireRole('SA', 'AD'),
  validateBody(closeWoSchema),
  (req, res, next) => {
    try {
      const detail = closeWorkOrder(Number(req.params.id), req.body, req.user!.id);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post('/work-orders/:id/cancel', requireAuth, requireRole('SA', 'AD'), (req, res, next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Dibatalkan oleh SA';
    const detail = cancelWorkOrder(Number(req.params.id), reason, req.user!.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// Technician My Jobs & Clock On/Off
apiRouter.get('/my-jobs', requireAuth, (req, res) => {
  const techId =
    (req.user!.role === 'KR' || req.user!.role === 'AD' || req.user!.role === 'PM') && req.query.technicianId
      ? Number(req.query.technicianId)
      : req.user!.id;

  const jobs = db
    .prepare(`
      SELECT wj.*,
             jt.name as job_name, jt.category, jt.component_key,
             wo.wo_number, wo.status as wo_status, wo.received_at, wo.condition_note,
             v.plate_current, v.brand, v.model, v.year,
             u.name as technician_name,
             (SELECT clock_on FROM time_logs tl WHERE tl.wo_job_id = wj.id AND tl.clock_off IS NULL ORDER BY tl.id DESC LIMIT 1) as active_clock_on,
             (SELECT COALESCE(SUM(tl.duration_minutes), 0) FROM time_logs tl WHERE tl.wo_job_id = wj.id AND tl.waiting_part = 0) as total_productive_minutes
      FROM wo_jobs wj
      JOIN job_types jt ON jt.id = wj.job_type_id
      JOIN work_orders wo ON wo.id = wj.work_order_id
      JOIN vehicles v ON v.id = wo.vehicle_id
      LEFT JOIN users u ON u.id = wj.technician_id
      WHERE (? IN ('KR', 'AD', 'PM') AND ? IS NULL OR wj.technician_id = ?)
        AND wo.status NOT IN ('DITUTUP', 'DIBATALKAN')
      ORDER BY CASE wj.status WHEN 'BERJALAN' THEN 0 WHEN 'MENUNGGU_PART' THEN 1 WHEN 'MENUNGGU' THEN 2 ELSE 3 END, wj.id DESC
    `)
    .all(req.user!.role, req.query.technicianId ?? null, techId) as { id: number; work_order_id: number }[];

  const enriched = jobs.map(j => {
    const issues = db.prepare('SELECT description FROM wo_issues WHERE work_order_id = ?').all(j.work_order_id);
    return { ...j, issues };
  });

  res.json(enriched);
});

apiRouter.post('/wo-jobs/:id/clock-on', requireAuth, (req, res, next) => {
  try {
    res.json(clockOnJob(Number(req.params.id), req.user!));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/wo-jobs/:id/waiting-part', requireAuth, (req, res, next) => {
  try {
    res.json(setWaitingPartJob(Number(req.params.id), req.user!));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/wo-jobs/:id/clock-off', requireAuth, (req, res, next) => {
  try {
    res.json(clockOffJob(Number(req.params.id), req.user!));
  } catch (err) {
    next(err);
  }
});

// KR Time correction
apiRouter.patch(
  '/time-logs/:id',
  requireAuth,
  requireRole('KR', 'AD'),
  validateBody(z.object({ durationMinutes: z.number().int().min(1) })),
  (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(id);
      if (!before) throw new AppError(404, 'LOG_TIDAK_DITEMUKAN', 'Catatan waktu tidak ditemukan.');
      db.prepare('UPDATE time_logs SET duration_minutes = ? WHERE id = ?').run(req.body.durationMinutes, id);
      writeAuditLog({
        userId: req.user!.id,
        action: 'KR_TIME_CORRECTION',
        entity: 'time_logs',
        entityId: id,
        before,
        after: { durationMinutes: req.body.durationMinutes },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 7. SPARE PARTS, STOCK MOVEMENTS & STOCK OPNAME (BR-04, BR-05, BR-11)
// ============================================================================
apiRouter.get('/parts', requireAuth, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = q
    ? db
        .prepare(`
          SELECT p.*, s.name as supplier_name
          FROM parts p
          LEFT JOIN suppliers s ON s.id = p.supplier_id
          WHERE p.code LIKE ? OR p.name LIKE ?
          ORDER BY p.code ASC
        `)
        .all(`%${q}%`, `%${q}%`)
    : db
        .prepare(`
          SELECT p.*, s.name as supplier_name
          FROM parts p
          LEFT JOIN suppliers s ON s.id = p.supplier_id
          ORDER BY p.code ASC
        `)
        .all();

  const enriched = (rows as { stock_qty: number; min_stock: number }[]).map(p => ({
    ...p,
    below_min: isBelowMin(p.stock_qty, p.min_stock),
  }));
  res.json(enriched);
});

apiRouter.get('/suppliers', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});

const partSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  unit: z.string().default('Pcs'),
  stock_qty: z.number().int().min(0).default(0),
  min_stock: z.number().int().min(0).default(5),
  buy_price: z.number().int().min(0),
  sell_price: z.number().int().min(0),
  supplier_id: z.number().int().nullable().optional(),
});

apiRouter.post('/parts', requireAuth, requireRole('SP', 'AD'), validateBody(partSchema), (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof partSchema>;
    const r = db
      .prepare(`
        INSERT INTO parts (code, name, unit, stock_qty, min_stock, buy_price, sell_price, supplier_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        b.code.trim().toUpperCase(),
        b.name.trim(),
        b.unit,
        b.stock_qty,
        b.min_stock,
        b.buy_price,
        b.sell_price,
        b.supplier_id || null
      );
    const created = db.prepare('SELECT * FROM parts WHERE id = ?').get(r.lastInsertRowid);
    writeAuditLog({
      userId: req.user!.id,
      action: 'CREATE_PART',
      entity: 'parts',
      entityId: Number(r.lastInsertRowid),
      after: created,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/parts/:id', requireAuth, requireRole('SP', 'AD'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    db.prepare(`
      UPDATE parts
      SET name = COALESCE(?, name),
          unit = COALESCE(?, unit),
          min_stock = COALESCE(?, min_stock),
          buy_price = COALESCE(?, buy_price),
          sell_price = COALESCE(?, sell_price)
      WHERE id = ?
    `).run(b.name ?? null, b.unit ?? null, b.min_stock ?? null, b.buy_price ?? null, b.sell_price ?? null, id);
    const updated = db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    writeAuditLog({ userId: req.user!.id, action: 'UPDATE_PART', entity: 'parts', entityId: id, after: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const issuePartSchema = z.object({
  partId: z.number().int().positive(),
  qty: z.number().int().positive('Jumlah part harus > 0'),
  woJobId: z.number().int().nullable().optional(),
});

apiRouter.post(
  '/work-orders/:id/parts',
  requireAuth,
  requireRole('SP', 'AD'),
  validateBody(issuePartSchema),
  (req, res, next) => {
    try {
      const result = issuePartToWorkOrder({
        workOrderId: Number(req.params.id),
        partId: req.body.partId,
        qty: req.body.qty,
        woJobId: req.body.woJobId,
        issuedBy: req.user!.id,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post(
  '/parts/:id/stock-in',
  requireAuth,
  requireRole('SP', 'AD'),
  validateBody(z.object({ qty: z.number().int().positive(), unitCost: z.number().int().min(0).optional() })),
  (req, res, next) => {
    try {
      const result = receiveStockIn({
        partId: Number(req.params.id),
        qty: req.body.qty,
        unitCost: req.body.unitCost,
        userId: req.user!.id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post(
  '/wo-parts/:id/return',
  requireAuth,
  requireRole('SP', 'AD'),
  validateBody(z.object({ qty: z.number().int().positive() })),
  (req, res, next) => {
    try {
      const result = returnWoPart(Number(req.params.id), req.body.qty, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.get('/stock-opnames', requireAuth, (_req, res) => {
  const opnames = db
    .prepare(`
      SELECT so.*, u1.name as created_by_name, u2.name as approved_by_name
      FROM stock_opnames so
      LEFT JOIN users u1 ON u1.id = so.created_by
      LEFT JOIN users u2 ON u2.id = so.approved_by
      ORDER BY so.id DESC
    `)
    .all() as { id: number }[];

  const enriched = opnames.map(o => {
    const items = db
      .prepare(`
        SELECT soi.*, p.code as part_code, p.name as part_name, p.unit
        FROM stock_opname_items soi
        JOIN parts p ON p.id = soi.part_id
        WHERE soi.opname_id = ?
      `)
      .all(o.id);
    return { ...o, items };
  });

  res.json(enriched);
});

const createOpnameSchema = z.object({
  period: z.string().min(7),
  submitImmediately: z.boolean().optional(),
  items: z.array(
    z.object({
      partId: z.number().int().positive(),
      physicalQty: z.number().int().min(0),
      reason: z.string().optional(),
    })
  ),
});

apiRouter.post(
  '/stock-opnames',
  requireAuth,
  requireRole('SP', 'AD'),
  validateBody(createOpnameSchema),
  (req, res, next) => {
    try {
      const id = createOrSubmitOpname({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post('/stock-opnames/:id/submit', requireAuth, requireRole('SP', 'AD'), (req, res, next) => {
  try {
    res.json(submitOpname(Number(req.params.id), req.user!.id));
  } catch (err) {
    next(err);
  }
});

apiRouter.post(
  '/stock-opnames/:id/approve',
  requireAuth,
  requireRole('AD', 'PM'),
  validateBody(z.object({ approved: z.boolean().default(true) })),
  (req, res, next) => {
    try {
      res.json(approveOpname(Number(req.params.id), req.body.approved, req.user!.id));
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 8. INVOICES & PAYMENTS
// ============================================================================
apiRouter.get('/invoices', requireAuth, (_req, res) => {
  const rows = db
    .prepare(`
      SELECT inv.*,
             wo.wo_number, wo.odometer_in,
             v.plate_current, v.brand, v.model, v.year,
             c.name as customer_name, c.phone as customer_phone,
             (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.invoice_id = inv.id) as paid_amount
      FROM invoices inv
      JOIN work_orders wo ON wo.id = inv.work_order_id
      JOIN vehicles v ON v.id = wo.vehicle_id
      JOIN customers c ON c.id = v.customer_id
      ORDER BY inv.id DESC
    `)
    .all();
  res.json(rows);
});

apiRouter.get('/invoices/:id', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const inv = db
      .prepare(`
        SELECT inv.*,
               wo.wo_number, wo.odometer_in, wo.received_at, wo.closed_at,
               v.plate_current, v.brand, v.model, v.year, v.vin,
               c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
        FROM invoices inv
        JOIN work_orders wo ON wo.id = inv.work_order_id
        JOIN vehicles v ON v.id = wo.vehicle_id
        JOIN customers c ON c.id = v.customer_id
        WHERE inv.id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;
    if (!inv) throw new AppError(404, 'INVOICE_TIDAK_DITEMUKAN', 'Invoice tidak ditemukan.');

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);
    const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY id').all(id);
    const warranties = db
      .prepare(`
        SELECT w.*, jt.name as job_name
        FROM warranties w
        JOIN wo_jobs wj ON wj.id = w.wo_job_id
        JOIN job_types jt ON jt.id = wj.job_type_id
        WHERE wj.work_order_id = ?
      `)
      .all(inv.work_order_id as number);

    res.json({ ...inv, items, payments, warranties });
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z.object({
  method: z.string().min(2, 'Metode pembayaran wajib diisi'),
  amount: z.number().int().positive('Nominal pembayaran harus > 0'),
});

apiRouter.post(
  '/invoices/:id/payments',
  requireAuth,
  requireRole('SA', 'AD'),
  validateBody(paymentSchema),
  (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { method, amount } = req.body as z.infer<typeof paymentSchema>;

      db.transaction(() => {
        const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as
          | { id: number; total: number; status: string }
          | undefined;
        if (!inv) throw new AppError(404, 'INVOICE_TIDAK_DITEMUKAN', 'Invoice tidak ditemukan.');

        db.prepare('INSERT INTO payments (invoice_id, paid_at, method, amount) VALUES (?, datetime("now"), ?, ?)').run(
          id,
          method,
          amount
        );

        const sumRow = db
          .prepare('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?')
          .get(id) as { total_paid: number };

        const newStatus = sumRow.total_paid >= inv.total ? 'LUNAS' : 'SEBAGIAN';
        db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, id);

        writeAuditLog({
          userId: req.user!.id,
          action: 'RECORD_PAYMENT',
          entity: 'invoices',
          entityId: id,
          after: { method, amount, newStatus },
        });
      })();

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 9. WARRANTIES & COMPLAINTS (BR-09)
// ============================================================================
apiRouter.get('/vehicles/:id/warranties', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const todayIso = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(`
      SELECT w.*, jt.name as job_name, wo.wo_number
      FROM warranties w
      JOIN wo_jobs wj ON wj.id = w.wo_job_id
      JOIN job_types jt ON jt.id = wj.job_type_id
      JOIN work_orders wo ON wo.id = wj.work_order_id
      WHERE w.vehicle_id = ?
      ORDER BY w.end_date DESC
    `)
    .all(id) as { start_date: string; end_date: string }[];

  const enriched = rows.map(w => {
    const days = Math.round((Date.parse(w.end_date) - Date.parse(w.start_date)) / 86_400_000);
    return { ...w, active: isUnderWarranty(w.start_date, days, todayIso) };
  });
  res.json(enriched);
});

apiRouter.get('/complaints', requireAuth, (_req, res) => {
  const rows = db
    .prepare(`
      SELECT cmp.*,
             v.plate_current, v.brand, v.model,
             c.name as customer_name, c.phone as customer_phone,
             wo.wo_number
      FROM complaints cmp
      JOIN vehicles v ON v.id = cmp.vehicle_id
      JOIN customers c ON c.id = v.customer_id
      LEFT JOIN work_orders wo ON wo.id = cmp.work_order_id
      ORDER BY cmp.id DESC
    `)
    .all();
  res.json(rows);
});

const complaintSchema = z.object({
  vehicleId: z.number().int().positive(),
  description: z.string().min(3, 'Deskripsi keluhan komplain wajib diisi'),
  prevComponentKey: z.string().min(1, 'Komponen servis sebelumnya wajib dipilih'),
  faultyComponentKey: z.string().min(1, 'Komponen bermasalah saat ini wajib dipilih'),
  serviceDate: z.string().optional(),
  warrantyDays: z.number().int().optional(),
});

apiRouter.post('/complaints', requireAuth, requireRole('SA', 'AD'), validateBody(complaintSchema), (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof complaintSchema>;
    const todayIso = new Date().toISOString().slice(0, 10);

    // Check active warranty from DB or passed parameters using domain isUnderWarranty
    let underWarranty = false;
    if (b.serviceDate && b.warrantyDays !== undefined) {
      underWarranty = isUnderWarranty(b.serviceDate, b.warrantyDays, todayIso);
    } else {
      const warranties = db
        .prepare('SELECT start_date, end_date FROM warranties WHERE vehicle_id = ? AND component_key = ?')
        .all(b.vehicleId, b.prevComponentKey) as { start_date: string; end_date: string }[];
      underWarranty = warranties.some(w => {
        const days = Math.round((Date.parse(w.end_date) - Date.parse(w.start_date)) / 86_400_000);
        return isUnderWarranty(w.start_date, days, todayIso);
      });
    }

    // BR-09: classifyComplaint domain logic
    const classification = classifyComplaint(b.prevComponentKey, b.faultyComponentKey, underWarranty);
    const costBorne =
      classification.type === 'GARANSI'
        ? 'Ditanggung Bengkel 100% (Jasa Rp0, Part Rp0)'
        : !classification.laborCharged && classification.partCharged
        ? 'Part Dibayar Pelanggan, Jasa Gratis (BR-09)'
        : 'Part & Jasa Dibayar Pelanggan (Masa Garansi Habis)';

    const r = db
      .prepare(`
        INSERT INTO complaints (vehicle_id, work_order_id, complaint_date, description, prev_component_key, faulty_component_key, type, part_charged, labor_charged, cost_borne, status)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'TERBUKA')
      `)
      .run(
        b.vehicleId,
        todayIso,
        b.description.trim(),
        b.prevComponentKey,
        b.faultyComponentKey,
        classification.type,
        classification.partCharged ? 1 : 0,
        classification.laborCharged ? 1 : 0,
        costBorne
      );

    const created = db.prepare('SELECT * FROM complaints WHERE id = ?').get(r.lastInsertRowid);
    writeAuditLog({
      userId: req.user!.id,
      action: 'CREATE_COMPLAINT',
      entity: 'complaints',
      entityId: Number(r.lastInsertRowid),
      after: { ...(created as object), classification },
    });

    res.status(201).json({ ...(created as object), classification });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/complaints/:id', requireAuth, requireRole('SA', 'AD'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    db.prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, id);
    res.json(db.prepare('SELECT * FROM complaints WHERE id = ?').get(id));
  } catch (err) {
    next(err);
  }
});

// Create Warranty Work Order directly from a Complaint (SKILL §2.8)
apiRouter.post('/complaints/:id/create-wo', requireAuth, requireRole('SA', 'AD'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cmp = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id) as
      | {
          id: number;
          vehicle_id: number;
          description: string;
          faulty_component_key: string;
          type: string;
          labor_charged: number;
        }
      | undefined;
    if (!cmp) throw new AppError(404, 'KOMPLAIN_TIDAK_DITEMUKAN', 'Data komplain tidak ditemukan.');

    const v = db.prepare('SELECT odometer_last FROM vehicles WHERE id = ?').get(cmp.vehicle_id) as {
      odometer_last: number;
    };

    const jt =
      (db.prepare('SELECT id FROM job_types WHERE component_key = ? LIMIT 1').get(cmp.faulty_component_key) as
        | { id: string }
        | undefined) ||
      (db.prepare('SELECT id FROM job_types LIMIT 1').get() as { id: string });

    const wo = createWorkOrder({
      vehicleId: cmp.vehicle_id,
      odometerIn: v.odometer_last,
      conditionNote: `Penanganan Komplain #${cmp.id} (${cmp.type})`,
      issues: [`[KOMPLAIN ${cmp.type}] ${cmp.description}`],
      jobTypeIds: [jt.id],
      isWarrantyWo: true,
      complaintId: cmp.id,
      zeroLabor: cmp.labor_charged === 0,
      createdBy: req.user!.id,
    });

    res.status(201).json(wo);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 10. SERVICE REMINDERS (BR-10)
// ============================================================================
apiRouter.get('/reminders/due', requireAuth, (_req, res) => {
  res.json(listRemindersDue());
});

apiRouter.post('/reminders/calculate', requireAuth, (_req, res) => {
  const result = calculateAndSyncReminders();
  res.json({ ...result, items: listRemindersDue() });
});

const followupSchema = z.object({
  status: z.enum(['PENDING', 'CONTACTED', 'SKIPPED']),
  result: z.string().min(2, 'Catatan hasil follow-up wajib diisi'),
  scheduledVisitDate: z.string().optional().nullable(),
});

apiRouter.patch(
  '/followups/:id',
  requireAuth,
  requireRole('SA', 'AD'),
  validateBody(followupSchema),
  (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const b = req.body as z.infer<typeof followupSchema>;
      db.prepare(`
        UPDATE service_followups
        SET status = ?, result = ?, scheduled_visit_date = ?, handled_by = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(b.status, b.result, b.scheduledVisitDate || null, req.user!.id, id);

      writeAuditLog({
        userId: req.user!.id,
        action: 'FOLLOWUP_REMINDER',
        entity: 'service_followups',
        entityId: id,
        after: b,
      });

      res.json(db.prepare('SELECT * FROM service_followups WHERE id = ?').get(id));
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 11. TECHNICIAN PERFORMANCE & BONUS (BR-06, BR-07)
// ============================================================================
apiRouter.get('/performance', requireAuth, (req, res) => {
  const period = typeof req.query.period === 'string' ? req.query.period : new Date().toISOString().slice(0, 7);
  const filterTechId = req.user!.role === 'TK' ? req.user!.id : undefined;
  res.json(getTechnicianPerformance(period, filterTechId));
});

const workHoursSchema = z.object({
  technicianId: z.number().int().positive(),
  period: z.string().min(7),
  availableHours: z.number().positive('Jam kerja tersedia harus > 0'),
  bonusThreshold: z.number().min(0.1).max(1.0).optional(),
});

apiRouter.put(
  '/work-hours',
  requireAuth,
  requireRole('AD', 'PM'),
  validateBody(workHoursSchema),
  (req, res, next) => {
    try {
      const b = req.body as z.infer<typeof workHoursSchema>;
      db.prepare(`
        INSERT INTO tech_work_hours (technician_id, period, available_hours)
        VALUES (?, ?, ?)
        ON CONFLICT(technician_id, period) DO UPDATE SET available_hours = excluded.available_hours
      `).run(b.technicianId, b.period, b.availableHours);

      if (b.bonusThreshold !== undefined) {
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('bonus_threshold', ?)`).run(
          String(b.bonusThreshold)
        );
      }

      writeAuditLog({
        userId: req.user!.id,
        action: 'UPDATE_WORK_HOURS',
        entity: 'tech_work_hours',
        entityId: `${b.technicianId}-${b.period}`,
        after: b,
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 12. MONTHLY REPORTS & DASHBOARD SUMMARY & CSV EXPORT
// ============================================================================
apiRouter.get('/reports/monthly', requireAuth, requireRole('AD', 'PM'), (req, res) => {
  const period = typeof req.query.period === 'string' ? req.query.period : new Date().toISOString().slice(0, 7);
  res.json(getMonthlyReport(period));
});

apiRouter.get('/reports/monthly.csv', requireAuth, requireRole('AD', 'PM'), (req, res) => {
  const period = typeof req.query.period === 'string' ? req.query.period : new Date().toISOString().slice(0, 7);
  const csv = generateMonthlyReportCsv(period);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Laporan-Bulanan-BritAuto-${period}.csv"`);
  res.send(csv);
});

apiRouter.get('/dashboard/summary', requireAuth, (req, res) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentPeriod = todayIso.slice(0, 7);

  const activeWoCount = (
    db
      .prepare(`SELECT COUNT(*) as c FROM work_orders WHERE status NOT IN ('DITUTUP', 'DIBATALKAN')`)
      .get() as { c: number }
  ).c;

  const doneTodayCount = (
    db
      .prepare(`SELECT COUNT(*) as c FROM work_orders WHERE status = 'DITUTUP' AND substr(closed_at, 1, 10) = ?`)
      .get(todayIso) as { c: number }
  ).c;

  const revenueMonth = (
    db
      .prepare(`SELECT COALESCE(SUM(total), 0) as rev FROM invoices WHERE substr(issued_at, 1, 7) = ?`)
      .get(currentPeriod) as { rev: number }
  ).rev;

  const lowStockParts = db
    .prepare(`SELECT * FROM parts WHERE stock_qty <= min_stock ORDER BY stock_qty ASC`)
    .all();

  const dueReminders = listRemindersDue().filter((r: any) => r.status === 'PENDING');

  const activeWorkOrders = db
    .prepare(`
      SELECT wo.id, wo.wo_number, wo.status, wo.received_at, wo.estimate_total,
             v.plate_current, v.brand, v.model, v.year,
             c.name as customer_name,
             (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id) as total_jobs,
             (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND wj.status = 'SELESAI') as done_jobs,
             (SELECT COUNT(*) FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND (wj.status = 'MENUNGGU_PART' OR wj.waiting_part = 1)) as waiting_part_jobs,
             CASE WHEN EXISTS (SELECT 1 FROM wo_jobs wj WHERE wj.work_order_id = wo.id AND (wj.status = 'MENUNGGU_PART' OR wj.waiting_part = 1)) THEN 1 ELSE 0 END as has_waiting_part,
             (SELECT description FROM wo_issues wi WHERE wi.work_order_id = wo.id ORDER BY wi.id ASC LIMIT 1) as issue_summary,
             (SELECT GROUP_CONCAT(u.name, ', ') FROM wo_jobs wj JOIN users u ON u.id = wj.technician_id WHERE wj.work_order_id = wo.id) as technician_names
      FROM work_orders wo
      JOIN vehicles v ON v.id = wo.vehicle_id
      JOIN customers c ON c.id = v.customer_id
      WHERE wo.status NOT IN ('DITUTUP', 'DIBATALKAN')
      ORDER BY wo.id DESC
    `)
    .all();

  const activeTechnicians = db
    .prepare(`
      SELECT u.id, u.name,
             (SELECT jt.name FROM wo_jobs wj JOIN job_types jt ON jt.id = wj.job_type_id WHERE wj.technician_id = u.id AND wj.status = 'BERJALAN' LIMIT 1) as current_job,
             (SELECT v.plate_current FROM wo_jobs wj JOIN work_orders wo ON wo.id = wj.work_order_id JOIN vehicles v ON v.id = wo.vehicle_id WHERE wj.technician_id = u.id AND wj.status = 'BERJALAN' LIMIT 1) as current_plate
      FROM users u
      WHERE u.role = 'TK' AND u.active = 1
      ORDER BY u.name
    `)
    .all();

  const pendingOpnames = (
    db.prepare(`SELECT COUNT(*) as c FROM stock_opnames WHERE status = 'SUBMITTED'`).get() as { c: number }
  ).c;

  res.json({
    today: todayIso,
    currentPeriod,
    activeWoCount,
    doneTodayCount,
    revenueMonth,
    lowStockCount: lowStockParts.length,
    lowStockParts,
    dueRemindersCount: dueReminders.length,
    dueReminders,
    activeWorkOrders,
    activeTechnicians,
    pendingOpnames,
  });
});

// ============================================================================
// 13. TOOLS & EXPENSES
// ============================================================================
apiRouter.get('/tools', requireAuth, (_req, res) => {
  const tools = db
    .prepare(`
      SELECT t.*,
             (SELECT COUNT(*) FROM tool_loans tl WHERE tl.tool_id = t.id AND tl.returned_at IS NULL) as borrowed_qty
      FROM tools t
      ORDER BY t.code
    `)
    .all();
  res.json(tools);
});

apiRouter.post(
  '/tools',
  requireAuth,
  requireRole('KR', 'AD'),
  validateBody(z.object({ code: z.string().min(2), name: z.string().min(2), qty: z.number().int().positive() })),
  (req, res, next) => {
    try {
      const { code, name, qty } = req.body;
      const r = db
        .prepare('INSERT INTO tools (code, name, qty) VALUES (?, ?, ?)')
        .run(code.trim().toUpperCase(), name.trim(), qty);
      res.status(201).json(db.prepare('SELECT * FROM tools WHERE id = ?').get(r.lastInsertRowid));
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.get('/tool-loans', requireAuth, (req, res) => {
  const rows = db
    .prepare(`
      SELECT tl.*, t.code as tool_code, t.name as tool_name, u.name as technician_name
      FROM tool_loans tl
      JOIN tools t ON t.id = tl.tool_id
      JOIN users u ON u.id = tl.technician_id
      WHERE (? != 'TK' OR tl.technician_id = ?)
      ORDER BY CASE WHEN tl.returned_at IS NULL THEN 0 ELSE 1 END, tl.id DESC
    `)
    .all(req.user!.role, req.user!.id);
  res.json(rows);
});

apiRouter.post(
  '/tool-loans',
  requireAuth,
  requireRole('KR', 'TK', 'AD'),
  validateBody(
    z.object({
      toolId: z.number().int().positive(),
      technicianId: z.number().int().positive().optional(),
      conditionNote: z.string().optional(),
    })
  ),
  (req, res, next) => {
    try {
      const techId = req.user!.role === 'TK' ? req.user!.id : req.body.technicianId || req.user!.id;
      const tool = db
        .prepare(`
          SELECT t.*,
                 (SELECT COUNT(*) FROM tool_loans tl WHERE tl.tool_id = t.id AND tl.returned_at IS NULL) as borrowed_qty
          FROM tools t WHERE t.id = ?
        `)
        .get(req.body.toolId) as { id: number; name: string; qty: number; borrowed_qty: number } | undefined;

      if (!tool) throw new AppError(404, 'ALAT_TIDAK_DITEMUKAN', 'Alat bengkel tidak ditemukan.');
      if (tool.borrowed_qty >= tool.qty) {
        throw new AppError(422, 'ALAT_SEDANG_DIPINJAM', `Semua unit ${tool.name} sedang dipinjam.`);
      }

      const r = db
        .prepare(`
          INSERT INTO tool_loans (tool_id, technician_id, loaned_at, returned_at, condition_note)
          VALUES (?, ?, datetime('now'), NULL, ?)
        `)
        .run(req.body.toolId, techId, req.body.conditionNote || 'Kondisi baik');

      writeAuditLog({
        userId: req.user!.id,
        action: 'LOAN_TOOL',
        entity: 'tool_loans',
        entityId: Number(r.lastInsertRowid),
        after: { toolId: req.body.toolId, technicianId: techId },
      });

      res.status(201).json({ id: Number(r.lastInsertRowid) });
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post('/tool-loans/:id/return', requireAuth, requireRole('KR', 'TK', 'AD'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    db.prepare(`UPDATE tool_loans SET returned_at = datetime('now') WHERE id = ?`).run(id);
    writeAuditLog({ userId: req.user!.id, action: 'RETURN_TOOL', entity: 'tool_loans', entityId: id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/expenses', requireAuth, requireRole('AD', 'PM'), (req, res) => {
  const period = typeof req.query.period === 'string' ? req.query.period : undefined;
  const rows = period
    ? db
        .prepare(`
          SELECT e.*, u.name as created_by_name
          FROM expenses e
          LEFT JOIN users u ON u.id = e.created_by
          WHERE substr(e.spent_at, 1, 7) = ?
          ORDER BY e.spent_at DESC, e.id DESC
        `)
        .all(period)
    : db
        .prepare(`
          SELECT e.*, u.name as created_by_name
          FROM expenses e
          LEFT JOIN users u ON u.id = e.created_by
          ORDER BY e.spent_at DESC, e.id DESC
        `)
        .all();
  res.json(rows);
});

const expenseSchema = z.object({
  category: z.string().min(2, 'Kategori pengeluaran wajib diisi'),
  description: z.string().min(2, 'Deskripsi wajib diisi'),
  amount: z.number().int().positive('Jumlah pengeluaran harus > 0'),
  spentAt: z.string().min(10, 'Tanggal pengeluaran wajib diisi'),
});

apiRouter.post('/expenses', requireAuth, requireRole('AD', 'PM'), validateBody(expenseSchema), (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof expenseSchema>;
    const r = db
      .prepare('INSERT INTO expenses (category, description, amount, spent_at, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(b.category.trim(), b.description.trim(), b.amount, b.spentAt, req.user!.id);
    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(r.lastInsertRowid);
    writeAuditLog({
      userId: req.user!.id,
      action: 'CREATE_EXPENSE',
      entity: 'expenses',
      entityId: Number(r.lastInsertRowid),
      after: created,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 14. NOTIFICATIONS & AUDIT LOGS
// ============================================================================
apiRouter.get('/notifications', requireAuth, (req, res) => {
  res.json(listNotificationsForUser(req.user!.id, req.user!.role));
});

apiRouter.patch('/notifications/:id/read', requireAuth, (req, res) => {
  markNotificationRead(Number(req.params.id));
  res.json({ ok: true });
});

apiRouter.get('/audit-logs', requireAuth, requireRole('AD', 'PM'), (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  res.json(listAuditLogs(limit));
});

// ============================================================================
// 15. DEEP THINKING OPERATIONAL & TECHNICAL QUERY (gemini-3.8-flash + RETRY)
// ============================================================================
function buildLocalTechnicalAnalysis(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('zf') || q.includes('transmisi') || q.includes('mechatronic') || q.includes('gigi')) {
    return [
      'ANALISIS TEKNIS — TRANSMISI ZF 8HP & MECHATRONIC',
      `Pertanyaan: "${query}"`,
      '',
      '1. Identifikasi Penyebab Utama (Root Cause):',
      '   • Degradasi seal sleeve jembatan (bridge seal) & adapter plug antara pompa oli dan modul Mechatronic yang menyebabkan drop tekanan hidraulik pada perpindahan gigi 2 → 3 (kopling C & B).',
      '   • Keausan solenoid pengatur tekanan (EDS/MV solenoid) pada valve body atau kontaminasi fluida ATF Lifeguard 8.',
      '   • Adaptasi kopling (clutch fill time / quickcharge adaptation) yang bergeser di luar toleransi (> ±250 mbar).',
      '',
      '2. Prosedur Pemeriksaan & Diagnostik Bengkel:',
      '   • Langkah 1 (Pembacaan Nilai Adaptasi): Hubungkan alat diagnostik ISTA/ODIS/SDD dan baca nilai Clutch Fill Pressure (Kopling A–E) serta Fast Fill Time. Jika tekanan adaptasi Kopling B/C > 300 mbar, indikasi kebocoran internal seal.',
      '   • Langkah 2 (Inspeksi Temperatur & Level ATF): Pastikan suhu ATF berada di rentang 35°C–45°C saat pemeriksaan level oli dan ambil sampel fluida untuk mendeteksi partikel gesek.',
      '   • Langkah 3 (Uji Tekanan Mechatronic): Turunkan oil pan transmisi, periksa kondisi karet sealing sleeve dan 4 tabung seal karet (mechatronic sealing tubes) dari retakan.',
      '',
      '3. Rekomendasi Tindakan Perbaikan & Spare Part:',
      '   • Ganti paket ZF 8HP Service Kit (Oil Pan + Filter terintegrasi + 7L ZF LifeguardFluid 8).',
      '   • Ganti Mechatronic Sealing Sleeve, Bridge Seal, dan 4 Tube Seal set.',
      '   • Lakukan reset nilai adaptasi transmisi diikuti prosedur Adaptation Drive sesuai siklus pabrik.',
    ].join('\n');
  }

  if (q.includes('air suspension') || q.includes('suspensi') || q.includes('kompresor') || q.includes('ketinggian')) {
    return [
      'ANALISIS TEKNIS — SISTEM ELECTRONIC AIR SUSPENSION (EAS)',
      `Pertanyaan: "${query}"`,
      '',
      '1. Identifikasi Penyebab Utama:',
      '   • Kebocoran mikro pada air spring bladder (balon suspensi) saat posisi ketinggian normal/access mode.',
      '   • Katup distribusi (valve block) terganjal partikel silika kering dari desiccant dryer kompresor AMK/Hitachi.',
      '   • Deviasi pembacaan ride-height sensor pada lengan suspensi akibat korosi konektor.',
      '',
      '2. Prosedur Pemeriksaan & Kalibrasi:',
      '   • Lakukan pembacaan tekanan gallery melalui SDD/Pathfinder (target tekanan reservoir 15–17.5 bar).',
      '   • Semprotkan cairan pendeteksi kebocoran pada leher crimping balon suspensi dan fitting valve block.',
      '   • Ukur jarak pusat roda ke bibir fender (wheel center to arch) pada keempat sudut di lantai spooring rata, lalu input nilai aktual dalam milimeter pada menu Guided Calibration.',
      '',
      '3. Rekomendasi Tindakan & Spare Part:',
      '   • Penggantian unit Air Strut atau O-ring Valve Block yang mengalami penurunan tekanan > 5 mm setelah parkir 12 jam.',
      '   • Kalibrasi ulang ketinggian standar dan uji jalan pada mode Dynamic & Comfort.',
    ].join('\n');
  }

  if (q.includes('pendingin') || q.includes('cooling') || q.includes('overheat') || q.includes('radiator') || q.includes('oli')) {
    return [
      'ANALISIS TEKNIS — SISTEM PENDINGIN MESIN & SEAL OLI',
      `Pertanyaan: "${query}"`,
      '',
      '1. Identifikasi Titik Rawan (Jaguar / Land Rover AJ133 V8 & AJ126 V6):',
      '   • Pipa crossover coolant plastik bagian depan & belakang (bawah supercharger) mengalami kerapuhan termal pada sambungan seam.',
      '   • Rumah water pump dan thermostat housing mengalami rembesan pada seal O-ring.',
      '   • Seal vakum pompa dan gasket cover katup (rocker cover) mengeras akibat siklus panas.',
      '',
      '2. Langkah Diagnostik Bengkel:',
      '   • Lakukan uji tekan sistem pendingin (Cooling System Pressure Test) pada tekanan 1.4 bar selama 15 menit dalam kondisi mesin dingin.',
      '   • Gunakan borescope di bawah intake manifold / supercharger untuk memeriksa jejak kerak coolant kering berwarna merah muda/oranye.',
      '   • Periksa korelasi suhu ECT dan sensor suhu kepala silinder melalui data live stream.',
      '',
      '3. Rekomendasi Tindakan Perbaikan:',
      '   • Ganti Front & Rear Coolant Crossover Pipe (disarankan upgrade ke pipa aluminium atau OEM revisi terbaru), Water Pump Assembly, dan Thermostat.',
      '   • Lakukan Vacuum Bleeding sistem pendingin menggunakan coolant spesifikasi JLR STJLR.651.5003.',
    ].join('\n');
  }

  return [
    'ANALISIS TEKNIS & OPERASIONAL — KONSULTAN SENIOR BRIT AUTO',
    `Pertanyaan: "${query}"`,
    '',
    '1. Evaluasi Diagnostik Awal:',
    '   • Lakukan pemindaian menyeluruh seluruh modul kendaraan (Full Network DTC Scan) menggunakan JLR SDD/Pathfinder atau ODIS untuk memisahkan kode kerusakan primer (root DTC) dari kode turunan tegangan/komunikasi CAN.',
    '   • Pastikan tegangan baterai ditopang oleh Battery Support Unit (stabil di 13.5V – 13.8V) selama sesi diagnostik karena sistem elektronik Jaguar, Land Rover, Bentley, dan Rolls-Royce sangat sensitif terhadap penurunan voltase.',
    '',
    '2. Langkah Pemeriksaan Terstruktur:',
    '   • Verifikasi parameter Live Data (tekanan fluida, trim bahan bakar, suhu kerja aktual, dan status aktuator) saat gejala muncul.',
    '   • Lakukan inspeksi mekanis pada area terkait (kebocoran vakum/fluida, keausan bushing/seal, serta resistansi rangkaian kabel dan ground point sasis).',
    '',
    '3. Rekomendasi Operasional Work Order:',
    '   • Dokumentasikan hasil temuan pada Job Card, pastikan ketersediaan suku cadang OEM di gudang sebelum pembongkaran utama, dan lakukan uji jalan akhir (Quality Control Road Test) sebelum penyerahan ke pelanggan.',
  ].join('\n');
}

apiRouter.post('/ai/analyze', requireAuth, async (req, res, next) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) throw new AppError(400, 'QUERY_KOSONG', 'Pertanyaan analisis wajib diisi.');

    const systemInstruction =
      'Anda adalah konsultan teknis senior spesialis mobil Inggris (Jaguar, Land Rover, Bentley, Rolls-Royce) untuk Bengkel Brit Auto. Jawab dalam bahasa Indonesia secara terstruktur dan ringkas.';

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ answer: buildLocalTechnicalAnalysis(query) });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const attempts: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
      { model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
      { model: 'gemini-3.8-flash' },
    ];

    let lastErr: any = null;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        const response = await ai.models.generateContent({
          model: attempt.model,
          contents: query,
          config: {
            systemInstruction,
            ...(attempt.thinkingLevel ? { thinkingConfig: { thinkingLevel: attempt.thinkingLevel } } : {}),
          },
        });
        if (response.text) {
          return res.json({ answer: response.text });
        }
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err || '');
        const isTransientOrQuota =
          err?.status === 503 ||
          err?.status === 429 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('high demand') ||
          msg.includes('Quota exceeded');

        if (isTransientOrQuota && i < attempts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }
        if (isTransientOrQuota) {
          return res.json({ answer: buildLocalTechnicalAnalysis(query) });
        }
        throw err;
      }
    }

    return res.json({ answer: buildLocalTechnicalAnalysis(query) });
  } catch (err: any) {
    next(err);
  }
});


