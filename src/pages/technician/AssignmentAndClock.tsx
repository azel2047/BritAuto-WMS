import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, PauseCircle, UserCheck, Wrench, CheckCircle2, Hammer } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PageLayout } from '../../components/layout/PageLayout';
import { StatusBadge, PlateChip } from '../../components/domain/StatusBadge';
import { EmptyState, TableSkeleton, ErrorCard } from '../../components/ui/Modal';

export const AssignmentBoardPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<'UNASSIGNED' | 'ALL'>('UNASSIGNED');

  const {
    data: workOrders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['work-orders', 'ALL'],
    queryFn: () => apiFetch('/work-orders'),
  });

  const activeWos = workOrders.filter(w => w.status !== 'DITUTUP' && w.status !== 'DIBATALKAN');
  const unassignedCount = activeWos.filter(
    w => w.status === 'MENUNGGU_PENUGASAN' || !w.technician_names
  ).length;

  const displayedWos =
    filterMode === 'UNASSIGNED'
      ? activeWos.filter(w => w.status === 'MENUNGGU_PENUGASAN' || !w.technician_names)
      : activeWos;

  return (
    <PageLayout
      title="Tugaskan Teknisi"
      primaryAction={
        <button type="button" onClick={() => navigate('/work-orders')} className="wc-btn-primary">
          <span>Semua Work Order</span>
        </button>
      }
      toolbar={
        <div className="flex items-center gap-2 h-10">
          <button
            type="button"
            onClick={() => setFilterMode('UNASSIGNED')}
            className={filterMode === 'UNASSIGNED' ? 'wc-btn-primary min-h-[36px]' : 'wc-btn-secondary min-h-[36px]'}
          >
            Perlu ditugaskan ({unassignedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('ALL')}
            className={filterMode === 'ALL' ? 'wc-btn-primary min-h-[36px]' : 'wc-btn-secondary min-h-[36px]'}
          >
            Semua aktif ({activeWos.length})
          </button>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : displayedWos.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          message="Semua Work Order aktif sudah ditugaskan ke teknisi."
          actionLabel="Tampilkan Semua Aktif"
          onAction={() => setFilterMode('ALL')}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {displayedWos.map((wo: any) => (
              <div
                key={wo.id}
                className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[var(--bg)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlateChip plate={wo.plate_current} />
                  <div className="min-w-0">
                    <div className="text-[14px] leading-5 font-semibold text-[var(--text)]">
                      {wo.brand} {wo.model} ({wo.year})
                    </div>
                    <div className="text-[12px] leading-4 text-[var(--text-muted)]">
                      <span className="font-mono">{wo.wo_number}</span> · Teknisi: {wo.technician_names || 'Belum ada'} · {wo.done_jobs}/{wo.total_jobs} selesai
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={wo.status} workOrder={wo} kind="wo" />
                  <button
                    type="button"
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="wc-btn-primary"
                  >
                    <span>Tugaskan</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
};

const LiveDisplayTimer: React.FC<{ baseMinutes: number; running: boolean }> = ({ baseMinutes, running }) => {
  const [secs, setSecs] = useState(baseMinutes * 60 + 12);

  useEffect(() => {
    if (!running) {
      setSecs(baseMinutes * 60);
      return;
    }
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [baseMinutes, running]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <div className="font-mono text-[24px] leading-8 font-semibold text-[var(--text)] tabular-nums">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  );
};

/**
 * Teknisi: kartu pekerjaan; tombol MULAI/SELESAI besar (64px, penuh lebar di mobile) + timer;
 * sekunder "Tunggu part".
 */
export const TechnicianJobsPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTechId, setSelectedTechId] = useState<string>('');

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['technicians'],
    queryFn: () => apiFetch('/users?role=TK'),
    enabled: user?.role !== 'TK',
  });

  const {
    data: jobs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['my-jobs', selectedTechId],
    queryFn: () => apiFetch(selectedTechId ? `/my-jobs?technicianId=${selectedTechId}` : '/my-jobs'),
  });

  const clockOnMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/wo-jobs/${id}/clock-on`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Pekerjaan dimulai', 'success');
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const waitingPartMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/wo-jobs/${id}/waiting-part`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Status diubah ke Tunggu part', 'info');
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const clockOffMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/wo-jobs/${id}/clock-off`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Pekerjaan selesai', 'success');
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  return (
    <PageLayout
      title="Pekerjaan Saya"
      primaryAction={
        <button type="button" onClick={() => navigate('/tools')} className="wc-btn-secondary">
          <Hammer className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
          <span>Alat Saya</span>
        </button>
      }
      toolbar={
        user?.role !== 'TK' ? (
          <div className="flex items-center gap-3 h-10">
            <label htmlFor="tech-select" className="text-[14px] leading-5 text-[var(--text-muted)]">
              Teknisi:
            </label>
            <select
              id="tech-select"
              value={selectedTechId}
              onChange={e => setSelectedTechId(e.target.value)}
              className="wc-input w-56"
            >
              <option value="">Semua teknisi</option>
              {technicians.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Wrench} message="Belum ada pekerjaan yang ditugaskan." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs.map((j: any) => {
            const isRunning = j.status === 'BERJALAN';
            return (
              <div
                key={j.id}
                className={`wc-card flex flex-col justify-between gap-6 ${
                  isRunning ? 'wc-card-selected' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PlateChip plate={j.plate_current} />
                      <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {j.wo_number}
                      </span>
                    </div>
                    <StatusBadge status={j.status} kind="job" />
                  </div>

                  <div>
                    <h2 className="text-h2">{j.job_name}</h2>
                    <div className="text-[14px] leading-5 text-[var(--text-muted)] mt-1">
                      {j.brand} {j.model} ({j.year})
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-[12px] leading-4 text-[var(--text-muted)]">Durasi aktual</div>
                      <LiveDisplayTimer
                        baseMinutes={Number(j.total_productive_minutes || 0)}
                        running={isRunning}
                      />
                    </div>
                    <div className="text-right text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                      Standar {j.standard_minutes} mnt
                    </div>
                  </div>
                </div>

                {/* Tombol MULAI / SELESAI besar (64px, penuh lebar di mobile) + sekunder "Tunggu part" */}
                <div className="space-y-2">
                  {j.status === 'MENUNGGU' || j.status === 'MENUNGGU_PART' ? (
                    <button
                      type="button"
                      onClick={() => clockOnMutation.mutate(j.id)}
                      disabled={clockOnMutation.isPending}
                      className="w-full h-16 wc-btn-primary text-[16px] leading-6 font-semibold"
                    >
                      <Play className="w-5 h-5 stroke-[1.5]" />
                      <span>Mulai Kerja</span>
                    </button>
                  ) : j.status === 'BERJALAN' ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => clockOffMutation.mutate(j.id)}
                        disabled={clockOffMutation.isPending}
                        className="w-full h-16 wc-btn-primary text-[16px] leading-6 font-semibold"
                      >
                        <Square className="w-5 h-5 stroke-[1.5]" />
                        <span>Selesai Kerja</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => waitingPartMutation.mutate(j.id)}
                        disabled={waitingPartMutation.isPending}
                        className="w-full min-h-[44px] wc-btn-secondary"
                      >
                        <PauseCircle className="w-5 h-5 stroke-[1.5]" />
                        <span>Tunggu Part</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-12 rounded-[8px] bg-[var(--success-bg)] text-[var(--success)] font-medium text-[14px] leading-5 flex items-center justify-center gap-2 tabular-nums">
                      <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
                      <span>Selesai ({j.total_productive_minutes} mnt)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};
