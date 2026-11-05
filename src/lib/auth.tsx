import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from './api';
import type { Role } from '../../server/domain/src/auth';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ user: User }>('/auth/me')
      .then(res => setUser(res.user))
      .catch(() => setStoredToken(null))
      .finally(() => setLoading(false));

    const handleUnauth = () => setUser(null);
    window.addEventListener('brit:unauthorized', handleUnauth);
    return () => window.removeEventListener('brit:unauthorized', handleUnauth);
  }, []);

  const login = useCallback((token: string, u: User) => {
    setStoredToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, showToast }}>
      {children}
      {/* Toast Container: kanan-atas, 3 detik */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0 no-print">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            style={{ boxShadow: 'var(--shadow-popover)' }}
            className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-[8px] border text-[14px] leading-5 font-medium ${
              t.type === 'error'
                ? 'bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger)]'
                : t.type === 'info'
                ? 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--border)]'
                : 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--border)]'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 stroke-[1.5] shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 stroke-[1.5] shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              aria-label="Tutup pesan"
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
