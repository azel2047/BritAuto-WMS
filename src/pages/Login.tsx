import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Tv, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BritLogo } from '../components/domain/BritLogo';
import { getHomeRouteForRole } from '../components/layout/AppShell';
import type { Role } from '../../server/domain/src/auth';

const DEMO_USERS: { username: string; role: Role; label: string; person: string }[] = [
  { username: 'sari', role: 'SA', label: 'Service Advisor', person: 'Sari' },
  { username: 'hasan', role: 'KR', label: 'Kepala Regu', person: 'Hasan' },
  { username: 'andi', role: 'TK', label: 'Teknisi 1', person: 'Andi' },
  { username: 'budi', role: 'TK', label: 'Teknisi 2', person: 'Budi' },
  { username: 'candra', role: 'TK', label: 'Teknisi 3', person: 'Candra' },
  { username: 'dedi', role: 'TK', label: 'Teknisi 4', person: 'Dedi' },
  { username: 'spare', role: 'SP', label: 'Spare Part', person: 'Hendra' },
  { username: 'admin', role: 'AD', label: 'Admin', person: 'Rina' },
  { username: 'agus', role: 'PM', label: 'Pemilik', person: 'Agus' },
];

export const LoginPage: React.FC = () => {
  const { login, showToast } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('sari');
  const [password, setPassword] = useState('Brit2026!');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Nama pengguna dan sandi wajib diisi. Isi kedua kolom lalu coba lagi.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(res.token, res.user);
      showToast(`Masuk sebagai ${res.user.name}`, 'success');
      navigate(getHomeRouteForRole(res.user.role as Role));
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa nama pengguna dan sandi.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = async (u: string) => {
    setUsername(u);
    setPassword('Brit2026!');
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: 'Brit2026!' }),
      });
      login(res.token, res.user);
      showToast(`Masuk sebagai ${res.user.name}`, 'success');
      navigate(getHomeRouteForRole(res.user.role as Role));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col justify-center items-center py-8 px-4">
      <div className="w-full max-w-md wc-card space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <BritLogo size={36} showText={true} />
          <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">WMS</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <h1 className="text-h1">Masuk Bengkel</h1>

          {errorMsg && (
            <div
              id="login-error"
              role="alert"
              className="p-3 rounded-[8px] bg-[var(--danger-bg)] border border-[var(--danger)] text-[var(--danger)] text-[14px] leading-5 flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 stroke-[1.5] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Nama pengguna *
              </label>
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                aria-invalid={!!errorMsg}
                aria-describedby={errorMsg ? 'login-error' : undefined}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="sari"
                className="w-full wc-input"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Kata sandi *
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                aria-invalid={!!errorMsg}
                aria-describedby={errorMsg ? 'login-error' : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full wc-input"
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full wc-btn-primary">
            <LogIn className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>{submitting ? 'Memproses...' : 'Masuk'}</span>
          </button>

          <div className="pt-4 border-t border-[var(--border)] space-y-2">
            <div className="text-[12px] leading-4 font-medium text-[var(--text-muted)]">
              Akun uji (1 ketuk)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_USERS.map(u => (
                <button
                  key={u.username}
                  type="button"
                  disabled={submitting}
                  onClick={() => quickLogin(u.username)}
                  className="min-h-[44px] px-2.5 py-2 text-left rounded-[8px] border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                >
                  <div className="text-[14px] leading-5 font-semibold text-[var(--text)] truncate">{u.person}</div>
                  <div className="text-[12px] leading-4 text-[var(--text-muted)] truncate">{u.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex justify-start">
            <Link
              to="/waiting-room"
              className="inline-flex items-center gap-2 min-h-[44px] text-[14px] leading-5 font-medium text-[var(--primary)] hover:underline"
            >
              <Tv className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
              <span>Layar Ruang Tunggu</span>
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
};
