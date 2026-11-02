import { db } from '../db/connection.ts';
import { applyStockIn, applyStockOut, applyReturn, isBelowMin, opnameDiff } from '../domain/src/stock.ts';
import { AppError } from '../middleware/errors.ts';
import { writeAuditLog } from '../repositories/audit.ts';
import { createNotification } from '../repositories/notifications.ts';
import { broadcastEvent } from '../events/sse.ts';

export function issuePartToWorkOrder(input: {
  workOrderId: number;
  woJobId?: number | null;
  partId: number;
  qty: number;
  issuedBy: number;
}) {
  const tx = db.transaction(() => {
    const wo = db.prepare('SELECT id, wo_number, status, is_warranty_wo, complaint_id FROM work_orders WHERE id = ?').get(input.workOrderId) as
      | { id: number; wo_number: string; status: string; is_warranty_wo: number; complaint_id: number | null }
      | undefined;
    if (!wo) throw new AppError(404, 'WO_TIDAK_DITEMUKAN', 'Work order tidak ditemukan.');
    if (wo.status === 'DITUTUP' || wo.status === 'DIBATALKAN') {
      throw new AppError(422, 'WO_SUDAH_DITUTUP', 'Tidak dapat mengeluarkan part untuk WO yang sudah ditutup atau dibatalkan.');
    }

    const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(input.partId) as
      | { id: number; code: string; name: string; stock_qty: number; min_stock: number; sell_price: number; buy_price: number }
      | undefined;
    if (!part) throw new AppError(404, 'PART_TIDAK_DITEMUKAN', 'Spare part tidak ditemukan.');

    // BR-04: applyStockOut throws InsufficientStockError if qty > stock_qty
    let newStock: number;
    try {
      newStock = applyStockOut(part.stock_qty, input.qty);
    } catch {
      throw new AppError(422, 'STOK_TIDAK_CUKUP', `Stok ${part.name} tersisa ${part.stock_qty}`);
    }

    // Check if warranty WO has free parts (BR-09)
    let unitPrice = part.sell_price;
    if (wo.complaint_id) {
      const comp = db.prepare('SELECT part_charged FROM complaints WHERE id = ?').get(wo.complaint_id) as
        | { part_charged: number }
        | undefined;
      if (comp && comp.part_charged === 0) {
        unitPrice = 0;
      }
    }

    const res = db
      .prepare(`
        INSERT INTO wo_parts (work_order_id, wo_job_id, part_id, qty, unit_price, issued_by, issued_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .run(input.workOrderId, input.woJobId || null, input.partId, input.qty, unitPrice, input.issuedBy);

    db.prepare('UPDATE parts SET stock_qty = ? WHERE id = ?').run(newStock, part.id);

    db.prepare(`
      INSERT INTO stock_movements (part_id, type, qty, unit_cost, ref_type, ref_id, created_by, created_at)
      VALUES (?, 'OUT', ?, ?, 'WO', ?, ?, datetime('now'))
    `).run(part.id, input.qty, part.buy_price, input.workOrderId, input.issuedBy);

    // BR-05: Low stock alert to SP and PM
    if (isBelowMin(newStock, part.min_stock)) {
      const msg = `Stok ${part.name} tersisa ${newStock} (min ${part.min_stock})`;
      createNotification({ role: 'SP', type: 'LOW_STOCK', message: msg });
      createNotification({ role: 'PM', type: 'LOW_STOCK', message: msg });
    }

    writeAuditLog({
      userId: input.issuedBy,
      action: 'ISSUE_PART_WO',
      entity: 'wo_parts',
      entityId: Number(res.lastInsertRowid),
      before: { stockQty: part.stock_qty },
      after: { stockQty: newStock, qty: input.qty, unitPrice, woNumber: wo.wo_number },
    });

    return { woPartId: Number(res.lastInsertRowid), newStock, isLowStock: isBelowMin(newStock, part.min_stock) };
  });

  const result = tx();
  broadcastEvent('wo.updated', { id: input.workOrderId, action: 'part_issued' });
  return result;
}

export function receiveStockIn(input: {
  partId: number;
  qty: number;
  unitCost?: number;
  userId: number;
}) {
  return db.transaction(() => {
    const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(input.partId) as
      | { id: number; name: string; stock_qty: number; buy_price: number }
      | undefined;
    if (!part) throw new AppError(404, 'PART_TIDAK_DITEMUKAN', 'Spare part tidak ditemukan.');

    const newStock = applyStockIn(part.stock_qty, input.qty);
    const cost = input.unitCost ?? part.buy_price;

    db.prepare('UPDATE parts SET stock_qty = ?, buy_price = ? WHERE id = ?').run(newStock, cost, part.id);

    db.prepare(`
      INSERT INTO stock_movements (part_id, type, qty, unit_cost, ref_type, ref_id, created_by, created_at)
      VALUES (?, 'IN', ?, ?, 'PURCHASE', NULL, ?, datetime('now'))
    `).run(part.id, input.qty, cost, input.userId);

    writeAuditLog({
      userId: input.userId,
      action: 'STOCK_IN',
      entity: 'parts',
      entityId: part.id,
      before: { stockQty: part.stock_qty },
      after: { stockQty: newStock, addedQty: input.qty, unitCost: cost },
    });

    return { partId: part.id, newStock };
  })();
}

export function returnWoPart(woPartId: number, qtyToReturn: number, userId: number) {
  return db.transaction(() => {
    const wp = db.prepare('SELECT * FROM wo_parts WHERE id = ?').get(woPartId) as
      | { id: number; work_order_id: number; part_id: number; qty: number; returned_qty: number }
      | undefined;
    if (!wp) throw new AppError(404, 'PEMAKAIAN_PART_TIDAK_DITEMUKAN', 'Data pemakaian part tidak ditemukan.');

    const remaining = wp.qty - wp.returned_qty;
    if (qtyToReturn <= 0 || qtyToReturn > remaining) {
      throw new AppError(422, 'QTY_RETUR_TIDAK_VALID', `Jumlah retur maksimal adalah ${remaining}.`);
    }

    const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(wp.part_id) as {
      id: number;
      stock_qty: number;
      buy_price: number;
    };

    const newStock = applyReturn(part.stock_qty, qtyToReturn);
    db.prepare('UPDATE parts SET stock_qty = ? WHERE id = ?').run(newStock, part.id);
    db.prepare('UPDATE wo_parts SET returned_qty = returned_qty + ? WHERE id = ?').run(qtyToReturn, woPartId);

    db.prepare(`
      INSERT INTO stock_movements (part_id, type, qty, unit_cost, ref_type, ref_id, created_by, created_at)
      VALUES (?, 'RETURN', ?, ?, 'WO_PART', ?, ?, datetime('now'))
    `).run(part.id, qtyToReturn, part.buy_price, woPartId, userId);

    writeAuditLog({
      userId,
      action: 'RETURN_WO_PART',
      entity: 'wo_parts',
      entityId: woPartId,
      before: { stockQty: part.stock_qty, returnedQty: wp.returned_qty },
      after: { stockQty: newStock, returnedQty: wp.returned_qty + qtyToReturn },
    });

    return { woPartId, newStock };
  })();
}

export function createOrSubmitOpname(input: {
  period: string;
  items: { partId: number; physicalQty: number; reason?: string }[];
  submitImmediately?: boolean;
  userId: number;
}) {
  return db.transaction(() => {
    const allParts = db.prepare('SELECT id, stock_qty, name FROM parts').all() as {
      id: number;
      stock_qty: number;
      name: string;
    }[];
    const partMap = new Map(allParts.map(p => [p.id, p]));

    const lines = input.items.map(i => {
      const p = partMap.get(i.partId);
      if (!p) throw new AppError(404, 'PART_TIDAK_DITEMUKAN', `Part ID ${i.partId} tidak ditemukan.`);
      return {
        partId: String(i.partId),
        systemQty: p.stock_qty,
        physicalQty: i.physicalQty,
        reason: i.reason?.trim() || '',
        name: p.name,
      };
    });

    // BR-11: opnameDiff reports only parts with differences
    const diffs = opnameDiff(lines);
    const diffSet = new Map(diffs.map(d => [d.partId, d.diff]));

    if (input.submitImmediately) {
      for (const l of lines) {
        if (diffSet.has(l.partId) && !l.reason) {
          throw new AppError(
            400,
            'ALASAN_SELISIH_WAJIB',
            `Alasan wajib diisi untuk part "${l.name}" yang memiliki selisih stok.`
          );
        }
      }
    }

    const status = input.submitImmediately ? 'SUBMITTED' : 'DRAFT';
    const res = db
      .prepare(`
        INSERT INTO stock_opnames (period, status, created_by, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
      .run(input.period, status, input.userId);
    const opnameId = Number(res.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO stock_opname_items (opname_id, part_id, system_qty, physical_qty, diff, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Save only items with differences (or all provided items with computed diff)
    for (const l of lines) {
      const d = diffSet.get(l.partId) ?? 0;
      if (d !== 0) {
        insertItem.run(opnameId, Number(l.partId), l.systemQty, l.physicalQty, d, l.reason || null);
      }
    }

    if (status === 'SUBMITTED') {
      createNotification({
        role: 'PM',
        type: 'OPNAME_SUBMITTED',
        message: `Stock opname periode ${input.period} menunggu persetujuan (${diffs.length} part selisih)`,
      });
    }

    writeAuditLog({
      userId: input.userId,
      action: status === 'SUBMITTED' ? 'SUBMIT_OPNAME' : 'CREATE_OPNAME_DRAFT',
      entity: 'stock_opnames',
      entityId: opnameId,
      after: { period: input.period, status, diffCount: diffs.length },
    });

    return opnameId;
  })();
}

export function submitOpname(opnameId: number, userId: number) {
  return db.transaction(() => {
    const opname = db.prepare('SELECT * FROM stock_opnames WHERE id = ?').get(opnameId) as
      | { id: number; period: string; status: string }
      | undefined;
    if (!opname) throw new AppError(404, 'OPNAME_TIDAK_DITEMUKAN', 'Data stock opname tidak ditemukan.');
    if (opname.status !== 'DRAFT') {
      throw new AppError(422, 'STATUS_OPNAME_TIDAK_VALID', 'Hanya stock opname berstatus DRAFT yang dapat diajukan.');
    }

    const items = db.prepare('SELECT * FROM stock_opname_items WHERE opname_id = ?').all(opnameId) as {
      part_id: number;
      diff: number;
      reason: string | null;
    }[];
    for (const item of items) {
      if (item.diff !== 0 && (!item.reason || !item.reason.trim())) {
        throw new AppError(400, 'ALASAN_SELISIH_WAJIB', 'Semua item yang selisih wajib memiliki alasan.');
      }
    }

    db.prepare(`UPDATE stock_opnames SET status = 'SUBMITTED' WHERE id = ?`).run(opnameId);
    createNotification({
      role: 'PM',
      type: 'OPNAME_SUBMITTED',
      message: `Stock opname periode ${opname.period} menunggu persetujuan`,
    });

    writeAuditLog({
      userId,
      action: 'SUBMIT_OPNAME',
      entity: 'stock_opnames',
      entityId: opnameId,
      before: { status: 'DRAFT' },
      after: { status: 'SUBMITTED' },
    });

    return { ok: true };
  })();
}

export function approveOpname(opnameId: number, approved: boolean, userId: number) {
  return db.transaction(() => {
    const opname = db.prepare('SELECT * FROM stock_opnames WHERE id = ?').get(opnameId) as
      | { id: number; period: string; status: string }
      | undefined;
    if (!opname) throw new AppError(404, 'OPNAME_TIDAK_DITEMUKAN', 'Data stock opname tidak ditemukan.');
    if (opname.status !== 'SUBMITTED') {
      throw new AppError(422, 'STATUS_OPNAME_TIDAK_VALID', 'Hanya stock opname berstatus SUBMITTED yang dapat disetujui.');
    }

    const newStatus = approved ? 'APPROVED' : 'REJECTED';
    db.prepare(`
      UPDATE stock_opnames
      SET status = ?, approved_by = ?, approved_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, userId, opnameId);

    const items = db.prepare('SELECT * FROM stock_opname_items WHERE opname_id = ?').all(opnameId) as {
      part_id: number;
      system_qty: number;
      physical_qty: number;
      diff: number;
    }[];

    if (approved) {
      for (const item of items) {
        if (item.diff !== 0) {
          db.prepare('UPDATE parts SET stock_qty = ? WHERE id = ?').run(item.physical_qty, item.part_id);
          db.prepare(`
            INSERT INTO stock_movements (part_id, type, qty, unit_cost, ref_type, ref_id, created_by, created_at)
            VALUES (?, 'ADJUST', ?, 0, 'OPNAME', ?, ?, datetime('now'))
          `).run(item.part_id, item.diff, opnameId, userId);
        }
      }
    }

    writeAuditLog({
      userId,
      action: approved ? 'APPROVE_OPNAME' : 'REJECT_OPNAME',
      entity: 'stock_opnames',
      entityId: opnameId,
      before: { status: 'SUBMITTED' },
      after: { status: newStatus, adjustedItems: items.length },
    });

    return { ok: true, status: newStatus };
  })();
}
