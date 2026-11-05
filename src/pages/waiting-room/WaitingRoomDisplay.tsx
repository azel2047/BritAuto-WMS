import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useRealtimeSse } from '../../lib/sse';
import { formatDateTimeId } from '../../lib/format';
import { BritLogo } from '../../components/domain/BritLogo';

const PROGRESS_LABELS = ['Diterima', 'Dikerjakan', 'Diperiksa', 'Siap'];

function getProgressIndex(status: string): number {
  if (status === 'DIPERIKSA' || status === 'DITUTUP') return 3;
  if (status === 'SELESAI_DIKERJAKAN') return 2;
  if (status === 'DIKERJAKAN') return 1;
  return 0;
}

/**
 * LAYAR RUANG TUNGGU (publik, TV):
 * Latar #14243B, tanpa menu/sidebar, teks #F3F6FA, min 28px.
 * Grid kartu: plat tersamar (mono, 32px), model 20px, status 28px dengan 4 titik progres.
 * Tanpa nama/telepon. Auto-refresh.
 */
export const WaitingRoomDisplayPage: React.FC = () => {
  const { lastUpdatedId } = useRealtimeSse();

  const { data } = useQuery<{ updatedAt: string; items: any[] }>({
    queryKey: ['waiting-room'],
    queryFn: () => apiFetch('/public/waiting-room'),
    refetchInterval: 5000,
  });

  const items = data?.items || [];

  return (
    <div className="min-h-screen bg-[#14243B] text-[#F3F6FA] p-6 sm:p-8 flex flex-col justify-between">
      <div className="max-w-[1360px] w-full mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/15">
          <div className="flex items-center gap-4">
            <BritLogo size={40} showText={false} inverted />
            <h1 className="text-[28px] sm:text-[32px] leading-[40px] font-semibold text-[#F3F6FA]">
              Status Kendaraan
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[16px] leading-6 text-[#F3F6FA]/80 tabular-nums">
              {data?.updatedAt ? formatDateTimeId(data.updatedAt) : '-'}
            </span>
            <Link
              to="/"
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-[8px] border border-white/25 text-[14px] leading-5 font-medium text-[#F3F6FA] hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
              <span>Kembali</span>
            </Link>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="py-16 text-[28px] leading-9 text-[#F3F6FA]/80">
            Belum ada antrean servis aktif.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map(item => {
              const stepIdx = getProgressIndex(item.status);
              const isHighlighted = lastUpdatedId === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-[12px] bg-[#1F3A5F] p-6 border transition-colors flex flex-col justify-between gap-6 ${
                    isHighlighted ? 'border-[#C9A227]' : 'border-white/15'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[32px] leading-[40px] font-semibold text-[#F3F6FA] tabular-nums">
                        {item.plateMasked}
                      </span>
                      <span className="font-mono text-[14px] leading-5 text-[#F3F6FA]/70 tabular-nums">
                        {item.woNumber}
                      </span>
                    </div>
                    <div className="text-[20px] leading-7 font-medium text-[#F3F6FA]/85">
                      {item.brand} {item.model} ({item.year})
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/15">
                    <div className="text-[28px] leading-9 font-semibold text-[#F3F6FA]">
                      {PROGRESS_LABELS[stepIdx]}
                    </div>

                    {/* 4 Titik Progres */}
                    <div className="grid grid-cols-4 gap-2" aria-label={`Tahap ${stepIdx + 1} dari 4`}>
                      {PROGRESS_LABELS.map((lbl, idx) => {
                        const active = idx <= stepIdx;
                        const current = idx === stepIdx;
                        return (
                          <div key={lbl} className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-3 h-3 rounded-full shrink-0 ${
                                  current
                                    ? 'bg-[#C9A227]'
                                    : active
                                    ? 'bg-[#F3F6FA]'
                                    : 'bg-white/20'
                                }`}
                              />
                              <div
                                className={`h-1 flex-1 rounded ${
                                  active ? 'bg-[#C9A227]' : 'bg-white/15'
                                }`}
                              />
                            </div>
                            <div
                              className={`text-[12px] leading-4 ${
                                active ? 'text-[#F3F6FA] font-medium' : 'text-[#F3F6FA]/50'
                              }`}
                            >
                              {lbl}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="max-w-[1360px] w-full mx-auto mt-8 pt-4 border-t border-white/15 text-[14px] leading-5 text-[#F3F6FA]/70 flex flex-wrap justify-between gap-2">
        <span>Nomor polisi disamarkan demi privasi pelanggan.</span>
        <span>Brit Auto</span>
      </footer>
    </div>
  );
};
