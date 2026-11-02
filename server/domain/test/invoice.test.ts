import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, nextNumber, findRate, RateNotFoundError, type Rate } from '../src/invoice.ts';

const rates: Rate[] = [
  { jobTypeId: 'MAINT', brand: 'Jaguar', model: null, rate: 400000, validFrom: '2026-01-01' },
  { jobTypeId: 'MAINT', brand: 'Jaguar', model: 'XF', rate: 500000, validFrom: '2026-01-01' },
  { jobTypeId: 'MAINT', brand: 'Jaguar', model: 'XF', rate: 550000, validFrom: '2026-09-01' },
];
describe('Invoice dan tarif (FR-PI, BR-08, NFR-15)', () => {
  it('TC-PI-01: total = jasa + part + biaya lain - diskon', () => {
    const t = computeTotals({ labor: [500000, 150000], parts: [{ qty: 2, unitPrice: 100000 }], other: [50000], discount: 100000 });
    assert.deepEqual(t, { labor: 650000, parts: 200000, other: 50000, subtotal: 900000, discount: 100000, total: 800000 });
  });
  it('TC-PI-02: diskon melebihi subtotal ditolak', () => {
    assert.throws(() => computeTotals({ labor: [100], parts: [], other: [], discount: 200 }), RangeError);
  });
  it('TC-PI-03: nomor invoice berformat PREFIX-YYYYMMDD-NNN', () => {
    assert.equal(nextNumber('INV', new Date('2026-10-22T03:00:00Z'), 7), 'INV-20261022-007');
    assert.throws(() => nextNumber('INV', new Date(), 0), RangeError);
  });
  it('TC-PI-04: tarif model spesifik diprioritaskan dan memakai versi terbaru sampai tanggal servis', () => {
    assert.equal(findRate(rates, 'MAINT', 'Jaguar', 'XF', '2026-10-01'), 550000);
    assert.equal(findRate(rates, 'MAINT', 'Jaguar', 'XF', '2026-05-01'), 500000);
    assert.equal(findRate(rates, 'MAINT', 'Jaguar', 'F-Pace', '2026-10-01'), 400000);
  });
  it('TC-PI-05: tarif tidak ada memunculkan error', () => {
    assert.throws(() => findRate(rates, 'OLI_TRANSMISI', 'Jaguar', 'XF', '2026-10-01'), RateNotFoundError);
  });
});
