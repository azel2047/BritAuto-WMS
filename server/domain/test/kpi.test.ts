import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcProductivity, calcEfficiency, isBonusEligible } from '../src/kpi.ts';

describe('KPI teknisi (FR-KT, BR-06, BR-07)', () => {
  it('TC-KT-01: 50 jam produktif dari 100 jam kerja = 50%', () => {
    assert.equal(calcProductivity(50 * 60, 100 * 60), 0.5);
  });
  it('TC-KT-02: jam kerja tersedia 0 ditolak', () => {
    assert.throws(() => calcProductivity(10, 0), RangeError);
  });
  it('TC-KT-03: standar 60 menit selesai 30 menit = efisiensi 200%', () => {
    assert.equal(calcEfficiency(60, 30), 2);
  });
  it('TC-KT-04: waktu aktual 0 ditolak', () => {
    assert.throws(() => calcEfficiency(60, 0), RangeError);
  });
  it('TC-KT-05: bonus hanya jika produktivitas di atas ambang 40%', () => {
    assert.equal(isBonusEligible(0.5), true);
    assert.equal(isBonusEligible(0.4), false);
    assert.equal(isBonusEligible(0.35), false);
  });
});
