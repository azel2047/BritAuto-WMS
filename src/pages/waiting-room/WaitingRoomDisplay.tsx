import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Wrench, CheckCircle2, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useRealtimeSse } from '../../lib/sse';
import { formatDateTimeId } from '../../lib/format';
import { BritLogo } from '../../components/domain/BritLogo';

export const WaitingRoomDisplayPage: React.FC = () => {
  const { lastUpdatedId } = useRealtimeSse();

  const { data } = useQuery<{ updatedAt: string; items: any[] }>({
    queryKey: ['waiting-room'],
    queryFn: () => apiFetch('/public/waiting-room'),
    refetchInterval: 5000, // Fallback polling 5s in addition to SSE
  });

  const items = data?.items || [];

  return (
    <div className="min-h-screen bg-[#14243b] text-white p-6 sm:p-10 flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/15">
          <div className="flex items-center gap-4">
            <BritLogo size={56} showText={false} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                STATUS SERVIS KENDARAAN — RUANG TUNGGU PELANGGAN
              </h1>
              <p className="text-sm text-[#c9a227] font-medium">
                Bengkel Brit Auto · Spesialis Jaguar, Land Rover, Bentley, Rolls-Royce
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-white/60">Pembaruan Otomatis (Real-time)</div>
              <div className="text-sm font-mono text-white/90 tabular-nums">
                {data?.updatedAt ? formatDateTimeId(data.updatedAt) : '-'}
              </div>
            </div>
            <Link
              to="/"
              className="px-3.5 py-2 rounded-[6px] bg-white/10 hover:bg-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Portal Staf
            </Link>
          </div>
        </header>

        {/* Vehicle Cards Grid (Large Typography >=28px for Plate, Zero Personal Data) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map(item => {
            const isHighlighted = lastUpdatedId === item.id;
            const isWorking = item.status === 'DIKERJAKAN';
            const isReady = item.status === 'DIPERIKSA';
            const isReview = item.status === 'SELESAI_DIKERJAKAN';

            return (
              <div
                key={item.id}
                className={`rounded-[12px] p-6 border transition-all ${
                  isHighlighted
                    ? 'bg-[#3a3217] border-[#c9a227] ring-2 ring-[#c9a227]'
                    : 'bg-[#1f3a5f] border-white/15'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-3xl sm:text-4xl font-bold tracking-wider text-white tabular-nums">
                      {item.plateMasked}
                    </div>
                    <div className="text-lg font-medium text-white/85 mt-1">
                      {item.brand} {item.model} ({item.year})
                    </div>
                  </div>
                  <span className="font-mono text-xs text-white/60 bg-[#14243b]/60 px-2.5 py-1 rounded">
                    {item.woNumber}
                  </span>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <div
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] text-base font-bold ${
                      isReady
                        ? 'bg-[#e4f4ec] text-[#2e8b57]'
                        : isReview
                        ? 'bg-[#f6efd2] text-[#14243b]'
                        : isWorking
                        ? 'bg-[#e2eefa] text-[#1f6fb2]'
                        : 'bg-[#fdf1dc] text-[#b36b00]'
                    }`}
                  >
                    {isReady ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isReview ? (
                      <ClipboardCheck className="w-5 h-5" />
                    ) : isWorking ? (
                      <Wrench className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                    <span>{item.friendlyStatus}</span>
                  </div>

                  <div className="text-right text-xs text-white/75 font-mono tabular-nums">
                    <div>
                      Pekerjaan: {item.doneJobs}/{item.totalJobs}
                    </div>
                    <div className="mt-0.5">Masuk: {formatDateTimeId(item.receivedAt)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="mt-10 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-white/60 gap-2">
        <span>Demi perlindungan data pribadi (UU PDP No. 27/2022), nomor polisi disamarkan dan nama pelanggan tidak ditampilkan.</span>
        <span>Bengkel Brit Auto — Layanan Premium Kendaraan Inggris</span>
      </footer>
    </div>
  );
};
