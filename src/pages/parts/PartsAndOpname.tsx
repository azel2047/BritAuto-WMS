import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ClipboardCheck,
  Check,
  X,
  Plus,
  Package,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateTimeId } from '../../lib/format';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  Modal,
  FilterChip,
  EmptyState,
  TableSkeleton,
  ErrorCard,
  PaginationBar,
} from '../../components/ui/Modal';

export const PartsListPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OK'>('ALL');
  const [page, setPage] = useState(1);
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

  const {
    data: parts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['parts', q],
    queryFn: () => apiFetch(`/parts?q=${encodeURIComponent(q)}`),
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
      showToast('Stok masuk disimpan', 'success');
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
        res.isLowStock ? `Part dikeluarkan (Stok sisa ${res.newStock})` : 'Part dikeluarkan ke WO',
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
      showToast('Part baru disimpan', 'success');
      setAddPartModal(false);
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const lowStockCount = parts.filter(p => p.below_min).length;
  const canManage = user?.role === 'SP' || user?.role === 'AD';

  const visibleParts = parts.filter(p => {
    if (stockFilter === 'LOW') return Boolean(p.below_min);
    if (stockFilter === 'OK') return !p.below_min;
    return true;
  });

  const pageSize = 20;
  const pagedParts = visibleParts.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageLayout
      title="Stok Part"
      primaryAction={
        canManage ? (
          <button type="button" onClick={() => setAddPartModal(true)} className="wc-btn-primary">
            <Plus className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Tambah Part</span>
          </button>
        ) : undefined
      }
      toolbar={
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari kode atau nama part..."
              className="w-full wc-input pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={stockFilter === 'ALL'}
              onClick={() => {
                setStockFilter('ALL');
                setPage(1);
              }}
              count={parts.length}
            >
              Semua
            </FilterChip>
            <FilterChip
              active={stockFilter === 'LOW'}
              onClick={() => {
                setStockFilter('LOW');
                setPage(1);
              }}
              count={lowStockCount}
            >
              Stok tipis
            </FilterChip>
            <FilterChip
              active={stockFilter === 'OK'}
              onClick={() => {
                setStockFilter('OK');
                setPage(1);
              }}
              count={parts.length - lowStockCount}
            >
              Stok aman
            </FilterChip>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : visibleParts.length === 0 ? (
        <EmptyState
          icon={Package}
          message="Tidak ada spare part yang cocok dengan filter."
          actionLabel="Tampilkan Semua"
          onAction={() => setStockFilter('ALL')}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          {/* Desktop Table: maks 6 kolom */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Spare Part</th>
                  <th className="text-right">Stok</th>
                  <th className="text-right">Min</th>
                  <th>Status</th>
                  <th className="text-right">Harga Jual</th>
                  {canManage && <th className="text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {pagedParts.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium text-[var(--text)]">{p.name}</div>
                      <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {p.code}
                      </div>
                    </td>
                    <td className="text-right font-mono text-[14px] leading-5 font-medium tabular-nums whitespace-nowrap">
                      {p.stock_qty} {p.unit}
                    </td>
                    <td className="text-right font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                      {p.min_stock}
                    </td>
                    <td>
                      <StatusBadge status={p.below_min ? 'LOW' : 'OK'} kind="stock" />
                    </td>
                    <td className="text-right font-mono text-[14px] leading-5 tabular-nums whitespace-nowrap">
                      {formatRupiah(p.sell_price)}
                    </td>
                    {canManage && (
                      <td className="text-right whitespace-nowrap">
                        <div className="wc-row-action inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIssuePartModal(p);
                              setIssueForm({ workOrderId: activeWos[0]?.id || 11, qty: 1 });
                            }}
                            className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                          >
                            <span>Pakai ke WO</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStockInPart(p);
                              setStockInForm({ qty: 5, unitCost: p.buy_price });
                            }}
                            className="wc-btn-primary min-h-[32px] py-1 px-2.5 text-[12px]"
                          >
                            <span>Stok Masuk</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile 2-Row Cards */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {pagedParts.map((p: any) => (
              <div key={p.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] leading-4 font-semibold text-[var(--text)]">
                    {p.code}
                  </span>
                  <StatusBadge status={p.below_min ? 'LOW' : 'OK'} kind="stock" />
                </div>
                <div className="flex items-center justify-between gap-2 text-[14px] leading-5">
                  <span className="text-[var(--text)] truncate">{p.name}</span>
                  <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] shrink-0">
                    {p.stock_qty} {p.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={visibleParts.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal: Keluarkan Part ke WO */}
      <Modal
        open={issuePartModal !== null}
        onClose={() => setIssuePartModal(null)}
        title={`Pakai Part (${issuePartModal?.code})`}
      >
        {issuePartModal && (
          <form
            onSubmit={e => {
              e.preventDefault();
              issueMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="text-[14px] leading-5 text-[var(--text)]">
              <strong>{issuePartModal.name}</strong> · Stok tersedia:{' '}
              <span className="font-mono font-semibold">{issuePartModal.stock_qty}</span>
            </div>

            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Work Order *
              </label>
              <select
                value={issueForm.workOrderId}
                onChange={e => setIssueForm(f => ({ ...f, workOrderId: Number(e.target.value) }))}
                className="w-full wc-input"
              >
                {activeWos.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.wo_number} — {w.plate_current} ({w.brand} {w.model})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="issue-qty-input" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Jumlah *
              </label>
              <input
                id="issue-qty-input"
                type="number"
                required
                min={1}
                aria-invalid={issueForm.qty > issuePartModal.stock_qty}
                value={issueForm.qty}
                onChange={e => setIssueForm(f => ({ ...f, qty: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
              {issueForm.qty > issuePartModal.stock_qty && (
                <p role="alert" className="mt-1.5 text-[12px] leading-4 text-[var(--danger)]">
                  Jumlah melebihi stok tersedia ({issuePartModal.stock_qty}).
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIssuePartModal(null)} className="wc-btn-secondary">
                Batal
              </button>
              <button type="submit" disabled={issueMutation.isPending} className="wc-btn-primary">
                Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Stok Masuk */}
      <Modal
        open={stockInPart !== null}
        onClose={() => setStockInPart(null)}
        title={`Stok Masuk (${stockInPart?.code})`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            stockInMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Jumlah masuk *
            </label>
            <input
              type="number"
              required
              min={1}
              value={stockInForm.qty}
              onChange={e => setStockInForm(f => ({ ...f, qty: Number(e.target.value) }))}
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Harga beli satuan (Rp) *
            </label>
            <input
              type="number"
              required
              min={0}
              value={stockInForm.unitCost}
              onChange={e => setStockInForm(f => ({ ...f, unitCost: Number(e.target.value) }))}
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStockInPart(null)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={stockInMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Tambah Part */}
      <Modal open={addPartModal} onClose={() => setAddPartModal(false)} title="Tambah Spare Part">
        <form
          onSubmit={e => {
            e.preventDefault();
            createPartMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Kode *
              </label>
              <input
                type="text"
                required
                value={newPart.code}
                onChange={e => setNewPart(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full wc-input font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Satuan *
              </label>
              <input
                type="text"
                required
                value={newPart.unit}
                onChange={e => setNewPart(f => ({ ...f, unit: e.target.value }))}
                className="w-full wc-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Nama part *
            </label>
            <input
              type="text"
              required
              value={newPart.name}
              onChange={e => setNewPart(f => ({ ...f, name: e.target.value }))}
              className="w-full wc-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Stok awal *
              </label>
              <input
                type="number"
                required
                value={newPart.stock_qty}
                onChange={e => setNewPart(f => ({ ...f, stock_qty: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Stok minimum *
              </label>
              <input
                type="number"
                required
                value={newPart.min_stock}
                onChange={e => setNewPart(f => ({ ...f, min_stock: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Harga beli (Rp) *
              </label>
              <input
                type="number"
                required
                value={newPart.buy_price}
                onChange={e => setNewPart(f => ({ ...f, buy_price: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Harga jual (Rp) *
              </label>
              <input
                type="number"
                required
                value={newPart.sell_price}
                onChange={e => setNewPart(f => ({ ...f, sell_price: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddPartModal(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createPartMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const StockOpnamePage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [period, setPeriod] = useState('2026-11');
  const [physicalMap, setPhysicalMap] = useState<Record<number, { qty: number; reason: string }>>({});

  const {
    data: opnames = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
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
      showToast('Opname diajukan', 'success');
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
      showToast('Opname diproses', 'success');
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canCreate = user?.role === 'SP' || user?.role === 'AD';
  const canApprove = user?.role === 'AD' || user?.role === 'PM';

  return (
    <PageLayout
      title="Opname Stok"
      primaryAction={
        canCreate ? (
          <button type="button" onClick={openCreateModal} className="wc-btn-primary">
            <ClipboardCheck className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Buat Opname</span>
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : opnames.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          message="Belum ada data stock opname."
          actionLabel={canCreate ? 'Buat Opname' : undefined}
          onAction={canCreate ? openCreateModal : undefined}
        />
      ) : (
        <div className="space-y-6">
          {opnames.map((op: any) => (
            <div key={op.id} className="wc-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-[16px] leading-6">
                      Periode {op.period}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium ${
                        op.status === 'APPROVED'
                          ? 'bg-[var(--success-bg)] text-[var(--success)]'
                          : op.status === 'SUBMITTED'
                          ? 'bg-[var(--warning-bg)] text-[var(--warning)]'
                          : 'bg-[var(--danger-bg)] text-[var(--danger)]'
                      }`}
                    >
                      {op.status === 'APPROVED'
                        ? 'Disetujui'
                        : op.status === 'SUBMITTED'
                        ? 'Menunggu'
                        : 'Ditolak'}
                    </span>
                  </div>
                  <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-1">
                    {op.created_by_name} · {formatDateTimeId(op.created_at)}
                  </div>
                </div>

                {canApprove && op.status === 'SUBMITTED' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => approveMutation.mutate({ id: op.id, approved: false })}
                      className="wc-btn-secondary"
                    >
                      <X className="w-4 h-4 stroke-[1.5]" />
                      <span>Tolak</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => approveMutation.mutate({ id: op.id, approved: true })}
                      className="wc-btn-primary"
                    >
                      <Check className="w-4 h-4 stroke-[1.5]" />
                      <span>Setujui</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="wc-table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th className="text-right">Sistem</th>
                      <th className="text-right">Fisik</th>
                      <th className="text-right">Selisih</th>
                      <th>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {op.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td>
                          <span className="font-mono text-[12px] leading-4 font-semibold">
                            {it.part_code}
                          </span>{' '}
                          — {it.part_name}
                        </td>
                        <td className="text-right font-mono tabular-nums">{it.system_qty}</td>
                        <td className="text-right font-mono tabular-nums font-semibold">
                          {it.physical_qty}
                        </td>
                        <td
                          className={`text-right font-mono tabular-nums font-semibold ${
                            it.diff < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                          }`}
                        >
                          {it.diff > 0 ? `+${it.diff}` : it.diff}
                        </td>
                        <td className="text-[14px] leading-5 text-[var(--text-muted)]">
                          {it.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Input Opname Fisik"
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
            <label className="text-[12px] leading-4 font-medium">Periode *</label>
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="wc-input font-mono w-44"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-[var(--border)] rounded-[8px]">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th className="text-right">Sistem</th>
                  <th className="text-right">Fisik</th>
                  <th className="text-right">Selisih</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {parts.slice(0, 12).map((p: any) => {
                  const phys = physicalMap[p.id]?.qty ?? p.stock_qty;
                  const diff = phys - p.stock_qty;
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="font-mono text-[12px]">{p.code}</span> — {p.name}
                      </td>
                      <td className="text-right font-mono tabular-nums">{p.stock_qty}</td>
                      <td className="text-right">
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
                          className="w-20 h-9 px-2 rounded-[6px] border border-[var(--border-strong)] text-right font-mono tabular-nums"
                        />
                      </td>
                      <td className="text-right font-mono font-semibold tabular-nums">
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td>
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
                          placeholder={diff !== 0 ? 'Wajib isi alasan...' : '-'}
                          className="w-full h-9 px-2.5 rounded-[6px] border border-[var(--border-strong)] text-[14px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createOpnameMutation.isPending} className="wc-btn-primary">
              Ajukan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};
