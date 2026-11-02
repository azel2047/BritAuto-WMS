/** FR-SP-02..06, BR-04, BR-05, BR-11 */
export class InsufficientStockError extends Error {}
function assertQty(q: number) { if (!Number.isFinite(q) || q <= 0) throw new RangeError('qty harus > 0'); }
export function applyStockIn(stock: number, qty: number): number { assertQty(qty); return stock + qty; }
export function applyStockOut(stock: number, qty: number): number {
  assertQty(qty);
  if (qty > stock) throw new InsufficientStockError(`stok ${stock} < diminta ${qty}`);
  return stock - qty;
}
export function applyReturn(stock: number, qty: number): number { assertQty(qty); return stock + qty; }
/** Notifikasi bila stok sama dengan atau di bawah stok minimum. */
export function isBelowMin(stock: number, minStock: number): boolean { return stock <= minStock; }
export interface OpnameLine { partId: string; systemQty: number; physicalQty: number }
export function opnameDiff(lines: OpnameLine[]) {
  return lines.map(l => ({ partId: l.partId, diff: l.physicalQty - l.systemQty })).filter(d => d.diff !== 0);
}
