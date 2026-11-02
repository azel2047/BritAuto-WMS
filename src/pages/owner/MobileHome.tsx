import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  BellRing,
  Wrench,
  Check,
  X,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { formatRupiah } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { StatusBadge } from '../../components/domain/StatusBadge';

export const OwnerMobileHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const queryClient = useQueryClient();

  const { data: summary } = useQuery<any>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/dashboard/summary'),
  });

  const { data: opnames = [] } = useQuery<any[]>({
    queryKey: ['stock-opnames'],
    queryFn: () => apiFetch('/stock-opnames'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      apiFetch(`/stock-opnames/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }),
    onSuccess: () => {
      showToast('Keputusan persetujuan stock opname disimpan', 'success');
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (!summary) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">Memuat ringkasan pemilik...</div>;
  }

  const submittedOpnames = opnames.filter(o => o.status === 'SUBMITTED');

  return (
    <div className="max-w-md mx-auto space-y-4 w-full overflow-x-hidden">
      <div className="bg-[#1f3a5f] text-white p-4 rounded-[10px] shadow">
        <div className="text-xs text-[#c9a227] font-semibold uppercase tracking-wider">
          Pemantauan Pemilik · Bapak Agus Sugiantu
        </div>
        <h1 className="text-lg font-bold mt-0.5">Ringkasan Operasional Hari Ini</h1>
        <p className="text-xs text-white/75 mt-0.5">Periode Aktif: {summary.currentPeriod}</p>
      </div>

      {/* Vertical large number cards per DESIGN.md §5 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium">WO Aktif</div>
          <div className="text-3xl font-bold text-[var(--text)] mt-1 tabular-nums">{summary.activeWoCount}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Sedang ditangani</div>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] font-medium">Selesai Hari Ini</div>
          <div className="text-3xl font-bold text-[#2e8b57] mt-1 tabular-nums">{summary.doneTodayCount}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Invoice terbit</div>
        </div>
      </div>

      <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] font-medium">Pendapatan Bulan Ini</span>
          <Wallet className="w-4 h-4 text-[#2e8b57]" />
        </div>
        <div className="text-2xl font-bold text-[var(--text)] mt-1 tabular-nums">
          {formatRupiah(summary.revenueMonth)}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <Link to="/reports" className="text-[#1f6fb2] font-medium hover:underline">
            Lihat Laporan Bulanan →
          </Link>
          <Link to="/performance" className="text-[#1f3a5f] font-medium hover:underline flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Bonus Teknisi</span>
          </Link>
        </div>
      </div>

      {/* Pending Stock Opname Approval Card (BR-11) */}
      {submittedOpnames.length > 0 && (
        <div className="bg-[#fdf1dc] border border-[#b36b00]/30 p-4 rounded-[10px] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#b36b00] uppercase">
              Persetujuan Selisih Stock Opname ({submittedOpnames.length})
            </span>
          </div>
          {submittedOpnames.map(op => (
            <div key={op.id} className="bg-white/90 dark:bg-slate-900 p-3 rounded-[6px] text-xs space-y-2">
              <div className="font-semibold text-[var(--text)]">
                Periode {op.period} · Diajukan oleh {op.created_by_name}
              </div>
              <div className="space-y-1">
                {op.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="truncate pr-2">{it.part_name}</span>
                    <span className="font-mono font-semibold shrink-0">
                      Selisih {it.diff > 0 ? `+${it.diff}` : it.diff} ({it.reason})
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => approveMutation.mutate({ id: op.id, approved: true })}
                  className="flex-1 py-2 rounded bg-[#2e8b57] text-white font-semibold flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Setujui Penyesuaian
                </button>
                <button
                  onClick={() => approveMutation.mutate({ id: op.id, approved: false })}
                  className="px-3 py-2 rounded bg-[#fbe7e4] text-[#c0392b] font-semibold flex items-center justify-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Work Orders Compact List */}
      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold">Work Order Aktif</h2>
          <Link to="/work-orders" className="text-xs text-[#1f6fb2]">
            Semua
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {summary.activeWorkOrders.map((wo: any) => (
            <div
              key={wo.id}
              onClick={() => navigate(`/work-orders/${wo.id}`)}
              className="p-3.5 flex items-center justify-between gap-2 active:bg-[var(--navy-50)] cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[var(--text)]">{wo.plate_current}</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{wo.wo_number}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {wo.brand} {wo.model} · {wo.customer_name}
                </div>
              </div>
              <StatusBadge status={wo.status} kind="wo" />
            </div>
          ))}
        </div>
      </div>

      {/* Active Technicians */}
      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold">Teknisi Aktif</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {summary.activeTechnicians.map((t: any) => (
            <div key={t.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-[var(--text)]">{t.name}</div>
                <div className="text-[var(--text-muted)]">{t.current_job || 'Standby'}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-medium ${
                  t.current_job ? 'bg-[#e2eefa] text-[#1f6fb2]' : 'bg-[#e4f4ec] text-[#2e8b57]'
                }`}
              >
                {t.current_job ? t.current_plate : 'Siap'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Low Stock & Reminders */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-[#b36b00]">
              <AlertTriangle className="w-4 h-4" /> Stok Rendah ({summary.lowStockCount})
            </span>
            <Link to="/parts" className="text-xs text-[#1f6fb2]">
              Detail
            </Link>
          </div>
          <div className="space-y-1.5">
            {summary.lowStockParts.slice(0, 4).map((p: any) => (
              <div key={p.id} className="flex justify-between text-xs">
                <span className="truncate pr-2">{p.name}</span>
                <span className="font-mono font-semibold text-[#b36b00] shrink-0">
                  {p.stock_qty}/{p.min_stock} {p.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-[#1f6fb2]">
              <BellRing className="w-4 h-4" /> Reminder Servis Jatuh Tempo ({summary.dueRemindersCount})
            </span>
            <Link to="/reminders" className="text-xs text-[#1f6fb2]">
              Detail
            </Link>
          </div>
          <div className="space-y-1.5">
            {summary.dueReminders.slice(0, 3).map((r: any) => (
              <div key={r.id} className="flex justify-between text-xs">
                <span className="font-medium">{r.plate_current} ({r.brand} {r.model})</span>
                <span className="text-[var(--text-muted)]">{r.customer_name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
