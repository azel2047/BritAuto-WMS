import React, { useEffect } from 'react';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto no-print">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${maxWidth} bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--text)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--navy-50)] hover:text-[var(--text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  icon: React.ElementType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon: Icon, message, actionLabel, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--surface)] border border-[var(--border)] rounded-[10px]">
      <div className="w-12 h-12 rounded-full bg-[var(--navy-50)] flex items-center justify-center text-[var(--navy-700)] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-medium hover:bg-[#2c4f7c] transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
