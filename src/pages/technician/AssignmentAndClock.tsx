import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, PauseCircle, Printer, UserCheck, Wrench, Clock } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { EmptyState } from '../../components/ui/Modal';

export const AssignmentBoardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ['work-orders', 'ALL'],
    queryFn: () => apiFetch('/work-orders'),
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['technicians'],
    queryFn: () => apiFetch('/users?role=TK'),
  });

  const activeWos = workOrders.filter(w => w.status !== 'DITUTUP' && w.status !== 'DIBATALKAN');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Papan Penugasan Teknisi & Job Card (KR)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Setiap Work Order dapat memiliki banyak pekerjaan dan tiap pekerjaan ditugaskan ke satu teknisi (BR-02).
          </p>
        </div>
      </div>

      {activeWos.length === 0 ? (
        <EmptyState icon={UserCheck} message="Tidak ada Work Order aktif yang membutuhkan penugasan." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeWos.map((wo: any) => (
            <div
              key={wo.id}
              className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-[#1f3a5f] dark:text-[#c9a227]">
                    {wo.wo_number}
                  </span>
                  <StatusBadge status={wo.status} kind="wo" />
                </div>
                <div className="font-semibold text-base">
                  {wo.plate_current} — {wo.brand} {wo.model}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Pelanggan: {wo.customer_name} · Teknisi: <strong>{wo.technician_names || 'Belum ditugaskan'}</strong>
                </div>
                <div className="text-xs font-mono text-[var(--text-muted)]">
                  Progres Pekerjaan: {wo.done_jobs}/{wo.total_jobs} selesai
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold hover:bg-[#2c4f7c] inline-flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Kelola Penugasan & Job Card</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TechnicianJobsPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTechId, setSelectedTechId] = useState<string>('');

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['technicians'],
    queryFn: () => apiFetch('/users?role=TK'),
    enabled: user?.role !== 'TK',
  });

  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-jobs', selectedTechId],
    queryFn: () =>
      apiFetch(selectedTechId ? `/my-jobs?technicianId=${selectedTechId}` : '/my-jobs'),
  });

  const clockOnMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/wo-jobs/${id}/clock-on`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Clock On berhasil! Waktu mulai dicatat dari server.', 'success');
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const waitingPartMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/wo-jobs/${id}/waiting-part`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Status diubah ke Menunggu Part (waktu tunggu tidak dihitung jam produktif)', 'info');
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const clockOffMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/wo-jobs/${id}/clock-off`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Clock Off berhasil! Pekerjaan selesai.', 'success');
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Job Card Teknisi & Clock On/Off</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Satu pekerjaan aktif per teknisi pada satu waktu. Waktu tunggu spare part tidak dihitung produktif (BR-03, BR-06).
          </p>
        </div>

        {user?.role !== 'TK' && (
          <select
            value={selectedTechId}
            onChange={e => setSelectedTechId(e.target.value)}
            className="h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
          >
            <option value="">Semua Teknisi Aktif</option>
            {technicians.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="h-48 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Wrench} message="Belum ada Job Card aktif yang ditugaskan kepada Anda." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((j: any) => (
            <div
              key={j.id}
              className={`bg-[var(--surface)] rounded-[10px] border p-5 flex flex-col justify-between gap-4 ${
                j.status === 'BERJALAN'
                  ? 'border-[#1f6fb2] ring-2 ring-[#1f6fb2]/20'
                  : 'border-[var(--border)]'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#1f3a5f] dark:text-[#c9a227]">
                    {j.wo_number} · Job #{j.id}
                  </span>
                  <StatusBadge status={j.status} kind="job" />
                </div>

                <div>
                  <div className="text-lg font-bold text-[var(--text)]">{j.job_name}</div>
                  <div className="text-sm font-medium text-[var(--text-muted)] mt-0.5">
                    <span className="font-mono font-bold text-[var(--text)]">{j.plate_current}</span> — {j.brand}{' '}
                    {j.model} ({j.year})
                  </div>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--navy-50)] text-xs space-y-1">
                  <div>
                    <strong>Teknisi:</strong> {j.technician_name || '-'}
                  </div>
                  <div>
                    <strong>Waktu Standar:</strong> <span className="font-mono">{j.standard_minutes} menit</span> ·{' '}
                    <strong>Tercatat Produktif:</strong>{' '}
                    <span className="font-mono">{j.total_productive_minutes} menit</span>
                  </div>
                  <div>
                    <strong>Keluhan:</strong> {j.issues?.map((x: any) => x.description).join('; ') || '-'}
                  </div>
                </div>
              </div>

              {/* Large Tap Target Clock On / Off Controls (h-16 = 64px per DESIGN.md §3) */}
              <div className="space-y-2 pt-2">
                {j.status === 'MENUNGGU' || j.status === 'MENUNGGU_PART' ? (
                  <button
                    onClick={() => clockOnMutation.mutate(j.id)}
                    disabled={clockOnMutation.isPending}
                    className="w-full h-16 rounded-[8px] bg-[#1f3a5f] hover:bg-[#2c4f7c] text-white font-bold text-base flex items-center justify-center gap-2.5 shadow transition-colors"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>CLOCK ON — MULAI KERJAKAN</span>
                  </button>
                ) : j.status === 'BERJALAN' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => clockOffMutation.mutate(j.id)}
                      disabled={clockOffMutation.isPending}
                      className="w-full h-16 rounded-[8px] bg-[#2e8b57] hover:opacity-95 text-white font-bold text-base flex items-center justify-center gap-2 shadow"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      <span>CLOCK OFF (SELESAI)</span>
                    </button>
                    <button
                      onClick={() => waitingPartMutation.mutate(j.id)}
                      disabled={waitingPartMutation.isPending}
                      className="w-full h-16 rounded-[8px] bg-[#fdf1dc] border border-[#b36b00]/40 text-[#b36b00] font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <PauseCircle className="w-5 h-5" />
                      <span>MENUNGGU PART</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-12 rounded-[8px] bg-[#e4f4ec] text-[#2e8b57] font-semibold text-sm flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Pekerjaan Telah Selesai ({j.total_productive_minutes} mnt)</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
