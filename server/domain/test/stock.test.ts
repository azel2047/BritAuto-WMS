import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyStockIn, applyStockOut, applyReturn, isBelowMin, opnameDiff, InsufficientStockError } from '../src/stock.ts';

describe('Stok spare part (FR-SP, BR-04, BR-05, BR-11)', () => {
  it('TC-SP-01: pengeluaran 3 dari stok 10 menyisakan 7', () => {
    assert.equal(applyStockOut(10, 3), 7);
  });
  it('TC-SP-02: pengeluaran melebihi stok ditolak', () => {
    assert.throws(() => applyStockOut(2, 3), InsufficientStockError);
  });
  it('TC-SP-03: notifikasi saat stok sama dengan atau di bawah minimum 5', () => {
    assert.equal(isBelowMin(3, 5), true);
    assert.equal(isBelowMin(5, 5), true);
    assert.equal(isBelowMin(6, 5), false);
  });
  it('TC-SP-04: barang masuk menambah stok, qty 0 atau negatif ditolak', () => {
    assert.equal(applyStockIn(4, 6), 10);
    assert.throws(() => applyStockIn(4, 0), RangeError);
    assert.throws(() => applyStockOut(4, -1), RangeError);
  });
  it('TC-SP-05: retur part mengembalikan stok', () => {
    assert.equal(applyReturn(7, 2), 9);
  });
  it('TC-SP-06: stock opname hanya melaporkan part yang selisih', () => {
    const r = opnameDiff([
      { partId: 'OLI', systemQty: 10, physicalQty: 8 },
      { partId: 'FILTER', systemQty: 4, physicalQty: 4 },
      { partId: 'WIPER', systemQty: 2, physicalQty: 3 },
    ]);
    assert.deepEqual(r, [{ partId: 'OLI', diff: -2 }, { partId: 'WIPER', diff: 1 }]);
  });
});
