import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home,
  ClipboardList,
  Car,
  UserCheck,
  Wrench,
  Package,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  BellRing,
  BarChart3,
  TrendingUp,
  Hammer,
  Wallet,
  Settings,
  History,
  Tv,
  Bell,
  LogOut,
  Menu,
  X,
  WifiOff,
  Search,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { apiFetch } from '../../lib/api';
import { ROLE_LABELS, formatDateTimeId } from '../../lib/format';
import { useRealtimeSse } from '../../lib/sse';
import { useOnlineStatus } from '../../lib/usePWAInstall';
import { BritLogo } from '../domain/BritLogo';
import type { Role } from '../../../server/domain/src/auth';

export interface RoleNavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

/**
 * Navigasi per peran, maks 5-6 item, bahasa sehari-hari (LANGKAH 3):
 * SA: Beranda | Work Order | Kendaraan | Invoice | Pengingat | Komplain
 * Kepala Regu: Beranda | Tugaskan | Work Order | Alat
 * Teknisi: Pekerjaan Saya | Alat Saya (hanya 2; tanpa sidebar di mobile)
 * Spare Part: Beranda | Pakai Part | Stok | Opname
 * Admin: Beranda | Pengguna & Tarif | Pengeluaran | Laporan | Work Order | Audit Log
 * Pemilik: Ringkasan | Kinerja | Laporan | Stok
 */
export const ROLE_NAVIGATION: Record<Role, RoleNavItem[]> = {
  SA: [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/work-orders', label: 'Work Order', icon: ClipboardList },
    { to: '/vehicles', label: 'Kendaraan', icon: Car },
    { to: '/invoices', label: 'Invoice', icon: FileText },
    { to: '/reminders', label: 'Pengingat', icon: BellRing },
    { to: '/complaints', label: 'Komplain', icon: ShieldAlert },
  ],
  KR: [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/assignments', label: 'Tugaskan', icon: UserCheck },
    { to: '/work-orders', label: 'Work Order', icon: ClipboardList },
    { to: '/tools', label: 'Alat', icon: Hammer },
  ],
  TK: [
    { to: '/my-jobs', label: 'Pekerjaan Saya', icon: Wrench },
    { to: '/tools', label: 'Alat Saya', icon: Hammer },
  ],
  SP: [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/work-orders', label: 'Pakai Part', icon: ClipboardList },
    { to: '/parts', label: 'Stok', icon: Package },
    { to: '/opnames', label: 'Opname', icon: ClipboardCheck },
  ],
  AD: [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/master', label: 'Pengguna & Tarif', icon: Settings },
    { to: '/expenses', label: 'Pengeluaran', icon: Wallet },
    { to: '/reports', label: 'Laporan', icon: BarChart3 },
    { to: '/work-orders', label: 'Work Order', icon: ClipboardList },
    { to: '/audit-logs', label: 'Audit Log', icon: History },
  ],
  PM: [
    { to: '/', label: 'Ringkasan', icon: Home },
    { to: '/performance', label: 'Kinerja', icon: TrendingUp },
    { to: '/reports', label: 'Laporan', icon: BarChart3 },
    { to: '/parts', label: 'Stok', icon: Package },
  ],
};

export function getHomeRouteForRole(role: Role): string {
  if (role === 'TK') return '/my-jobs';
  return '/';
}

const DEMO_ACCOUNTS: { username: string; label: string; role: Role }[] = [
  { username: 'sari', label: 'Sari (SA)', role: 'SA' },
  { username: 'hasan', label: 'Hasan (Kepala Regu)', role: 'KR' },
  { username: 'andi', label: 'Andi (Teknisi 1)', role: 'TK' },
  { username: 'budi', label: 'Budi (Teknisi 2)', role: 'TK' },
  { username: 'candra', label: 'Candra (Teknisi 3)', role: 'TK' },
  { username: 'dedi', label: 'Dedi (Teknisi 4)', role: 'TK' },
  { username: 'spare', label: 'Hendra (Spare Part)', role: 'SP' },
  { username: 'admin', label: 'Rina (Admin)', role: 'AD' },
  { username: 'agus', label: 'Agus (Pemilik)', role: 'PM' },
];

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Beranda',
  '/owner/mobile': 'Ringkasan',
  '/work-orders': 'Work Order',
  '/work-orders/new': 'Terima Kendaraan',
  '/assignments': 'Tugaskan Teknisi',
  '/my-jobs': 'Pekerjaan Saya',
  '/vehicles': 'Kendaraan',
  '/customers': 'Pelanggan',
  '/parts': 'Stok Part',
  '/opnames': 'Opname Stok',
  '/invoices': 'Invoice',
  '/complaints': 'Klaim Garansi',
  '/reminders': 'Pengingat Servis',
  '/performance': 'Kinerja Teknisi',
  '/reports': 'Laporan Bulanan',
  '/expenses': 'Pengeluaran',
  '/tools': 'Alat Bengkel',
  '/master': 'Pengguna & Tarif',
  '/audit-logs': 'Audit Log',
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login, logout, showToast } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [topSearch, setTopSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useRealtimeSse();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (!user) return <>{children}</>;

  const visibleNav = ROLE_NAVIGATION[user.role] || ROLE_NAVIGATION.SA;
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter(n => !n.read_at).length;

  const isTechnician = user.role === 'TK';
  const isOwner = user.role === 'PM';
  const hasMobileBottomNav = isTechnician || isOwner;

  const resolvePageTitle = () => {
    if (location.pathname === '/' && user.role === 'PM') return 'Ringkasan';
    if (ROUTE_TITLES[location.pathname]) return ROUTE_TITLES[location.pathname];
    if (location.pathname.startsWith('/work-orders/')) return 'Detail Work Order';
    if (location.pathname.startsWith('/invoices/')) return 'Detail Invoice';
    return 'Beranda';
  };

  const handleQuickSwitch = async (username: string) => {
    try {
      const res = await apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: 'Brit2026!' }),
      });
      login(res.token, res.user);
      queryClient.clear();
      showToast(`Beralih ke ${res.user.name} (${ROLE_LABELS[res.user.role as Role]})`, 'info');
      navigate(getHomeRouteForRole(res.user.role as Role));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleTopSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topSearch.trim()) return;
    setMobileMenuOpen(false);
    navigate(`/vehicles?q=${encodeURIComponent(topSearch.trim())}`);
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar: Tablet 64px (ikon), Desktop >=1024px 232px fixed, latar #1F3A5F */}
      <aside
        aria-label="Navigasi Utama"
        className="hidden md:flex flex-col w-[64px] lg:w-[232px] shrink-0 bg-[#1F3A5F] text-white sticky top-0 h-screen z-30 no-print select-none"
      >
        {/* Brand Header */}
        <div className="h-14 px-3 lg:px-4 flex items-center justify-center lg:justify-start border-b border-white/10">
          <div className="lg:hidden">
            <BritLogo size={32} showText={false} inverted />
          </div>
          <div className="hidden lg:block">
            <BritLogo size={32} showText={true} inverted />
          </div>
        </div>

        {/* Navigation Items: 40px tinggi, ikon 20px + label 14px, jarak 2px. Aktif: #2C4F7C + garis kuningan 3px di kiri */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Menu Peran">
          {visibleNav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `flex items-center justify-center lg:justify-start gap-3 h-10 px-2.5 lg:px-3 rounded-[8px] text-[14px] leading-5 font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#2C4F7C] text-white border-l-[3px] border-[#C9A227]'
                      : 'text-white/80 hover:bg-[#2C4F7C]/60 hover:text-white border-l-[3px] border-transparent'
                  }`
                }
              >
                <Icon className="w-5 h-5 stroke-[1.5] shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline truncate">{item.label}</span>
              </NavLink>
            );
          })}

          {(user.role === 'SA' || user.role === 'KR' || user.role === 'AD' || user.role === 'PM') && (
            <NavLink
              to="/waiting-room"
              title="Layar Tunggu"
              aria-label="Layar Tunggu"
              className="flex items-center justify-center lg:justify-start gap-3 h-10 px-2.5 lg:px-3 rounded-[8px] text-[14px] leading-5 font-medium text-white/75 hover:bg-[#2C4F7C]/60 hover:text-white border-l-[3px] border-transparent transition-colors whitespace-nowrap"
            >
              <Tv className="w-5 h-5 stroke-[1.5] shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline truncate">Layar Tunggu</span>
            </NavLink>
          )}
        </nav>

        {/* Bottom Sidebar: Nama + Peran pengguna (kecil), Demo Switcher, dan "Keluar" */}
        <div className="p-2 lg:p-3 border-t border-white/10 space-y-2">
          <div className="hidden lg:block px-2">
            <div className="text-[14px] leading-5 font-medium text-white truncate">{user.name}</div>
            <div className="text-[12px] leading-4 text-white/70 truncate">{ROLE_LABELS[user.role]}</div>
          </div>

          <div className="hidden lg:block px-1">
            <label htmlFor="sidebar-role-switch" className="sr-only">
              Ganti Peran Demo
            </label>
            <select
              id="sidebar-role-switch"
              aria-label="Ganti Peran Demo"
              value={user.username}
              onChange={e => handleQuickSwitch(e.target.value)}
              className="w-full h-8 px-2 rounded-[6px] bg-[#14243B] text-white/90 border border-white/15 text-[12px] leading-4 cursor-pointer"
            >
              {DEMO_ACCOUNTS.map(acc => (
                <option key={acc.username} value={acc.username}>
                  Peran: {acc.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            title="Keluar"
            aria-label="Keluar"
            className="w-full h-10 flex items-center justify-center lg:justify-start gap-3 px-2.5 lg:px-3 rounded-[8px] text-[14px] leading-5 font-medium text-white/80 hover:bg-[#2C4F7C] hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 stroke-[1.5] shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar 56px: kiri judul halaman; kanan cari (Ctrl+K) + lonceng. Latar putih, border bawah 1px */}
        <header className="h-14 bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger only on mobile (<768px) and NOT for Teknisi (tanpa sidebar di mobile) */}
            {!isTechnician && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Buka menu"
                className="md:hidden w-11 h-11 -ml-1 rounded-[8px] flex items-center justify-center text-[var(--text)] hover:bg-[var(--bg)] shrink-0 cursor-pointer"
              >
                <Menu className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
              </button>
            )}
            <span className="text-[16px] leading-6 font-semibold text-[var(--text)] truncate">
              {resolvePageTitle()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input (Ctrl+K) */}
            <form onSubmit={handleTopSearchSubmit} className="relative flex items-center">
              <Search
                className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Cari plat nomor (Ctrl+K)"
                value={topSearch}
                onChange={e => setTopSearch(e.target.value)}
                placeholder="Cari plat (Ctrl+K)"
                className="w-36 sm:w-56 h-9 pl-9 pr-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] focus:bg-[var(--surface)] text-[14px] leading-5 text-[var(--text)] placeholder:text-[var(--text-muted)]"
              />
            </form>

            {/* Mobile Demo Account Switcher for Teknisi (since TK has no mobile drawer) */}
            {isTechnician && (
              <select
                aria-label="Ganti Akun Demo"
                value={user.username}
                onChange={e => handleQuickSwitch(e.target.value)}
                className="md:hidden h-9 px-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[12px] leading-4 text-[var(--text)]"
              >
                {DEMO_ACCOUNTS.map(acc => (
                  <option key={acc.username} value={acc.username}>
                    {acc.label}
                  </option>
                ))}
              </select>
            )}

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(o => !o)}
                aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
                aria-expanded={notifOpen}
                className="relative w-10 h-10 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-[6px] bg-[var(--primary)] text-white font-mono text-[12px] leading-4 font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="region"
                  aria-label="Notifikasi"
                  style={{ boxShadow: 'var(--shadow-popover)' }}
                  className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-[12px] z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="font-semibold text-[14px] leading-5 text-[var(--text)]">Notifikasi</span>
                    <span className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                      {unreadCount} baru
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
                    {safeNotifications.length === 0 ? (
                      <div className="p-6 text-center text-[14px] leading-5 text-[var(--text-muted)]">
                        Tidak ada notifikasi.
                      </div>
                    ) : (
                      safeNotifications.map((n: any) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-[14px] leading-5 flex items-start justify-between gap-3 ${
                            !n.read_at ? 'bg-[var(--primary-subtle)]/50' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="text-[14px] leading-5 text-[var(--text)]">{n.message}</p>
                            <p className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                              {formatDateTimeId(n.created_at)}
                            </p>
                          </div>
                          {!n.read_at && (
                            <button
                              type="button"
                              onClick={() => markReadMutation.mutate(n.id)}
                              className="min-h-[32px] px-2 text-[12px] leading-4 font-medium text-[var(--primary)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Tandai baca
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Konten: latar #F6F8FB, padding 32px desktop, isi max-width 1120px rata-tengah */}
        <main
          className={`flex-1 w-full max-w-[1120px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden ${
            hasMobileBottomNav ? 'pb-24 md:pb-8' : 'pb-10'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Drawer (<768px) for roles with drawer */}
      {mobileMenuOpen && !isTechnician && (
        <div
          className="fixed inset-0 z-50 md:hidden flex no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi"
        >
          <div className="fixed inset-0 bg-[#14243B]/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[82vw] bg-[#1F3A5F] text-white flex flex-col h-full z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
              <BritLogo size={28} showText={true} inverted />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="w-10 h-10 rounded-[8px] flex items-center justify-center text-white/80 hover:bg-[#2C4F7C] cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Menu Mobile">
              {visibleNav.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 h-11 px-3 rounded-[8px] text-[14px] leading-5 font-medium ${
                        isActive
                          ? 'bg-[#2C4F7C] text-white border-l-[3px] border-[#C9A227]'
                          : 'text-white/80 hover:bg-[#2C4F7C]/60 border-l-[3px] border-transparent'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 stroke-[1.5] shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/10 space-y-2">
              <div className="px-2">
                <div className="text-[14px] leading-5 font-medium text-white">{user.name}</div>
                <div className="text-[12px] leading-4 text-white/70">{ROLE_LABELS[user.role]}</div>
              </div>
              <select
                aria-label="Ganti Peran Demo"
                value={user.username}
                onChange={e => {
                  setMobileMenuOpen(false);
                  handleQuickSwitch(e.target.value);
                }}
                className="w-full h-9 px-2 rounded-[6px] bg-[#14243B] text-white text-[12px] leading-4 border border-white/15"
              >
                {DEMO_ACCOUNTS.map(acc => (
                  <option key={acc.username} value={acc.username}>
                    Peran: {acc.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="w-full h-11 flex items-center gap-3 px-3 rounded-[8px] text-[14px] leading-5 font-medium text-white/80 hover:bg-[#2C4F7C] cursor-pointer"
              >
                <LogOut className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav 64px khusus Pemilik (PM) dan Teknisi (TK) */}
      {hasMobileBottomNav && (
        <nav
          aria-label="Navigasi Bawah"
          className={`md:hidden fixed bottom-0 inset-x-0 h-16 bg-[var(--surface)] border-t border-[var(--border)] grid z-40 no-print ${
            isTechnician ? 'grid-cols-3' : 'grid-cols-4'
          }`}
        >
          {visibleNav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 min-h-[44px] px-1 text-[12px] leading-4 font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--primary)] border-t-2 border-[#C9A227]'
                      : 'text-[var(--text-muted)] border-t-2 border-transparent'
                  }`
                }
              >
                <Icon className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
                <span className="truncate max-w-full">{item.label}</span>
              </NavLink>
            );
          })}
          {isTechnician && (
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="flex flex-col items-center justify-center gap-1 min-h-[44px] px-1 text-[12px] leading-4 font-medium text-[var(--text-muted)] cursor-pointer"
            >
              <LogOut className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          )}
        </nav>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          style={{ boxShadow: 'var(--shadow-popover)' }}
          className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-[8px] bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--border)] px-3.5 py-2 text-[12px] leading-4 font-medium no-print"
        >
          <WifiOff className="w-4 h-4 stroke-[1.5]" aria-hidden="true" />
          <span>Mode Offline</span>
        </div>
      )}
    </div>
  );
};
