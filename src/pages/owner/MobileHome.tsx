import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Check, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { formatRupiah } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { PageLayout } from '../../components/layout/PageLayout';
import { PlateChip } from '../../components/domain/StatusBadge';
import { TableSkeleton, ErrorCard } from '../../components/ui/Modal';

/**
 * Pemilik (mobile & desktop):
 * 3 angka besar saja (WO aktif, Pendapatan bulan ini, Stok menipis)
 * + daftar "Perlu perhatian" maks 5 baris.
 */
export const OwnerMobileHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery<any>({
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
      showToast('Persetujuan opname disimpan', 'success');
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading) {
    return (
      <PageLayout title="Ringkasan">
        <TableSkeleton rows={4} />
      </PageLayout>
    );
  }

  if (isError || !summary) {
    return (
      <PageLayout title="Ringkasan">
        <ErrorCard onRetry={() => refetch()} />
      </PageLayout>
    );
  }

  const safeOpnames = Array.isArray(opnames) ? opnames : [];
  const submittedOpnames = safeOpnames.filter(o => o.status === 'SUBMITTED');
  const lowStockParts = Array.isArray(summary.lowStockParts) ? summary.lowStockParts : [];
  const dueReminders = Array.isArray(summary.dueReminders) ? summary.dueReminders : [];
  const activeWorkOrders = Array.isArray(summary.activeWorkOrders) ? summary.activeWorkOrders : [];

  const attentionItems: Array<{
    key: string;
    label: string;
    meta: string;
    plate?: string;
    to: string;
  }> = [];

  for (const p of lowStockParts.slice(0, 2)) {
    attentionItems.push({
      key: `part-${p.id}`,
      label: `Stok tipis: ${p.name}`,
      meta: `Sisa ${p.stock_qty} ${p.unit}`,
      to: '/parts',
    });
  }

  for (const r of dueReminders.slice(0, 2)) {
    attentionItems.push({
      key: `rem-${r.id}`,
      plate: r.plate_current,
      label: `${r.brand} ${r.model}`,
      meta: 'Jatuh tempo servis',
      to: '/reminders',
    });
  }

  for (const wo of activeWorkOrders) {
    if (attentionItems.length >= 5) break;
    if (wo.status === 'MENUNGGU_PENUGASAN' || wo.status === 'SELESAI_DIKERJAKAN') {
      attentionItems.push({
        key: `wo-${wo.id}`,
        plate: wo.plate_current,
        label: `${wo.brand} ${wo.model}`,
        meta: wo.status === 'MENUNGGU_PENUGASAN' ? 'Perlu ditugaskan' : 'Perlu diperiksa',
        to: `/work-orders/${wo.id}`,
      });
    }
  }

  const topFiveAttention = attentionItems.slice(0, 5);

  return (
    <PageLayout
      title="Ringkasan"
      primaryAction={
        <button type="button" onClick={() => navigate('/reports')} className="wc-btn-primary">
          <BarChart3 className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
          <span>Lihat Laporan</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* 3 Angka Besar Saja (Kartu: maks 1 judul + 1 angka + 1 keterangan pendek <=6 kata) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={() => navigate('/work-orders')}
            className="wc-card wc-card-hover text-left cursor-pointer"
          >
            <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">WO aktif</div>
            <div className="text-display text-[var(--text)] mt-2 tabular-nums">
              {summary.activeWoCount ?? 0}
            </div>
            <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-2">
              {summary.doneTodayCount ?? 0} selesai hari ini
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="wc-card wc-card-hover text-left cursor-pointer"
          >
            <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">Pendapatan bulan ini</div>
            <div className="text-[24px] leading-8 font-semibold font-mono text-[var(--text)] mt-2 tabular-nums">
              {formatRupiah(summary.revenueMonth)}
            </div>
            <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-2">
              Periode {summary.currentPeriod}
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/parts')}
            className="wc-card wc-card-hover text-left cursor-pointer"
          >
            <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">Stok menipis</div>
            <div className="text-display text-[var(--danger)] mt-2 tabular-nums">
              {summary.lowStockCount ?? 0}
            </div>
            <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-2">
              Perlu pembelian ulang
            </div>
          </button>
        </div>

        {/* Persetujuan Opname bila ada (BR-11) */}
        {submittedOpnames.length > 0 && (
          <section className="wc-card space-y-4">
            <h2 className="text-h3">Persetujuan Opname ({submittedOpnames.length})</h2>
            <div className="divide-y divide-[var(--border)]">
              {submittedOpnames.map(op => (
                <div key={op.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[14px] leading-5 font-semibold text-[var(--text)]">
                      Periode {op.period} · {op.created_by_name}
                    </div>
                    <div className="text-[12px] leading-4 text-[var(--text-muted)]">
                      {op.items?.map((it: any) => `${it.part_name} (${it.diff > 0 ? `+${it.diff}` : it.diff})`).join(', ')}
                    </div>
                  </div>
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Daftar "Perlu perhatian" maks 5 baris */}
        <section className="wc-card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-h3">Perlu Perhatian</h2>
          </div>
          {topFiveAttention.length === 0 ? (
            <div className="p-6 flex items-center gap-2 text-[14px] leading-5 text-[var(--success)]">
              <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
              <span>Semua beres</span>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {topFiveAttention.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="w-full min-h-[48px] px-6 py-3 flex items-center justify-between gap-4 hover:bg-[var(--bg)] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.plate && <PlateChip plate={item.plate} />}
                    <span className="text-[14px] leading-5 font-medium text-[var(--text)] truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] leading-4 text-[var(--text-muted)]">{item.meta}</span>
                    <ChevronRight className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
};
