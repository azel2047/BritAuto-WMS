import { db } from '../db/connection.ts';
import { calcProductivity, calcEfficiency, isBonusEligible } from '../domain/src/kpi.ts';
import { sumProductiveMinutes } from '../domain/src/clock.ts';

export function getTechnicianPerformance(period: string, filterTechId?: number) {
  const thresholdRow = db.prepare(`SELECT value FROM settings WHERE key = 'bonus_threshold'`).get() as
    | { value: string }
    | undefined;
  const threshold = thresholdRow ? Number(thresholdRow.value) : 0.4;

  const technicians = db
    .prepare(`SELECT id, name, username FROM users WHERE role = 'TK' AND active = 1`)
    .all() as { id: number; name: string; username: string }[];

  const filtered = filterTechId ? technicians.filter(t => t.id === filterTechId) : technicians;

  const items = filtered.map(tech => {
    const whRow = db
      .prepare('SELECT available_hours FROM tech_work_hours WHERE technician_id = ? AND period = ?')
      .get(tech.id, period) as { available_hours: number } | undefined;
    const availableHours = whRow ? whRow.available_hours : 160;
    const availableMinutes = availableHours * 60;

    // Fetch time logs for this technician in the given YYYY-MM period
    const rawLogs = db
      .prepare(`
        SELECT clock_on, clock_off, waiting_part, duration_minutes
        FROM time_logs
        WHERE technician_id = ? AND substr(clock_on, 1, 7) = ? AND clock_off IS NOT NULL
      `)
      .all(tech.id, period) as {
      clock_on: string;
      clock_off: string;
      waiting_part: number;
      duration_minutes: number | null;
    }[];

    // Calculate productive minutes via domain sumProductiveMinutes or stored duration_minutes
    const domainLogs = rawLogs.map(l => ({
      clockOn: l.clock_on,
      clockOff: l.clock_off,
      waitingPart: Boolean(l.waiting_part),
    }));
    const productiveMinutes = sumProductiveMinutes(domainLogs);
    const productiveHours = Number((productiveMinutes / 60).toFixed(2));

    const productivity = calcProductivity(productiveMinutes, availableMinutes);
    const bonusEligible = isBonusEligible(productivity, threshold);

    // Completed jobs in period for efficiency calculation (BR-07)
    const completedJobs = db
      .prepare(`
        SELECT wj.id, wj.standard_minutes,
               (SELECT COALESCE(SUM(tl.duration_minutes), 0) FROM time_logs tl WHERE tl.wo_job_id = wj.id AND tl.waiting_part = 0) as actual_minutes
        FROM wo_jobs wj
        JOIN work_orders wo ON wo.id = wj.work_order_id
        WHERE wj.technician_id = ?
          AND wj.status = 'SELESAI'
          AND substr(wo.received_at, 1, 7) = ?
      `)
      .all(tech.id, period) as { id: number; standard_minutes: number; actual_minutes: number }[];

    const totalStandardMinutes = completedJobs.reduce((a, b) => a + b.standard_minutes, 0);
    const totalActualMinutes = completedJobs.reduce((a, b) => a + Math.max(1, b.actual_minutes), 0);

    const efficiency =
      totalStandardMinutes > 0 && totalActualMinutes > 0
        ? calcEfficiency(totalStandardMinutes, totalActualMinutes)
        : 1.0;

    return {
      technicianId: tech.id,
      name: tech.name,
      username: tech.username,
      period,
      productiveMinutes,
      productiveHours,
      availableHours,
      productivity,
      productivityPercent: Number((productivity * 100).toFixed(1)),
      efficiency,
      efficiencyPercent: Number((efficiency * 100).toFixed(1)),
      completedJobsCount: completedJobs.length,
      bonusThreshold: threshold,
      bonusEligible,
    };
  });

  return {
    period,
    bonusThreshold: threshold,
    bonusThresholdPercent: Number((threshold * 100).toFixed(0)),
    technicians: items,
  };
}
