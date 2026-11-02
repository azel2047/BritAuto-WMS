/** FR-PI-02..05, BR-08, NFR-15 */
export interface InvoiceInput { labor: number[]; parts: { qty: number; unitPrice: number }[]; other: number[]; discount: number }
export function computeTotals(i: InvoiceInput) {
  const labor = i.labor.reduce((a, b) => a + b, 0);
  const parts = i.parts.reduce((a, p) => a + p.qty * p.unitPrice, 0);
  const other = i.other.reduce((a, b) => a + b, 0);
  const subtotal = labor + parts + other;
  if (i.discount < 0 || i.discount > subtotal) throw new RangeError('diskon tidak valid');
  return { labor, parts, other, subtotal, discount: i.discount, total: subtotal - i.discount };
}
/** Format default: PREFIX-YYYYMMDD-NNN (format final menunggu konfirmasi sponsor). */
export function nextNumber(prefix: string, date: Date, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError('seq harus bilangan bulat >= 1');
  const y = date.getUTCFullYear(), m = String(date.getUTCMonth() + 1).padStart(2, '0'), d = String(date.getUTCDate()).padStart(2, '0');
  return `${prefix}-${y}${m}${d}-${String(seq).padStart(3, '0')}`;
}
export interface Rate { jobTypeId: string; brand: string; model: string | null; rate: number; validFrom: string }
export class RateNotFoundError extends Error {}
/** Tarif model spesifik diprioritaskan atas tarif merek; ambil validFrom terbaru yang <= tanggal. */
export function findRate(rates: Rate[], jobTypeId: string, brand: string, model: string, onDate: string): number {
  const ok = rates.filter(r => r.jobTypeId === jobTypeId && r.brand === brand && r.validFrom <= onDate);
  const pick = (list: Rate[]) => list.sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];
  const specific = pick(ok.filter(r => r.model === model));
  if (specific) return specific.rate;
  const general = pick(ok.filter(r => r.model === null));
  if (general) return general.rate;
  throw new RateNotFoundError(`tarif tidak ditemukan: ${jobTypeId}/${brand}/${model}`);
}
