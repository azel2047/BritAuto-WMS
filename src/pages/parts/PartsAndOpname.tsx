import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  PackagePlus,
  Search,
  AlertTriangle,
  ClipboardCheck,
  Check,
  X,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateTimeId } from '../../lib/format';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { Modal } from '../../components/ui/Modal';

export const PartsListPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [stockInPart, setStockInPart] = useState<any | null>(null);
  const [stockInForm, setStockInForm] = useState({ qty: 5, unitCost: 0 });

  const [issuePartModal, setIssuePartModal] = useState<any | null>(null);
  const [issueForm, setIssueForm] = useState({ workOrderId: 11, qty: 1 });

  const [addPartModal, setAddPartModal] = useState(false);
  const [newPart, setNewPart] = useState({
    code: 'PRT-NEW-01',
    name: '',
    unit: 'Pcs',
    stock_qty: 10,
    min_stock: 5,
    buy_price: 250000,
    sell_price: 350000,
  });

  const { data: parts = [] } = useQuery<any[]>({
    queryKey: ['parts', q],
    queryFn: () => apiFetch(`/parts?q=${encodeURIComponent(q)}`),
  });

  const { data: opnames = [] } = useQuery<any[]>({
    queryKey: ['stock-opnames'],
    queryFn: () => apiFetch('/stock-opnames'),
  });

  const { data: activeWos = [] } = useQuery<any[]>({
    queryKey: ['work-orders', 'ACTIVE_FOR_PARTS'],
    queryFn: async () => {
      const all = await apiFetch<any[]>('/work-orders');
      return all.filter(w => w.status !== 'DITUTUP' && w.status !== 'DIBATALKAN');
    },
  });

  const stockInMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/parts/${stockInPart.id}/stock-in`, {
        method: 'POST',
        body: JSON.stringify({ qty: Number(stockInForm.qty), unitCost: Number(stockInForm.unitCost) }),
      }),
    onSuccess: () => {
      showToast('Barang masuk berhasil dicatat dan stok bertambah', 'success');
      setStockInPart(null);
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const issueMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/work-orders/${issueForm.workOrderId}/parts`, {
        method: 'POST',
        body: JSON.stringify({
          partId: issuePartModal.id,
          qty: Number(issueForm.qty),
        }),
      }),
    onSuccess: (res: any) => {
      showToast(
        res.isLowStock
          ? `Part dikeluarkan ke WO — Notifikasi stok minimum aktif (Sisa ${res.newStock})!`
          : `Part berhasil dikeluarkan ke WO (Sisa stok: ${res.newStock})`,
        res.isLowStock ? 'info' : 'success'
      );
      setIssuePartModal(null);
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const createPartMutation = useMutation({
    mutationFn: () =>
      apiFetch('/parts', {
        method: 'POST',
        body: JSON.stringify(newPart),
      }),
    onSuccess: () => {
      showToast('Master spare part baru berhasil ditambahkan', 'success');
      setAddPartModal(false);
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const lowStockCount = parts.filter(p => p.below_min).length;
  const canManage = user?.role === 'SP' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Inventaris & Pemakaian Spare Part (BR-04, BR-05)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Stok berkurang otomatis saat dikeluarkan ke WO dan tidak pernah negatif. Notifikasi terbit saat stok ≤ minimum.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setAddPartModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-semibold hover:bg-[#2c4f7c] self-start"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Master Part</span>
          </button>
        )}
      </div>

      {/* 3 Summary Cards per DESIGN.md §5 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Total SKU Spare Part</div>
          <div className="text-3xl font-bold mt-1 tabular-nums">{parts.length}</div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Di Bawah Stok Minimum</div>
          <div className="text-3xl font-bold text-[#b36b00] mt-1 tabular-nums">{lowStockCount}</div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Stock Opname Terakhir</div>
          <div className="text-xl font-bold mt-2 font-mono">
            {opnames[0] ? `${opnames[0].period} (${opnames[0].status})` : '-'}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari kode atau nama spare part..."
            className="w-full h-10 pl-10 pr-4 rounded-[6px] border border-[var(--border)] text-sm"
          />
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                <th scope="col" className="py-3 px-4 font-semibold">Kode</th>
                <th scope="col" className="py-3 px-4 font-semibold">Nama Spare Part</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Stok</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Min</th>
                <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Harga Beli</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Harga Jual</th>
                {canManage && <th scope="col" className="py-3 px-4 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              {parts.map((p: any) => (
                <tr key={p.id} className={p.below_min ? 'bg-[#fdf1dc]/35' : 'hover:bg-[var(--navy-50)]'}>
                  <td className="py-3 px-4 font-mono text-xs font-semibold whitespace-nowrap">{p.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{p.supplier_name || '-'}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                    {p.stock_qty} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-[var(--text-muted)]">
                    {p.min_stock}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={p.below_min ? 'LOW' : 'OK'} kind="stock" />
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                    {formatRupiah(p.buy_price)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {formatRupiah(p.sell_price)}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => {
                          setIssuePartModal(p);
                          setIssueForm({ workOrderId: activeWos[0]?.id || 11, qty: 1 });
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#1f3a5f] text-white text-xs font-medium hover:bg-[#2c4f7c] inline-flex items-center gap-1"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" /> Keluarkan ke WO
                      </button>
                      <button
                        onClick={() => {
                          setStockInPart(p);
                          setStockInForm({ qty: 5, unitCost: p.buy_price });
                        }}
                        className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs font-medium hover:bg-[var(--navy-50)] inline-flex items-center gap-1"
                      >
                        <PackagePlus className="w-3.5 h-3.5" /> Barang Masuk
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Part to WO (BR-04 / BR-05) */}
      <Modal
        open={issuePartModal !== null}
        onClose={() => setIssuePartModal(null)}
        title={`Keluarkan Part ke Work Order (${issuePartModal?.code})`}
      >
        {issuePartModal && (
          <form
            onSubmit={e => {
              e.preventDefault();
              issueMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="p-3 rounded-[6px] bg-[var(--navy-50)] text-xs space-y-1">
              <div className="font-semibold text-sm">{issuePartModal.name}</div>
              <div>
                Stok Saat Ini: <strong className="font-mono">{issuePartModal.stock_qty} {issuePartModal.unit}</strong> · Minimum:{' '}
                <strong className="font-mono">{issuePartModal.min_stock}</strong>
              </div>
              <div className="text-[var(--text-muted)]">
                Tip Demo Kriteria #4: Masukkan jumlah melebihi <strong>{issuePartModal.stock_qty}</strong> untuk menguji penolakan otomatis (BR-04).
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Pilih Work Order Aktif</label>
              <select
                value={issueForm.workOrderId}
                onChange={e => setIssueForm(f => ({ ...f, workOrderId: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                {activeWos.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.wo_number} — {w.plate_current} ({w.brand} {w.model})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Jumlah Dikeluarkan (Qty)</label>
              <input
                type="number"
                required
                min={1}
                value={issueForm.qty}
                onChange={e => setIssueForm(f => ({ ...f, qty: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIssuePartModal(null)}
                className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={issueMutation.isPending}
                className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
              >
                Simpan Pengeluaran Part
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Stock In */}
      <Modal
        open={stockInPart !== null}
        onClose={() => setStockInPart(null)}
        title={`Barang Masuk (${stockInPart?.name})`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            stockInMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Jumlah Masuk (Qty)</label>
            <input
              type="number"
              required
              min={1}
              value={stockInForm.qty}
              onChange={e => setStockInForm(f => ({ ...f, qty: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Harga Beli Satuan (Rp)</label>
            <input
              type="number"
              required
              min={0}
              value={stockInForm.unitCost}
              onChange={e => setStockInForm(f => ({ ...f, unitCost: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStockInPart(null)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={stockInMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Catat Barang Masuk
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Master Part */}
      <Modal open={addPartModal} onClose={() => setAddPartModal(false)} title="Tambah Master Spare Part">
        <form
          onSubmit={e => {
            e.preventDefault();
            createPartMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Kode Part</label>
              <input
                type="text"
                required
                value={newPart.code}
                onChange={e => setNewPart(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Satuan</label>
              <input
                type="text"
                required
                value={newPart.unit}
                onChange={e => setNewPart(f => ({ ...f, unit: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nama Spare Part</label>
            <input
              type="text"
              required
              value={newPart.name}
              onChange={e => setNewPart(f => ({ ...f, name: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Stok Awal</label>
              <input
                type="number"
                required
                value={newPart.stock_qty}
                onChange={e => setNewPart(f => ({ ...f, stock_qty: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Stok Minimum</label>
              <input
                type="number"
                required
                value={newPart.min_stock}
                onChange={e => setNewPart(f => ({ ...f, min_stock: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Harga Beli (Rp)</label>
              <input
                type="number"
                required
                value={newPart.buy_price}
                onChange={e => setNewPart(f => ({ ...f, buy_price: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Harga Jual (Rp)</label>
              <input
                type="number"
                required
                value={newPart.sell_price}
                onChange={e => setNewPart(f => ({ ...f, sell_price: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddPartModal(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createPartMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Part
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const StockOpnamePage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [period, setPeriod] = useState('2026-11');
  const [physicalMap, setPhysicalMap] = useState<Record<number, { qty: number; reason: string }>>({});

  const { data: opnames = [] } = useQuery<any[]>({
    queryKey: ['stock-opnames'],
    queryFn: () => apiFetch('/stock-opnames'),
  });

  const { data: parts = [] } = useQuery<any[]>({
    queryKey: ['parts'],
    queryFn: () => apiFetch('/parts'),
  });

  const openCreateModal = () => {
    const init: Record<number, { qty: number; reason: string }> = {};
    for (const p of parts) {
      init[p.id] = { qty: p.stock_qty, reason: '' };
    }
    setPhysicalMap(init);
    setCreateOpen(true);
  };

  const createOpnameMutation = useMutation({
    mutationFn: () => {
      const items = parts.map(p => ({
        partId: p.id,
        physicalQty: physicalMap[p.id]?.qty ?? p.stock_qty,
        reason: physicalMap[p.id]?.reason ?? '',
      }));
      return apiFetch('/stock-opnames', {
        method: 'POST',
        body: JSON.stringify({
          period,
          submitImmediately: true,
          items,
        }),
      });
    },
    onSuccess: () => {
      showToast('Stock opname berhasil diajukan dan menunggu persetujuan Admin/Pemilik (BR-11)', 'success');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      apiFetch(`/stock-opnames/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }),
    onSuccess: () => {
      showToast('Persetujuan stock opname berhasil diproses & stok disesuaikan (BR-11)', 'success');
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canCreate = user?.role === 'SP' || user?.role === 'AD';
  const canApprove = user?.role === 'AD' || user?.role === 'PM';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Stock Opname Bulanan & Persetujuan Selisih (BR-11)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Bandingkan stok sistem dengan stok fisik; hanya part yang selisih yang dilaporkan dan disesuaikan setelah disetujui Admin/Pemilik.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-semibold hover:bg-[#2c4f7c] self-start"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>+ Buat Stock Opname Baru</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {opnames.map((op: any) => (
          <div key={op.id} className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-4 bg-[var(--navy-50)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">Periode {op.period}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                      op.status === 'APPROVED'
                        ? 'bg-[#e4f4ec] text-[#2e8b57]'
                        : op.status === 'SUBMITTED'
                        ? 'bg-[#fdf1dc] text-[#b36b00]'
                        : 'bg-[#fbe7e4] text-[#c0392b]'
                    }`}
                  >
                    {op.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Dibuat oleh: {op.created_by_name} ({formatDateTimeId(op.created_at)})
                  {op.approved_by_name ? ` · Diproses oleh: ${op.approved_by_name}` : ''}
                </div>
              </div>

              {canApprove && op.status === 'SUBMITTED' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMutation.mutate({ id: op.id, approved: true })}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[#2e8b57] text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Setujui & Sesuaikan Stok
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ id: op.id, approved: false })}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[#fbe7e4] text-[#c0392b] text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-xs uppercase text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-4">Part</th>
                    <th className="py-2.5 px-4 text-right">Stok Sistem</th>
                    <th className="py-2.5 px-4 text-right">Stok Fisik</th>
                    <th className="py-2.5 px-4 text-right">Selisih</th>
                    <th className="py-2.5 px-4">Alasan Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {op.items?.map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-xs font-semibold">{it.part_code}</span> — {it.part_name}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{it.system_qty}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">{it.physical_qty}</td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold ${
                          it.diff < 0 ? 'text-[#c0392b]' : 'text-[#2e8b57]'
                        }`}
                      >
                        {it.diff > 0 ? `+${it.diff}` : it.diff}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[var(--text-muted)]">{it.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Input Stock Opname Fisik Bulanan (BR-11)"
        maxWidth="max-w-3xl"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            createOpnameMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold">Periode Opname:</label>
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="h-9 px-3 rounded border border-[var(--border)] text-sm font-mono"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-[var(--border)] rounded-[8px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[var(--navy-50)] sticky top-0">
                <tr>
                  <th className="py-2 px-3">Spare Part</th>
                  <th className="py-2 px-3 text-right">Sistem</th>
                  <th className="py-2 px-3 text-right">Fisik</th>
                  <th className="py-2 px-3 text-right">Selisih</th>
                  <th className="py-2 px-3">Alasan (Wajib bila selisih)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {parts.slice(0, 12).map((p: any) => {
                  const phys = physicalMap[p.id]?.qty ?? p.stock_qty;
                  const diff = phys - p.stock_qty;
                  return (
                    <tr key={p.id} className={diff !== 0 ? 'bg-[#fdf1dc]/40' : ''}>
                      <td className="py-2 px-3 font-medium">
                        {p.code} — {p.name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{p.stock_qty}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          value={phys}
                          onChange={e =>
                            setPhysicalMap(prev => ({
                              ...prev,
                              [p.id]: {
                                qty: Number(e.target.value),
                                reason: prev[p.id]?.reason || '',
                              },
                            }))
                          }
                          className="w-16 h-8 px-2 rounded border border-[var(--border)] text-right font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required={diff !== 0}
                          value={physicalMap[p.id]?.reason || ''}
                          onChange={e =>
                            setPhysicalMap(prev => ({
                              ...prev,
                              [p.id]: {
                                qty: prev[p.id]?.qty ?? p.stock_qty,
                                reason: e.target.value,
                              },
                            }))
                          }
                          placeholder={diff !== 0 ? 'Wajib isi alasan selisih...' : 'Sesuai'}
                          className="w-full h-8 px-2 rounded border border-[var(--border)]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createOpnameMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Ajukan Stock Opname
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
