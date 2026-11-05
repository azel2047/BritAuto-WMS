import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  ChevronRight,
  CheckCircle2,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageLayout } from '../components/layout/PageLayout';
import { StatusBadge, PlateChip } from '../components/domain/StatusBadge';
import { TableSkeleton, ErrorCard } from '../components/ui/Modal';
import { OwnerMobileHomePage } from './owner/MobileHome';
import { TechnicianJobsPage } from './technician/AssignmentAndClock';

/**
 * BERANDA = daftar tugas, bukan dekorasi (LANGKAH 3):
 * - SA / AD: tombol utama "+ Terima Kendaraan"; di bawahnya DAFTAR berisi
 *   "Perlu diperiksa (n)", "Siap diserahkan (n)", "Jatuh tempo servis (n)" —
 *   tiap baris bisa diklik ke daftar terfilter. Hanya tampilkan baris yang n > 0, sisanya "Semua beres".
 * - Kepala Regu (KR): daftar WO yang belum ditugaskan, tiap baris tombol "Tugaskan".
 * - Teknisi (TK): langsung merender kartu pekerjaan (MULAI/SELESAI 64px).
 * - Pemilik (PM): langsung merender Ringkasan (3 angka besar + daftar Perlu perhatian maks 5 baris).
 * - Spare Part (SP): tombol utama "Opname Stok", daftar stok menipis & WO aktif.
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery<any>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/dashboard/summary'),
    enabled: user?.role !== 'TK' && user?.role !== 'PM',
  });

  const { data: allWorkOrders = [], isLoading: woLoading } = useQuery<any[]>({
    queryKey: ['work-orders', 'ALL'],
    queryFn: () => apiFetch('/work-orders?status=ALL&q='),
    enabled: user?.role !== 'TK' && user?.role !== 'PM',
  });

  const activeWorkOrders: any[] = useMemo(() => {
    const safeAll = Array.isArray(allWorkOrders) ? allWorkOrders : [];
    const raw = safeAll.filter(w => w.status !== 'DITUTUP' && w.status !== 'DIBATALKAN');
    if (raw.length > 0) return raw;
    return Array.isArray(summary?.activeWorkOrders) ? summary.activeWorkOrders : [];
  }, [allWorkOrders, summary]);

  if (user?.role === 'TK') {
    return <TechnicianJobsPage />;
  }

  if (user?.role === 'PM') {
    return <OwnerMobileHomePage />;
  }

  if (summaryLoading || woLoading) {
    return (
      <PageLayout title="Beranda">
        <TableSkeleton rows={5} />
      </PageLayout>
    );
  }

  if (summaryError || !summary) {
    return (
      <PageLayout title="Beranda">
        <ErrorCard onRetry={() => refetchSummary()} />
      </PageLayout>
    );
  }

  // Kepala Regu (KR): daftar WO yang belum ditugaskan, tiap baris tombol "Tugaskan"
  if (user?.role === 'KR') {
    const unassignedWos = activeWorkOrders.filter(
      w => w.status === 'MENUNGGU_PENUGASAN' || !w.technician_names
    );
    const otherActiveWos = activeWorkOrders.filter(
      w => w.status !== 'MENUNGGU_PENUGASAN' && Boolean(w.technician_names)
    );

    return (
      <PageLayout
        title="Perlu Ditugaskan"
        primaryAction={
          <button type="button" onClick={() => navigate('/assignments')} className="wc-btn-primary">
            <UserCheck className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Papan Tugaskan</span>
          </button>
        }
      >
        <div className="space-y-6">
          <section className="wc-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-h3">Belum Ditugaskan ({unassignedWos.length})</h2>
            </div>
            {unassignedWos.length === 0 ? (
              <div className="p-6 flex items-center gap-2 text-[14px] leading-5 text-[var(--success)]">
                <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
                <span>Semua beres</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {unassignedWos.map((wo: any) => (
                  <div
                    key={wo.id}
                    className="px-6 py-3 min-h-[56px] flex flex-wrap items-center justify-between gap-4 hover:bg-[var(--bg)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlateChip plate={wo.plate_current} />
                      <div className="min-w-0">
                        <div className="text-[14px] leading-5 font-semibold text-[var(--text)] truncate">
                          {wo.brand} {wo.model} ({wo.year})
                        </div>
                        <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                          {wo.wo_number} · {wo.total_jobs || 1} pekerjaan
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                      className="wc-btn-primary"
                    >
                      <span>Tugaskan</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {otherActiveWos.length > 0 && (
            <section className="wc-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h2 className="text-h3">Sedang Berjalan ({otherActiveWos.length})</h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {otherActiveWos.map((wo: any) => (
                  <div
                    key={wo.id}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="px-6 py-3 min-h-[48px] flex flex-wrap items-center justify-between gap-4 hover:bg-[var(--bg)] cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlateChip plate={wo.plate_current} />
                      <span className="text-[14px] leading-5 font-medium text-[var(--text)]">
                        {wo.brand} {wo.model}
                      </span>
                      <span className="text-[12px] leading-4 text-[var(--text-muted)]">
                        · {wo.technician_names}
                      </span>
                    </div>
                    <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </PageLayout>
    );
  }

  // Spare Part (SP)
  if (user?.role === 'SP') {
    const lowStockCount = Number(summary.lowStockCount || 0);
    const pendingOpnames = Number(summary.pendingOpnames || 0);
    const spTasks = [
      { label: 'Stok menipis', count: lowStockCount, to: '/parts' },
      { label: 'Work Order aktif', count: activeWorkOrders.length, to: '/work-orders' },
      { label: 'Opname menunggu persetujuan', count: pendingOpnames, to: '/opnames' },
    ].filter(t => t.count > 0);

    return (
      <PageLayout
        title="Beranda"
        primaryAction={
          <button type="button" onClick={() => navigate('/opnames')} className="wc-btn-primary">
            <ClipboardCheck className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Opname Stok</span>
          </button>
        }
      >
        <div className="space-y-6">
          <section className="wc-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-h3">Daftar Tugas</h2>
            </div>
            {spTasks.length === 0 ? (
              <div className="p-6 flex items-center gap-2 text-[14px] leading-5 text-[var(--success)]">
                <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
                <span>Semua beres</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {spTasks.map(task => (
                  <button
                    key={task.label}
                    type="button"
                    onClick={() => navigate(task.to)}
                    className="w-full min-h-[48px] px-6 py-3 flex items-center justify-between gap-4 hover:bg-[var(--bg)] text-left cursor-pointer"
                  >
                    <span className="text-[14px] leading-5 font-medium text-[var(--text)]">
                      {task.label} ({task.count})
                    </span>
                    <ChevronRight className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)]" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="wc-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-h3">Keluarkan Part ke Work Order</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {activeWorkOrders.map((wo: any) => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className="px-6 py-3 min-h-[48px] flex items-center justify-between gap-4 hover:bg-[var(--bg)] cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlateChip plate={wo.plate_current} />
                    <span className="text-[14px] leading-5 font-medium text-[var(--text)] truncate">
                      {wo.brand} {wo.model}
                    </span>
                    <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] hidden sm:inline">
                      {wo.wo_number}
                    </span>
                  </div>
                  <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageLayout>
    );
  }

  // Default: SA & Admin
  // Daftar berisi "Perlu diperiksa (n)", "Siap diserahkan (n)", "Jatuh tempo servis (n)", "Perlu ditugaskan (n)"
  // Hanya tampilkan baris yang n > 0, sisanya "Semua beres".
  const perluDiperiksaCount = activeWorkOrders.filter(w => w.status === 'SELESAI_DIKERJAKAN').length;
  const siapDiserahkanCount = activeWorkOrders.filter(w => w.status === 'DIPERIKSA').length;
  const perluDitugaskanCount = activeWorkOrders.filter(w => w.status === 'MENUNGGU_PENUGASAN').length;
  const jatuhTempoCount = Number(summary.dueRemindersCount || 0);

  const taskRows = [
    {
      label: 'Perlu diperiksa',
      count: perluDiperiksaCount,
      to: '/work-orders?status=SELESAI_DIKERJAKAN',
    },
    {
      label: 'Siap diserahkan',
      count: siapDiserahkanCount,
      to: '/work-orders?status=DIPERIKSA',
    },
    {
      label: 'Jatuh tempo servis',
      count: jatuhTempoCount,
      to: '/reminders',
    },
    {
      label: 'Perlu ditugaskan',
      count: perluDitugaskanCount,
      to: '/work-orders?status=MENUNGGU_PENUGASAN',
    },
  ].filter(row => row.count > 0);

  return (
    <PageLayout
      title="Beranda"
      primaryAction={
        <button type="button" onClick={() => navigate('/work-orders/new')} className="wc-btn-primary">
          <Plus className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
          <span>Terima Kendaraan</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Daftar Tugas Hari Ini */}
        <section className="wc-card p-0 overflow-hidden" aria-label="Daftar Tugas">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-h3">Perlu Tindakan</h2>
          </div>

          {taskRows.length === 0 ? (
            <div className="p-6 flex items-center gap-2 text-[14px] leading-5 text-[var(--success)]">
              <CheckCircle2 className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
              <span>Semua beres</span>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {taskRows.map(row => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => navigate(row.to)}
                  className="w-full min-h-[48px] px-6 py-3 flex items-center justify-between gap-4 hover:bg-[var(--bg)] text-left transition-colors cursor-pointer"
                >
                  <span className="text-[14px] leading-5 font-medium text-[var(--text)]">
                    {row.label}{' '}
                    <span className="font-mono font-semibold text-[var(--primary)] tabular-nums">
                      ({row.count})
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Daftar Work Order Aktif */}
        <section className="wc-card p-0 overflow-hidden" aria-label="Work Order Aktif">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-h3">Work Order Aktif ({activeWorkOrders.length})</h2>
            <button
              type="button"
              onClick={() => navigate('/work-orders')}
              className="text-[14px] leading-5 font-medium text-[var(--primary)] hover:underline cursor-pointer"
            >
              Semua Work Order
            </button>
          </div>

          {/* Desktop Table (maks 5 kolom) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Kendaraan</th>
                  <th>No. WO</th>
                  <th>Pelanggan</th>
                  <th>Teknisi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeWorkOrders.map((wo: any) => (
                  <tr
                    key={wo.id}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="flex items-center gap-2.5">
                        <PlateChip plate={wo.plate_current} />
                        <span className="text-[14px] leading-5 text-[var(--text-muted)]">
                          {wo.brand} {wo.model}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-[14px] leading-5 text-[var(--text)] tabular-nums">
                      {wo.wo_number}
                    </td>
                    <td className="text-[14px] leading-5 text-[var(--text)]">{wo.customer_name}</td>
                    <td className="text-[14px] leading-5 text-[var(--text-muted)]">
                      {wo.technician_names || 'Belum ada'}
                    </td>
                    <td>
                      <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile 2-Row Cards */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {activeWorkOrders.map((wo: any) => (
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
                  <span className="font-medium text-[var(--text)] truncate">
                    {wo.brand} {wo.model} · {wo.customer_name}
                  </span>
                  <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] shrink-0">
                    {wo.wo_number}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
};
