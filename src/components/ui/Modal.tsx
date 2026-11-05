import React, { useEffect } from 'react';
import { X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14243B]/45 p-4 overflow-y-auto no-print"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ boxShadow: 'var(--shadow-popover)' }}
        className={`w-full ${maxWidth} bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden`}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border)]">
          <h2 id="modal-title" className="text-[16px] leading-6 font-semibold text-[var(--text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isPending?: boolean;
}> = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Konfirmasi', isPending = false }) => (
  <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
    <div className="space-y-6">
      <p className="text-[14px] leading-5 text-[var(--text)]">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="wc-btn-secondary">
          Batal
        </button>
        <button type="button" onClick={onConfirm} disabled={isPending} className="wc-btn-danger">
          {isPending ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);

export const EmptyState: React.FC<{
  icon: React.ElementType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon: Icon, message, actionLabel, onAction }) => {
  return (
    <div className="wc-card flex flex-col items-start sm:items-center justify-center py-12 px-6 sm:text-center gap-3">
      <Icon className="w-5 h-5 stroke-[1.5] text-[var(--text-muted)]" aria-hidden="true" />
      <p className="text-[14px] leading-5 text-[var(--text-muted)]">{message}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="wc-btn-primary mt-1">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const ErrorCard: React.FC<{
  message?: string;
  onRetry?: () => void;
}> = ({ message = 'Gagal memuat data dari server. Periksa koneksi lalu coba lagi.', onRetry }) => (
  <div role="alert" className="wc-card border-[var(--danger)] bg-[var(--danger-bg)] flex items-center justify-between gap-4">
    <div className="flex items-start gap-2.5 text-[var(--danger)] text-[14px] leading-5">
      <AlertCircle className="w-5 h-5 stroke-[1.5] shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
    {onRetry && (
      <button type="button" onClick={onRetry} className="wc-btn-secondary shrink-0">
        Coba lagi
      </button>
    )}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="wc-card p-0 overflow-hidden divide-y divide-[var(--border)]" aria-busy="true" aria-label="Memuat data">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 px-4 flex items-center justify-between gap-4 animate-pulse">
        <div className="h-4 w-28 rounded bg-[var(--border)]" />
        <div className="h-4 w-48 rounded bg-[var(--border)] hidden sm:block" />
        <div className="h-4 w-20 rounded bg-[var(--border)]" />
      </div>
    ))}
  </div>
);

export const PaginationBar: React.FC<{
  page: number;
  pageSize?: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}> = ({ page, pageSize = 20, totalItems, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] text-[12px] leading-4 text-[var(--text-muted)]">
      <span className="tabular-nums">
        Menampilkan {start}–{end} dari {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Halaman sebelumnya"
          className="wc-btn-secondary px-2.5 min-h-[36px]"
        >
          <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
        </button>
        <span className="px-2 font-mono tabular-nums text-[var(--text)]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Halaman berikutnya"
          className="wc-btn-secondary px-2.5 min-h-[36px]"
        >
          <ChevronRight className="w-4 h-4 stroke-[1.5]" />
        </button>
      </div>
    </div>
  );
};

export const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}> = ({ active, onClick, children, count }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-[8px] text-[14px] leading-5 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
      active
        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
        : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
    }`}
  >
    <span>{children}</span>
    {typeof count === 'number' && (
      <span
        className={`font-mono text-[12px] leading-4 tabular-nums ${
          active ? 'text-[var(--on-primary)]/90' : 'text-[var(--text-muted)]'
        }`}
      >
        ({count})
      </span>
    )}
  </button>
);
