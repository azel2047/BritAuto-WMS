import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isServiceDue } from '../src/reminder.ts';
import { isUnderWarranty, classifyComplaint } from '../src/warranty.ts';
import { normalizePlate, findVehicleByPlate } from '../src/plates.ts';
import { authorize, registerFailedLogin, isLocked } from '../src/auth.ts';
import { canClockOn, durationMinutes, sumProductiveMinutes } from '../src/clock.ts';

describe('Service reminder (FR-RM-01, BR-10)', () => {
  it('TC-RM-01: jatuh tempo menurut interval 6 bulan', () => {
    assert.equal(isServiceDue({ lastServiceDate: '2026-04-01', lastOdometer: 10000, monthInterval: 6, today: '2026-10-22', currentOdometer: 10100 }), true);
  });
  it('TC-RM-02: jatuh tempo menurut interval 5.000 km', () => {
    assert.equal(isServiceDue({ lastServiceDate: '2026-09-01', lastOdometer: 10000, monthInterval: 6, kmInterval: 5000, today: '2026-10-22', currentOdometer: 15500 }), true);
  });
  it('TC-RM-03: belum jatuh tempo bila belum melewati keduanya', () => {
    assert.equal(isServiceDue({ lastServiceDate: '2026-09-01', lastOdometer: 10000, monthInterval: 6, kmInterval: 5000, today: '2026-10-22', currentOdometer: 11000 }), false);
  });
});
describe('Garansi dan komplain (FR-RW, BR-09)', () => {
  it('TC-RW-01: garansi berlaku sampai batas hari', () => {
    assert.equal(isUnderWarranty('2026-09-01', 90, '2026-10-22'), true);
    assert.equal(isUnderWarranty('2026-01-01', 90, '2026-10-22'), false);
  });
  it('TC-RW-02: komponen sama garansi; komponen lain part dibayar dan jasa gratis', () => {
    assert.deepEqual(classifyComplaint('KOMPRESOR', 'KOMPRESOR', true), { type: 'GARANSI', partCharged: false, laborCharged: false });
    assert.deepEqual(classifyComplaint('KOMPRESOR', 'KONDENSOR', true), { type: 'NON_GARANSI', partCharged: true, laborCharged: false });
  });
});
describe('Nomor polisi (FR-DM-04, FR-DM-05, BR-01)', () => {
  it('TC-DM-01: normalisasi nomor polisi', () => {
    assert.equal(normalizePlate('b 128 xl'), 'B128XL');
    assert.equal(normalizePlate('B-21.AB'), 'B21AB');
  });
  it('TC-DM-02: plat lama dan baru menemukan kendaraan yang sama', () => {
    const v = [{ vehicleId: 'V1', plates: ['B 128 XL', 'B 21 XL'] }, { vehicleId: 'V2', plates: ['D 99 AA'] }];
    assert.equal(findVehicleByPlate(v, 'b128xl'), 'V1');
    assert.equal(findVehicleByPlate(v, 'B21 XL'), 'V1');
  });
  it('TC-DM-03: plat tidak dikenal mengembalikan undefined', () => {
    assert.equal(findVehicleByPlate([{ vehicleId: 'V1', plates: ['B1'] }], 'Z9'), undefined);
  });
});
describe('Hak akses dan login (FR-AK, NFR-01, NFR-02)', () => {
  it('TC-AK-01: Service Advisor boleh mengubah work order, teknisi tidak', () => {
    assert.equal(authorize('SA', 'work_order', 'write'), true);
    assert.equal(authorize('TK', 'work_order', 'write', true), false);
  });
  it('TC-AK-02: teknisi hanya mengakses clock miliknya sendiri', () => {
    assert.equal(authorize('TK', 'clock', 'write', true), true);
    assert.equal(authorize('TK', 'clock', 'write', false), false);
  });
  it('TC-AK-03: tarif jasa hanya dikelola Admin dan Pemilik', () => {
    assert.equal(authorize('PM', 'rate_master', 'write'), true);
    assert.equal(authorize('AD', 'rate_master', 'write'), true);
    assert.equal(authorize('SP', 'rate_master', 'write'), false);
    assert.equal(authorize('SA', 'unknown_resource', 'read'), false);
  });
  it('TC-AK-04: akun terkunci pada kegagalan login ke-5', () => {
    let s = { failed: 0, lockedUntil: null as number | null };
    for (let i = 0; i < 4; i++) s = registerFailedLogin(s, 1_000);
    assert.equal(isLocked(s, 1_000), false);
    s = registerFailedLogin(s, 1_000);
    assert.equal(isLocked(s, 1_000), true);
  });
  it('TC-AK-05: kunci akun berakhir setelah 15 menit', () => {
    const s = registerFailedLogin({ failed: 4, lockedUntil: null }, 0);
    assert.equal(isLocked(s, 14 * 60_000), true);
    assert.equal(isLocked(s, 15 * 60_000), false);
  });
});
describe('Clock on / clock off (FR-PG)', () => {
  it('TC-PG-01: clock on ditolak bila masih ada pekerjaan berjalan', () => {
    assert.equal(canClockOn([{ clockOn: '2026-10-22T02:00:00Z', clockOff: null }]), false);
    assert.equal(canClockOn([{ clockOn: '2026-10-22T02:00:00Z', clockOff: '2026-10-22T03:00:00Z' }]), true);
  });
  it('TC-PG-02: durasi dihitung dalam menit, clock off sebelum clock on ditolak', () => {
    assert.equal(durationMinutes('2026-10-22T02:00:00Z', '2026-10-22T03:15:00Z'), 75);
    assert.throws(() => durationMinutes('2026-10-22T03:00:00Z', '2026-10-22T02:00:00Z'), RangeError);
  });
  it('TC-PG-03: waktu menunggu spare part tidak dihitung produktif', () => {
    const logs = [
      { clockOn: '2026-10-22T02:00:00Z', clockOff: '2026-10-22T03:00:00Z' },
      { clockOn: '2026-10-22T03:00:00Z', clockOff: '2026-10-22T04:00:00Z', waitingPart: true },
      { clockOn: '2026-10-22T04:00:00Z', clockOff: '2026-10-22T04:30:00Z' },
    ];
    assert.equal(sumProductiveMinutes(logs), 90);
  });
});
