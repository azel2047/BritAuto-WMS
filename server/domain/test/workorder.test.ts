import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextStatus, canCloseWorkOrder, InvalidTransitionError } from '../src/workorder.ts';

describe('Work order (FR-PT-06, FR-PI-04, BR-12)', () => {
  it('TC-WO-01: status mengikuti alur sampai ditutup', () => {
    let s = nextStatus('MENUNGGU_PENUGASAN', 'ASSIGN');
    assert.equal(s, 'DITUGASKAN');
    s = nextStatus(s, 'CLOCK_ON'); assert.equal(s, 'DIKERJAKAN');
    s = nextStatus(s, 'ALL_JOBS_DONE'); assert.equal(s, 'SELESAI_DIKERJAKAN');
    s = nextStatus(s, 'REVIEW'); assert.equal(s, 'DIPERIKSA');
    s = nextStatus(s, 'CLOSE'); assert.equal(s, 'DITUTUP');
  });
  it('TC-WO-02: transisi tidak valid ditolak', () => {
    assert.throws(() => nextStatus('DITUTUP', 'CLOCK_ON'), InvalidTransitionError);
    assert.throws(() => nextStatus('MENUNGGU_PENUGASAN', 'CLOSE'), InvalidTransitionError);
  });
  it('TC-WO-03: pembatalan hanya sebelum pemeriksaan', () => {
    assert.equal(nextStatus('DIKERJAKAN', 'CANCEL'), 'DIBATALKAN');
    assert.throws(() => nextStatus('DIPERIKSA', 'CANCEL'), InvalidTransitionError);
  });
  it('TC-WO-04: dapat ditutup bila semua pekerjaan selesai, part tercatat, dan sudah diperiksa', () => {
    const r = canCloseWorkOrder({ jobs: [{ status: 'SELESAI' }, { status: 'SELESAI' }], partsRecorded: true, reviewedBySA: true });
    assert.deepEqual(r, { ok: true });
  });
  it('TC-WO-05: ditolak jika ada pekerjaan belum selesai atau part belum tercatat', () => {
    const a = canCloseWorkOrder({ jobs: [{ status: 'SELESAI' }, { status: 'BERJALAN' }], partsRecorded: true, reviewedBySA: true });
    assert.equal(a.ok, false);
    const b = canCloseWorkOrder({ jobs: [{ status: 'SELESAI' }], partsRecorded: false, reviewedBySA: true });
    assert.equal(b.ok, false);
    assert.match(b.reason ?? '', /spare part/);
  });
});
