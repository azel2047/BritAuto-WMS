import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RotateCcw,
  UserPlus,
  Unlock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Hammer,
  Wallet,
  History,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId, formatDateTimeId, ROLE_LABELS } from '../../lib/format';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  Modal,
  FilterChip,
  EmptyState,
  TableSkeleton,
  ErrorCard,
} from '../../components/ui/Modal';
import type { Role } from '../../../server/domain/src/auth';

export const ToolsPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [loanModal, setLoanModal] = useState<any | null>(null);
  const [conditionNote, setConditionNote] = useState('Lengkap & terkalibrasi');
  const [addToolOpen, setAddToolOpen] = useState(false);
  const [toolForm, setToolForm] = useState({ code: 'TL-NEW-01', name: '', qty: 1 });

  const {
    data: tools = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['tools'],
    queryFn: () => apiFetch('/tools'),
  });

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ['tool-loans'],
    queryFn: () => apiFetch('/tool-loans'),
  });

  const loanMutation = useMutation({
    mutationFn: () =>
      apiFetch('/tool-loans', {
        method: 'POST',
        body: JSON.stringify({ toolId: loanModal.id, conditionNote }),
      }),
    onSuccess: () => {
      showToast('Peminjaman dicatat', 'success');
      setLoanModal(null);
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      queryClient.invalidateQueries({ queryKey: ['tool-loans'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const returnMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tool-loans/${id}/return`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Pengembalian dicatat', 'success');
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      queryClient.invalidateQueries({ queryKey: ['tool-loans'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const addToolMutation = useMutation({
    mutationFn: () =>
      apiFetch('/tools', {
        method: 'POST',
        body: JSON.stringify(toolForm),
      }),
    onSuccess: () => {
      showToast('Alat disimpan', 'success');
      setAddToolOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canManage = user?.role === 'KR' || user?.role === 'AD';

  return (
    <PageLayout
      title={user?.role === 'TK' ? 'Alat Saya' : 'Alat Bengkel'}
      primaryAction={
        canManage ? (
          <button type="button" onClick={() => setAddToolOpen(true)} className="wc-btn-primary">
            <Plus className="w-5 h-5 stroke-[1.5]" />
            <span>Tambah Alat</span>
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : tools.length === 0 ? (
        <EmptyState icon={Hammer} message="Belum ada daftar alat bengkel." />
      ) : (
        <div className="space-y-6">
          <div className="wc-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-h3">Daftar Alat</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="wc-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Alat</th>
                    <th className="text-right">Tersedia</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((t: any) => {
                    const available = t.qty - t.borrowed_qty;
                    return (
                      <tr key={t.id}>
                        <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                          {t.code}
                        </td>
                        <td className="font-medium text-[var(--text)]">{t.name}</td>
                        <td className="text-right font-mono tabular-nums">
                          {available} / {t.qty}
                        </td>
                        <td className="text-right">
                          {available > 0 &&
                            (user?.role === 'TK' || user?.role === 'KR' || user?.role === 'AD') && (
                              <button
                                type="button"
                                onClick={() => setLoanModal(t)}
                                className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                              >
                                <span>Pinjam</span>
                              </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="wc-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-h3">Riwayat Peminjaman</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="wc-table">
                <thead>
                  <tr>
                    <th>Alat</th>
                    <th>Peminjam</th>
                    <th>Waktu Pinjam</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l: any) => (
                    <tr key={l.id}>
                      <td>
                        <span className="font-mono text-[12px] text-[var(--text-muted)]">
                          {l.tool_code}
                        </span>{' '}
                        — {l.tool_name}
                      </td>
                      <td className="font-medium text-[var(--text)]">{l.technician_name}</td>
                      <td className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                        {formatDateTimeId(l.loaned_at)}
                      </td>
                      <td>
                        {l.returned_at ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--success-bg)] text-[var(--success)] text-[12px] leading-4 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>Kembali</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--warning-bg)] text-[var(--warning)] text-[12px] leading-4 font-medium">
                            <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>Dipinjam</span>
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        {!l.returned_at && (
                          <button
                            type="button"
                            onClick={() => returnMutation.mutate(l.id)}
                            className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                          >
                            <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>Kembalikan</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={loanModal !== null} onClose={() => setLoanModal(null)} title={`Pinjam Alat (${loanModal?.name})`}>
        <form
          onSubmit={e => {
            e.preventDefault();
            loanMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Kondisi alat *
            </label>
            <input
              type="text"
              required
              value={conditionNote}
              onChange={e => setConditionNote(e.target.value)}
              className="w-full wc-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLoanModal(null)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={loanMutation.isPending} className="wc-btn-primary">
              Pinjam
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addToolOpen} onClose={() => setAddToolOpen(false)} title="Tambah Alat">
        <form
          onSubmit={e => {
            e.preventDefault();
            addToolMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Kode *
            </label>
            <input
              type="text"
              required
              value={toolForm.code}
              onChange={e => setToolForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="w-full wc-input font-mono"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Nama alat *
            </label>
            <input
              type="text"
              required
              value={toolForm.name}
              onChange={e => setToolForm(f => ({ ...f, name: e.target.value }))}
              className="w-full wc-input"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Jumlah *
            </label>
            <input
              type="number"
              min={1}
              required
              value={toolForm.qty}
              onChange={e => setToolForm(f => ({ ...f, qty: Number(e.target.value) }))}
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddToolOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={addToolMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const ExpensesPage: React.FC = () => {
  const { showToast } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    category: 'Operasional & Listrik',
    description: '',
    amount: 1500000,
    spentAt: new Date().toISOString().slice(0, 10),
  });

  const {
    data: expenses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['expenses'],
    queryFn: () => apiFetch('/expenses'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      showToast('Pengeluaran disimpan', 'success');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-report'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  return (
    <PageLayout
      title="Pengeluaran"
      primaryAction={
        <button type="button" onClick={() => setModalOpen(true)} className="wc-btn-primary">
          <Plus className="w-5 h-5 stroke-[1.5]" />
          <span>Catat Pengeluaran</span>
        </button>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Wallet}
          message="Belum ada catatan pengeluaran operasional."
          actionLabel="Catat Pengeluaran"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th>Oleh</th>
                  <th className="text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e: any) => (
                  <tr key={e.id}>
                    <td className="text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                      {formatDateId(e.spent_at)}
                    </td>
                    <td className="font-medium text-[var(--text)]">{e.category}</td>
                    <td className="text-[14px] leading-5 text-[var(--text)]">{e.description}</td>
                    <td className="text-[12px] leading-4 text-[var(--text-muted)]">
                      {e.created_by_name}
                    </td>
                    <td className="text-right font-mono font-medium tabular-nums whitespace-nowrap">
                      {formatRupiah(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Catat Pengeluaran">
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Kategori *
            </label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full wc-input"
            >
              <option value="Operasional & Listrik">Operasional & Listrik</option>
              <option value="Perawatan Alat">Perawatan Alat</option>
              <option value="Lisensi Diagnosa">Lisensi Diagnosa</option>
              <option value="Consumables">Consumables</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Deskripsi *
            </label>
            <input
              type="text"
              required
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full wc-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Nominal (Rp) *
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Tanggal *
              </label>
              <input
                type="date"
                required
                value={form.spentAt}
                onChange={e => setForm(f => ({ ...f, spentAt: e.target.value }))}
                className="w-full wc-input font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const MasterAdminPage: React.FC = () => {
  const { showToast } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'rates' | 'users'>('rates');

  const [addRateOpen, setAddRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState({
    job_type_id: 'SRV_BERKALA',
    brand: 'Jaguar',
    model: 'XF',
    rate: 1650000,
    valid_from: new Date().toISOString().slice(0, 10),
  });

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: 'Brit2026!',
    role: 'TK' as Role,
  });

  const { data: jobRates = [], isLoading: ratesLoading } = useQuery<any[]>({
    queryKey: ['job-rates'],
    queryFn: () => apiFetch('/job-rates'),
  });

  const { data: jobTypes = [] } = useQuery<any[]>({
    queryKey: ['job-types'],
    queryFn: () => apiFetch('/job-types'),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/users'),
  });

  const createRateMutation = useMutation({
    mutationFn: () =>
      apiFetch('/job-rates', {
        method: 'POST',
        body: JSON.stringify({ ...rateForm, model: rateForm.model.trim() || null }),
      }),
    onSuccess: () => {
      showToast('Tarif disimpan', 'success');
      setAddRateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['job-rates'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      }),
    onSuccess: () => {
      showToast('Pengguna disimpan', 'success');
      setAddUserOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const unlockUserMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ unlock: true, active: true }),
      }),
    onSuccess: () => {
      showToast('Akun dibuka', 'success');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <PageLayout
      title="Pengguna & Tarif"
      primaryAction={
        tab === 'rates' ? (
          <button type="button" onClick={() => setAddRateOpen(true)} className="wc-btn-primary">
            <Plus className="w-5 h-5 stroke-[1.5]" />
            <span>Tambah Tarif</span>
          </button>
        ) : (
          <button type="button" onClick={() => setAddUserOpen(true)} className="wc-btn-primary">
            <UserPlus className="w-5 h-5 stroke-[1.5]" />
            <span>Tambah Pengguna</span>
          </button>
        )
      }
      toolbar={
        <div className="flex items-center gap-2">
          <FilterChip active={tab === 'rates'} onClick={() => setTab('rates')}>
            Tarif Jasa
          </FilterChip>
          <FilterChip active={tab === 'users'} onClick={() => setTab('users')}>
            Pengguna
          </FilterChip>
        </div>
      }
    >
      {tab === 'rates' ? (
        ratesLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="wc-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="wc-table">
                <thead>
                  <tr>
                    <th>Pekerjaan</th>
                    <th>Merek</th>
                    <th>Model</th>
                    <th>Berlaku Mulai</th>
                    <th className="text-right">Tarif</th>
                  </tr>
                </thead>
                <tbody>
                  {jobRates.slice(0, 30).map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <div className="font-medium text-[var(--text)]">{r.job_name}</div>
                        <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                          {r.job_type_id}
                        </div>
                      </td>
                      <td>{r.brand}</td>
                      <td className="text-[14px] leading-5 text-[var(--text-muted)]">
                        {r.model || 'Semua model'}
                      </td>
                      <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                        {r.valid_from}
                      </td>
                      <td className="text-right font-mono font-medium tabular-nums whitespace-nowrap">
                        {formatRupiah(r.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : usersLoading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="font-medium text-[var(--text)]">{u.name}</td>
                    <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                      {u.username}
                    </td>
                    <td>{ROLE_LABELS[u.role as Role]}</td>
                    <td>
                      {u.locked_until && u.locked_until > Date.now() ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--danger-bg)] text-[var(--danger)] text-[12px] leading-4 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Terkunci</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--success-bg)] text-[var(--success)] text-[12px] leading-4 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Aktif</span>
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {(u.failed_logins > 0 || u.locked_until) && (
                        <button
                          type="button"
                          onClick={() => unlockUserMutation.mutate(u.id)}
                          className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                        >
                          <Unlock className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Buka Kunci</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={addRateOpen} onClose={() => setAddRateOpen(false)} title="Tambah Tarif Jasa">
        <form
          onSubmit={e => {
            e.preventDefault();
            createRateMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Pekerjaan *
            </label>
            <select
              value={rateForm.job_type_id}
              onChange={e => setRateForm(f => ({ ...f, job_type_id: e.target.value }))}
              className="w-full wc-input"
            >
              {jobTypes.map((jt: any) => (
                <option key={jt.id} value={jt.id}>
                  {jt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Merek *
              </label>
              <select
                value={rateForm.brand}
                onChange={e => setRateForm(f => ({ ...f, brand: e.target.value }))}
                className="w-full wc-input"
              >
                <option value="Jaguar">Jaguar</option>
                <option value="Land Rover">Land Rover</option>
                <option value="Bentley">Bentley</option>
                <option value="Rolls-Royce">Rolls-Royce</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Model
              </label>
              <input
                type="text"
                value={rateForm.model}
                onChange={e => setRateForm(f => ({ ...f, model: e.target.value }))}
                placeholder="Kosongkan jika umum"
                className="w-full wc-input"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Tarif (Rp) *
              </label>
              <input
                type="number"
                required
                value={rateForm.rate}
                onChange={e => setRateForm(f => ({ ...f, rate: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Berlaku mulai *
              </label>
              <input
                type="date"
                required
                value={rateForm.valid_from}
                onChange={e => setRateForm(f => ({ ...f, valid_from: e.target.value }))}
                className="w-full wc-input font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddRateOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createRateMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addUserOpen} onClose={() => setAddUserOpen(false)} title="Tambah Pengguna">
        <form
          onSubmit={e => {
            e.preventDefault();
            createUserMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Nama lengkap *
            </label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
              className="w-full wc-input"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Username *
            </label>
            <input
              type="text"
              required
              value={userForm.username}
              onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
              className="w-full wc-input font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Peran *
              </label>
              <select
                value={userForm.role}
                onChange={e => setUserForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full wc-input"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Sandi awal *
              </label>
              <input
                type="text"
                required
                value={userForm.password}
                onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                className="w-full wc-input font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddUserOpen(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createUserMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const AuditLogsPage: React.FC = () => {
  const {
    data: logs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['audit-logs'],
    queryFn: () => apiFetch('/audit-logs'),
  });

  return (
    <PageLayout title="Audit Log">
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState icon={History} message="Belum ada catatan audit log." />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Aksi</th>
                  <th>Entitas</th>
                  <th>Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => {
                  const isDenied = l.action === 'AKSES_DITOLAK' || l.action === 'LOGIN_FAILED';
                  return (
                    <tr key={l.id}>
                      <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {formatDateTimeId(l.created_at)}
                      </td>
                      <td className="font-medium text-[var(--text)]">
                        {l.user_name ? `${l.user_name} (${l.user_role})` : 'Sistem'}
                      </td>
                      <td>
                        {isDenied ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--danger-bg)] text-[var(--danger)] text-[12px] leading-4 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>{l.action}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-[12px] leading-4 text-[var(--text)]">
                            {l.action}
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-[12px] leading-4 text-[var(--text)]">
                        {l.entity} {l.entity_id ? `#${l.entity_id}` : ''}
                      </td>
                      <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)] max-w-md truncate">
                        {l.after_json || l.before_json || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageLayout>
  );
};
