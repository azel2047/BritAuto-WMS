import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, LogIn, Tv, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BritLogo } from '../components/domain/BritLogo';

const DEMO_USERS = [
  { username: 'agus', role: 'PM', label: 'Pemilik (Agus)' },
  { username: 'sari', role: 'SA', label: 'Service Advisor (Sari)' },
  { username: 'hasan', role: 'KR', label: 'Kepala Regu (Hasan)' },
  { username: 'andi', role: 'TK', label: 'Teknisi 1 (Andi)' },
  { username: 'budi', role: 'TK', label: 'Teknisi 2 (Budi)' },
  { username: 'candra', role: 'TK', label: 'Teknisi 3 (Candra)' },
  { username: 'dedi', role: 'TK', label: 'Teknisi 4 (Dedi)' },
  { username: 'spare', role: 'SP', label: 'Spare Part (Hendra)' },
  { username: 'admin', role: 'AD', label: 'Admin (Rina)' },
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
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(res.token, res.user);
      showToast(`Selamat datang, ${res.user.name}`, 'success');
      navigate(res.user.role === 'PM' && window.innerWidth < 768 ? '/owner/mobile' : '/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa username dan kata sandi.');
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
      showToast(`Masuk sebagai ${res.user.name} (${res.user.role})`, 'success');
      navigate(res.user.role === 'PM' && window.innerWidth < 768 ? '/owner/mobile' : '/');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#14243b] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[var(--surface)] text-[var(--text)] rounded-[10px] shadow-2xl border border-[var(--border)] overflow-hidden">
        <div className="bg-[#1f3a5f] text-white px-6 py-6 flex flex-col items-center text-center border-b border-[#c9a227]/40">
          <BritLogo size={64} showText={false} />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-white">Brit Auto WMS</h1>
          <p className="text-xs text-white/75 mt-1">
            Sistem Manajemen Operasional Spesialis Mobil Inggris
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-[6px] bg-[#fbe7e4] border border-[#c0392b]/30 text-[#c0392b] text-xs font-medium flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-username" className="block text-xs font-medium text-[var(--text)] mb-1">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Contoh: sari, agus, hasan, andi..."
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#2c4f7c]"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-[var(--text)] mb-1">
              Kata Sandi
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#2c4f7c]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-[6px] bg-[#1f3a5f] hover:bg-[#2c4f7c] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
          </button>

          <div className="pt-3 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
              <span className="font-medium">Login Cepat Akun Demo (Sandi: Brit2026!)</span>
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {DEMO_USERS.map(u => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => quickLogin(u.username)}
                  className="px-2.5 py-1.5 text-left rounded-[6px] border border-[var(--border)] hover:bg-[var(--navy-50)] transition-colors"
                >
                  <div className="text-xs font-semibold text-[var(--text)] truncate">{u.username}</div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{u.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link
              to="/waiting-room"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1f6fb2] hover:underline"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Buka Layar Ruang Tunggu Pelanggan (Publik / Tanpa Login)</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
