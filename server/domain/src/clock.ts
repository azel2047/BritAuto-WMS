/** FR-PG-01..03, FR-PG-07 */
export interface TimeLog { clockOn: string; clockOff: string | null; waitingPart?: boolean }
export function canClockOn(logs: TimeLog[]): boolean { return !logs.some(l => l.clockOff === null); }
export function durationMinutes(clockOn: string, clockOff: string): number {
  const ms = Date.parse(clockOff) - Date.parse(clockOn);
  if (!(ms >= 0)) throw new RangeError('clock off tidak boleh sebelum clock on');
  return Math.round(ms / 60_000);
}
/** Waktu tunggu spare part tidak dihitung produktif. */
export function sumProductiveMinutes(logs: TimeLog[]): number {
  return logs.filter(l => l.clockOff !== null && !l.waitingPart).reduce((a, l) => a + durationMinutes(l.clockOn, l.clockOff as string), 0);
}
