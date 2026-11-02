import { db } from '../db/connection.ts';
import { findRate, nextNumber, computeTotals, type Rate } from '../domain/src/invoice.ts';
import { nextStatus, canCloseWorkOrder, type WoStatus } from '../domain/src/workorder.ts';
import { isUnderWarranty } from '../domain/src/warranty.ts';
import { AppError } from '../middleware/errors.ts';
import { writeAuditLog } from '../repositories/audit.ts';
import { createNotification } from '../repositories/notifications.ts';
import { broadcastEvent } from '../events/sse.ts';

export function getRatesForLookup(): Rate[] {
  const rows = db.prepare('SELECT job_type_id, brand, model, rate, valid_from FROM job_rates').all() as {
    job_type_id: string;
    brand: string;
    model: string | null;
    rate: number;
    valid_from: string;
  }[];
  return rows.map(r => ({
    jobTypeId: r.job_type_id,
    brand: r.brand,
    model: r.model,
    rate: r.rate,
    validFrom: r.valid_from,
  }));
}

export function createWorkOrder(input: {
  vehicleId: number;
  odometerIn: number;
  conditionNote?: string;
  issues: string[];
  jobTypeIds: string[];
  isWarrantyWo?: boolean;
  complaintId?: number;
  zeroLabor?: boolean;
  createdBy: number;
}) {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(input.vehicleId) as
    | { id: number; brand: string; model: string; odometer_last: number; plate_current: string }
    | undefined;
  if (!vehicle) throw new AppError(404, 'KENDARAAN_TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.');

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const allRates = getRatesForLookup();

  const tx = db.transaction(() => {
    const seqRow = db
      .prepare(`SELECT COUNT(*) as c FROM work_orders WHERE substr(received_at, 1, 10) = ?`)
      .get(todayIso) as { c: number };
    const woNumber = nextNumber('WO', today, seqRow.c + 1);

    // Prepare jobs & calculate estimate
    let estimateTotal = 0;
    const jobsToInsert: { jobTypeId: string; rate: number; stdMin: number; compKey: string }[] = [];

    for (const jtId of input.jobTypeIds) {
      const jt = db.prepare('SELECT * FROM job_types WHERE id = ?').get(jtId) as
        | { id: string; standard_minutes: number; component_key: string }
        | undefined;
      if (!jt) throw new AppError(404, 'JENIS_PEKERJAAN_TIDAK_DITEMUKAN', `Jenis pekerjaan ${jtId} tidak ditemukan.`);

      const rate = input.zeroLabor
        ? 0
        : findRate(allRates, jtId, vehicle.brand, vehicle.model, todayIso);
      estimateTotal += rate;
      jobsToInsert.push({
        jobTypeId: jtId,
        rate,
        stdMin: jt.standard_minutes,
        compKey: jt.component_key,
      });
    }

    const res = db
      .prepare(`
        INSERT INTO work_orders (wo_number, vehicle_id, status, received_at, odometer_in, condition_note, estimate_total, no_parts_required, is_warranty_wo, complaint_id, created_by)
        VALUES (?, ?, 'MENUNGGU_PENUGASAN', ?, ?, ?, ?, 0, ?, ?, ?)
      `)
      .run(
        woNumber,
        input.vehicleId,
        today.toISOString(),
        input.odometerIn,
        input.conditionNote || null,
        estimateTotal,
        input.isWarrantyWo ? 1 : 0,
        input.complaintId || null,
        input.createdBy
      );

    const woId = Number(res.lastInsertRowid);

    const insertIssue = db.prepare('INSERT INTO wo_issues (work_order_id, description) VALUES (?, ?)');
    for (const desc of input.issues) {
      if (desc.trim()) insertIssue.run(woId, desc.trim());
    }

    const insertJob = db.prepare(`
      INSERT INTO wo_jobs (work_order_id, job_type_id, technician_id, status, rate_applied, standard_minutes, waiting_part)
      VALUES (?, ?, NULL, 'MENUNGGU', ?, ?, 0)
    `);
    for (const j of jobsToInsert) {
      insertJob.run(woId, j.jobTypeId, j.rate, j.stdMin);
    }

    if (input.odometerIn > vehicle.odometer_last) {
      db.prepare('UPDATE vehicles SET odometer_last = ? WHERE id = ?').run(input.odometerIn, vehicle.id);
    }

    if (input.complaintId) {
      db.prepare(`UPDATE complaints SET work_order_id = ?, status = 'DALAM_PENANGANAN' WHERE id = ?`).run(
        woId,
        input.complaintId
      );
    }

    createNotification({
      role: 'KR',
      type: 'WO_NEW',
      message: `WO baru ${woNumber} (${vehicle.plate_current}) menunggu penugasan teknisi`,
    });

    writeAuditLog({
      userId: input.createdBy,
      action: 'CREATE_WO',
      entity: 'work_orders',
      entityId: woId,
      after: { woNumber, vehicleId: input.vehicleId, estimateTotal },
    });

    return woId;
  });

  const woId = tx();
  broadcastEvent('wo.updated', { id: woId, action: 'created' });
  return getWorkOrderDetail(woId);
}

export function assignTechnicians(
  woId: number,
  assignments: { woJobId: number; technicianId: number }[],
  userId: number
) {
  const wo = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as
    | { id: number; wo_number: string; status: WoStatus }
    | undefined;
  if (!wo) throw new AppError(404, 'WO_TIDAK_DITEMUKAN', 'Work order tidak ditemukan.');

  const tx = db.transaction(() => {
    const updateStmt = db.prepare('UPDATE wo_jobs SET technician_id = ? WHERE id = ? AND work_order_id = ?');
    for (const a of assignments) {
      updateStmt.run(a.technicianId, a.woJobId, woId);
      createNotification({
        userId: a.technicianId,
        type: 'JOB_ASSIGNED',
        message: `Anda ditugaskan pada pekerjaan di ${wo.wo_number}`,
      });
    }

    const allJobs = db.prepare('SELECT technician_id FROM wo_jobs WHERE work_order_id = ?').all(woId) as {
      technician_id: number | null;
    }[];
    const allAssigned = allJobs.length > 0 && allJobs.every(j => j.technician_id !== null);

    let newStatus = wo.status;
    if (allAssigned && wo.status === 'MENUNGGU_PENUGASAN') {
      newStatus = nextStatus(wo.status, 'ASSIGN');
      db.prepare('UPDATE work_orders SET status = ? WHERE id = ?').run(newStatus, woId);
    }

    writeAuditLog({
      userId,
      action: 'ASSIGN_WO_JOBS',
      entity: 'work_orders',
      entityId: woId,
      before: { status: wo.status },
      after: { status: newStatus, assignments },
    });
  });

  tx();
  broadcastEvent('wo.updated', { id: woId, action: 'assigned' });
  return getWorkOrderDetail(woId);
}

export function reviewWorkOrder(woId: number, noPartsRequired: boolean, userId: number) {
  const wo = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as
    | { id: number; status: WoStatus; no_parts_required: number }
    | undefined;
  if (!wo) throw new AppError(404, 'WO_TIDAK_DITEMUKAN', 'Work order tidak ditemukan.');

  const newStatus = nextStatus(wo.status, 'REVIEW');
  const nowIso = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE work_orders
      SET status = ?, reviewed_by = ?, reviewed_at = ?, no_parts_required = ?
      WHERE id = ?
    `).run(newStatus, userId, nowIso, noPartsRequired ? 1 : wo.no_parts_required, woId);

    writeAuditLog({
      userId,
      action: 'REVIEW_WO',
      entity: 'work_orders',
      entityId: woId,
      before: { status: wo.status },
      after: { status: newStatus, reviewedBy: userId, noPartsRequired },
    });
  });

  tx();
  broadcastEvent('wo.updated', { id: woId, action: 'reviewed' });
  return getWorkOrderDetail(woId);
}

export function closeWorkOrder(
  woId: number,
  input: { otherCost: number; otherDescription?: string; discount: number; noPartsRequired?: boolean },
  userId: number
) {
  const wo = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as
    | {
        id: number;
        wo_number: string;
        vehicle_id: number;
        status: WoStatus;
        no_parts_required: number;
        reviewed_by: number | null;
        complaint_id: number | null;
      }
    | undefined;
  if (!wo) throw new AppError(404, 'WO_TIDAK_DITEMUKAN', 'Work order tidak ditemukan.');

  const jobs = db
    .prepare(`
      SELECT wj.*, jt.name as job_name, jt.warranty_days, jt.component_key
      FROM wo_jobs wj
      JOIN job_types jt ON jt.id = wj.job_type_id
      WHERE wj.work_order_id = ?
    `)
    .all(woId) as {
    id: number;
    job_type_id: string;
    job_name: string;
    status: 'MENUNGGU' | 'BERJALAN' | 'MENUNGGU_PART' | 'SELESAI';
    rate_applied: number;
    warranty_days: number;
    component_key: string;
  }[];

  const parts = db
    .prepare(`
      SELECT wp.*, p.name as part_name, p.code as part_code
      FROM wo_parts wp
      JOIN parts p ON p.id = wp.part_id
      WHERE wp.work_order_id = ? AND (wp.qty - wp.returned_qty) > 0
    `)
    .all(woId) as {
    id: number;
    part_id: number;
    part_name: string;
    part_code: string;
    qty: number;
    returned_qty: number;
    unit_price: number;
  }[];

  const effectiveNoParts = input.noPartsRequired ?? Boolean(wo.no_parts_required);
  const partsRecorded = parts.length > 0 || effectiveNoParts;
  const reviewedBySA = wo.status === 'DIPERIKSA' && wo.reviewed_by !== null;

  // BR-12 check using pure domain function
  const check = canCloseWorkOrder({
    jobs: jobs.map(j => ({ status: j.status })),
    partsRecorded,
    reviewedBySA,
  });

  if (!check.ok) {
    throw new AppError(422, 'WO_BELUM_BISA_DITUTUP', check.reason || 'Work order belum memenuhi syarat penutupan.');
  }

  const newStatus = nextStatus(wo.status, 'CLOSE');
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const totals = computeTotals({
    labor: jobs.map(j => j.rate_applied),
    parts: parts.map(p => ({ qty: p.qty - p.returned_qty, unitPrice: p.unit_price })),
    other: input.otherCost > 0 ? [input.otherCost] : [],
    discount: input.discount,
  });

  const tx = db.transaction(() => {
    const seqRow = db
      .prepare(`SELECT COUNT(*) as c FROM invoices WHERE substr(issued_at, 1, 10) = ?`)
      .get(todayIso) as { c: number };
    const invNumber = nextNumber('INV', today, seqRow.c + 1);

    const invStatus = totals.total === 0 ? 'LUNAS' : 'BELUM_BAYAR';
    const invRes = db
      .prepare(`
        INSERT INTO invoices (invoice_number, work_order_id, issued_at, subtotal_labor, subtotal_parts, other_cost, discount, total, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        invNumber,
        woId,
        today.toISOString(),
        totals.labor,
        totals.parts,
        totals.other,
        totals.discount,
        totals.total,
        invStatus
      );
    const invId = Number(invRes.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, item_type, description, qty, unit_price, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const j of jobs) {
      insertItem.run(invId, 'JASA', j.job_name, 1, j.rate_applied, j.rate_applied);
    }
    for (const p of parts) {
      const netQty = p.qty - p.returned_qty;
      insertItem.run(invId, 'PART', `${p.part_code} - ${p.part_name}`, netQty, p.unit_price, netQty * p.unit_price);
    }
    if (input.otherCost > 0) {
      insertItem.run(
        invId,
        'LAIN',
        input.otherDescription?.trim() || 'Biaya Lain-lain / Consumable',
        1,
        input.otherCost,
        input.otherCost
      );
    }

    db.prepare(`
      UPDATE work_orders
      SET status = ?, closed_at = ?, no_parts_required = ?, estimate_total = ?
      WHERE id = ?
    `).run(newStatus, today.toISOString(), effectiveNoParts ? 1 : 0, totals.total, woId);

    // Create active warranties for jobs with warranty_days > 0
    const insertWarranty = db.prepare(`
      INSERT INTO warranties (vehicle_id, wo_job_id, component_key, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const j of jobs) {
      if (j.warranty_days > 0) {
        const endD = new Date(todayIso + 'T00:00:00Z');
        endD.setUTCDate(endD.getUTCDate() + j.warranty_days);
        insertWarranty.run(wo.vehicle_id, j.id, j.component_key, todayIso, endD.toISOString().slice(0, 10));
      }
    }

    if (wo.complaint_id) {
      db.prepare(`UPDATE complaints SET status = 'SELESAI' WHERE id = ?`).run(wo.complaint_id);
    }

    writeAuditLog({
      userId,
      action: 'CLOSE_WO_CREATE_INVOICE',
      entity: 'work_orders',
      entityId: woId,
      before: { status: wo.status },
      after: { status: newStatus, invoiceNumber: invNumber, total: totals.total },
    });

    return invId;
  });

  const invoiceId = tx();
  broadcastEvent('wo.updated', { id: woId, action: 'closed', invoiceId });
  return getWorkOrderDetail(woId);
}

export function cancelWorkOrder(woId: number, reason: string, userId: number) {
  const wo = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as
    | { id: number; status: WoStatus }
    | undefined;
  if (!wo) throw new AppError(404, 'WO_TIDAK_DITEMUKAN', 'Work order tidak ditemukan.');

  const newStatus = nextStatus(wo.status, 'CANCEL');
  db.transaction(() => {
    db.prepare('UPDATE work_orders SET status = ? WHERE id = ?').run(newStatus, woId);
    writeAuditLog({
      userId,
      action: 'CANCEL_WO',
      entity: 'work_orders',
      entityId: woId,
      before: { status: wo.status },
      after: { status: newStatus, reason },
    });
  })();

  broadcastEvent('wo.updated', { id: woId, action: 'cancelled' });
  return getWorkOrderDetail(woId);
}

export function getWorkOrderDetail(woId: number) {
  const wo = db
    .prepare(`
      SELECT wo.*,
             v.plate_current, v.brand, v.model, v.year, v.vin, v.odometer_last,
             c.id as customer_id, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address,
             u1.name as created_by_name,
             u2.name as reviewed_by_name
      FROM work_orders wo
      JOIN vehicles v ON v.id = wo.vehicle_id
      JOIN customers c ON c.id = v.customer_id
      LEFT JOIN users u1 ON u1.id = wo.created_by
      LEFT JOIN users u2 ON u2.id = wo.reviewed_by
      WHERE wo.id = ?
    `)
    .get(woId) as Record<string, unknown> | undefined;

  if (!wo) throw new AppError(404, 'WO_TIDAK_DITEMUKAN', 'Work order tidak ditemukan.');

  const issues = db.prepare('SELECT * FROM wo_issues WHERE work_order_id = ?').all(woId);
  const jobs = db
    .prepare(`
      SELECT wj.*, jt.name as job_name, jt.category, jt.component_key, jt.warranty_days,
             u.name as technician_name
      FROM wo_jobs wj
      JOIN job_types jt ON jt.id = wj.job_type_id
      LEFT JOIN users u ON u.id = wj.technician_id
      WHERE wj.work_order_id = ?
    `)
    .all(woId) as { id: number }[];

  const jobsWithLogs = jobs.map(j => {
    const logs = db
      .prepare('SELECT * FROM time_logs WHERE wo_job_id = ? ORDER BY id DESC')
      .all(j.id);
    return { ...j, time_logs: logs };
  });

  const parts = db
    .prepare(`
      SELECT wp.*, p.code as part_code, p.name as part_name, p.unit, u.name as issued_by_name
      FROM wo_parts wp
      JOIN parts p ON p.id = wp.part_id
      LEFT JOIN users u ON u.id = wp.issued_by
      WHERE wp.work_order_id = ?
    `)
    .all(woId);

  const invoice = db.prepare('SELECT * FROM invoices WHERE work_order_id = ?').get(woId);

  const todayIso = new Date().toISOString().slice(0, 10);
  const rawWarranties = db
    .prepare(`
      SELECT w.*, jt.name as job_name
      FROM warranties w
      JOIN wo_jobs wj ON wj.id = w.wo_job_id
      JOIN job_types jt ON jt.id = wj.job_type_id
      WHERE w.vehicle_id = ?
    `)
    .all(wo.vehicle_id as number) as { start_date: string; end_date: string; component_key: string; job_name: string }[];

  const activeWarranties = rawWarranties.filter(w => {
    const days = Math.round((Date.parse(w.end_date) - Date.parse(w.start_date)) / 86_400_000);
    return isUnderWarranty(w.start_date, days, todayIso);
  });

  return {
    ...wo,
    issues,
    jobs: jobsWithLogs,
    parts,
    invoice: invoice || null,
    active_warranties: activeWarranties,
  };
}
