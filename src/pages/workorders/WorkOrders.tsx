import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  ClipboardList,
  ShieldAlert,
  Printer,
  Check,
  UserCheck,
  Package,
  FileText,
  XCircle,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId, formatDateTimeId, WO_STATUS_LABELS } from '../../lib/format';
import { StatusBadge, PlateChip } from '../../components/domain/StatusBadge';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  EmptyState,
  FilterChip,
  TableSkeleton,
  ErrorCard,
  PaginationBar,
  ConfirmModal,
} from '../../components/ui/Modal';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get('status') || 'ALL';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
  }, [searchParams]);

  const {
    data: workOrders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['work-orders', statusFilter, q],
    queryFn: () =>
      apiFetch(`/work-orders?status=${encodeURIComponent(statusFilter)}&q=${encodeURIComponent(q)}`),
  });

  const canCreate = user?.role === 'SA' || user?.role === 'AD';
  const canSeeFinancials = user?.role === 'PM' || user?.role === 'AD' || user?.role === 'SA';

  const pageSize = 20;
  const pagedWorkOrders = workOrders.slice((page - 1) * pageSize, page * pageSize);

  const handleStatusChange = (s: string) => {
    setStatusFilter(s);
    setPage(1);
    const next: Record<string, string> = {};
    if (s !== 'ALL') next.status = s;
    if (q) next.q = q;
    setSearchParams(next);
  };

  return (
    <PageLayout
      title="Work Order"
      primaryAction={
        canCreate ? (
          <button type="button" onClick={() => navigate('/work-orders/new')} className="wc-btn-primary">
            <Plus className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Terima Kendaraan</span>
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
              placeholder="Cari plat, nomor WO, pelanggan..."
              className="w-full wc-input pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={statusFilter === 'ALL'} onClick={() => handleStatusChange('ALL')}>
              Semua
            </FilterChip>
            {WO_STEPS.map(s => (
              <FilterChip key={s} active={statusFilter === s} onClick={() => handleStatusChange(s)}>
                {WO_STATUS_LABELS[s]}
              </FilterChip>
            ))}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          message="Tidak ada Work Order yang cocok dengan filter."
          actionLabel={canCreate ? 'Terima Kendaraan' : undefined}
          onAction={canCreate ? () => navigate('/work-orders/new') : undefined}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          {/* Desktop Table: maks 6 kolom, kolom pertama = identitas (chip plat + model kecil di bawahnya) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Kendaraan</th>
                  <th>No. WO</th>
                  <th>Pelanggan</th>
                  <th>Status</th>
                  {canSeeFinancials && <th className="text-right">Estimasi</th>}
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pagedWorkOrders.map((wo: any) => (
                  <tr
                    key={wo.id}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <PlateChip plate={wo.plate_current} />
                        <span className="text-[12px] leading-4 text-[var(--text-muted)]">
                          {wo.brand} {wo.model} ({wo.year})
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-[14px] leading-5 text-[var(--text)] tabular-nums">
                      {wo.wo_number}
                    </td>
                    <td>
                      <div className="text-[14px] leading-5 text-[var(--text)]">{wo.customer_name}</div>
                      <div className="text-[12px] leading-4 text-[var(--text-muted)]">
                        {wo.technician_names || 'Belum ditugaskan'}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
                    </td>
                    {canSeeFinancials && (
                      <td className="text-right font-mono text-[14px] leading-5 font-medium tabular-nums whitespace-nowrap">
                        {formatRupiah(wo.estimate_total)}
                      </td>
                    )}
                    <td className="text-right">
                      <span className="wc-row-action inline-flex items-center gap-1 text-[12px] leading-4 font-medium text-[var(--primary)]">
                        <span>Detail</span>
                        <ChevronRight className="w-4 h-4 stroke-[1.5]" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tiap baris jadi kartu 2 baris (atas: chip plat + status; bawah: model + info utama) */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {pagedWorkOrders.map((wo: any) => (
              <div
                key={wo.id}
                onClick={() => navigate(`/work-orders/${wo.id}`)}
                className="p-4 space-y-2 hover:bg-[var(--bg)] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <PlateChip plate={wo.plate_current} />
                  <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
                </div>
                <div className="flex items-center justify-between gap-2 text-[14px] leading-5">
                  <span className="text-[var(--text)] truncate">
                    {wo.brand} {wo.model} · {wo.customer_name}
                  </span>
                  <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] shrink-0">
                    {wo.wo_number}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={workOrders.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </PageLayout>
  );
};

/**
 * "Terima Kendaraan" = wizard 3 langkah (Kendaraan -> Keluhan -> Pekerjaan)
 * dengan indikator "1 dari 3", autofocus ke plat, pencarian plat muncul otomatis.
 * Satu langkah = maks 4-5 field terlihat. Bilah aksi sticky bawah [Batal] [Simpan].
 */
export const WorkOrderNewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const queryClient = useQueryClient();
  const plateInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plateSearch, setPlateSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number>(
    Number(searchParams.get('vehicleId')) || 1
  );
  const [odometerIn, setOdometerIn] = useState<number>(42600);
  const [conditionNote, setConditionNote] = useState('Bodi mulus, BBM 3/4');
  const [issueText, setIssueText] = useState('Servis berkala dan pengecekan pengereman');
  const [selectedJobs, setSelectedJobs] = useState<string[]>(['SRV_BERKALA']);

  useEffect(() => {
    if (step === 1) {
      plateInputRef.current?.focus();
    }
  }, [step]);

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
      showToast(`Work Order ${created.wo_number} disimpan`, 'success');
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

  const handlePrimaryStepAction = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!issueText.trim()) {
        showToast('Keluhan pelanggan wajib diisi', 'error');
        return;
      }
      setStep(3);
      return;
    }
    if (!selectedVehicle || selectedJobs.length === 0) return;
    createWoMutation.mutate({
      vehicleId: selectedVehicle.id,
      odometerIn,
      conditionNote,
      issues: issueText.split('\n').filter(Boolean),
      jobTypeIds: selectedJobs,
    });
  };

  return (
    <PageLayout
      title="Terima Kendaraan"
      subtitle={`Langkah ${step} dari 3 — ${
        step === 1 ? 'Kendaraan' : step === 2 ? 'Keluhan' : 'Pekerjaan'
      }`}
      stickyFooter={
        <>
          <button
            type="button"
            onClick={() => {
              if (step === 1) navigate('/work-orders');
              else setStep((step - 1) as 1 | 2);
            }}
            className="wc-btn-secondary"
          >
            {step === 1 ? 'Batal' : 'Sebelumnya'}
          </button>
          <button
            type="button"
            onClick={handlePrimaryStepAction}
            disabled={createWoMutation.isPending || (step === 3 && selectedJobs.length === 0)}
            className="wc-btn-primary"
          >
            <span>
              {step < 3
                ? 'Lanjut'
                : createWoMutation.isPending
                ? 'Menyimpan...'
                : 'Terima Kendaraan'}
            </span>
          </button>
        </>
      }
    >
      <div className="max-w-2xl space-y-6">
        {/* Stepper 3 langkah */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, label: '1. Kendaraan' },
            { num: 2, label: '2. Keluhan' },
            { num: 3, label: '3. Pekerjaan' },
          ].map(s => {
            const active = step === s.num;
            const passed = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num as 1 | 2 | 3)}
                className={`h-10 px-3 rounded-[8px] border text-left text-[14px] leading-5 font-medium flex items-center justify-between cursor-pointer ${
                  active
                    ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)] border-b-[3px] border-b-[#C9A227]'
                    : passed
                    ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--success)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
                }`}
              >
                <span>{s.label}</span>
                {passed && <Check className="w-4 h-4 stroke-[1.5]" />}
              </button>
            );
          })}
        </div>

        {/* LANGKAH 1: KENDARAAN (maks 4 field) */}
        {step === 1 && (
          <div className="wc-card space-y-4">
            <h2 className="text-h3">Identitas Kendaraan</h2>

            <div>
              <label htmlFor="penerimaan-cari" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Cari plat nomor / pelanggan
              </label>
              <div className="relative">
                <Search className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={plateInputRef}
                  id="penerimaan-cari"
                  type="search"
                  value={plateSearch}
                  onChange={e => setPlateSearch(e.target.value)}
                  placeholder="Ketik plat lama/baru (mis: B 128 XL)..."
                  className="w-full wc-input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="penerimaan-pilih" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Kendaraan terdaftar *
              </label>
              <select
                id="penerimaan-pilih"
                value={selectedVehicle?.id || ''}
                onChange={e => setSelectedVehicleId(Number(e.target.value))}
                className="w-full wc-input font-medium"
              >
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_current} — {v.brand} {v.model} ({v.customer_name})
                  </option>
                ))}
              </select>
            </div>

            {selectedVehicle && (
              <div className="wc-tile flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PlateChip plate={selectedVehicle.plate_current} />
                  <div>
                    <div className="text-[14px] leading-5 font-semibold text-[var(--text)]">
                      {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
                    </div>
                    <div className="text-[12px] leading-4 text-[var(--text-muted)]">
                      {selectedVehicle.customer_name} · Odometer terakhir {Number(selectedVehicle.odometer_last).toLocaleString('id-ID')} km
                    </div>
                  </div>
                </div>
                {selectedVehicle.active_warranties?.length > 0 && (
                  <StatusBadge status="GARANSI" kind="warranty" />
                )}
              </div>
            )}

            <div>
              <label htmlFor="wo-odo" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Odometer masuk (km) *
              </label>
              <input
                id="wo-odo"
                type="number"
                required
                min={0}
                value={odometerIn}
                onChange={e => setOdometerIn(Number(e.target.value))}
                className="w-full wc-input font-mono tabular-nums"
              />
              {selectedVehicle && odometerIn < selectedVehicle.odometer_last && (
                <p role="alert" className="mt-1.5 text-[12px] leading-4 text-[var(--warning)]">
                  Odometer lebih rendah dari catatan terakhir ({Number(selectedVehicle.odometer_last).toLocaleString('id-ID')} km).
                </p>
              )}
            </div>
          </div>
        )}

        {/* LANGKAH 2: KELUHAN (maks 2 field) */}
        {step === 2 && (
          <div className="wc-card space-y-4">
            <h2 className="text-h3">Keluhan & Kondisi</h2>

            <div>
              <label htmlFor="wo-issues" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Keluhan pelanggan *
              </label>
              <textarea
                id="wo-issues"
                rows={4}
                required
                value={issueText}
                onChange={e => setIssueText(e.target.value)}
                placeholder="Tulis satu keluhan per baris..."
                className="w-full p-3 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[16px] leading-6 md:text-[14px] md:leading-5"
              />
            </div>

            <div>
              <label htmlFor="wo-cond" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Kondisi fisik
              </label>
              <input
                id="wo-cond"
                type="text"
                value={conditionNote}
                onChange={e => setConditionNote(e.target.value)}
                className="w-full wc-input"
              />
            </div>
          </div>
        )}

        {/* LANGKAH 3: PEKERJAAN */}
        {step === 3 && (
          <div className="wc-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-h3">Pilih Pekerjaan *</h2>
              <span className="font-mono text-[14px] leading-5 font-semibold text-[var(--text)] tabular-nums">
                Estimasi: {formatRupiah(estimatedLabor)}
              </span>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[8px]">
              {resolvedJobs.map(jt => {
                const checked = selectedJobs.includes(jt.id);
                return (
                  <label
                    key={jt.id}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer ${
                      checked ? 'bg-[var(--primary-subtle)]/50' : 'hover:bg-[var(--bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleJob(jt.id)}
                        className="w-4 h-4 accent-[var(--primary)]"
                      />
                      <div className="min-w-0">
                        <div className="text-[14px] leading-5 font-medium text-[var(--text)]">{jt.name}</div>
                        <div className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                          {jt.standard_minutes} mnt · Garansi {jt.warranty_days} hari
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[14px] leading-5 font-medium text-[var(--text)] tabular-nums shrink-0">
                      {formatRupiah(jt.rate_applied)}
                    </span>
                  </label>
                );
              })}
            </div>

            {selectedJobs.length === 0 && (
              <p role="alert" className="text-[12px] leading-4 text-[var(--danger)]">
                Pilih minimal 1 pekerjaan sebelum menyimpan.
              </p>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

/**
 * DETAIL WORK ORDER:
 * - Header: chip plat besar + model + status. Di bawah: stepper 6 langkah ringkas
 *   (titik + label 12px; langkah lewat bercentang, aktif dengan garis kuningan).
 * - Satu kartu "Langkah berikutnya" berisi hanya tombol yang valid untuk peran ini;
 *   aksi tidak berlaku DISEMBUNYIKAN. Bila belum bisa ditutup: 1 baris alasan ("1 pekerjaan belum selesai").
 * - Konten dibagi TAB (Pekerjaan | Part | Biaya | Riwayat) agar satu layar tidak menumpuk.
 * - Desktop: kiri 8 kolom (tab), kanan 4 kolom (langkah berikutnya + info kendaraan).
 *   Mobile: 1 kolom, "Langkah berikutnya" di atas.
 */
export const WorkOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const woId = Number(id);
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'jobs' | 'parts' | 'cost' | 'history'>('jobs');
  const [assignMap, setAssignMap] = useState<Record<number, number>>({});
  const [partForm, setPartForm] = useState({ partId: 1, qty: 1, woJobId: 0 });
  const [noPartsRequired, setNoPartsRequired] = useState(false);
  const [closeForm, setCloseForm] = useState({ otherCost: 0, otherDescription: '', discount: 0 });
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const {
    data: wo,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
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
      showToast('Penugasan disimpan', 'success');
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
        res.isLowStock ? 'Part dikeluarkan (Stok menipis)' : 'Part dikeluarkan ke WO',
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
      showToast('Retur part disimpan', 'success');
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
      showToast('Pemeriksaan SA selesai', 'success');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
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
      showToast('Work Order ditutup & Invoice terbit', 'success');
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
      setCancelConfirmOpen(false);
      showToast('Work Order dibatalkan', 'info');
      queryClient.invalidateQueries({ queryKey: ['work-order', woId] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading) {
    return (
      <PageLayout title="Detail Work Order">
        <TableSkeleton rows={5} />
      </PageLayout>
    );
  }

  if (isError || !wo) {
    return (
      <PageLayout title="Detail Work Order">
        <ErrorCard onRetry={() => refetch()} />
      </PageLayout>
    );
  }

  const canSeeFinancials = user?.role === 'PM' || user?.role === 'AD' || user?.role === 'SA';
  const canSeePhone = user?.role === 'PM' || user?.role === 'AD' || user?.role === 'SA';
  const jobsList: any[] = wo.jobs || [];
  const partsList: any[] = wo.parts || [];
  const unfinishedJobsCount = jobsList.filter(j => j.status !== 'SELESAI').length;
  const hasPartRecorded = partsList.length > 0 || noPartsRequired;
  const isReviewed = wo.status === 'DIPERIKSA' || wo.status === 'DITUTUP';

  let blockerReason: string | null = null;
  if (unfinishedJobsCount > 0) {
    blockerReason = `${unfinishedJobsCount} pekerjaan belum selesai`;
  } else if (!hasPartRecorded) {
    blockerReason = 'Pemakaian part belum dicatat';
  } else if (!isReviewed) {
    blockerReason = 'Belum diperiksa Service Advisor';
  }

  const laborTotal = jobsList.reduce((s: number, j: any) => s + j.rate_applied, 0);
  const partsTotal = partsList.reduce((s: number, p: any) => s + (p.qty - p.returned_qty) * p.unit_price, 0);
  const grandPreview = Math.max(
    0,
    laborTotal + partsTotal + Number(closeForm.otherCost || 0) - Number(closeForm.discount || 0)
  );

  const currentStepIndex = WO_STEPS.indexOf(wo.status);

  return (
    <div className="space-y-6">
      {/* Header: chip plat besar + model + status */}
      <header className="wc-card space-y-5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <PlateChip plate={wo.plate_current} size="lg" />
            <div>
              <h1 className="text-h2">
                {wo.brand} {wo.model} ({wo.year})
              </h1>
              <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                {wo.wo_number}
              </div>
            </div>
            <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
            {wo.is_warranty_wo ? <StatusBadge status="GARANSI" kind="warranty" /> : null}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="wc-btn-secondary"
          >
            <Printer className="w-4 h-4 stroke-[1.5]" />
            <span>Cetak Job Card</span>
          </button>
        </div>

        {/* Stepper 6 langkah ringkas (titik + label 12px; langkah lewat bercentang, aktif dengan garis kuningan) */}
        {wo.status !== 'DIBATALKAN' && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-4 border-t border-[var(--border)]">
            {WO_STEPS.map((stepKey, idx) => {
              const passed = idx < currentStepIndex;
              const active = idx === currentStepIndex;
              return (
                <div
                  key={stepKey}
                  className={`py-2 px-2.5 rounded-[6px] text-[12px] leading-4 flex items-center gap-2 ${
                    active
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-semibold border-b-2 border-[#C9A227]'
                      : passed
                      ? 'text-[var(--success)] font-medium'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {passed ? (
                    <Check className="w-3.5 h-3.5 stroke-[1.5] shrink-0" />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        active ? 'bg-[#C9A227]' : 'bg-[var(--border-strong)]'
                      }`}
                    />
                  )}
                  <span className="truncate">{WO_STATUS_LABELS[stepKey]}</span>
                </div>
              );
            })}
          </div>
        )}
      </header>

      {/* Grid 12 Kolom: Kiri 8 kolom (Tab), Kanan 4 kolom (Langkah berikutnya + Info kendaraan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        {/* Kanan 4 kolom (Mobile: di atas / order-first, Desktop: kanan / lg:order-last) */}
        <aside className="lg:col-span-4 order-first lg:order-last space-y-6">
          {/* Kartu "Langkah Berikutnya" */}
          <div className="wc-card space-y-4">
            <h2 className="text-h3">Langkah Berikutnya</h2>

            {wo.status !== 'DITUTUP' && wo.status !== 'DIBATALKAN' && blockerReason && (
              <div className="text-[12px] leading-4 text-[var(--warning)] bg-[var(--warning-bg)] px-3 py-2 rounded-[6px]">
                {blockerReason}
              </div>
            )}

            <div className="space-y-2">
              {/* Valid actions for KR / AD: Simpan Penugasan */}
              {(user?.role === 'KR' || user?.role === 'AD') &&
                wo.status !== 'DITUTUP' &&
                wo.status !== 'DIBATALKAN' && (
                  <button
                    type="button"
                    onClick={() => assignMutation.mutate()}
                    disabled={assignMutation.isPending}
                    className="w-full wc-btn-primary"
                  >
                    <UserCheck className="w-4 h-4 stroke-[1.5]" />
                    <span>Simpan Penugasan</span>
                  </button>
                )}

              {/* Valid action for TK: Buka Pekerjaan Saya */}
              {user?.role === 'TK' && wo.status !== 'DITUTUP' && (
                <button
                  type="button"
                  onClick={() => navigate('/my-jobs')}
                  className="w-full wc-btn-primary"
                >
                  <span>Mulai / Selesaikan Kerja</span>
                </button>
              )}

              {/* Valid action for SP: Keluarkan Part */}
              {user?.role === 'SP' && wo.status !== 'DITUTUP' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('parts')}
                  className="w-full wc-btn-primary"
                >
                  <Package className="w-4 h-4 stroke-[1.5]" />
                  <span>Keluarkan Part</span>
                </button>
              )}

              {/* Valid action for SA / AD when SELESAI_DIKERJAKAN: Tandai Diperiksa */}
              {(user?.role === 'SA' || user?.role === 'AD') &&
                wo.status === 'SELESAI_DIKERJAKAN' && (
                  <button
                    type="button"
                    onClick={() => reviewMutation.mutate()}
                    disabled={reviewMutation.isPending}
                    className="w-full wc-btn-primary"
                  >
                    <Check className="w-4 h-4 stroke-[1.5]" />
                    <span>Tandai Diperiksa</span>
                  </button>
                )}

              {/* Valid action for SA / AD when DIPERIKSA: Tutup & Buat Invoice */}
              {(user?.role === 'SA' || user?.role === 'AD') && wo.status === 'DIPERIKSA' && (
                <button
                  type="button"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending || Boolean(blockerReason)}
                  className="w-full wc-btn-primary"
                >
                  <FileText className="w-4 h-4 stroke-[1.5]" />
                  <span>Tutup & Terbitkan Invoice</span>
                </button>
              )}

              {/* Lihat Invoice bila sudah ditutup */}
              {wo.invoice && canSeeFinancials && (
                <Link to={`/invoices/${wo.invoice.id}`} className="w-full wc-btn-primary">
                  <FileText className="w-4 h-4 stroke-[1.5]" />
                  <span>Lihat Invoice</span>
                </Link>
              )}

              {/* Batalkan WO (sekunder) untuk SA/AD jika belum diperiksa/ditutup */}
              {(user?.role === 'SA' || user?.role === 'AD') &&
                wo.status !== 'DIPERIKSA' &&
                wo.status !== 'DITUTUP' &&
                wo.status !== 'DIBATALKAN' && (
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    className="w-full wc-btn-secondary"
                  >
                    <XCircle className="w-4 h-4 stroke-[1.5]" />
                    <span>Batalkan WO</span>
                  </button>
                )}
            </div>
          </div>

          {/* Kartu Info Kendaraan */}
          <div className="wc-card space-y-2 text-[14px] leading-5">
            <h2 className="text-h3">Info Kendaraan</h2>
            <div className="text-[var(--text)] font-medium">{wo.customer_name}</div>
            {canSeePhone && wo.customer_phone && (
              <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                {wo.customer_phone}
              </div>
            )}
            <div className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums pt-2 border-t border-[var(--border)]">
              Odometer masuk: {Number(wo.odometer_in).toLocaleString('id-ID')} km
            </div>
            <div className="text-[12px] leading-4 text-[var(--text-muted)]">
              Keluhan: {wo.issues?.map((i: any) => i.description).join('; ') || '-'}
            </div>
          </div>
        </aside>

        {/* Kiri 8 kolom: Konten dibagi TAB (Pekerjaan | Part | Biaya | Riwayat) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-3">
            <FilterChip
              active={activeTab === 'jobs'}
              onClick={() => setActiveTab('jobs')}
              count={jobsList.length}
            >
              Pekerjaan
            </FilterChip>
            <FilterChip
              active={activeTab === 'parts'}
              onClick={() => setActiveTab('parts')}
              count={partsList.length}
            >
              Part
            </FilterChip>
            {canSeeFinancials && (
              <FilterChip active={activeTab === 'cost'} onClick={() => setActiveTab('cost')}>
                Biaya
              </FilterChip>
            )}
            <FilterChip active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
              Riwayat
            </FilterChip>
          </div>

          {/* TAB 1: PEKERJAAN */}
          {activeTab === 'jobs' && (
            <div className="wc-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="wc-table">
                  <thead>
                    <tr>
                      <th>Pekerjaan</th>
                      <th>Standar</th>
                      <th>Teknisi</th>
                      <th>Status</th>
                      {canSeeFinancials && <th className="text-right">Tarif</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {jobsList.map((j: any) => (
                      <tr key={j.id}>
                        <td>
                          <div className="font-medium text-[var(--text)]">{j.job_name}</div>
                          <div className="text-[12px] leading-4 text-[var(--text-muted)]">
                            Garansi {j.warranty_days} hari
                          </div>
                        </td>
                        <td className="font-mono text-[12px] leading-4 tabular-nums">
                          {j.standard_minutes} mnt
                        </td>
                        <td>
                          {(user?.role === 'KR' || user?.role === 'AD') && wo.status !== 'DITUTUP' ? (
                            <select
                              aria-label={`Pilih teknisi untuk ${j.job_name}`}
                              value={assignMap[j.id] || ''}
                              onChange={e =>
                                setAssignMap(prev => ({ ...prev, [j.id]: Number(e.target.value) }))
                              }
                              className="wc-input h-9 text-[12px] leading-4"
                            >
                              <option value="">Pilih teknisi</option>
                              {technicians.map((t: any) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[14px] leading-5 text-[var(--text)]">
                              {j.technician_name || 'Belum ada'}
                            </span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={j.status} kind="job" />
                        </td>
                        {canSeeFinancials && (
                          <td className="text-right font-mono text-[14px] leading-5 tabular-nums whitespace-nowrap">
                            {formatRupiah(j.rate_applied)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PART */}
          {activeTab === 'parts' && (
            <div className="space-y-4">
              {(user?.role === 'SP' || user?.role === 'AD') &&
                wo.status !== 'DITUTUP' &&
                wo.status !== 'DIBATALKAN' && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      issuePartMutation.mutate();
                    }}
                    className="wc-card grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
                  >
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                        Spare part *
                      </label>
                      <select
                        value={partForm.partId}
                        onChange={e => setPartForm(f => ({ ...f, partId: Number(e.target.value) }))}
                        className="w-full wc-input"
                      >
                        {allParts.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name} (Stok: {p.stock_qty})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                        Jumlah *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={partForm.qty}
                        onChange={e => setPartForm(f => ({ ...f, qty: Number(e.target.value) }))}
                        className="w-full wc-input font-mono tabular-nums"
                      />
                    </div>
                    <button type="submit" disabled={issuePartMutation.isPending} className="wc-btn-primary">
                      <span>Keluarkan</span>
                    </button>
                  </form>
                )}

              <div className="wc-card p-0 overflow-hidden">
                <div className="px-6 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[14px] leading-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noPartsRequired}
                      onChange={e => setNoPartsRequired(e.target.checked)}
                      className="w-4 h-4 accent-[var(--primary)]"
                    />
                    <span>Tanpa penggantian part</span>
                  </label>
                  {canSeeFinancials && (
                    <span className="font-mono text-[14px] leading-5 font-semibold tabular-nums">
                      {formatRupiah(partsTotal)}
                    </span>
                  )}
                </div>

                {partsList.length === 0 ? (
                  <div className="p-6 text-[14px] leading-5 text-[var(--text-muted)]">
                    Belum ada spare part dicatat.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="wc-table">
                      <thead>
                        <tr>
                          <th>Part</th>
                          <th className="text-right">Keluar</th>
                          <th className="text-right">Retur</th>
                          {canSeeFinancials && <th className="text-right">Subtotal</th>}
                          <th className="text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partsList.map((p: any) => {
                          const netQty = p.qty - p.returned_qty;
                          return (
                            <tr key={p.id}>
                              <td>
                                <div className="font-medium text-[var(--text)]">{p.part_name}</div>
                                <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                                  {p.part_code}
                                </div>
                              </td>
                              <td className="text-right font-mono tabular-nums">{p.qty}</td>
                              <td className="text-right font-mono tabular-nums">{p.returned_qty}</td>
                              {canSeeFinancials && (
                                <td className="text-right font-mono tabular-nums whitespace-nowrap">
                                  {formatRupiah(netQty * p.unit_price)}
                                </td>
                              )}
                              <td className="text-right">
                                {(user?.role === 'SP' || user?.role === 'AD') &&
                                  netQty > 0 &&
                                  wo.status !== 'DITUTUP' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        returnPartMutation.mutate({ woPartId: p.id, qty: 1 })
                                      }
                                      className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
                                      <span>Retur 1</span>
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

          {/* TAB 3: BIAYA */}
          {activeTab === 'cost' && canSeeFinancials && (
            <div className="wc-card space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                    Biaya lain (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={closeForm.otherCost}
                    onChange={e => setCloseForm(f => ({ ...f, otherCost: Number(e.target.value) }))}
                    className="w-full wc-input font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                    Diskon (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={closeForm.discount}
                    onChange={e => setCloseForm(f => ({ ...f, discount: Number(e.target.value) }))}
                    className="w-full wc-input font-mono tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                    Keterangan biaya
                  </label>
                  <input
                    type="text"
                    value={closeForm.otherDescription}
                    onChange={e => setCloseForm(f => ({ ...f, otherDescription: e.target.value }))}
                    placeholder="Consumable bengkel"
                    className="w-full wc-input"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border)] space-y-2 text-[14px] leading-5">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Jasa</span>
                  <span className="font-mono tabular-nums">{formatRupiah(laborTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Spare part</span>
                  <span className="font-mono tabular-nums">{formatRupiah(partsTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Biaya lain</span>
                  <span className="font-mono tabular-nums">{formatRupiah(closeForm.otherCost)}</span>
                </div>
                <div className="flex justify-between text-[var(--danger)]">
                  <span>Diskon</span>
                  <span className="font-mono tabular-nums">-{formatRupiah(closeForm.discount)}</span>
                </div>
                <div className="pt-2 border-t border-[var(--border)] flex justify-between text-[16px] leading-6 font-semibold">
                  <span>Total tagihan</span>
                  <span className="font-mono tabular-nums">{formatRupiah(grandPreview)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RIWAYAT */}
          {activeTab === 'history' && (
            <div className="wc-card space-y-3 text-[14px] leading-5">
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Waktu diterima</span>
                <span className="font-mono tabular-nums">{formatDateTimeId(wo.received_at)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Kondisi masuk</span>
                <span>{wo.condition_note || '-'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[var(--text-muted)]">Diperiksa oleh</span>
                <span>{wo.reviewed_by_name || 'Belum diperiksa'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable Job Card A4 */}
      <div className="hidden print-only print-container space-y-6">
        <div className="flex items-start justify-between border-b border-[var(--text)] pb-4">
          <div className="flex items-center gap-3">
            <BritLogo size={36} showText={true} />
          </div>
          <div className="text-right">
            <div className="font-mono text-[16px] font-semibold">{wo.wo_number}</div>
            <div className="text-[12px]">{formatDateTimeId(wo.received_at)}</div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Batalkan Work Order"
        message={`Batalkan Work Order ${wo.wo_number} untuk kendaraan ${wo.plate_current}?`}
        confirmLabel="Ya, Batalkan"
        isPending={cancelMutation.isPending}
      />
    </div>
  );
};
