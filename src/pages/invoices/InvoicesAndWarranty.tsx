import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Printer,
  CreditCard,
  ShieldAlert,
  Plus,
  Wrench,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId, formatDateTimeId } from '../../lib/format';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { BritLogo } from '../../components/domain/BritLogo';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ['invoices'],
    queryFn: () => apiFetch('/invoices'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Daftar Invoice & Pembayaran</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          Invoice yang telah terbit menggunakan snapshot harga saat transaksi dan bersifat permanen (tidak dapat dihapus).
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />
      ) : (
        <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                  <th className="py-3 px-4 font-semibold">No. Invoice</th>
                  <th className="py-3 px-4 font-semibold">No. WO</th>
                  <th className="py-3 px-4 font-semibold">Tanggal</th>
                  <th className="py-3 px-4 font-semibold">Kendaraan & Pelanggan</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Tagihan</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {invoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="hover:bg-[var(--navy-50)] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-bold text-[#1f3a5f] dark:text-[#c9a227]">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{inv.wo_number}</td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{formatDateId(inv.issued_at)}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">
                        {inv.plate_current} — {inv.brand} {inv.model}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{inv.customer_name}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                      {formatRupiah(inv.total)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inv.status} kind="invoice" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const invId = Number(id);
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ method: 'Transfer BCA', amount: 0 });

  const { data: inv, isLoading } = useQuery<any>({
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
      showToast('Pembayaran berhasil dicatat', 'success');
      setPayOpen(false);
      queryClient.invalidateQueries({ queryKey: ['invoice', invId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading || !inv) {
    return <div className="h-64 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />;
  }

  const totalPaid = (inv.payments || []).reduce((s: number, p: any) => s + p.amount, 0);
  const remaining = Math.max(0, inv.total - totalPaid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Invoice
        </Link>

        <div className="flex items-center gap-2">
          {(user?.role === 'SA' || user?.role === 'AD') && inv.status !== 'LUNAS' && (
            <button
              onClick={() => {
                setPayForm({ method: 'Transfer BCA', amount: remaining });
                setPayOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#2e8b57] text-white text-xs font-semibold"
            >
              <CreditCard className="w-4 h-4" /> Catat Pembayaran
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
          >
            <Printer className="w-4 h-4" /> Cetak Invoice Resmi (A4)
          </button>
        </div>
      </div>

      {/* Printable A4 Invoice Document */}
      <div className="bg-white text-[#14243b] p-6 sm:p-10 rounded-[10px] border border-[var(--border)] print-container space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-[#14243b] pb-4">
          <div className="flex items-center gap-3.5">
            <BritLogo size={54} showText={false} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">BENGKEL BRIT AUTO</h1>
              <p className="text-xs text-slate-600">
                Spesialis Jaguar · Land Rover · Bentley · Rolls-Royce
              </p>
              <p className="text-xs text-slate-600">
                Jl. RS Fatmawati Raya No. 88, Cilandak, Jakarta Selatan · Telp: 021-7591-8899
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-xs font-bold uppercase text-slate-500">INVOICE RESMI</div>
            <div className="font-mono text-xl font-bold text-[#1f3a5f]">{inv.invoice_number}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              Tanggal Terbit: {formatDateTimeId(inv.issued_at)}
            </div>
            <div className="mt-1">
              <StatusBadge status={inv.status} kind="invoice" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-slate-500 uppercase font-semibold">Ditagihkan Kepada:</div>
            <div className="font-bold text-sm">{inv.customer_name}</div>
            <div>Telp: {inv.customer_phone}</div>
            <div>{inv.customer_address || '-'}</div>
          </div>
          <div className="space-y-1 sm:text-right">
            <div className="text-slate-500 uppercase font-semibold">Detail Kendaraan & Servis:</div>
            <div>
              Nomor Polisi: <strong className="font-mono">{inv.plate_current}</strong>
            </div>
            <div>
              Kendaraan: {inv.brand} {inv.model} ({inv.year})
            </div>
            <div>
              No. Work Order: <strong className="font-mono">{inv.wo_number}</strong> · Odometer:{' '}
              {Number(inv.odometer_in).toLocaleString('id-ID')} km
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 uppercase text-slate-600">
                <th className="border border-slate-300 py-2.5 px-3">Kategori</th>
                <th className="border border-slate-300 py-2.5 px-3">Deskripsi Item (Snapshot Harga)</th>
                <th className="border border-slate-300 py-2.5 px-3 text-right">Qty</th>
                <th className="border border-slate-300 py-2.5 px-3 text-right">Harga Satuan</th>
                <th className="border border-slate-300 py-2.5 px-3 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {inv.items?.map((it: any) => (
                <tr key={it.id}>
                  <td className="border border-slate-300 py-2 px-3 font-mono font-semibold">{it.item_type}</td>
                  <td className="border border-slate-300 py-2 px-3">{it.description}</td>
                  <td className="border border-slate-300 py-2 px-3 text-right font-mono tabular-nums">{it.qty}</td>
                  <td className="border border-slate-300 py-2 px-3 text-right font-mono tabular-nums">
                    {formatRupiah(it.unit_price)}
                  </td>
                  <td className="border border-slate-300 py-2 px-3 text-right font-mono tabular-nums font-semibold">
                    {formatRupiah(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="space-y-2 text-xs">
            {inv.warranties?.length > 0 && (
              <div className="p-3 rounded border border-slate-300 bg-slate-50">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#2e8b57]" /> Jaminan Garansi Servis (BR-09):
                </div>
                <ul className="space-y-0.5">
                  {inv.warranties.map((w: any) => (
                    <li key={w.id}>
                      • {w.job_name} ({w.component_key}): Berlaku s/d <strong>{formatDateId(w.end_date)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs ml-auto w-full max-w-xs">
            <div className="flex justify-between">
              <span>Subtotal Jasa:</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.subtotal_labor)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal Spare Part:</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.subtotal_parts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Biaya Lain-lain:</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.other_cost)}</span>
            </div>
            <div className="flex justify-between text-[#c0392b]">
              <span>Diskon:</span>
              <span className="font-mono tabular-nums">-{formatRupiah(inv.discount)}</span>
            </div>
            <div className="pt-2 border-t-2 border-[#14243b] flex justify-between text-base font-bold">
              <span>Total Tagihan:</span>
              <span className="font-mono tabular-nums">{formatRupiah(inv.total)}</span>
            </div>
            <div className="flex justify-between text-[#2e8b57] font-semibold">
              <span>Telah Dibayar:</span>
              <span className="font-mono tabular-nums">{formatRupiah(totalPaid)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Catat Pembayaran Invoice">
        <form
          onSubmit={e => {
            e.preventDefault();
            payMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Metode Pembayaran</label>
            <select
              value={payForm.method}
              onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Kartu Debit / Kredit">Kartu Debit / Kredit</option>
              <option value="QRIS">QRIS</option>
              <option value="Tunai">Tunai</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nominal Pembayaran (Rp)</label>
            <input
              type="number"
              required
              min={1}
              value={payForm.amount}
              onChange={e => setPayForm(f => ({ ...f, amount: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPayOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={payMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#2e8b57] text-white text-xs font-semibold"
            >
              Simpan Pembayaran
            </button>
          </div>
        </form>
      </Modal>
    </div>
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

  const { data: complaints = [] } = useQuery<any[]>({
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
      showToast(
        `Komplain berhasil diklasifikasikan otomatis sebagai: ${res.type} (${res.cost_borne})`,
        'success'
      );
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const createWoMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/complaints/${id}/create-wo`, { method: 'POST' }),
    onSuccess: (wo: any) => {
      showToast(`Work Order Garansi ${wo.wo_number} berhasil dibuat!`, 'success');
      navigate(`/work-orders/${wo.id}`);
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canManage = user?.role === 'SA' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Klaim Garansi & Penanganan Komplain (BR-09)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Komponen sama dalam masa garansi → Digaransikan penuh (Jasa Rp0, Part Rp0). Komponen berbeda → Part dibayar pelanggan, Jasa gratis.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-semibold hover:bg-[#2c4f7c] self-start"
          >
            <Plus className="w-4 h-4" />
            <span>+ Catat & Klasifikasi Komplain</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {complaints.map((c: any) => (
          <div
            key={c.id}
            className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-sm">{c.plate_current}</span>
                <span className="text-sm font-semibold">
                  {c.brand} {c.model} · {c.customer_name}
                </span>
                <StatusBadge status={c.type} kind="warranty" />
              </div>
              <p className="text-sm text-[var(--text)]">{c.description}</p>
              <div className="text-xs text-[var(--text-muted)]">
                Komponen Sebelumnya: <strong className="font-mono">{c.prev_component_key}</strong> → Komponen Bermasalah:{' '}
                <strong className="font-mono">{c.faulty_component_key}</strong> · Skema Biaya:{' '}
                <strong className="text-[var(--text)]">{c.cost_borne}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {c.work_order_id ? (
                <Link
                  to={`/work-orders/${c.work_order_id}`}
                  className="px-3.5 py-2 rounded-[6px] border border-[var(--border)] text-xs font-semibold hover:bg-[var(--navy-50)]"
                >
                  Lihat {c.wo_number || `WO #${c.work_order_id}`}
                </Link>
              ) : (
                canManage && (
                  <button
                    onClick={() => createWoMutation.mutate(c.id)}
                    disabled={createWoMutation.isPending}
                    className="px-3.5 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold hover:bg-[#2c4f7c] inline-flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" /> Buat WO Garansi
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Komplain & Klasifikasi Otomatis Garansi (BR-09)"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Pilih Kendaraan</label>
            <select
              value={form.vehicleId}
              onChange={e => setForm(f => ({ ...f, vehicleId: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.plate_current} — {v.brand} {v.model} ({v.customer_name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Komponen Servis Sebelumnya</label>
              <select
                value={form.prevComponentKey}
                onChange={e => setForm(f => ({ ...f, prevComponentKey: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-xs font-mono"
              >
                {jobTypes.map((jt: any) => (
                  <option key={jt.id} value={jt.component_key}>
                    {jt.component_key} ({jt.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Komponen Bermasalah Saat Ini</label>
              <select
                value={form.faultyComponentKey}
                onChange={e => setForm(f => ({ ...f, faultyComponentKey: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-xs font-mono"
              >
                {jobTypes.map((jt: any) => (
                  <option key={jt.id} value={jt.component_key}>
                    {jt.component_key} ({jt.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Tanggal Servis Sebelumnya</label>
              <input
                type="date"
                value={form.serviceDate}
                onChange={e => setForm(f => ({ ...f, serviceDate: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Masa Garansi Komponen (Hari)</label>
              <input
                type="number"
                value={form.warrantyDays}
                onChange={e => setForm(f => ({ ...f, warrantyDays: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Deskripsi Keluhan Komplain</label>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full p-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Klasifikasi & Simpan Komplain
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
