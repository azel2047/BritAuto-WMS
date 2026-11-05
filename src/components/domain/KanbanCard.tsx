import React from 'react';
import { getWorkOrderBadgeConfig, PlateChip, TimerChip, type WorkOrderStateInput } from './StatusBadge';

export interface KanbanWorkOrderItem extends WorkOrderStateInput {
  id: number;
  wo_number: string;
  plate_current: string;
  brand: string;
  model: string;
  year?: number;
  complaintPreview?: string;
  issue_summary?: string;
  techFirstName?: string;
  technician_names?: string;
  done_jobs?: number;
  total_jobs?: number;
}

export interface KanbanCardProps {
  wo: KanbanWorkOrderItem;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ wo, isSelected, onSelect }) => {
  const badge = getWorkOrderBadgeConfig(wo.status, wo);
  const BadgeIcon = badge.Icon;
  const isInProgress = badge.status === 'DIKERJAKAN';

  const techLabel =
    wo.techFirstName ||
    (wo.technician_names ? String(wo.technician_names).split(',')[0].trim().split(' ')[0] : 'Belum ada');

  return (
    <div
      onClick={() => onSelect(wo.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(wo.id);
        }
      }}
      className={`rounded-[12px] bg-[var(--surface)] p-4 border transition-colors cursor-pointer flex flex-col gap-2 min-w-0 ${
        isSelected ? 'wc-card-selected' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <PlateChip plate={wo.plate_current} />
        <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
          {wo.wo_number}
        </span>
      </div>

      <div className="text-[14px] leading-5 font-semibold text-[var(--text)]">
        {wo.brand} {wo.model}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
        <span
          data-status={badge.status}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] leading-4 font-medium whitespace-nowrap shrink-0 ${badge.cls}`}
        >
          <BadgeIcon className="w-3.5 h-3.5 stroke-[1.5] shrink-0" aria-hidden="true" />
          <span>{badge.label}</span>
        </span>
        {isInProgress ? (
          <TimerChip baseMinutes={42} active={true} />
        ) : (
          <span className="text-[12px] leading-4 text-[var(--text-muted)] truncate">{techLabel}</span>
        )}
      </div>
    </div>
  );
};
