import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  PhoneCall,
  Award,
  Settings,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  BellRing,
  TrendingUp,
} from 'lucide-react';
import { apiFetch, getStoredToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId } from '../../lib/format';
import { PageLayout } from '../../components/layout/PageLayout';
import { PlateChip } from '../../components/domain/StatusBadge';
import {
  Modal,
  EmptyState,
  TableSkeleton,
  ErrorCard,
} from '../../components/ui/Modal';

export const RemindersPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();
  const [followupModal, setFollowupModal] = useState<any | null>(null);
  const [followupForm, setFollowupForm] = useState({
    status: 'CONTACTED' as 'CONTACTED' | 'SKIPPED',
    result: 'Pelanggan dihubungi dan menjadwalkan kunjungan minggu depan',
    scheduledVisitDate: '2026-11-09',
  });

  const {
    data: reminders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['reminders'],
    queryFn: () => apiFetch('/reminders/due'),
  });

  const calcMutation = useMutation({
    mutationFn: () => apiFetch('/reminders/calculate', { method: 'POST' }),
    onSuccess: (res: any) => {
      showToast(
        res.newlyCreated > 0
          ? `${res.newlyCreated} pengingat baru ditambahkan`
          : 'Pengingat diperbarui',
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const updateFollowupMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/followups/${followupModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(followupForm),
      }),
    onSuccess: () => {
      showToast('Tindak lanjut disimpan', 'success');
      setFollowupModal(null);
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canFollowup = user?.role === 'SA' || user?.role === 'AD';

  return (
    <PageLayout
      title="Pengingat Servis"
      primaryAction={
        <button
          type="button"
          onClick={() => calcMutation.mutate()}
          disabled={calcMutation.isPending}
          className="wc-btn-primary"
        >
          <RefreshCw className={`w-5 h-5 stroke-[1.5] ${calcMutation.isPending ? 'animate-spin' : ''}`} />
          <span>Hitung Ulang</span>
        </button>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={BellRing}
          message="Tidak ada pengingat servis yang jatuh tempo."
          actionLabel="Hitung Ulang"
          onAction={() => calcMutation.mutate()}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Kendaraan</th>
                  <th>Pelanggan</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                  <th>Jadwal</th>
                  {canFollowup && <th className="text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {reminders.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <PlateChip plate={r.plate_current} />
                        <span className="text-[12px] leading-4 text-[var(--text-muted)]">
                          {r.brand} {r.model}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="text-[14px] leading-5 text-[var(--text)]">{r.customer_name}</div>
                      <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {r.customer_phone}
                      </div>
                    </td>
                    <td className="text-[14px] leading-5 text-[var(--text)]">
                      {r.reason || formatDateId(r.due_date)}
                    </td>
                    <td>
                      {r.status === 'CONTACTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--success-bg)] text-[var(--success)] text-[12px] leading-4 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Dihubungi</span>
                        </span>
                      ) : r.status === 'SKIPPED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--info-bg)] text-[var(--info)] text-[12px] leading-4 font-medium">
                          <XCircle className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Dilewati</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--warning-bg)] text-[var(--warning)] text-[12px] leading-4 font-medium">
                          <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Menunggu</span>
                        </span>
                      )}
                    </td>
                    <td className="text-[12px] leading-4 text-[var(--text-muted)]">
                      {r.scheduled_visit_date ? formatDateId(r.scheduled_visit_date) : r.result || '-'}
                    </td>
                    {canFollowup && (
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setFollowupModal(r)}
                          className="wc-row-action wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                        >
                          <PhoneCall className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Hubungi</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-[var(--border)]">
            {reminders.map((r: any) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <PlateChip plate={r.plate_current} />
                  {canFollowup && (
                    <button
                      type="button"
                      onClick={() => setFollowupModal(r)}
                      className="wc-btn-secondary min-h-[36px] text-[12px]"
                    >
                      <span>Hubungi</span>
                    </button>
                  )}
                </div>
                <div className="text-[14px] leading-5 text-[var(--text)]">
                  {r.brand} {r.model} · {r.customer_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={followupModal !== null}
        onClose={() => setFollowupModal(null)}
        title={`Tindak Lanjut (${followupModal?.plate_current})`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            updateFollowupMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Status *
            </label>
            <select
              value={followupForm.status}
              onChange={e => setFollowupForm(f => ({ ...f, status: e.target.value as any }))}
              className="w-full wc-input"
            >
              <option value="CONTACTED">Sudah dihubungi</option>
              <option value="SKIPPED">Dilewati</option>
            </select>
          </div>
          {followupForm.status === 'CONTACTED' && (
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Rencana kunjungan
              </label>
              <input
                type="date"
                value={followupForm.scheduledVisitDate}
                onChange={e => setFollowupForm(f => ({ ...f, scheduledVisitDate: e.target.value }))}
                className="w-full wc-input font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Catatan *
            </label>
            <textarea
              rows={2}
              required
              value={followupForm.result}
              onChange={e => setFollowupForm(f => ({ ...f, result: e.target.value }))}
              className="w-full p-3 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[14px] leading-5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFollowupModal(null)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={updateFollowupMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const TechnicianPerformancePage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('2026-11');
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    technicianId: 5,
    availableHours: 160,
    bonusThresholdPercent: 40,
  });

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
    queryKey: ['performance', period],
    queryFn: () => apiFetch(`/performance?period=${encodeURIComponent(period)}`),
  });

  const updateWorkHoursMutation = useMutation({
    mutationFn: () =>
      apiFetch('/work-hours', {
        method: 'PUT',
        body: JSON.stringify({
          technicianId: Number(configForm.technicianId),
          period,
          availableHours: Number(configForm.availableHours),
          bonusThreshold: Number(configForm.bonusThresholdPercent) / 100,
        }),
      }),
    onSuccess: () => {
      showToast('Pengaturan disimpan', 'success');
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canConfigure = user?.role === 'PM' || user?.role === 'AD';
  const technicians: any[] = data?.technicians || [];
  const thresholdPercent = data?.bonusThresholdPercent ?? 40;

  return (
    <PageLayout
      title="Kinerja Teknisi"
      primaryAction={
        canConfigure ? (
          <button
            type="button"
            onClick={() => {
              if (technicians[0]) {
                setConfigForm({
                  technicianId: technicians[0].technicianId,
                  availableHours: technicians[0].availableHours,
                  bonusThresholdPercent: thresholdPercent,
                });
              }
              setConfigOpen(true);
            }}
            className="wc-btn-primary"
          >
            <Settings className="w-5 h-5 stroke-[1.5]" />
            <span>Atur Jam</span>
          </button>
        ) : undefined
      }
      toolbar={
        <div className="flex items-center gap-3 h-10">
          <label htmlFor="perf-period" className="text-[14px] leading-5 text-[var(--text-muted)]">
            Periode:
          </label>
          <input
            id="perf-period"
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="wc-input font-mono w-44"
          />
          <span className="text-[12px] leading-4 text-[var(--text-muted)]">
            Ambang bonus &gt; {thresholdPercent}%
          </span>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : technicians.length === 0 ? (
        <EmptyState icon={TrendingUp} message="Belum ada data kinerja untuk periode ini." />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Teknisi</th>
                  <th className="text-right">Jam Produktif</th>
                  <th className="text-right">Jam Tersedia</th>
                  <th className="text-right">Produktivitas</th>
                  <th className="text-right">Efisiensi</th>
                  <th>Status Bonus</th>
                </tr>
              </thead>
              <tbody>
                {technicians.map(t => (
                  <tr key={t.technicianId}>
                    <td>
                      <div className="font-medium text-[var(--text)]">{t.name}</div>
                      <div className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                        {t.completedJobsCount} selesai
                      </div>
                    </td>
                    <td className="text-right font-mono tabular-nums">{t.productiveHours} j</td>
                    <td className="text-right font-mono tabular-nums text-[var(--text-muted)]">
                      {t.availableHours} j
                    </td>
                    <td className="text-right font-mono font-semibold tabular-nums">
                      {t.productivityPercent}%
                    </td>
                    <td className="text-right font-mono tabular-nums">{t.efficiencyPercent}%</td>
                    <td>
                      {t.bonusEligible ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--success-bg)] text-[var(--success)] text-[12px] leading-4 font-medium">
                          <Award className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Berhak bonus</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--info-bg)] text-[var(--info)] text-[12px] leading-4 font-medium">
                          <span>Di bawah ambang</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Atur Jam & Ambang Bonus">
        <form
          onSubmit={e => {
            e.preventDefault();
            updateWorkHoursMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Teknisi *
            </label>
            <select
              value={configForm.technicianId}
              onChange={e => setConfigForm(f => ({ ...f, technicianId: Number(e.target.value) }))}
              className="w-full wc-input"
            >
              {technicians.map(t => (
                <option key={t.technicianId} value={t.technicianId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Jam tersedia ({period}) *
            </label>
            <input
              type="number"
              required
              min={1}
              value={configForm.availableHours}
              onChange={e => setConfigForm(f => ({ ...f, availableHours: Number(e.target.value) }))}
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Ambang bonus (%) *
            </label>
            <input
              type="number"
              required
              min={10}
              max={95}
              value={configForm.bonusThresholdPercent}
              onChange={e =>
                setConfigForm(f => ({ ...f, bonusThresholdPercent: Number(e.target.value) }))
              }
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfigOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={updateWorkHoursMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const MonthlyReportPage: React.FC = () => {
  const [period, setPeriod] = useState('2026-10');

  const {
    data: report,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
    queryKey: ['monthly-report', period],
    queryFn: () => apiFetch(`/reports/monthly?period=${encodeURIComponent(period)}`),
  });

  const handleExportCsv = () => {
    const token = getStoredToken();
    const url = `/api/reports/monthly.csv?period=${encodeURIComponent(period)}${
      token ? `&token=${encodeURIComponent(token)}` : ''
    }`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan-Bulanan-BritAuto-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <PageLayout
      title="Laporan Bulanan"
      primaryAction={
        <button type="button" onClick={handleExportCsv} className="wc-btn-primary">
          <Download className="w-5 h-5 stroke-[1.5]" />
          <span>Unduh CSV</span>
        </button>
      }
      toolbar={
        <div className="flex items-center gap-3 h-10">
          <label htmlFor="report-period" className="text-[14px] leading-5 text-[var(--text-muted)]">
            Periode:
          </label>
          <input
            id="report-period"
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="wc-input font-mono w-44"
          />
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError || !report ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          {/* 3 Ringkasan Keuangan: maks 1 judul + 1 angka + 1 keterangan pendek */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="wc-card">
              <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">Pendapatan</div>
              <div className="text-[24px] leading-8 font-semibold font-mono text-[var(--text)] mt-2 tabular-nums">
                {formatRupiah(report.revenue)}
              </div>
              <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-2">
                {report.invoiceCount} invoice terbit
              </div>
            </div>

            <div className="wc-card">
              <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">Pengeluaran</div>
              <div className="text-[24px] leading-8 font-semibold font-mono text-[var(--text)] mt-2 tabular-nums">
                {formatRupiah(report.totalExpenses)}
              </div>
              <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-2">
                Operasional & part
              </div>
            </div>

            <div className="wc-card">
              <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">Laba kotor</div>
              <div className="text-[24px] leading-8 font-semibold font-mono text-[var(--success)] mt-2 tabular-nums">
                {formatRupiah(report.grossProfit)}
              </div>
              <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-2">
                {report.closedWo} WO selesai
              </div>
            </div>
          </div>

          {/* 10 Spare Part Terlaris */}
          <div className="wc-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-h3">Pemakaian Part Tertinggi ({period})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="wc-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Part</th>
                    <th className="text-right">Terpakai</th>
                    <th className="text-right">Nilai Penjualan</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topParts.map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {p.code}
                      </td>
                      <td className="font-medium text-[var(--text)]">{p.name}</td>
                      <td className="text-right font-mono tabular-nums">
                        {p.total_qty} {p.unit}
                      </td>
                      <td className="text-right font-mono font-medium tabular-nums whitespace-nowrap">
                        {formatRupiah(p.total_sales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};
