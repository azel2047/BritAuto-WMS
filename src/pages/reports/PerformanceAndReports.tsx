import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  RefreshCw,
  PhoneCall,
  Award,
  Settings,
  Download,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { apiFetch, getStoredToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';

export const RemindersPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();
  const [followupModal, setFollowupModal] = useState<any | null>(null);
  const [followupForm, setFollowupForm] = useState({
    status: 'CONTACTED' as 'CONTACTED' | 'SKIPPED',
    result: 'Pelanggan sudah dihubungi via WhatsApp dan menjadwalkan servis minggu depan',
    scheduledVisitDate: '2026-11-09',
  });

  const { data: reminders = [] } = useQuery<any[]>({
    queryKey: ['reminders'],
    queryFn: () => apiFetch('/reminders/due'),
  });

  const calcMutation = useMutation({
    mutationFn: () => apiFetch('/reminders/calculate', { method: 'POST' }),
    onSuccess: (res: any) => {
      showToast(
        res.newlyCreated > 0
          ? `Perhitungan selesai: ${res.newlyCreated} reminder baru ditambahkan`
          : 'Semua kendaraan telah diperiksa terhadap interval bulan & odometer (BR-10)',
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
      showToast('Status follow-up service reminder berhasil disimpan', 'success');
      setFollowupModal(null);
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canFollowup = user?.role === 'SA' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Service Reminder Berkala (BR-10)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Dihitung otomatis menurut interval bulan (6 bln) ATAU kilometer (10.000 km), mana yang tercapai lebih dulu.
          </p>
        </div>
        <button
          onClick={() => calcMutation.mutate()}
          disabled={calcMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs sm:text-sm font-semibold hover:bg-[#2c4f7c] self-start"
        >
          <RefreshCw className={`w-4 h-4 ${calcMutation.isPending ? 'animate-spin' : ''}`} />
          <span>Hitung Reminder Sekarang</span>
        </button>
      </div>

      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                <th className="py-3 px-4 font-semibold">Kendaraan</th>
                <th className="py-3 px-4 font-semibold">Pelanggan & Telepon</th>
                <th className="py-3 px-4 font-semibold">Alasan Jatuh Tempo</th>
                <th className="py-3 px-4 font-semibold">Status Follow-up</th>
                <th className="py-3 px-4 font-semibold">Hasil / Jadwal</th>
                {canFollowup && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              {reminders.map((r: any) => (
                <tr key={r.id} className="hover:bg-[var(--navy-50)]">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold">{r.plate_current}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {r.brand} {r.model} · {Number(r.odometer_last).toLocaleString('id-ID')} km
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{r.customer_name}</div>
                    <div className="text-xs font-mono text-[var(--text-muted)]">{r.customer_phone}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">{r.reason || `Jatuh tempo ${formatDateId(r.due_date)}`}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        r.status === 'CONTACTED'
                          ? 'bg-[#e4f4ec] text-[#2e8b57]'
                          : r.status === 'SKIPPED'
                          ? 'bg-[#f3f6fa] text-[#5b6b82]'
                          : 'bg-[#fdf1dc] text-[#b36b00]'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                    {r.result || '-'}
                    {r.scheduled_visit_date ? ` (Kunjungan: ${formatDateId(r.scheduled_visit_date)})` : ''}
                  </td>
                  {canFollowup && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setFollowupModal(r)}
                        className="px-3 py-1.5 rounded bg-[#1f3a5f] text-white text-xs font-medium inline-flex items-center gap-1"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Catat Follow-up
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={followupModal !== null}
        onClose={() => setFollowupModal(null)}
        title={`Follow-up Pelanggan (${followupModal?.plate_current} - ${followupModal?.customer_name})`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            updateFollowupMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Status Follow-up</label>
            <select
              value={followupForm.status}
              onChange={e => setFollowupForm(f => ({ ...f, status: e.target.value as any }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              <option value="CONTACTED">CONTACTED (Sudah Dihubungi)</option>
              <option value="SKIPPED">SKIPPED (Dilewati / Menolak)</option>
            </select>
          </div>
          {followupForm.status === 'CONTACTED' && (
            <div>
              <label className="block text-xs font-medium mb-1">Rencana Tanggal Kunjungan Servis</label>
              <input
                type="date"
                value={followupForm.scheduledVisitDate}
                onChange={e => setFollowupForm(f => ({ ...f, scheduledVisitDate: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1">Catatan Hasil / Alasan</label>
            <textarea
              rows={2}
              required
              value={followupForm.result}
              onChange={e => setFollowupForm(f => ({ ...f, result: e.target.value }))}
              className="w-full p-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFollowupModal(null)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateFollowupMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Follow-up
            </button>
          </div>
        </form>
      </Modal>
    </div>
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

  const { data, isLoading } = useQuery<any>({
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
      showToast('Jam kerja tersedia & ambang bonus berhasil diperbarui', 'success');
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canConfigure = user?.role === 'PM' || user?.role === 'AD';
  const technicians: any[] = data?.technicians || [];
  const thresholdPercent = data?.bonusThresholdPercent ?? 40;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Kinerja & Bonus Teknisi (BR-06, BR-07)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Produktivitas = Jam Produktif / Jam Tersedia × 100% (Bonus bila &gt; {thresholdPercent}%). Efisiensi = Waktu Standar / Waktu Aktual.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm font-mono"
          />
          {canConfigure && (
            <button
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold hover:bg-[#2c4f7c]"
            >
              <Settings className="w-4 h-4" /> Atur Jam & Ambang Bonus
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />
      ) : (
        <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                  <th className="py-3 px-4 font-semibold">Nama Teknisi</th>
                  <th className="py-3 px-4 font-semibold text-right">Jam Produktif</th>
                  <th className="py-3 px-4 font-semibold text-right">Jam Tersedia</th>
                  <th className="py-3 px-4 font-semibold">Produktivitas (Ambang &gt;{thresholdPercent}%)</th>
                  <th className="py-3 px-4 font-semibold text-right">Efisiensi Kerja</th>
                  <th className="py-3 px-4 font-semibold">Status Bonus (BR-06)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {technicians.map(t => (
                  <tr key={t.technicianId} className="hover:bg-[var(--navy-50)]">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{t.completedJobsCount} job selesai</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {t.productiveHours} jam
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[var(--text-muted)]">
                      {t.availableHours} jam
                    </td>
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="flex items-center justify-between text-xs font-mono mb-1 tabular-nums">
                        <span className="font-bold">{t.productivityPercent}%</span>
                        <span className="text-[var(--text-muted)]">Ambang {thresholdPercent}%</span>
                      </div>
                      <div className="relative h-2.5 w-full rounded-full bg-[var(--navy-100)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            t.bonusEligible ? 'bg-[#2e8b57]' : 'bg-[#b36b00]'
                          }`}
                          style={{ width: `${Math.min(100, t.productivityPercent)}%` }}
                        />
                        <div
                          title={`Garis ambang bonus ${thresholdPercent}%`}
                          className="absolute top-0 bottom-0 w-0.5 bg-[#c0392b]"
                          style={{ left: `${Math.min(100, thresholdPercent)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#1f6fb2]">
                      {t.efficiencyPercent}%
                    </td>
                    <td className="py-3.5 px-4">
                      {t.bonusEligible ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#e4f4ec] text-[#2e8b57] text-xs font-bold">
                          <Award className="w-3.5 h-3.5" /> Berhak Bonus (&gt;{thresholdPercent}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f3f6fa] text-[#5b6b82] text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Belum Mencapai Ambang
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

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Atur Jam Kerja Tersedia & Ambang Bonus (BR-06)">
        <form
          onSubmit={e => {
            e.preventDefault();
            updateWorkHoursMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Pilih Teknisi</label>
            <select
              value={configForm.technicianId}
              onChange={e => setConfigForm(f => ({ ...f, technicianId: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              {technicians.map(t => (
                <option key={t.technicianId} value={t.technicianId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Jam Kerja Tersedia Bulan {period} (Jam)</label>
            <input
              type="number"
              required
              min={1}
              value={configForm.availableHours}
              onChange={e => setConfigForm(f => ({ ...f, availableHours: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ambang Produktivitas Bonus (%)</label>
            <input
              type="number"
              required
              min={10}
              max={95}
              value={configForm.bonusThresholdPercent}
              onChange={e => setConfigForm(f => ({ ...f, bonusThresholdPercent: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateWorkHoursMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const MonthlyReportPage: React.FC = () => {
  const [period, setPeriod] = useState('2026-10');

  const { data: report, isLoading } = useQuery<any>({
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

  if (isLoading || !report) {
    return <div className="h-64 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Laporan Operasional & Keuangan Bulanan</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Ringkasan pendapatan invoice, pengeluaran bengkel, laba kotor, dan 10 spare part terlaris.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm font-mono"
          />
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs sm:text-sm font-semibold hover:bg-[#2c4f7c]"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Pendapatan ({period})</div>
          <div className="text-2xl font-bold text-[#2e8b57] mt-1 font-mono tabular-nums">
            {formatRupiah(report.revenue)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{report.invoiceCount} invoice terbit</div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Total Pengeluaran</div>
          <div className="text-2xl font-bold text-[#c0392b] mt-1 font-mono tabular-nums">
            {formatRupiah(report.totalExpenses)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Operasional + Pembelian Part
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Laba Kotor</div>
          <div className="text-2xl font-bold text-[var(--text)] mt-1 font-mono tabular-nums">
            {formatRupiah(report.grossProfit)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Pendapatan − Pengeluaran</div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase">Jumlah Work Order</div>
          <div className="text-2xl font-bold text-[var(--text)] mt-1 font-mono tabular-nums">
            {report.totalWo} WO
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{report.closedWo} WO selesai ditutup</div>
        </div>
      </div>

      {/* 5-Month Bar Chart (recharts) */}
      <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)] space-y-4">
        <h2 className="text-base font-semibold">Grafik Tren Pendapatan vs Pengeluaran (5 Bulan Terakhir)</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={v => `${Math.round(v / 1_000_000)}Jt`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(val: any) => formatRupiah(Number(val))} />
              <Legend />
              <Bar dataKey="revenue" name="Pendapatan" fill="#1f3a5f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Pengeluaran" fill="#c9a227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Selling Spare Parts Table */}
      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">10 Spare Part Terlaris Periode {period}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                <th className="py-3 px-4 font-semibold">Kode</th>
                <th className="py-3 px-4 font-semibold">Nama Spare Part</th>
                <th className="py-3 px-4 font-semibold text-right">Qty Terpakai</th>
                <th className="py-3 px-4 font-semibold text-right">Nilai Penjualan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              {report.topParts.map((p: any) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-mono text-xs font-semibold">{p.code}</td>
                  <td className="py-3 px-4 font-medium">{p.name}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                    {p.total_qty} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {formatRupiah(p.total_sales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
