import { db } from '../db/connection.ts';
import { isServiceDue } from '../domain/src/reminder.ts';
import { createNotification } from '../repositories/notifications.ts';

export function calculateAndSyncReminders(todayIso = new Date().toISOString().slice(0, 10)) {
  const vehicles = db.prepare('SELECT * FROM vehicles').all() as {
    id: number;
    plate_current: string;
    brand: string;
    model: string;
    odometer_last: number;
  }[];

  const intervals = db.prepare('SELECT * FROM service_intervals').all() as {
    brand: string;
    model: string | null;
    km_interval: number;
    month_interval: number;
  }[];

  let newlyCreated = 0;

  for (const v of vehicles) {
    // Latest closed WO for this vehicle
    const lastWo = db
      .prepare(`
        SELECT substr(closed_at, 1, 10) as last_date, odometer_in
        FROM work_orders
        WHERE vehicle_id = ? AND status = 'DITUTUP' AND closed_at IS NOT NULL
        ORDER BY closed_at DESC
        LIMIT 1
      `)
      .get(v.id) as { last_date: string; odometer_in: number } | undefined;

    if (!lastWo) continue;

    const interval =
      intervals.find(i => i.brand === v.brand && i.model === v.model) ||
      intervals.find(i => i.brand === v.brand && i.model === null);

    if (!interval) continue;

    const due = isServiceDue({
      lastServiceDate: lastWo.last_date,
      lastOdometer: lastWo.odometer_in,
      monthInterval: interval.month_interval,
      kmInterval: interval.km_interval,
      today: todayIso,
      currentOdometer: v.odometer_last,
    });

    if (due) {
      const existingPending = db
        .prepare(`SELECT id FROM service_followups WHERE vehicle_id = ? AND status = 'PENDING'`)
        .get(v.id);

      if (!existingPending) {
        const diffKm = v.odometer_last - lastWo.odometer_in;
        const reason = `Servis terakhir ${lastWo.last_date} (Odometer +${diffKm.toLocaleString('id-ID')} km dari interval ${interval.km_interval.toLocaleString('id-ID')} km / ${interval.month_interval} bln)`;
        db.prepare(`
          INSERT INTO service_followups (vehicle_id, due_date, reason, status)
          VALUES (?, ?, ?, 'PENDING')
        `).run(v.id, todayIso, reason);
        newlyCreated++;
      }
    }
  }

  if (newlyCreated > 0) {
    createNotification({
      role: 'SA',
      type: 'REMINDER_DUE',
      message: `${newlyCreated} kendaraan baru jatuh tempo servis berkala`,
    });
  }

  return { newlyCreated };
}

export function listRemindersDue() {
  return db
    .prepare(`
      SELECT sf.*,
             v.plate_current, v.brand, v.model, v.year, v.odometer_last,
             c.name as customer_name, c.phone as customer_phone,
             u.name as handled_by_name
      FROM service_followups sf
      JOIN vehicles v ON v.id = sf.vehicle_id
      JOIN customers c ON c.id = v.customer_id
      LEFT JOIN users u ON u.id = sf.handled_by
      ORDER BY CASE sf.status WHEN 'PENDING' THEN 0 WHEN 'CONTACTED' THEN 1 ELSE 2 END, sf.due_date ASC
    `)
    .all();
}
