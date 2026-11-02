import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  Search,
  ClipboardList,
  ShieldAlert,
  Printer,
  CheckCircle2,
  UserCheck,
  Package,
  FileText,
  XCircle,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId, formatDateTimeId, WO_STATUS_LABELS } from '../../lib/format';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { EmptyState } from '../../components/ui/Modal';
import { BritLogo } from '../../components/domain/BritLogo';

const WO_STEPS = [
  'MENUNGGU_PENUGASAN',
  'DITUGASKAN',
  'DIKERJAKAN',
  'SELESAI_DIKERJAKAN',
  'DIPERIKSA',
  'DITUTUP',
];

export const WorkOrderListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [q, setQ] = useState('');

  const { data: workOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ['work-orders', statusFilter, q],
    queryFn: () =>
      apiFetch(`/work-orders?status=${encodeURIComponent(statusFilter)}&q=${encodeURIComponent(q)}`),
  });

  const canCreate = user?.role === 'SA' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Daftar Work Order (WO)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Alur servis penuh dari penerimaan, penugasan teknisi, clock on/off, part, hingga penutupan & invoice.
          </p>
        </div>
        {canCreate && (
          <Link
            to="/work-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-semibold hover:bg-[#2c4f7c] whitespace-nowrap self-start"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Terima Kendaraan</span>
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari nomor WO, nomor polisi, model, atau nama pelanggan..."
              className="w-full h-10 pl-10 pr-4 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
          >
            <option value="ALL">Semua Status</option>
            {WO_STEPS.map(s => (
              <option key={s} value={s}>
                {WO_STATUS_LABELS[s]}
              </option>
            ))}
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          message="Belum ada work order yang sesuai dengan filter."
          actionLabel={canCreate ? '+ Terima Kendaraan' : undefined}
          onAction={canCreate ? () => navigate('/work-orders/new') : undefined}
        />
      ) : (
        <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                  <th scope="col" className="py-3 px-4 font-semibold">No. WO</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Tanggal Masuk</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Kendaraan</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Pelanggan</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Progres Job</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Total / Estimasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {workOrders.map((wo: any) => (
                  <tr
                    key={wo.id}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="hover:bg-[var(--navy-50)] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-bold text-[#1f3a5f] dark:text-[#c9a227] whitespace-nowrap">
                      {wo.wo_number}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {formatDateTimeId(wo.received_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">{wo.plate_current}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {wo.brand} {wo.model} ({wo.year})
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{wo.customer_name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{wo.technician_names || 'Belum ditugaskan'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      {wo.done_jobs}/{wo.total_jobs} selesai
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={wo.status} kind="wo" />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                      {formatRupiah(wo.estimate_total)}
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

export const WorkOrderNewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const queryClient = useQueryClient();

  const [plateSearch, setPlateSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number>(
    Number(searchParams.get('vehicleId')) || 1
  );
  const [odometerIn, setOdometerIn] = useState<number>(42600);
  const [conditionNote, setConditionNote] = useState('Bodi mulus, BBM 3/4, barang berharga sudah diambil pemilik');
  const [issueText, setIssueText] = useState('Servis berkala dan pengecekan sistem pengereman');
  const [selectedJobs, setSelectedJobs] = useState<string[]>(['SRV_BERKALA']);

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['vehicles', plateSearch],
    queryFn: () => apiFetch(`/vehicles/search?q=${encodeURIComponent(plateSearch)}`),
  });

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];

  useEffect(() => {
    if (selectedVehicle) {
      setSelectedVehicleId(selectedVehicle.id);
      setOdometerIn(selectedVehicle.odometer_last + 150);
    }
  }, [selectedVehicle?.id]);

  // Fetch resolved job rates for selected vehicle's brand & model (BR-08)
  const { data: ratesData } = useQuery<any>({
    queryKey: ['job-rates-resolved', selectedVehicle?.brand, selectedVehicle?.model],
    queryFn: () =>
      apiFetch(
        `/job-rates?brand=${encodeURIComponent(selectedVehicle.brand)}&model=${encodeURIComponent(
          selectedVehicle.model
        )}`
      ),
    enabled: !!selectedVehicle,
  });

  const resolvedJobs: any[] = ratesData?.resolvedForVehicle || [];

  const createWoMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch('/work-orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (created: any) => {
      showToast(`Work Order ${created.wo_number} berhasil dibuat (MENUNGGU_PENUGASAN)`, 'success');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      navigate(`/work-orders/${created.id}`);
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const toggleJob = (id: string) => {
    setSelectedJobs(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const estimatedLabor = resolvedJobs
    .filter(j => selectedJobs.includes(j.id))
    .reduce((sum, j) => sum + (j.rate_applied || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Penerimaan Kendaraan & Buat Work Order</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Tarif jasa dihitung otomatis dari Master Tarif berdasarkan merek & model kendaraan (BR-08).
          </p>
        </div>
        <Link to="/work-orders" className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!selectedVehicle) return;
          createWoMutation.mutate({
            vehicleId: selectedVehicle.id,
            odometerIn,
            conditionNote,
            issues: issueText.split('\n').filter(Boolean),
            jobTypeIds: selectedJobs,
          });
        }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Left Column (5 cols): Vehicle Selection & Customer Info */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-4">
            <h2 className="text-base font-semibold">1. Pilih Kendaraan (Plat Baru / Lama)</h2>

            <div>
              <label className="block text-xs font-medium mb-1">Cari Plat Nomor / Nama Pelanggan</label>
              <input
                type="text"
                value={plateSearch}
                onChange={e => setPlateSearch(e.target.value)}
                placeholder="Ketik plat nomor (contoh: B 128 XL atau B 1234 JAG)..."
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Kendaraan Ditemukan ({vehicles.length})</label>
              <select
                value={selectedVehicle?.id || ''}
                onChange={e => setSelectedVehicleId(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
              >
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_current} — {v.brand} {v.model} ({v.customer_name})
                  </option>
                ))}
              </select>
            </div>

            {selectedVehicle && (
              <div className="p-4 rounded-[8px] bg-[var(--navy-50)] border border-[var(--border)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-[#14243b] text-white font-mono font-bold">
                    {selectedVehicle.plate_current}
                  </span>
                  <span className="font-semibold">
                    {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
                  </span>
                </div>
                {selectedVehicle.plates?.length > 1 && (
                  <div className="text-[#b36b00] font-medium">
                    Riwayat Plat: {selectedVehicle.plates.map((p: any) => p.plate).join(' → ')}
                  </div>
                )}
                <div className="pt-1 border-t border-[var(--border)] space-y-0.5 text-[var(--text-muted)]">
                  <div>
                    Pelanggan: <strong className="text-[var(--text)]">{selectedVehicle.customer_name}</strong>
                  </div>
                  <div>Telepon: {selectedVehicle.customer_phone}</div>
                  <div>
                    Odometer Terakhir:{' '}
                    <strong className="font-mono">{Number(selectedVehicle.odometer_last).toLocaleString('id-ID')} km</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Active Warranty Alert Box (Yellow box per DESIGN.md §5) */}
            {selectedVehicle?.active_warranties?.length > 0 && (
              <div className="p-3.5 rounded-[8px] bg-[#fdf1dc] border border-[#b36b00]/40 text-[#b36b00] text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>PERINGATAN GARANSI AKTIF (BR-09)</span>
                </div>
                <p>
                  Kendaraan ini memiliki garansi aktif untuk komponen:{' '}
                  <strong>
                    {selectedVehicle.active_warranties
                      .map((w: any) => `${w.component_key} (s/d ${formatDateId(w.end_date)})`)
                      .join(', ')}
                  </strong>
                  . Jika servis terkait keluhan berulang pada komponen yang sama, gunakan menu Klaim Garansi.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium mb-1">Odometer Saat Masuk (KM)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={odometerIn}
                  onChange={e => setOdometerIn(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Catatan Kondisi Awal Fisik Kendaraan</label>
                <input
                  type="text"
                  value={conditionNote}
                  onChange={e => setConditionNote(e.target.value)}
                  className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Keluhan Pelanggan (1 baris per keluhan)</label>
                <textarea
                  rows={3}
                  required
                  value={issueText}
                  onChange={e => setIssueText(e.target.value)}
                  className="w-full p-3 rounded-[6px] border border-[var(--border)] text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Job Selection & Auto Rate Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                2. Pilih Jenis Pekerjaan ({selectedVehicle?.brand} {selectedVehicle?.model})
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{selectedJobs.length} dipilih</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {resolvedJobs.map(jt => {
                const checked = selectedJobs.includes(jt.id);
                return (
                  <label
                    key={jt.id}
                    className={`p-3 rounded-[8px] border cursor-pointer flex items-start gap-3 transition-colors ${
                      checked
                        ? 'border-[#1f3a5f] bg-[var(--navy-50)]'
                        : 'border-[var(--border)] hover:bg-[var(--navy-50)]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleJob(jt.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-semibold text-[var(--text)]">{jt.name}</div>
                      <div className="text-[var(--text-muted)] mt-0.5">
                        {jt.category} · Standar {jt.standard_minutes} mnt · Garansi {jt.warranty_days} hr
                      </div>
                      <div className="font-mono font-bold text-[#1f3a5f] dark:text-[#c9a227] mt-1 tabular-nums">
                        {formatRupiah(jt.rate_applied)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Estimasi Biaya Jasa (Snapshot BR-08)</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text)]">
                  {formatRupiah(estimatedLabor)}
                </div>
              </div>
              <button
                type="submit"
                disabled={createWoMutation.isPending || selectedJobs.length === 0}
                className="px-6 py-3 rounded-[6px] bg-[#1f3a5f] hover:bg-[#2c4f7c] text-white font-semibold text-sm disabled:opacity-50"
              >
                {createWoMutation.isPending ? 'Menyimpan Work Order...' : 'Terbitkan Work Order'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export const WorkOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const woId = Number(id);
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'jobs' | 'parts' | 'close' | 'print'>('jobs');
  const [assignMap, setAssignMap] = useState<Record<number, number>>({});
  const [partForm, setPartForm] = useState({ partId: 1, qty: 1, woJobId: 0 });
  const [noPartsRequired, setNoPartsRequired] = useState(false);
  const [closeForm, setCloseForm] = useState({ otherCost: 0, otherDescription: '', discount: 0 });

  const { data: wo, isLoading } = useQuery<any>({
    queryKey: ['work-order', woId],
    queryFn: () => apiFetch(`/work-orders/${woId}`),
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['technicians'],
    queryFn: () => apiFetch('/users?role=TK'),
  });

  const { data: allParts = [] } = useQuery<any[]>({
    queryKey: ['parts'],
    queryFn: () => apiFetch('/parts'),
  });

  useEffect(() => {
    if (wo) {
      setNoPartsRequired(Boolean(wo.no_parts_required));
      const initialAssign: Record<number, number> = {};
      for (const j of wo.jobs || []) {
        if (j.technician_id) initialAssign[j.id] = j.technician_id;
        else if (technicians[0]) initialAssign[j.id] = technicians[0].id;
      }
      setAssignMap(initialAssign);
    }
  }, [wo?.id, technicians.length]);

  const assignMutation = useMutation({
    mutationFn: () => {
      const assignments = Object.entries(assignMap).map(([woJobId, technicianId]) => ({
        woJobId: Number(woJobId),
        technicianId: Number(technicianId),
      }));
      return apiFetch(`/work-orders/${woId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ assignments }),
      });
    },
    onSuccess: () => {
      showToast('Penugasan teknisi berhasil disimpan', 'success');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const issuePartMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/work-orders/${woId}/parts`, {
        method: 'POST',
        body: JSON.stringify({
          partId: Number(partForm.partId),
          qty: Number(partForm.qty),
          woJobId: partForm.woJobId ? Number(partForm.woJobId) : null,
        }),
      }),
    onSuccess: (res: any) => {
      showToast(
        res.isLowStock
          ? 'Spare part dikeluarkan ke WO — PERINGATAN: Stok mencapai batas minimum (BR-05)!'
          : 'Spare part berhasil dikeluarkan ke WO (BR-04)',
        res.isLowStock ? 'info' : 'success'
      );
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const returnPartMutation = useMutation({
    mutationFn: ({ woPartId, qty }: { woPartId: number; qty: number }) =>
      apiFetch(`/wo-parts/${woPartId}/return`, {
        method: 'POST',
        body: JSON.stringify({ qty }),
      }),
    onSuccess: () => {
      showToast('Retur spare part berhasil mengembalikan stok', 'success');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/work-orders/${woId}/review`, {
        method: 'POST',
        body: JSON.stringify({ noPartsRequired }),
      }),
    onSuccess: () => {
      showToast('Work Order ditandai DIPERIKSA oleh Service Advisor', 'success');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/work-orders/${woId}/close`, {
        method: 'POST',
        body: JSON.stringify({
          ...closeForm,
          noPartsRequired,
        }),
      }),
    onSuccess: (updated: any) => {
      showToast('Work Order DITUTUP & Invoice resmi berhasil diterbitkan!', 'success');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
      if (updated.invoice?.id) {
        navigate(`/invoices/${updated.invoice.id}`);
      }
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/work-orders/${woId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Dibatalkan atas permintaan pelanggan' }),
      }),
    onSuccess: () => {
      showToast('Work Order dibatalkan', 'info');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading || !wo) {
    return <div className="h-64 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />;
  }

  const laborTotal = (wo.jobs || []).reduce((s: number, j: any) => s + j.rate_applied, 0);
  const partsTotal = (wo.parts || []).reduce((s: number, p: any) => s + (p.qty - p.returned_qty) * p.unit_price, 0);
  const grandPreview = Math.max(0, laborTotal + partsTotal + Number(closeForm.otherCost || 0) - Number(closeForm.discount || 0));

  const currentStepIndex = WO_STEPS.indexOf(wo.status);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-4 no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-lg sm:text-xl font-bold text-[#1f3a5f] dark:text-[#c9a227]">
                {wo.wo_number}
              </span>
              <StatusBadge status={wo.status} kind="wo" />
              {wo.is_warranty_wo ? (
                <span className="px-2 py-0.5 rounded bg-[#e4f4ec] text-[#2e8b57] text-xs font-semibold">
                  WO Klaim Garansi
                </span>
              ) : null}
            </div>
            <div className="text-sm font-medium mt-1">
              <span className="font-mono font-bold">{wo.plate_current}</span> · {wo.brand} {wo.model} ({wo.year}) · Pemilik:{' '}
              <strong>{wo.customer_name}</strong> ({wo.customer_phone})
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Diterima: {formatDateTimeId(wo.received_at)} · Odometer Masuk:{' '}
              <span className="font-mono">{Number(wo.odometer_in).toLocaleString('id-ID')} km</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {wo.invoice && (
              <Link
                to={`/invoices/${wo.invoice.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[#2e8b57] text-white text-xs font-semibold"
              >
                <FileText className="w-4 h-4" />
                <span>Lihat Invoice ({wo.invoice.invoice_number})</span>
              </Link>
            )}
            <button
              onClick={() => {
                setActiveTab('print');
                setTimeout(() => window.print(), 150);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] border border-[var(--border)] hover:bg-[var(--navy-50)] text-xs font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Tanda Terima / Job Card</span>
            </button>
          </div>
        </div>

        {/* 6-Step Status Stepper */}
        {wo.status !== 'DIBATALKAN' && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-[var(--border)]">
            {WO_STEPS.map((step, idx) => {
              const done = idx <= currentStepIndex;
              return (
                <div
                  key={step}
                  className={`px-2.5 py-2 rounded-[6px] text-xs font-medium flex items-center gap-1.5 ${
                    done
                      ? 'bg-[#1f3a5f] text-white'
                      : 'bg-[var(--navy-50)] text-[var(--text-muted)]'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{WO_STATUS_LABELS[step]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] w-fit no-print">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 rounded-[6px] text-xs font-semibold transition-colors ${
            activeTab === 'jobs' ? 'bg-[#1f3a5f] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          1. Pekerjaan & Penugasan ({wo.jobs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('parts')}
          className={`px-4 py-2 rounded-[6px] text-xs font-semibold transition-colors ${
            activeTab === 'parts' ? 'bg-[#1f3a5f] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          2. Pemakaian Spare Part ({wo.parts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('close')}
          className={`px-4 py-2 rounded-[6px] text-xs font-semibold transition-colors ${
            activeTab === 'close' ? 'bg-[#1f3a5f] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          3. Pemeriksaan SA & Penutupan WO (BR-12)
        </button>
        <button
          onClick={() => setActiveTab('print')}
          className={`px-4 py-2 rounded-[6px] text-xs font-semibold transition-colors ${
            activeTab === 'print' ? 'bg-[#1f3a5f] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          4. Pratinjau Cetak (A4)
        </button>
      </div>

      {/* TAB 1: JOBS & ASSIGNMENT */}
      {activeTab === 'jobs' && (
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Daftar Pekerjaan & Teknisi (BR-02)</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Keluhan: {wo.issues?.map((i: any) => i.description).join('; ') || '-'}
              </p>
            </div>
            {(user?.role === 'KR' || user?.role === 'AD') && wo.status !== 'DITUTUP' && (
              <button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold hover:bg-[#2c4f7c]"
              >
                <UserCheck className="w-4 h-4" />
                <span>Simpan Penugasan Teknisi</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                  <th scope="col" className="py-3 px-4 font-semibold">Pekerjaan</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Standar</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Teknisi Ditugaskan</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Status Job</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Tarif Jasa (Snapshot)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {wo.jobs?.map((j: any) => (
                  <tr key={j.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold">{j.job_name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Komponen: {j.component_key} · Garansi {j.warranty_days} hari
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">{j.standard_minutes} mnt</td>
                    <td className="py-3 px-4">
                      {user?.role === 'KR' || user?.role === 'AD' ? (
                        <select
                          value={assignMap[j.id] || ''}
                          onChange={e =>
                            setAssignMap(prev => ({ ...prev, [j.id]: Number(e.target.value) }))
                          }
                          className="h-9 px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium"
                        >
                          <option value="">-- Pilih Teknisi --</option>
                          {technicians.map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-medium">{j.technician_name || 'Belum ditugaskan'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={j.status} kind="job" />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatRupiah(j.rate_applied)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SPARE PARTS USAGE (BR-03, BR-04, BR-05) */}
      {activeTab === 'parts' && (
        <div className="space-y-4 no-print">
          {(user?.role === 'SP' || user?.role === 'AD') && wo.status !== 'DITUTUP' && wo.status !== 'DIBATALKAN' && (
            <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-4">
              <h2 className="text-base font-semibold">Input Pengeluaran Spare Part ke Work Order (BR-04)</h2>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  issuePartMutation.mutate();
                }}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Pilih Spare Part</label>
                  <select
                    value={partForm.partId}
                    onChange={e => setPartForm(f => ({ ...f, partId: Number(e.target.value) }))}
                    className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-xs"
                  >
                    {allParts.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name} (Stok: {p.stock_qty} {p.unit} · {formatRupiah(p.sell_price)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Jumlah (Qty)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={partForm.qty}
                    onChange={e => setPartForm(f => ({ ...f, qty: Number(e.target.value) }))}
                    className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  disabled={issuePartMutation.isPending}
                  className="h-10 px-4 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold hover:bg-[#2c4f7c] inline-flex items-center justify-center gap-1.5"
                >
                  <Package className="w-4 h-4" />
                  <span>Keluarkan Part</span>
                </button>
              </form>
            </div>
          )}

          <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold">Daftar Spare Part Tercatat pada WO Ini</h3>
              <span className="font-mono text-xs font-bold tabular-nums">
                Subtotal Part: {formatRupiah(partsTotal)}
              </span>
            </div>
            {wo.parts?.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                Belum ada pemakaian spare part yang dicatat pada Work Order ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                      <th scope="col" className="py-3 px-4 font-semibold">Kode & Nama Part</th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right">Qty Keluar</th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right">Retur</th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right">Harga Satuan</th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right">Subtotal</th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-sm">
                    {wo.parts.map((p: any) => {
                      const netQty = p.qty - p.returned_qty;
                      return (
                        <tr key={p.id}>
                          <td className="py-3 px-4">
                            <div className="font-medium">{p.part_name}</div>
                            <div className="text-xs text-[var(--text-muted)] font-mono">{p.part_code}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{p.qty}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#b36b00]">
                            {p.returned_qty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{formatRupiah(p.unit_price)}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            {formatRupiah(netQty * p.unit_price)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {(user?.role === 'SP' || user?.role === 'AD') &&
                              netQty > 0 &&
                              wo.status !== 'DITUTUP' && (
                                <button
                                  onClick={() => returnPartMutation.mutate({ woPartId: p.id, qty: 1 })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--navy-50)]"
                                >
                                  <RotateCcw className="w-3 h-3" /> Retur 1
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REVIEW & CLOSE WO (BR-12) */}
      {activeTab === 'close' && (
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-5 no-print">
          <div>
            <h2 className="text-base font-semibold">Pemeriksaan Service Advisor & Penutupan Work Order (BR-12)</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Work Order hanya dapat ditutup apabila: (1) Semua pekerjaan berstatus SELESAI, (2) Pemakaian part sudah tercatat atau dicentang Tanpa Part, dan (3) Sudah diperiksa Service Advisor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-[8px] border border-[var(--border)] bg-[var(--navy-50)]/40">
              <div className="font-semibold">Syarat 1: Semua Pekerjaan Selesai</div>
              <div className="mt-1 font-mono">
                {wo.jobs?.every((j: any) => j.status === 'SELESAI') ? (
                  <span className="text-[#2e8b57] font-bold">✓ Terpenuhi ({wo.jobs.length} selesai)</span>
                ) : (
                  <span className="text-[#c0392b] font-bold">✗ Masih ada pekerjaan belum selesai</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-[8px] border border-[var(--border)] bg-[var(--navy-50)]/40">
              <div className="font-semibold">Syarat 2: Pencatatan Spare Part</div>
              <div className="mt-1">
                {wo.parts?.length > 0 || noPartsRequired ? (
                  <span className="text-[#2e8b57] font-bold">
                    ✓ Terpenuhi ({wo.parts?.length > 0 ? `${wo.parts.length} item part` : 'Tanpa part'})
                  </span>
                ) : (
                  <span className="text-[#c0392b] font-bold">✗ Belum ada part tercatat</span>
                )}
              </div>
              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noPartsRequired}
                  onChange={e => setNoPartsRequired(e.target.checked)}
                />
                <span>WO ini memang tidak membutuhkan spare part</span>
              </label>
            </div>

            <div className="p-3.5 rounded-[8px] border border-[var(--border)] bg-[var(--navy-50)]/40">
              <div className="font-semibold">Syarat 3: Pemeriksaan Akhir SA</div>
              <div className="mt-1">
                {wo.status === 'DIPERIKSA' || wo.status === 'DITUTUP' ? (
                  <span className="text-[#2e8b57] font-bold">✓ Sudah Diperiksa SA ({wo.reviewed_by_name || 'SA'})</span>
                ) : (
                  <span className="text-[#b36b00] font-bold">Menunggu klik "Tandai Sudah Diperiksa SA"</span>
                )}
              </div>
            </div>
          </div>

          {(user?.role === 'SA' || user?.role === 'AD') && wo.status !== 'DITUTUP' && wo.status !== 'DIBATALKAN' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-[var(--border)]">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Biaya Tambahan & Diskon Invoice</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Biaya Lain-lain (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={closeForm.otherCost}
                      onChange={e => setCloseForm(f => ({ ...f, otherCost: Number(e.target.value) }))}
                      className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Diskon (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={closeForm.discount}
                      onChange={e => setCloseForm(f => ({ ...f, discount: Number(e.target.value) }))}
                      className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Keterangan Biaya Lain</label>
                  <input
                    type="text"
                    value={closeForm.otherDescription}
                    onChange={e => setCloseForm(f => ({ ...f, otherDescription: e.target.value }))}
                    placeholder="Misal: Consumable & Pengecekan Diagnostik"
                    className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
                  />
                </div>
              </div>

              <div className="p-4 rounded-[8px] bg-[var(--navy-50)] border border-[var(--border)] flex flex-col justify-between space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal Jasa:</span>
                    <span className="font-mono tabular-nums">{formatRupiah(laborTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal Spare Part:</span>
                    <span className="font-mono tabular-nums">{formatRupiah(partsTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Lain-lain:</span>
                    <span className="font-mono tabular-nums">{formatRupiah(closeForm.otherCost)}</span>
                  </div>
                  <div className="flex justify-between text-[#c0392b]">
                    <span>Diskon:</span>
                    <span className="font-mono tabular-nums">-{formatRupiah(closeForm.discount)}</span>
                  </div>
                  <div className="pt-2 border-t border-[var(--border)] flex justify-between text-base font-bold">
                    <span>Total Invoice:</span>
                    <span className="font-mono tabular-nums">{formatRupiah(grandPreview)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {wo.status === 'SELESAI_DIKERJAKAN' && (
                    <button
                      type="button"
                      onClick={() => reviewMutation.mutate()}
                      disabled={reviewMutation.isPending}
                      className="px-4 py-2.5 rounded-[6px] bg-[#1f6fb2] text-white text-xs font-semibold hover:opacity-95 inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>1. Tandai Sudah Diperiksa SA</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                    className="px-4 py-2.5 rounded-[6px] bg-[#2e8b57] text-white text-xs font-semibold hover:opacity-95 inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>2. Tutup WO & Terbitkan Invoice</span>
                  </button>

                  {wo.status !== 'DIPERIKSA' && (
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate()}
                      className="ml-auto px-3 py-2 rounded-[6px] bg-[#fbe7e4] text-[#c0392b] text-xs font-medium inline-flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Batalkan WO
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRINTABLE JOB CARD & RECEIPT (A4) */}
      {activeTab === 'print' && (
        <div className="bg-white text-[#14243b] p-8 rounded-[10px] border border-[var(--border)] print-container space-y-6">
          <div className="flex items-start justify-between border-b-2 border-[#14243b] pb-4">
            <div className="flex items-center gap-3">
              <BritLogo size={48} showText={false} />
              <div>
                <h2 className="text-xl font-bold">BENGKEL BRIT AUTO</h2>
                <p className="text-xs text-slate-600">
                  Spesialis Jaguar · Land Rover · Bentley · Rolls-Royce
                </p>
                <p className="text-xs text-slate-600">
                  Jl. RS Fatmawati Raya No. 88, Cilandak, Jakarta Selatan · Telp: 021-7591-8899
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase text-slate-500">Tanda Terima & Job Card</div>
              <div className="font-mono text-lg font-bold">{wo.wo_number}</div>
              <div className="text-xs text-slate-600">{formatDateTimeId(wo.received_at)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <div><strong>Pelanggan:</strong> {wo.customer_name}</div>
              <div><strong>Telepon:</strong> {wo.customer_phone}</div>
              <div><strong>Kondisi Fisik Masuk:</strong> {wo.condition_note || '-'}</div>
            </div>
            <div className="space-y-1">
              <div><strong>Nomor Polisi:</strong> <span className="font-mono font-bold">{wo.plate_current}</span></div>
              <div><strong>Kendaraan:</strong> {wo.brand} {wo.model} ({wo.year})</div>
              <div><strong>Odometer Masuk:</strong> {Number(wo.odometer_in).toLocaleString('id-ID')} km</div>
            </div>
          </div>

          <div className="text-xs">
            <strong>Keluhan Pelanggan:</strong>
            <ul className="list-disc list-inside mt-1">
              {wo.issues?.map((i: any) => (
                <li key={i.id}>{i.description}</li>
              ))}
            </ul>
          </div>

          <table className="w-full text-left border-collapse text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 py-2 px-3">Pekerjaan (Job Card)</th>
                <th className="border border-slate-300 py-2 px-3">Teknisi</th>
                <th className="border border-slate-300 py-2 px-3 text-right">Standar (Mnt)</th>
                <th className="border border-slate-300 py-2 px-3">Status</th>
                <th className="border border-slate-300 py-2 px-3 text-right">Estimasi Jasa</th>
              </tr>
            </thead>
            <tbody>
              {wo.jobs?.map((j: any) => (
                <tr key={j.id}>
                  <td className="border border-slate-300 py-2 px-3 font-medium">{j.job_name}</td>
                  <td className="border border-slate-300 py-2 px-3">{j.technician_name || '-'}</td>
                  <td className="border border-slate-300 py-2 px-3 text-right font-mono">{j.standard_minutes}</td>
                  <td className="border border-slate-300 py-2 px-3">{j.status}</td>
                  <td className="border border-slate-300 py-2 px-3 text-right font-mono">{formatRupiah(j.rate_applied)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-8 pt-8 text-center text-xs">
            <div>
              <div className="mb-14">Pelanggan</div>
              <div className="border-t border-slate-400 pt-1">({wo.customer_name})</div>
            </div>
            <div>
              <div className="mb-14">Service Advisor</div>
              <div className="border-t border-slate-400 pt-1">({wo.created_by_name || 'Service Advisor'})</div>
            </div>
            <div>
              <div className="mb-14">Kepala Regu / Teknisi</div>
              <div className="border-t border-slate-400 pt-1">(Bengkel Brit Auto)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
