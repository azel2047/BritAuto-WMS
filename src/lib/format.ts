import type { Role } from '../../server/domain/src/auth.ts';

export function formatRupiah(amount: number | null | undefined): string {
  const num = Number(amount ?? 0);
  return 'Rp' + Math.round(num).toLocaleString('id-ID');
}

export function formatDateId(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });
  } catch {
    return iso;
  }
}

export function formatDateTimeId(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  } catch {
    return iso;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  SA: 'Service Advisor',
  KR: 'Kepala Regu',
  TK: 'Teknisi',
  SP: 'Bagian Spare Part',
  AD: 'Admin',
  PM: 'Pemilik',
};

export const WO_STATUS_LABELS: Record<string, string> = {
  MENUNGGU_PENUGASAN: 'Menunggu Penugasan',
  DITUGASKAN: 'Ditugaskan',
  DIKERJAKAN: 'Dikerjakan',
  SELESAI_DIKERJAKAN: 'Selesai Dikerjakan',
  DIPERIKSA: 'Diperiksa SA',
  DITUTUP: 'Ditutup',
  DIBATALKAN: 'Dibatalkan',
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  MENUNGGU: 'Menunggu',
  BERJALAN: 'Sedang Dikerjakan',
  MENUNGGU_PART: 'Menunggu Part',
  SELESAI: 'Selesai',
};
