/** FR-RM-01, BR-10 */
export interface DueInput { lastServiceDate: string; lastOdometer: number; monthInterval?: number; kmInterval?: number; today: string; currentOdometer: number }
function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10);
}
export function isServiceDue(i: DueInput): boolean {
  const byMonth = i.monthInterval !== undefined && addMonths(i.lastServiceDate, i.monthInterval) <= i.today;
  const byKm = i.kmInterval !== undefined && i.currentOdometer - i.lastOdometer >= i.kmInterval;
  return byMonth || byKm;
}
