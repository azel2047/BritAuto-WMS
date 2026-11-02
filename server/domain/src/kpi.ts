/** FR-KT-02..04, BR-06, BR-07 */
export function calcProductivity(productiveMinutes: number, availableMinutes: number): number {
  if (!(availableMinutes > 0)) throw new RangeError('availableMinutes harus > 0');
  if (productiveMinutes < 0) throw new RangeError('productiveMinutes tidak boleh negatif');
  return productiveMinutes / availableMinutes;
}
export function calcEfficiency(standardMinutes: number, actualMinutes: number): number {
  if (!(actualMinutes > 0)) throw new RangeError('actualMinutes harus > 0');
  if (!(standardMinutes > 0)) throw new RangeError('standardMinutes harus > 0');
  return standardMinutes / actualMinutes;
}
/** Bonus bila produktivitas DI ATAS ambang (contoh Bapak Agus: di atas 40%). */
export function isBonusEligible(productivity: number, threshold = 0.4): boolean {
  return productivity > threshold;
}
