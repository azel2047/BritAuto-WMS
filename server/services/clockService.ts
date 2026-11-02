import { db } from '../db/connection.ts';
import { canClockOn, durationMinutes, type TimeLog } from '../domain/src/clock.ts';
import { nextStatus, type WoStatus } from '../domain/src/workorder.ts';
import { AppError } from '../middleware/errors.ts';
import { checkAccess } from '../middleware/rbac.ts';
import { writeAuditLog } from '../repositories/audit.ts';
import { broadcastEvent } from '../events/sse.ts';
import type { Role } from '../domain/src/auth.ts';

function getTechTimeLogs(technicianId: number): TimeLog[] {
  const rows = db
    .prepare('SELECT clock_on, clock_off, waiting_part FROM time_logs WHERE technician_id = ?')
    .all(technicianId) as { clock_on: string; clock_off: string | null; waiting_part: number }[];
  return rows.map(r => ({
    clockOn: r.clock_on,
    clockOff: r.clock_off,
    waitingPart: Boolean(r.waiting_part),
  }));
}

export function clockOnJob(woJobId: number, user: { id: number; role: Role }) {
  const job = db
    .prepare(`
      SELECT wj.*, wo.status as wo_status, wo.wo_number
      FROM wo_jobs wj
      JOIN work_orders wo ON wo.id = wj.work_order_id
      WHERE wj.id = ?
    `)
    .get(woJobId) as
    | {
        id: number;
        work_order_id: number;
        technician_id: number | null;
        status: string;
        wo_status: WoStatus;
        wo_number: string;
      }
    | undefined;

  if (!job) throw new AppError(404, 'PEKERJAAN_TIDAK_DITEMUKAN', 'Pekerjaan tidak ditemukan.');
  if (!job.technician_id) {
    throw new AppError(422, 'BELUM_DITUGASKAN', 'Pekerjaan ini belum memiliki teknisi yang ditugaskan.');
  }

  const isOwner = job.technician_id === user.id;
  checkAccess(user, 'clock', 'write', isOwner);

  const techLogs = getTechTimeLogs(job.technician_id);
  if (!canClockOn(techLogs)) {
    throw new AppError(
      409,
      'PEKERJAAN_MASIH_BERJALAN',
      'Masih ada pekerjaan berjalan. Selesaikan atau hentikan pekerjaan aktif sebelum Clock On pekerjaan baru.'
    );
  }

  const nowIso = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO time_logs (wo_job_id, technician_id, clock_on, clock_off, duration_minutes, waiting_part_minutes, waiting_part)
      VALUES (?, ?, ?, NULL, NULL, 0, 0)
    `).run(woJobId, job.technician_id, nowIso);

    db.prepare(`UPDATE wo_jobs SET status = 'BERJALAN', waiting_part = 0 WHERE id = ?`).run(woJobId);

    if (job.wo_status === 'DITUGASKAN') {
      const nextWoStatus = nextStatus(job.wo_status, 'CLOCK_ON');
      db.prepare('UPDATE work_orders SET status = ? WHERE id = ?').run(nextWoStatus, job.work_order_id);
    }

    writeAuditLog({
      userId: user.id,
      action: 'CLOCK_ON',
      entity: 'wo_jobs',
      entityId: woJobId,
      after: { clockOn: nowIso, technicianId: job.technician_id },
    });
  });

  tx();
  broadcastEvent('wo.updated', { id: job.work_order_id, action: 'clock_on', woJobId });
  return { ok: true, clockOn: nowIso };
}

export function setWaitingPartJob(woJobId: number, user: { id: number; role: Role }) {
  const job = db.prepare('SELECT * FROM wo_jobs WHERE id = ?').get(woJobId) as
    | { id: number; work_order_id: number; technician_id: number | null; status: string }
    | undefined;
  if (!job) throw new AppError(404, 'PEKERJAAN_TIDAK_DITEMUKAN', 'Pekerjaan tidak ditemukan.');

  const isOwner = job.technician_id === user.id;
  checkAccess(user, 'clock', 'write', isOwner);

  const nowIso = new Date().toISOString();

  const tx = db.transaction(() => {
    const activeLog = db
      .prepare('SELECT * FROM time_logs WHERE wo_job_id = ? AND clock_off IS NULL ORDER BY id DESC LIMIT 1')
      .get(woJobId) as { id: number; clock_on: string } | undefined;

    if (activeLog) {
      const dur = Math.max(1, durationMinutes(activeLog.clock_on, nowIso));
      db.prepare('UPDATE time_logs SET clock_off = ?, duration_minutes = ? WHERE id = ?').run(nowIso, dur, activeLog.id);
    }

    // Start a waiting_part log so waiting time is tracked but excluded from sumProductiveMinutes
    db.prepare(`
      INSERT INTO time_logs (wo_job_id, technician_id, clock_on, clock_off, duration_minutes, waiting_part_minutes, waiting_part)
      VALUES (?, ?, ?, ?, 0, 0, 1)
    `).run(woJobId, job.technician_id, nowIso, nowIso);

    db.prepare(`UPDATE wo_jobs SET status = 'MENUNGGU_PART', waiting_part = 1 WHERE id = ?`).run(woJobId);

    writeAuditLog({
      userId: user.id,
      action: 'WAITING_PART',
      entity: 'wo_jobs',
      entityId: woJobId,
      after: { status: 'MENUNGGU_PART', at: nowIso },
    });
  });

  tx();
  broadcastEvent('wo.updated', { id: job.work_order_id, action: 'waiting_part', woJobId });
  return { ok: true, status: 'MENUNGGU_PART' };
}

export function clockOffJob(woJobId: number, user: { id: number; role: Role }) {
  const job = db
    .prepare(`
      SELECT wj.*, wo.status as wo_status
      FROM wo_jobs wj
      JOIN work_orders wo ON wo.id = wj.work_order_id
      WHERE wj.id = ?
    `)
    .get(woJobId) as
    | {
        id: number;
        work_order_id: number;
        technician_id: number | null;
        status: string;
        wo_status: WoStatus;
      }
    | undefined;

  if (!job) throw new AppError(404, 'PEKERJAAN_TIDAK_DITEMUKAN', 'Pekerjaan tidak ditemukan.');
  const isOwner = job.technician_id === user.id;
  checkAccess(user, 'clock', 'write', isOwner);

  const nowIso = new Date().toISOString();

  const tx = db.transaction(() => {
    const activeLog = db
      .prepare('SELECT * FROM time_logs WHERE wo_job_id = ? AND clock_off IS NULL ORDER BY id DESC LIMIT 1')
      .get(woJobId) as { id: number; clock_on: string; waiting_part_minutes: number } | undefined;

    if (activeLog) {
      const rawMin = durationMinutes(activeLog.clock_on, nowIso);
      const netMin = Math.max(1, rawMin - (activeLog.waiting_part_minutes || 0));
      db.prepare('UPDATE time_logs SET clock_off = ?, duration_minutes = ? WHERE id = ?').run(nowIso, netMin, activeLog.id);
    }

    db.prepare(`UPDATE wo_jobs SET status = 'SELESAI', waiting_part = 0 WHERE id = ?`).run(woJobId);

    const allJobs = db
      .prepare('SELECT status FROM wo_jobs WHERE work_order_id = ?')
      .all(job.work_order_id) as { status: string }[];

    const allDone = allJobs.length > 0 && allJobs.every(j => j.status === 'SELESAI');
    if (allDone && (job.wo_status === 'DIKERJAKAN' || job.wo_status === 'DITUGASKAN')) {
      const currentStatus = job.wo_status === 'DITUGASKAN' ? nextStatus(job.wo_status, 'CLOCK_ON') : job.wo_status;
      const nextWoStatus = nextStatus(currentStatus, 'ALL_JOBS_DONE');
      db.prepare('UPDATE work_orders SET status = ? WHERE id = ?').run(nextWoStatus, job.work_order_id);
    }

    writeAuditLog({
      userId: user.id,
      action: 'CLOCK_OFF',
      entity: 'wo_jobs',
      entityId: woJobId,
      after: { clockOff: nowIso, status: 'SELESAI' },
    });
  });

  tx();
  broadcastEvent('wo.updated', { id: job.work_order_id, action: 'clock_off', woJobId });
  return { ok: true, clockOff: nowIso };
}
