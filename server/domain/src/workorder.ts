/** FR-PT-06, FR-PI-04, BR-12 */
export type WoStatus = 'MENUNGGU_PENUGASAN' | 'DITUGASKAN' | 'DIKERJAKAN' | 'SELESAI_DIKERJAKAN' | 'DIPERIKSA' | 'DITUTUP' | 'DIBATALKAN';
export type WoEvent = 'ASSIGN' | 'CLOCK_ON' | 'ALL_JOBS_DONE' | 'REVIEW' | 'CLOSE' | 'CANCEL';
const T: Record<WoStatus, Partial<Record<WoEvent, WoStatus>>> = {
  MENUNGGU_PENUGASAN: { ASSIGN: 'DITUGASKAN', CANCEL: 'DIBATALKAN' },
  DITUGASKAN: { CLOCK_ON: 'DIKERJAKAN', CANCEL: 'DIBATALKAN' },
  DIKERJAKAN: { ALL_JOBS_DONE: 'SELESAI_DIKERJAKAN', CANCEL: 'DIBATALKAN' },
  SELESAI_DIKERJAKAN: { REVIEW: 'DIPERIKSA' },
  DIPERIKSA: { CLOSE: 'DITUTUP' },
  DITUTUP: {},
  DIBATALKAN: {},
};
export class InvalidTransitionError extends Error {}
export function nextStatus(current: WoStatus, event: WoEvent): WoStatus {
  const n = T[current][event];
  if (!n) throw new InvalidTransitionError(`${current} tidak dapat menerima ${event}`);
  return n;
}
export interface JobLite { status: 'MENUNGGU' | 'BERJALAN' | 'MENUNGGU_PART' | 'SELESAI' }
export interface CloseCheckInput { jobs: JobLite[]; partsRecorded: boolean; reviewedBySA: boolean }
export function canCloseWorkOrder(i: CloseCheckInput): { ok: boolean; reason?: string } {
  if (i.jobs.length === 0) return { ok: false, reason: 'Work order belum memiliki pekerjaan' };
  if (i.jobs.some(j => j.status !== 'SELESAI')) return { ok: false, reason: 'Masih ada pekerjaan yang belum selesai' };
  if (!i.partsRecorded) return { ok: false, reason: 'Pemakaian spare part belum tercatat' };
  if (!i.reviewedBySA) return { ok: false, reason: 'Belum diperiksa Service Advisor' };
  return { ok: true };
}
