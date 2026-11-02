import React from 'react';
import {
  Clock,
  UserCheck,
  Wrench,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  XCircle,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { WO_STATUS_LABELS, JOB_STATUS_LABELS } from '../../lib/format';

export const StatusBadge: React.FC<{ status: string; kind?: 'wo' | 'job' | 'invoice' | 'stock' | 'warranty' }> = ({
  status,
  kind = 'wo',
}) => {
  if (kind === 'stock') {
    const low = status === 'LOW';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium whitespace-nowrap shrink-0 ${
          low ? 'bg-[#fdf1dc] text-[#b36b00]' : 'bg-[#e4f4ec] text-[#2e8b57]'
        }`}
      >
        {low ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        {low ? 'Stok Rendah' : 'Stok Aman'}
      </span>
    );
  }

  if (kind === 'invoice') {
    const isPaid = status === 'LUNAS';
    const isPartial = status === 'SEBAGIAN';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium whitespace-nowrap shrink-0 ${
          isPaid
            ? 'bg-[#e4f4ec] text-[#2e8b57]'
            : isPartial
            ? 'bg-[#e2eefa] text-[#1f6fb2]'
            : 'bg-[#fdf1dc] text-[#b36b00]'
        }`}
      >
        {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
        {isPaid ? 'Lunas' : isPartial ? 'Dibayar Sebagian' : 'Belum Bayar'}
      </span>
    );
  }

  if (kind === 'warranty') {
    const isGaransi = status === 'GARANSI';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium whitespace-nowrap shrink-0 ${
          isGaransi ? 'bg-[#e4f4ec] text-[#2e8b57]' : 'bg-[#fdf1dc] text-[#b36b00]'
        }`}
      >
        {isGaransi ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        {isGaransi ? 'Klaim Garansi' : 'Non-Garansi (Part Berbayar, Jasa Gratis)'}
      </span>
    );
  }

  if (kind === 'job') {
    const label = JOB_STATUS_LABELS[status] || status;
    const styleMap: Record<string, string> = {
      MENUNGGU: 'bg-[#fdf1dc] text-[#b36b00]',
      BERJALAN: 'bg-[#e2eefa] text-[#1f6fb2]',
      MENUNGGU_PART: 'bg-[#fbe7e4] text-[#c0392b]',
      SELESAI: 'bg-[#e4f4ec] text-[#2e8b57]',
    };
    const Icon =
      status === 'SELESAI'
        ? CheckCircle2
        : status === 'BERJALAN'
        ? Wrench
        : status === 'MENUNGGU_PART'
        ? AlertTriangle
        : Clock;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium whitespace-nowrap shrink-0 ${
          styleMap[status] || 'bg-[#f3f6fa] text-[#5b6b82]'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }

  const label = WO_STATUS_LABELS[status] || status;
  const map: Record<string, { cls: string; Icon: React.ElementType }> = {
    MENUNGGU_PENUGASAN: { cls: 'bg-[#fdf1dc] text-[#b36b00]', Icon: Clock },
    DITUGASKAN: { cls: 'bg-[#e2eefa] text-[#1f6fb2]', Icon: UserCheck },
    DIKERJAKAN: { cls: 'bg-[#e2eefa] text-[#1f6fb2]', Icon: Wrench },
    SELESAI_DIKERJAKAN: { cls: 'bg-[#e4f4ec] text-[#2e8b57]', Icon: CheckCircle2 },
    DIPERIKSA: { cls: 'bg-[#e6edf6] text-[#1f3a5f]', Icon: ClipboardCheck },
    DITUTUP: { cls: 'bg-[#f3f6fa] text-[#5b6b82]', Icon: Lock },
    DIBATALKAN: { cls: 'bg-[#fbe7e4] text-[#c0392b]', Icon: XCircle },
  };
  const cfg = map[status] || { cls: 'bg-[#f3f6fa] text-[#5b6b82]', Icon: Clock };
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};
