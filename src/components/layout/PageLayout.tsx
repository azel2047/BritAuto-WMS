import React from 'react';

export interface PageLayoutProps {
  /** Judul halaman maks 3 kata, 24px/600 di kiri */
  title: string;
  /** Opsional 1 baris 14px abu bila benar-benar perlu */
  subtitle?: string;
  /** SATU tombol utama di kanan */
  primaryAction?: React.ReactNode;
  /** Toolbar (bila daftar): cari + maks 2 filter + chip status */
  toolbar?: React.ReactNode;
  /** Bilah aksi sticky bawah [Batal] [Simpan] untuk form panjang */
  stickyFooter?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * PageLayout (urutan SAMA di semua halaman):
 * 1) Header: judul 24px/600 di kiri, SATU tombol utama di kanan.
 * 2) Toolbar (bila daftar): cari + maks 2 filter + (opsional) chip status.
 * 3) Konten.
 * 4) Form panjang: bilah aksi sticky bawah [Batal] [Simpan].
 * Jarak antar blok: 24px (space-y-6).
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  primaryAction,
  toolbar,
  stickyFooter,
  children,
}) => {
  return (
    <div className="space-y-6">
      {/* 1) Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="min-w-0">
          <h1 className="text-h1 text-[var(--text)]">{title}</h1>
          {subtitle && (
            <p className="text-[14px] leading-5 text-[var(--text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </header>

      {/* 2) Toolbar */}
      {toolbar && <div className="no-print">{toolbar}</div>}

      {/* 3) Konten */}
      <div>{children}</div>

      {/* 4) Sticky Form Action Bar */}
      {stickyFooter && (
        <div className="sticky bottom-16 md:bottom-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-end gap-3 no-print">
          {stickyFooter}
        </div>
      )}
    </div>
  );
};
