import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Printer,
  CreditCard,
  Plus,
  Wrench,
  FileText,
  ShieldAlert,
  ChevronRight,
  Search,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId, formatDateTimeId } from '../../lib/format';
import { StatusBadge, PlateChip } from '../../components/domain/StatusBadge';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  Modal,
  EmptyState,
  TableSkeleton,
  ErrorCard,
  PaginationBar,
  FilterChip,
} from '../../components/ui/Modal';
import { BritLogo } from '../../components/domain/BritLogo';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BELUM_BAYAR' | 'LUNAS'>('ALL');
  const [page, setPage] = useState(1);

  const {
    data: invoices = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['invoices'],
    queryFn: () => apiFetch('/invoices'),
  });

  const filtered = invoices.filter((inv: any) => {
    if (statusFilter === 'LUNAS' && inv.status !== 'LUNAS') return false;
    if (statusFilter === 'BELUM_BAYAR' && inv.status === 'LUNAS') return false;
    if (q.trim()) {
      const needle = q.toLowerCase();
      return (
        String(inv.plate_current || '').toLowerCase().includes(needle) ||
        String(inv.invoice_number || '').toLowerCase().includes(needle) ||
        String(inv.customer_name || '').toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const pageSize = 20;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageLayout
      title="Invoice"
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
              placeholder="Cari plat, nomor invoice, pelanggan..."
              className="w-full wc-input pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <FilterChip
              active={statusFilter === 'ALL'}
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              count={invoices.length}
            >
              Semua
            </FilterChip>
            <FilterChip
              active={statusFilter === 'BELUM_BAYAR'}
              onClick={() => {
                setStatusFilter('BELUM_BAYAR');
                setPage(1);
              }}
              count={invoices.filter(i => i.status !== 'LUNAS').length}
            >
              Belum bayar
            </FilterChip>
            <FilterChip
              active={statusFilter === 'LUNAS'}
              onClick={() => {
                setStatusFilter('LUNAS');
                setPage(1);
              }}
              count={invoices.filter(i => i.status === 'LUNAS').length}
            >
              Lunas
            </FilterChip>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="Tidak ada invoice yang cocok dengan pencarian."
          actionLabel="Tampilkan Semua"
          onAction={() => {
            setQ('');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          {/* Desktop Table: maks 6 kolom */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Kendaraan</th>
                  <th>No. Invoice</th>
                  <th>Pelanggan</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((inv: any) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <PlateChip plate={inv.plate_current} />
                        <span className="text-[12px] leading-4 text-[var(--text-muted)]">
                          {inv.brand} {inv.model}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="font-mono text-[14px] leading-5 font-medium text-[var(--text)]">
                        {inv.invoice_number}
                      </div>
                      <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {inv.wo_number}
                      </div>
                    </td>
                    <td className="text-[14px] leading-5 text-[var(--text)]">{inv.customer_name}</td>
                    <td className="text-[14px] leading-5 text-[var(--text-muted)] tabular-nums">
                      {formatDateId(inv.issued_at)}
                    </td>
                    <td>
                      <StatusBadge status={inv.status} kind="invoice" />
                    </td>
                    <td className="text-right font-mono text-[14px] leading-5 font-medium tabular-nums whitespace-nowrap">
                      {formatRupiah(inv.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile 2-Row Cards */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {paged.map((inv: any) => (
              <div
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="p-4 space-y-2 hover:bg-[var(--bg)] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <PlateChip plate={inv.plate_current} />
                  <StatusBadge status={inv.status} kind="invoice" />
                </div>
                <div className="flex items-center justify-between gap-2 text-[14px] leading-5">
                  <span className="text-[var(--text)] truncate">
                    {inv.brand} {inv.model} · {inv.customer_name}
                  </span>
                  <span className="font-mono font-medium text-[var(--text)] shrink-0">
                    {formatRupiah(inv.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </PageLayout>
  );
};

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const invId = Number(id);
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ method: 'Transfer BCA', amount: 0 });

  const {
    data: inv,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
    queryKey: ['invoice', invId],
    queryFn: () => apiFetch(`/invoices/${invId}`),
  });

  const payMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/invoices/${invId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payForm),
      }),
    onSuccess: () => {
      showToast('Pembayaran disimpan', 'success');
      setPayOpen(false);
      queryClient.invalidateQueries({ queryKey: ['invoice', invId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading) {
    return (
      <PageLayout title="Detail Invoice">
        <TableSkeleton rows={5} />
      </PageLayout>
    );
  }

  if (isError || !inv) {
    return (
      <PageLayout title="Detail Invoice">
        <ErrorCard onRetry={() => refetch()} />
      </PageLayout>
    );
  }

  const totalPaid = (inv.payments || []).reduce((s: number, p: any) => s + p.amount, 0);
  const remaining = Math.max(0, inv.total - totalPaid);
  const canPay = (user?.role === 'SA' || user?.role === 'AD') && inv.status !== 'LUNAS';

  return (
    <PageLayout
      title={inv.invoice_number}
      primaryAction={
        canPay ? (
          <button
            type="button"
            onClick={() => {
              setPayForm({ method: 'Transfer BCA', amount: remaining });
              setPayOpen(true);
            }}
            className="wc-btn-primary"
          >
            <CreditCard className="w-5 h-5 stroke-[1.5]" />
            <span>Catat Pembayaran</span>
          </button>
        ) : (
          <button type="button" onClick={() => window.print()} className="wc-btn-primary">
            <Printer className="w-5 h-5 stroke-[1.5]" />
            <span>Cetak Invoice</span>
          </button>
        )
      }
      toolbar={
        canPay ? (
          <div className="flex items-center justify-end">
            <button type="button" onClick={() => window.print()} className="wc-btn-secondary">
              <Printer className="w-4 h-4 stroke-[1.5]" />
              <span>Cetak Invoice</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="wc-card p-6 sm:p-8 print-container space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <BritLogo size={36} showText={true} />
          </div>
          <div className="flex items-center gap-3">
            <PlateChip plate={inv.plate_current} size="lg" />
            <StatusBadge status={inv.status} kind="invoice" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[14px] leading-5">
          <div className="space-y-1">
            <div className="text-[12px] leading-4 text-[var(--text-muted)]">Pelanggan</div>
            <div className="font-semibold text-[var(--text)]">{inv.customer_name}</div>
            <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              {inv.customer_phone}
            </div>
          </div>
          <div className="space-y-1 sm:text-right">
            <div className="text-[12px] leading-4 text-[var(--text-muted)]">Kendaraan & Work Order</div>
            <div className="font-semibold text-[var(--text)]">
              {inv.brand} {inv.model} ({inv.year})
            </div>
            <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
              {inv.wo_number} · {formatDateTimeId(inv.issued_at)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-[var(--border)] rounded-[8px]">
          <table className="wc-table">
            <thead>
              <tr>
                <th>Tipe</th>
                <th>Deskripsi</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Harga Satuan</th>
                <th className="text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {inv.items?.map((it: any) => (
                <tr key={it.id}>
                  <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                    {it.item_type}
                  </td>
                  <td className="font-medium text-[var(--text)]">{it.description}</td>
                  <td className="text-right font-mono tabular-nums">{it.qty}</td>
                  <td className="text-right font-mono tabular-nums whitespace-nowrap">
                    {formatRupiah(it.unit_price)}
                  </td>
                  <td className="text-right font-mono font-medium tabular-nums whitespace-nowrap">
                    {formatRupiah(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-2">
          <div className="space-y-1 text-[12px] leading-4 text-[var(--text-muted)]">
            {inv.warranties?.length > 0 && (
              <>
                <div className="font-semibold text-[var(--text)]">Garansi aktif:</div>
                {inv.warranties.map((w: any) => (
                  <div key={w.id}>
                    {w.job_name} ({w.component_key}) s/d {formatDateId(w.end_date)}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="space-y-2 text-[14px] leading-5 ml-auto w-full max-w-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Subtotal jasa</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.subtotal_labor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Subtotal part</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.subtotal_parts)}</span>
            </div>
            {inv.discount > 0 && (
              <div className="flex justify-between text-[var(--danger)]">
                <span>Diskon</span>
                <span className="font-mono tabular-nums">-{formatRupiah(inv.discount)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-[var(--border)] flex justify-between text-[16px] leading-6 font-semibold">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.total)}</span>
            </div>
            <div className="flex justify-between text-[var(--success)] font-medium">
              <span>Dibayar</span>
              <span className="font-mono tabular-nums">{formatRupiah(totalPaid)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Catat Pembayaran">
        <form
          onSubmit={e => {
            e.preventDefault();
            payMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Metode *
            </label>
            <select
              value={payForm.method}
              onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
              className="w-full wc-input"
            >
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Kartu Debit / Kredit">Kartu Debit / Kredit</option>
              <option value="QRIS">QRIS</option>
              <option value="Tunai">Tunai</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Nominal (Rp) *
            </label>
            <input
              type="number"
              required
              min={1}
              value={payForm.amount}
              onChange={e => setPayForm(f => ({ ...f, amount: Number(e.target.value) }))}
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPayOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={payMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const ComplaintsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    vehicleId: 1,
    description: 'Kompresor AC kembali berdengung dan kurang dingin',
    prevComponentKey: 'KOMPRESOR_AC',
    faultyComponentKey: 'KOMPRESOR_AC',
    serviceDate: '2026-09-05',
    warrantyDays: 90,
  });

  const {
    data: complaints = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['complaints'],
    queryFn: () => apiFetch('/complaints'),
  });

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['vehicles', 'ALL'],
    queryFn: () => apiFetch('/vehicles/search?q='),
  });

  const { data: jobTypes = [] } = useQuery<any[]>({
    queryKey: ['job-types'],
    queryFn: () => apiFetch('/job-types'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/complaints', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (res: any) => {
      showToast(`Komplain disimpan (${res.type})`, 'success');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const createWoMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/complaints/${id}/create-wo`, { method: 'POST' }),
    onSuccess: (wo: any) => {
      showToast(`WO Garansi ${wo.wo_number} dibuat`, 'success');
      navigate(`/work-orders/${wo.id}`);
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canManage = user?.role === 'SA' || user?.role === 'AD';

  return (
    <PageLayout
      title="Klaim Garansi"
      primaryAction={
        canManage ? (
          <button type="button" onClick={() => setModalOpen(true)} className="wc-btn-primary">
            <Plus className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Catat Komplain</span>
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          message="Belum ada klaim garansi atau komplain."
          actionLabel={canManage ? 'Catat Komplain' : undefined}
          onAction={canManage ? () => setModalOpen(true) : undefined}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {complaints.map((c: any) => (
              <div
                key={c.id}
                className="p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 hover:bg-[var(--bg)]"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <PlateChip plate={c.plate_current} />
                    <span className="text-[14px] leading-5 font-semibold text-[var(--text)]">
                      {c.brand} {c.model} · {c.customer_name}
                    </span>
                    <StatusBadge status={c.type} kind="warranty" />
                  </div>
                  <div className="text-[14px] leading-5 text-[var(--text)]">{c.description}</div>
                  <div className="text-[12px] leading-4 text-[var(--text-muted)]">
                    Komponen: <span className="font-mono">{c.faulty_component_key}</span> · {c.cost_borne}
                  </div>
                </div>

                <div className="shrink-0">
                  {c.work_order_id ? (
                    <Link to={`/work-orders/${c.work_order_id}`} className="wc-btn-secondary">
                      <span>Lihat WO</span>
                      <ChevronRight className="w-4 h-4 stroke-[1.5]" />
                    </Link>
                  ) : (
                    canManage && (
                      <button
                        type="button"
                        onClick={() => createWoMutation.mutate(c.id)}
                        disabled={createWoMutation.isPending}
                        className="wc-btn-primary"
                      >
                        <Wrench className="w-4 h-4 stroke-[1.5]" />
                        <span>Buat WO Garansi</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Catat Komplain">
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Kendaraan *
            </label>
            <select
              value={form.vehicleId}
              onChange={e => setForm(f => ({ ...f, vehicleId: Number(e.target.value) }))}
              className="w-full wc-input"
            >
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.plate_current} — {v.brand} {v.model} ({v.customer_name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Komponen sebelumnya *
              </label>
              <select
                value={form.prevComponentKey}
                onChange={e => setForm(f => ({ ...f, prevComponentKey: e.target.value }))}
                className="w-full wc-input font-mono text-[12px]"
              >
                {jobTypes.map((jt: any) => (
                  <option key={jt.id} value={jt.component_key}>
                    {jt.component_key}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Komponen bermasalah *
              </label>
              <select
                value={form.faultyComponentKey}
                onChange={e => setForm(f => ({ ...f, faultyComponentKey: e.target.value }))}
                className="w-full wc-input font-mono text-[12px]"
              >
                {jobTypes.map((jt: any) => (
                  <option key={jt.id} value={jt.component_key}>
                    {jt.component_key}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Tanggal servis lalu *
              </label>
              <input
                type="date"
                value={form.serviceDate}
                onChange={e => setForm(f => ({ ...f, serviceDate: e.target.value }))}
                className="w-full wc-input font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Masa garansi (hari) *
              </label>
              <input
                type="number"
                value={form.warrantyDays}
                onChange={e => setForm(f => ({ ...f, warrantyDays: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Keluhan *
            </label>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full p-3 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[14px] leading-5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};
