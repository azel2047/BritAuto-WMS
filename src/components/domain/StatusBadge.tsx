import React, { useEffect, useState } from 'react';
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
  Play,
  Inbox,
} from 'lucide-react';

export interface WorkOrderStateInput {
  status?: string;
  effectiveStatus?: string;
  kanbanCol?: string;
  has_waiting_part?: boolean | number;
  waiting_part_jobs?: number;
  waiting_part?: boolean | number;
  jobs?: Array<{ status?: string; waiting_part?: boolean | number }>;
}

export interface BadgeConfig {
  status: string;
  label: string;
  cls: string;
  Icon: React.ElementType;
}

/**
 * Signature Visual Element: Chip Plat Nomor
 * font mono 600, latar #FFFFFF, border 1.5px #14243B, radius 6px, padding 2px 8px
 */
export const PlateChip: React.FC<{ plate?: string; size?: 'sm' | 'lg'; className?: string }> = ({
  plate = '-',
  size = 'sm',
  className = '',
}) => (
  <span className={`${size === 'lg' ? 'plate-chip-lg' : 'plate-chip'} ${className}`}>
    {plate}
  </span>
);

/**
 * Resolves canonical Work Order state.
 */
export function resolveWorkOrderStatus(status?: string, workOrder?: WorkOrderStateInput): string {
  const raw = workOrder?.effectiveStatus || status || workOrder?.status || 'MENUNGGU_PENUGASAN';

  if (raw === 'DIBATALKAN') return 'DIBATALKAN';
  if (raw === 'DITUTUP') return 'DITUTUP';

  const hasJobWaitingPart = Array.isArray(workOrder?.jobs)
    ? workOrder!.jobs.some(j => j.status === 'MENUNGGU_PART' || Boolean(j.waiting_part))
    : false;

  const isWaitingPart =
    raw === 'MENUNGGU_PART' ||
    workOrder?.kanbanCol === 'MENUNGGU_PART' ||
    Boolean(workOrder?.has_waiting_part) ||
    Number(workOrder?.waiting_part_jobs || 0) > 0 ||
    Boolean(workOrder?.waiting_part) ||
    hasJobWaitingPart;

  if (isWaitingPart && raw !== 'SELESAI_DIKERJAKAN' && raw !== 'DIPERIKSA') {
    return 'MENUNGGU_PART';
  }
  if (raw === 'MENUNGGU_PART' || workOrder?.kanbanCol === 'MENUNGGU_PART') {
    return 'MENUNGGU_PART';
  }

  if (raw === 'DIPERIKSA') return 'DIPERIKSA';
  if (raw === 'SELESAI_DIKERJAKAN' || raw === 'SIAP_INVOICE') return 'SELESAI_DIKERJAKAN';
  if (raw === 'DIKERJAKAN' || raw === 'BERJALAN' || raw === 'IN_PROGRESS') return 'DIKERJAKAN';
  if (raw === 'DITUGASKAN' || raw === 'ASSIGNED') return 'DITUGASKAN';
  if (raw === 'MENUNGGU_PENUGASAN' || raw === 'DITERIMA' || raw === 'RECEIVED') return 'MENUNGGU_PENUGASAN';

  return raw;
}

/**
 * Strictly 4 status color pairs across the entire application:
 * - success: #1E6B42 / #E4F4EC
 * - warning: #8A5200 / #FDF1DC
 * - info:    #175A91 / #E2EEFA
 * - danger:  #A52A1E / #FBE7E4
 * Labels strictly 1–2 words.
 */
const STATUS_STYLES = {
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)]',
};

export function getWorkOrderBadgeConfig(status?: string, workOrder?: WorkOrderStateInput): BadgeConfig {
  const resolved = resolveWorkOrderStatus(status, workOrder);

  const labelMap: Record<string, string> = {
    MENUNGGU_PENUGASAN: 'Perlu ditugaskan',
    DITUGASKAN: 'Ditugaskan',
    DIKERJAKAN: 'Dikerjakan',
    MENUNGGU_PART: 'Tunggu part',
    SELESAI_DIKERJAKAN: 'Perlu diperiksa',
    DIPERIKSA: 'Siap diserahkan',
    DITUTUP: 'Selesai',
    DIBATALKAN: 'Dibatalkan',
  };

  const map: Record<string, { cls: string; Icon: React.ElementType }> = {
    MENUNGGU_PENUGASAN: {
      cls: STATUS_STYLES.warning,
      Icon: Inbox,
    },
    DITUGASKAN: {
      cls: STATUS_STYLES.info,
      Icon: UserCheck,
    },
    DIKERJAKAN: {
      cls: STATUS_STYLES.success,
      Icon: Wrench,
    },
    MENUNGGU_PART: {
      cls: STATUS_STYLES.warning,
      Icon: AlertTriangle,
    },
    SELESAI_DIKERJAKAN: {
      cls: STATUS_STYLES.info,
      Icon: ClipboardCheck,
    },
    DIPERIKSA: {
      cls: STATUS_STYLES.success,
      Icon: CheckCircle2,
    },
    DITUTUP: {
      cls: STATUS_STYLES.success,
      Icon: Lock,
    },
    DIBATALKAN: {
      cls: STATUS_STYLES.danger,
      Icon: XCircle,
    },
  };

  const cfg = map[resolved] || {
    cls: STATUS_STYLES.info,
    Icon: Clock,
  };
  const label = labelMap[resolved] || resolved;

  return {
    status: resolved,
    label,
    cls: cfg.cls,
    Icon: cfg.Icon,
  };
}

export const StatusBadge: React.FC<{
  status?: string;
  workOrder?: WorkOrderStateInput;
  kind?: 'wo' | 'job' | 'invoice' | 'stock' | 'warranty';
}> = ({ status = '', workOrder, kind = 'wo' }) => {
  if (kind === 'stock') {
    const low = status === 'LOW';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 ${
          low ? STATUS_STYLES.danger : STATUS_STYLES.success
        }`}
      >
        {low ? (
          <AlertTriangle className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        )}
        <span>{low ? 'Stok tipis' : 'Stok aman'}</span>
      </span>
    );
  }

  if (kind === 'invoice') {
    const isPaid = status === 'LUNAS';
    const isPartial = status === 'SEBAGIAN';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 ${
          isPaid ? STATUS_STYLES.success : isPartial ? STATUS_STYLES.info : STATUS_STYLES.warning
        }`}
      >
        {isPaid ? (
          <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        ) : (
          <Clock className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        )}
        <span>{isPaid ? 'Lunas' : isPartial ? 'Sebagian' : 'Belum bayar'}</span>
      </span>
    );
  }

  if (kind === 'warranty') {
    const isGaransi = status === 'GARANSI';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 ${
          isGaransi ? STATUS_STYLES.success : STATUS_STYLES.warning
        }`}
      >
        {isGaransi ? (
          <ShieldCheck className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        )}
        <span>{isGaransi ? 'Garansi' : 'Non-garansi'}</span>
      </span>
    );
  }

  if (kind === 'job') {
    const labelMap: Record<string, string> = {
      MENUNGGU: 'Menunggu',
      BERJALAN: 'Dikerjakan',
      MENUNGGU_PART: 'Tunggu part',
      SELESAI: 'Selesai',
    };
    const styleMap: Record<string, string> = {
      MENUNGGU: STATUS_STYLES.info,
      BERJALAN: STATUS_STYLES.success,
      MENUNGGU_PART: STATUS_STYLES.warning,
      SELESAI: STATUS_STYLES.success,
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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 ${
          styleMap[status] || STATUS_STYLES.info
        }`}
      >
        <Icon className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
        <span>{labelMap[status] || status}</span>
      </span>
    );
  }

  const badge = getWorkOrderBadgeConfig(status, workOrder);
  const Icon = badge.Icon;

  return (
    <span
      data-status={badge.status}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 ${badge.cls}`}
    >
      <Icon className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
      <span>{badge.label}</span>
    </span>
  );
};

export const TimerChip: React.FC<{ baseMinutes?: number; active?: boolean }> = ({
  baseMinutes = 34,
  active = true,
}) => {
  const [seconds, setSeconds] = useState(baseMinutes * 60 + 18);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--success-bg)] text-[var(--success)] font-mono text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 tabular-nums">
      <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
      <span>{formatted}</span>
    </span>
  );
};
