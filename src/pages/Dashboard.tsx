import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ClipboardList,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  BellRing,
  Wrench,
  PlusCircle,
  Search,
  ArrowRight,
  Cpu,
  Smartphone,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatRupiah, formatDateTimeId, ROLE_LABELS } from '../lib/format';
import { StatusBadge } from '../components/domain/StatusBadge';
import { Modal } from '../components/ui/Modal';

export const DashboardPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [plateQuery, setPlateQuery] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState(
    'Analisis gejala getaran transmisi ZF 8HP pada Rolls-Royce Ghost saat perpindahan gigi 2 ke 3 beserta langkah pemeriksaan tekanan mechatronic.'
  );
  const [aiAnswer, setAiAnswer] = useState('');

  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/dashboard/summary'),
  });

  const aiMutation = useMutation({
    mutationFn: (query: string) =>
      apiFetch<{ answer: string }>('/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
    onSuccess: data => setAiAnswer(data.answer),
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const handleQuickPlateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateQuery.trim()) return;
    navigate(`/vehicles?q=${encodeURIComponent(plateQuery.trim())}`);
  };

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-[var(--navy-100)] rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)]">
            Dashboard {ROLE_LABELS[user!.role]}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
            Bengkel Spesialis Jaguar · Land Rover · Bentley · Rolls-Royce
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'PM' && (
            <Link
              to="/owner/mobile"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] border border-[#1f3a5f] text-[#1f3a5f] dark:border-white/30 dark:text-white text-xs font-semibold hover:bg-[var(--navy-50)] transition-colors whitespace-nowrap"
            >
              <Smartphone className="w-4 h-4" />
              <span>Tampilan Mobile Pemilik</span>
            </Link>
          )}
          <button
            onClick={() => setAiModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] border border-[var(--border)] bg-[var(--navy-50)] text-[var(--text)] text-xs font-semibold hover:bg-[var(--navy-100)] transition-colors whitespace-nowrap"
          >
            <Cpu className="w-4 h-4 text-[#1f3a5f]" />
            <span>Konsultasi Teknis Mendalam</span>
          </button>
          {(user?.role === 'SA' || user?.role === 'AD') && (
            <Link
              to="/work-orders/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs sm:text-sm font-semibold hover:bg-[#2c4f7c] transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Terima Kendaraan</span>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Vehicle / Plate Search Bar (BR-01) */}
      {(user?.role === 'SA' || user?.role === 'KR' || user?.role === 'AD' || user?.role === 'PM') && (
        <form
          onSubmit={handleQuickPlateSearch}
          className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={plateQuery}
              onChange={e => setPlateQuery(e.target.value)}
              placeholder="Cari cepat nomor polisi lama/baru (mis. B 128 XL atau B 1234 JAG), nama pelanggan, atau telepon..."
              className="w-full h-10 pl-10 pr-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#2c4f7c]"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-5 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-medium hover:bg-[#2c4f7c] transition-colors whitespace-nowrap shrink-0"
          >
            Cari Riwayat Kendaraan
          </button>
        </form>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
            <span>WORK ORDER AKTIF</span>
            <ClipboardList className="w-4 h-4 text-[#1f3a5f]" />
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--text)] tabular-nums">{summary.activeWoCount}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {summary.doneTodayCount} kendaraan selesai hari ini
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
            <span>PENDAPATAN BULAN INI</span>
            <Wallet className="w-4 h-4 text-[#2e8b57]" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-[var(--text)] tabular-nums truncate">
            {formatRupiah(summary.revenueMonth)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Periode {summary.currentPeriod}</div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
            <span>STOK DI BAWAH MINIMUM</span>
            <AlertTriangle className="w-4 h-4 text-[#b36b00]" />
          </div>
          <div className="mt-2 text-3xl font-bold text-[#b36b00] tabular-nums">{summary.lowStockCount}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {summary.pendingOpnames > 0 ? `${summary.pendingOpnames} opname menunggu setuju` : 'Perlu restock segera'}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[10px] border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
            <span>REMINDER JATUH TEMPO</span>
            <BellRing className="w-4 h-4 text-[#1f6fb2]" />
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--text)] tabular-nums">{summary.dueRemindersCount}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Menunggu follow-up Service Advisor</div>
        </div>
      </div>

      {/* Main 2-column Grid: Active Work Orders & Technician / Stock Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Active Work Orders */}
        <div className="lg:col-span-2 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-base font-semibold">Work Order Sedang Berjalan</h2>
            <Link to="/work-orders" className="text-xs font-medium text-[#1f6fb2] hover:underline flex items-center gap-1">
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                  <th scope="col" className="py-3 px-4 font-semibold">No. WO</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Kendaraan</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Pelanggan</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Estimasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {summary.activeWorkOrders.map((wo: any) => (
                  <tr
                    key={wo.id}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="hover:bg-[var(--navy-50)] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1f3a5f] dark:text-[#c9a227] whitespace-nowrap">
                      {wo.wo_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--text)]">{wo.plate_current}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {wo.brand} {wo.model}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm">{wo.customer_name}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={wo.status} kind="wo" />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap">
                      {formatRupiah(wo.estimate_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right col: Active Technicians & Low Stock */}
        <div className="space-y-6">
          <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold">Status Teknisi Bengkel</h2>
              <Link to="/my-jobs" className="text-xs text-[#1f6fb2] hover:underline">
                Job Card
              </Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {summary.activeTechnicians.map((t: any) => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium text-[var(--text)]">{t.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {t.current_job ? `${t.current_job} (${t.current_plate})` : 'Siap menerima tugas'}
                    </div>
                  </div>
                  {t.current_job ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#e2eefa] text-[#1f6fb2] text-xs font-medium whitespace-nowrap">
                      <Wrench className="w-3 h-3" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#e4f4ec] text-[#2e8b57] text-xs font-medium whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" />
                      Tersedia
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold">Peringatan Stok Minimum (BR-05)</h2>
              <Link to="/parts" className="text-xs text-[#1f6fb2] hover:underline">
                Kelola Stok
              </Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {summary.lowStockParts.slice(0, 5).map((p: any) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text)] truncate">{p.name}</div>
                    <div className="text-[var(--text-muted)] font-mono">{p.code}</div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="px-2 py-0.5 rounded bg-[#fdf1dc] text-[#b36b00] font-semibold">
                      Sisa {p.stock_qty} {p.unit}
                    </span>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Min: {p.min_stock}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deep Technical Consultation Modal (gemini-4-argon ThinkingLevel.HIGH) */}
      <Modal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="Analisis Teknis & Operasional Mendalam"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Gunakan penalaran teknis mendalam untuk menganalisis gejala kerusakan spesifik mobil Inggris (Jaguar, Land Rover, Bentley, Rolls-Royce) atau evaluasi operasional bengkel.
          </p>
          <textarea
            rows={3}
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            className="w-full p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#2c4f7c]"
            placeholder="Masukkan pertanyaan teknis atau skenario analisis..."
          />
          <div className="flex justify-end">
            <button
              onClick={() => aiMutation.mutate(aiQuery)}
              disabled={aiMutation.isPending || !aiQuery.trim()}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-medium hover:bg-[#2c4f7c] disabled:opacity-50"
            >
              {aiMutation.isPending ? 'Menganalisis secara mendalam...' : 'Jalankan Analisis'}
            </button>
          </div>
          {aiAnswer && (
            <div className="p-4 rounded-[8px] bg-[var(--navy-50)] border border-[var(--border)] text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
              {aiAnswer}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
