import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Car,
  Users,
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
  Download,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { apiFetch } from '../../lib/api';
import { ROLE_LABELS, formatDateTimeId } from '../../lib/format';
import { useRealtimeSse } from '../../lib/sse';
import { usePWAInstall, useOnlineStatus } from '../../lib/usePWAInstall';
import { BritLogo } from '../domain/BritLogo';
import type { Role } from '../../../server/domain/src/auth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

// Strictly follows STRUCTURE.md §5 access matrix
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: LayoutDashboard, roles: ['SA', 'KR', 'TK', 'SP', 'AD', 'PM'] },
  { to: '/owner/mobile', label: 'Monitor Mobile (PWA)', icon: Smartphone, roles: ['PM'] },
  { to: '/work-orders/new', label: 'Terima Kendaraan', icon: PlusCircle, roles: ['SA', 'AD'] },
  { to: '/work-orders', label: 'Work Order', icon: ClipboardList, roles: ['SA', 'KR', 'TK', 'SP', 'AD', 'PM'] },
  { to: '/assignments', label: 'Penugasan & Job Card', icon: UserCheck, roles: ['KR', 'SA', 'AD', 'PM'] },
  { to: '/my-jobs', label: 'Job Card & Clock', icon: Wrench, roles: ['TK', 'KR'] },
  { to: '/vehicles', label: 'Kendaraan & Plat', icon: Car, roles: ['SA', 'KR', 'AD', 'PM'] },
  { to: '/customers', label: 'Data Pelanggan', icon: Users, roles: ['SA', 'KR', 'AD', 'PM'] },
  { to: '/parts', label: 'Stok Spare Part', icon: Package, roles: ['SP', 'SA', 'AD', 'PM'] },
  { to: '/opnames', label: 'Stock Opname', icon: ClipboardCheck, roles: ['SP', 'AD', 'PM'] },
  { to: '/invoices', label: 'Invoice & Pembayaran', icon: FileText, roles: ['SA', 'AD', 'PM'] },
  { to: '/complaints', label: 'Garansi & Komplain', icon: ShieldAlert, roles: ['SA', 'AD', 'PM'] },
  { to: '/reminders', label: 'Service Reminder', icon: BellRing, roles: ['SA', 'AD', 'PM'] },
  { to: '/performance', label: 'Kinerja & Bonus', icon: TrendingUp, roles: ['PM', 'AD', 'KR', 'TK'] },
  { to: '/reports', label: 'Laporan Bulanan', icon: BarChart3, roles: ['PM', 'AD'] },
  { to: '/expenses', label: 'Pengeluaran Bengkel', icon: Wallet, roles: ['AD', 'PM'] },
  { to: '/tools', label: 'Alat Bengkel', icon: Hammer, roles: ['KR', 'TK', 'AD', 'PM'] },
  { to: '/master', label: 'Master Tarif & Pengguna', icon: Settings, roles: ['AD', 'PM'] },
  { to: '/audit-logs', label: 'Audit Log Keamanan', icon: History, roles: ['AD', 'PM'] },
  { to: '/waiting-room', label: 'Layar Ruang Tunggu', icon: Tv, roles: ['SA', 'KR', 'AD', 'PM'] },
];

const DEMO_ACCOUNTS: { username: string; label: string; role: Role }[] = [
  { username: 'agus', label: 'Agus Sugiantu (Pemilik - PM)', role: 'PM' },
  { username: 'sari', label: 'Sari Puspita (Service Advisor - SA)', role: 'SA' },
  { username: 'hasan', label: 'Hasan Basri (Kepala Regu - KR)', role: 'KR' },
  { username: 'andi', label: 'Andi Pratama (Teknisi 1 - TK)', role: 'TK' },
  { username: 'budi', label: 'Budi Santoso (Teknisi 2 - TK)', role: 'TK' },
  { username: 'candra', label: 'Candra Kusuma (Teknisi 3 - TK)', role: 'TK' },
  { username: 'dedi', label: 'Dedi Kurniawan (Teknisi 4 - TK)', role: 'TK' },
  { username: 'spare', label: 'Hendra Gunawan (Spare Part - SP)', role: 'SP' },
  { username: 'admin', label: 'Rina Wijaya (Admin - AD)', role: 'AD' },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login, logout, showToast } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  useRealtimeSse();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

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

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const handleQuickSwitch = async (username: string) => {
    try {
      const res = await apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: 'Brit2026!' }),
      });
      login(res.token, res.user);
      queryClient.clear();
      showToast(`Beralih ke akun ${res.user.name} (${ROLE_LABELS[res.user.role as Role]})`, 'info');
      navigate('/');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)]">
      {/* Desktop Sidebar (240px fixed, navy-800) */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 bg-[#1f3a5f] text-white no-print">
        <div className="h-[56px] px-4 flex items-center border-b border-white/10">
          <BritLogo size={34} showText={true} />
        </div>

        <div className="px-4 py-3 border-b border-white/10 bg-[#14243b]/40">
          <div className="text-xs text-white/70">Masuk sebagai</div>
          <div className="font-semibold text-sm truncate">{user.name}</div>
          <div className="text-xs text-[#c9a227] font-medium mt-0.5">
            {ROLE_LABELS[user.role]} ({user.role})
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Menu Utama">
          {visibleNav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#2c4f7c] text-[#c9a227] font-semibold'
                      : 'text-white/85 hover:bg-[#2c4f7c]/60 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* PWA Install Button in Sidebar */}
        {!isInstalled && (isInstallable || isIOS) && (
          <div className="px-3 py-2 border-t border-white/10">
            <button
              onClick={() => (isInstallable ? install() : setIosGuideOpen(true))}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] bg-[#c9a227] text-[#14243b] text-xs font-semibold hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Install Aplikasi PWA
            </button>
          </div>
        )}

        <div className="p-3 border-t border-white/10">
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[6px] text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (56px) */}
        <header className="h-[56px] bg-[var(--surface)] border-b border-[var(--border)] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 rounded-[6px] text-[var(--text)] hover:bg-[var(--navy-50)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display font-semibold text-sm sm:text-base text-[var(--text)] truncate">
              {visibleNav.find(n => n.to === location.pathname)?.label || 'Brit Auto Workshop Management'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Role Switcher for Demo Evaluation */}
            <div className="hidden md:flex items-center gap-1.5">
              <label htmlFor="demo-role-switch" className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                Demo Peran:
              </label>
              <select
                id="demo-role-switch"
                value={user.username}
                onChange={e => handleQuickSwitch(e.target.value)}
                className="h-8 px-2 text-xs rounded-[6px] border border-[var(--border)] bg-[var(--navy-50)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[#2c4f7c]"
              >
                {DEMO_ACCOUNTS.map(acc => (
                  <option key={acc.username} value={acc.username}>
                    {acc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(o => !o)}
                aria-label="Notifikasi"
                className="relative p-2 rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--navy-50)] hover:text-[var(--text)] transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-[#c0392b] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="font-semibold text-sm">Notifikasi Sistem</span>
                    <span className="text-xs text-[var(--text-muted)]">{unreadCount} belum dibaca</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[var(--text-muted)]">Belum ada notifikasi</div>
                    ) : (
                      notifications.map((n: any) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-xs flex items-start justify-between gap-3 ${
                            !n.read_at ? 'bg-[var(--navy-50)]' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="text-[var(--text)] font-medium leading-snug">{n.message}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{formatDateTimeId(n.created_at)}</p>
                          </div>
                          {!n.read_at && (
                            <button
                              onClick={() => markReadMutation.mutate(n.id)}
                              className="text-[11px] text-[#1f6fb2] hover:underline whitespace-nowrap shrink-0"
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

        {/* Page Container */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto p-4 sm:p-6 pb-24 lg:pb-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#1f3a5f] text-white flex flex-col h-full z-10">
            <div className="h-[56px] px-4 flex items-center justify-between border-b border-white/10">
              <BritLogo size={32} showText={true} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="p-1.5 rounded-md text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-white/10 space-y-2 bg-[#14243b]/40">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-[#c9a227]">{ROLE_LABELS[user.role]}</div>
              <div className="pt-1">
                <label className="block text-[11px] text-white/70 mb-1">Ganti Akun Demo:</label>
                <select
                  value={user.username}
                  onChange={e => {
                    setMobileMenuOpen(false);
                    handleQuickSwitch(e.target.value);
                  }}
                  className="w-full h-9 px-2 text-xs rounded bg-[#14243b] text-white border border-white/20"
                >
                  {DEMO_ACCOUNTS.map(acc => (
                    <option key={acc.username} value={acc.username}>
                      {acc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
              {visibleNav.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm font-medium ${
                        isActive ? 'bg-[#2c4f7c] text-[#c9a227]' : 'text-white/85 hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/10">
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[6px] text-sm text-white/90 hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile BottomNav (4 items: Ringkasan, Kinerja, Stok, Laporan for Pemilik per DESIGN.md §3) */}
      {user.role === 'PM' && (
        <nav
          aria-label="Navigasi Bawah Pemilik"
          className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-[#14243b] text-white border-t border-white/10 grid grid-cols-4 z-40 no-print"
        >
          <NavLink
            to="/owner/mobile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                isActive ? 'text-[#c9a227]' : 'text-white/75'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Ringkasan</span>
          </NavLink>
          <NavLink
            to="/performance"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                isActive ? 'text-[#c9a227]' : 'text-white/75'
              }`
            }
          >
            <TrendingUp className="w-5 h-5" />
            <span>Kinerja</span>
          </NavLink>
          <NavLink
            to="/parts"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                isActive ? 'text-[#c9a227]' : 'text-white/75'
              }`
            }
          >
            <Package className="w-5 h-5" />
            <span>Stok</span>
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                isActive ? 'text-[#c9a227]' : 'text-white/75'
              }`
            }
          >
            <BarChart3 className="w-5 h-5" />
            <span>Laporan</span>
          </NavLink>
        </nav>
      )}

      {/* Offline Connectivity Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-[6px] bg-[#b36b00] px-3 py-2 text-xs font-medium text-white shadow-lg no-print">
          <WifiOff className="w-4 h-4" />
          <span>Mode Offline — Menampilkan data tersimpan</span>
        </div>
      )}

      {/* iOS PWA Installation Guide Modal */}
      {iosGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="w-full max-w-sm rounded-[10px] bg-[var(--surface)] p-5 shadow-xl border border-[var(--border)]">
            <h3 className="text-base font-semibold">Install Brit Auto di iPhone / iPad</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              1. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.
              <br />
              2. Pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
            </p>
            <button
              onClick={() => setIosGuideOpen(false)}
              className="mt-4 w-full py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-medium"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
