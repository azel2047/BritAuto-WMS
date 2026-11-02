/** FR-RW-03, BR-09 */
export function isUnderWarranty(serviceDate: string, warrantyDays: number, today: string): boolean {
  const end = new Date(serviceDate + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + warrantyDays);
  return today <= end.toISOString().slice(0, 10);
}
export interface ComplaintResult { type: 'GARANSI' | 'NON_GARANSI'; partCharged: boolean; laborCharged: boolean }
/** Komponen sama & masih garansi -> garansi. Komponen lain -> part dibayar pelanggan, jasa gratis. */
export function classifyComplaint(prevComponentId: string, faultyComponentId: string, underWarranty: boolean): ComplaintResult {
  if (prevComponentId === faultyComponentId && underWarranty) return { type: 'GARANSI', partCharged: false, laborCharged: false };
  if (prevComponentId === faultyComponentId) return { type: 'NON_GARANSI', partCharged: true, laborCharged: true };
  return { type: 'NON_GARANSI', partCharged: true, laborCharged: false };
}
