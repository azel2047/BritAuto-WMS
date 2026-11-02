import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Hammer,
  Plus,
  RotateCcw,
  Wallet,
  Settings,
  UserPlus,
  Unlock,
  KeyRound,
  History,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRupiah, formatDateId, formatDateTimeId, ROLE_LABELS } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import type { Role } from '../../../server/domain/src/auth';

export const ToolsPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const [loanModal, setLoanModal] = useState<any | null>(null);
  const [conditionNote, setConditionNote] = useState('Kondisi lengkap & terkalibrasi');
  const [addToolOpen, setAddToolOpen] = useState(false);
  const [toolForm, setToolForm] = useState({ code: 'TL-NEW-01', name: '', qty: 1 });

  const { data: tools = [] } = useQuery<any[]>({
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
      showToast('Peminjaman alat bengkel berhasil dicatat', 'success');
      setLoanModal(null);
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      queryClient.invalidateQueries({ queryKey: ['tool-loans'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const returnMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tool-loans/${id}/return`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Pengembalian alat bengkel berhasil dicatat', 'success');
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
      showToast('Inventaris alat bengkel ditambahkan', 'success');
      setAddToolOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canManage = user?.role === 'KR' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Inventaris & Peminjaman Alat Bengkel (Special Tools)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Pencatatan peminjaman dan pengembalian diagnostic tool & kunci khusus agar tidak hilang.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setAddToolOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-semibold self-start"
          >
            <Plus className="w-4 h-4" /> + Tambah Alat
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((t: any) => {
          const available = t.qty - t.borrowed_qty;
          return (
            <div
              key={t.id}
              className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)] flex flex-col justify-between gap-3"
            >
              <div>
                <div className="font-mono text-xs text-[var(--text-muted)]">{t.code}</div>
                <div className="font-semibold text-sm mt-0.5">{t.name}</div>
                <div className="text-xs mt-2 font-mono">
                  Tersedia: <strong>{available}</strong> / {t.qty} unit
                </div>
              </div>
              {available > 0 && (user?.role === 'TK' || user?.role === 'KR' || user?.role === 'AD') && (
                <button
                  onClick={() => setLoanModal(t)}
                  className="w-full py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold hover:bg-[#2c4f7c]"
                >
                  Pinjam Alat Ini
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">Riwayat Peminjaman Alat</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                <th className="py-3 px-4 font-semibold">Alat</th>
                <th className="py-3 px-4 font-semibold">Teknisi Peminjam</th>
                <th className="py-3 px-4 font-semibold">Waktu Pinjam</th>
                <th className="py-3 px-4 font-semibold">Status / Kembali</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loans.map((l: any) => (
                <tr key={l.id}>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-semibold">{l.tool_code}</span> — {l.tool_name}
                  </td>
                  <td className="py-3 px-4 font-medium">{l.technician_name}</td>
                  <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{formatDateTimeId(l.loaned_at)}</td>
                  <td className="py-3 px-4">
                    {l.returned_at ? (
                      <span className="text-xs text-[#2e8b57] font-medium">
                        Kembali ({formatDateTimeId(l.returned_at)})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#fdf1dc] text-[#b36b00] text-xs font-semibold">
                        Sedang Dipinjam
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!l.returned_at && (
                      <button
                        onClick={() => returnMutation.mutate(l.id)}
                        className="px-3 py-1 rounded bg-[#2e8b57] text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Kembalikan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={loanModal !== null} onClose={() => setLoanModal(null)} title={`Pinjam Alat (${loanModal?.name})`}>
        <form
          onSubmit={e => {
            e.preventDefault();
            loanMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Catatan Kondisi Alat</label>
            <input
              type="text"
              value={conditionNote}
              onChange={e => setConditionNote(e.target.value)}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLoanModal(null)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loanMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Konfirmasi Pinjam
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addToolOpen} onClose={() => setAddToolOpen(false)} title="Tambah Alat Bengkel">
        <form
          onSubmit={e => {
            e.preventDefault();
            addToolMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Kode Alat</label>
            <input
              type="text"
              required
              value={toolForm.code}
              onChange={e => setToolForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nama Alat Khusus</label>
            <input
              type="text"
              required
              value={toolForm.name}
              onChange={e => setToolForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Jumlah Unit</label>
            <input
              type="number"
              min={1}
              required
              value={toolForm.qty}
              onChange={e => setToolForm(f => ({ ...f, qty: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddToolOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={addToolMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
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

  const { data: expenses = [] } = useQuery<any[]>({
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
      showToast('Pengeluaran operasional bengkel berhasil dicatat', 'success');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-report'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Pengeluaran Operasional Bengkel</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Pencatatan biaya listrik, perawatan alat, lisensi software diagnosa, dan consumable bengkel.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-semibold self-start"
        >
          <Plus className="w-4 h-4" /> + Catat Pengeluaran
        </button>
      </div>

      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                <th className="py-3 px-4 font-semibold">Tanggal</th>
                <th className="py-3 px-4 font-semibold">Kategori</th>
                <th className="py-3 px-4 font-semibold">Deskripsi</th>
                <th className="py-3 px-4 font-semibold">Dicatat Oleh</th>
                <th className="py-3 px-4 font-semibold text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {expenses.map((e: any) => (
                <tr key={e.id}>
                  <td className="py-3 px-4 font-mono text-xs">{formatDateId(e.spent_at)}</td>
                  <td className="py-3 px-4 font-medium">{e.category}</td>
                  <td className="py-3 px-4">{e.description}</td>
                  <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{e.created_by_name}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#c0392b]">
                    {formatRupiah(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Catat Pengeluaran Operasional">
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Kategori</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              <option value="Operasional & Listrik">Operasional & Listrik</option>
              <option value="Perawatan Alat">Perawatan Alat</option>
              <option value="Lisensi Diagnosa">Lisensi Diagnosa</option>
              <option value="Consumables">Consumables</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Deskripsi</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nominal (Rp)</label>
              <input
                type="number"
                required
                min={1}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={form.spentAt}
                onChange={e => setForm(f => ({ ...f, spentAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Pengeluaran
            </button>
          </div>
        </form>
      </Modal>
    </div>
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

  const { data: jobRates = [] } = useQuery<any[]>({
    queryKey: ['job-rates'],
    queryFn: () => apiFetch('/job-rates'),
  });

  const { data: jobTypes = [] } = useQuery<any[]>({
    queryKey: ['job-types'],
    queryFn: () => apiFetch('/job-types'),
  });

  const { data: users = [] } = useQuery<any[]>({
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
      showToast('Tarif jasa baru berhasil disimpan (BR-08)', 'success');
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
      showToast('Pengguna baru berhasil ditambahkan', 'success');
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
      showToast('Kunci akun dibuka kembali', 'success');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Master Tarif Jasa (BR-08) & Manajemen Pengguna</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Tarif model spesifik diprioritaskan di atas tarif merek umum; perubahan tarif tidak mengubah transaksi historis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-[var(--surface)] border border-[var(--border)] rounded-[8px]">
            <button
              onClick={() => setTab('rates')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold ${
                tab === 'rates' ? 'bg-[#1f3a5f] text-white' : 'text-[var(--text-muted)]'
              }`}
            >
              Master Tarif Jasa
            </button>
            <button
              onClick={() => setTab('users')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold ${
                tab === 'users' ? 'bg-[#1f3a5f] text-white' : 'text-[var(--text-muted)]'
              }`}
            >
              Pengguna & Peran (RBAC)
            </button>
          </div>
        </div>
      </div>

      {tab === 'rates' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setAddRateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> + Tambah Versi Tarif Jasa
            </button>
          </div>

          <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                    <th className="py-3 px-4 font-semibold">Jenis Pekerjaan</th>
                    <th className="py-3 px-4 font-semibold">Merek</th>
                    <th className="py-3 px-4 font-semibold">Model Spesifik</th>
                    <th className="py-3 px-4 font-semibold">Berlaku Mulai</th>
                    <th className="py-3 px-4 font-semibold text-right">Tarif Jasa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {jobRates.slice(0, 30).map((r: any) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{r.job_name}</div>
                        <div className="text-xs font-mono text-[var(--text-muted)]">{r.job_type_id}</div>
                      </td>
                      <td className="py-2.5 px-4 font-medium">{r.brand}</td>
                      <td className="py-2.5 px-4">
                        {r.model ? (
                          <span className="px-2 py-0.5 rounded bg-[#f6efd2] text-[#14243b] text-xs font-semibold">
                            Spesifik: {r.model}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">Semua Model ({r.brand})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs">{r.valid_from}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                        {formatRupiah(r.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setAddUserOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              <UserPlus className="w-4 h-4" /> + Tambah Pengguna
            </button>
          </div>

          <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                    <th className="py-3 px-4 font-semibold">Nama</th>
                    <th className="py-3 px-4 font-semibold">Username</th>
                    <th className="py-3 px-4 font-semibold">Peran</th>
                    <th className="py-3 px-4 font-semibold">Status Kunci Akun</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-semibold">{u.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{u.username}</td>
                      <td className="py-3 px-4 text-xs">
                        {ROLE_LABELS[u.role as Role]} ({u.role})
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {u.locked_until && u.locked_until > Date.now() ? (
                          <span className="px-2 py-0.5 rounded bg-[#fbe7e4] text-[#c0392b] font-semibold">
                            Terkunci ({u.failed_logins}x gagal)
                          </span>
                        ) : (
                          <span className="text-[#2e8b57] font-medium">Aktif Normal</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(u.failed_logins > 0 || u.locked_until) && (
                          <button
                            onClick={() => unlockUserMutation.mutate(u.id)}
                            className="px-2.5 py-1 rounded border border-[var(--border)] text-xs font-medium inline-flex items-center gap-1"
                          >
                            <Unlock className="w-3 h-3" /> Buka Kunci
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

      <Modal open={addRateOpen} onClose={() => setAddRateOpen(false)} title="Tambah Tarif Jasa (BR-08)">
        <form
          onSubmit={e => {
            e.preventDefault();
            createRateMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Jenis Pekerjaan</label>
            <select
              value={rateForm.job_type_id}
              onChange={e => setRateForm(f => ({ ...f, job_type_id: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              {jobTypes.map((jt: any) => (
                <option key={jt.id} value={jt.id}>
                  {jt.name} ({jt.id})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Merek</label>
              <select
                value={rateForm.brand}
                onChange={e => setRateForm(f => ({ ...f, brand: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                <option value="Jaguar">Jaguar</option>
                <option value="Land Rover">Land Rover</option>
                <option value="Bentley">Bentley</option>
                <option value="Rolls-Royce">Rolls-Royce</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Model (Kosongkan jika umum)</label>
              <input
                type="text"
                value={rateForm.model}
                onChange={e => setRateForm(f => ({ ...f, model: e.target.value }))}
                placeholder="Contoh: XF / Defender 110"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Tarif Jasa (Rp)</label>
              <input
                type="number"
                required
                value={rateForm.rate}
                onChange={e => setRateForm(f => ({ ...f, rate: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Berlaku Mulai Tanggal</label>
              <input
                type="date"
                required
                value={rateForm.valid_from}
                onChange={e => setRateForm(f => ({ ...f, valid_from: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddRateOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createRateMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Tarif
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addUserOpen} onClose={() => setAddUserOpen(false)} title="Tambah Pengguna Baru">
        <form
          onSubmit={e => {
            e.preventDefault();
            createUserMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Username</label>
            <input
              type="text"
              required
              value={userForm.username}
              onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Peran (Role)</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v} ({k})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kata Sandi Awal</label>
              <input
                type="text"
                required
                value={userForm.password}
                onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddUserOpen(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Buat Akun
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AuditLogsPage: React.FC = () => {
  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ['audit-logs'],
    queryFn: () => apiFetch('/audit-logs'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Audit Log Keamanan & Jejak Transaksi</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          Catatan append-only untuk seluruh perubahan data penting, login, dan penolakan akses (RBAC).
        </p>
      </div>

      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] uppercase">
                <th className="py-3 px-4 font-semibold">Waktu</th>
                <th className="py-3 px-4 font-semibold">Pengguna</th>
                <th className="py-3 px-4 font-semibold">Aksi</th>
                <th className="py-3 px-4 font-semibold">Entitas</th>
                <th className="py-3 px-4 font-semibold">Detail Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-[var(--navy-50)]">
                  <td className="py-2.5 px-4 font-mono whitespace-nowrap">{formatDateTimeId(l.created_at)}</td>
                  <td className="py-2.5 px-4 font-medium">
                    {l.user_name ? `${l.user_name} (${l.user_role})` : 'Sistem'}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-semibold ${
                        l.action === 'AKSES_DITOLAK' || l.action === 'LOGIN_FAILED'
                          ? 'bg-[#fbe7e4] text-[#c0392b]'
                          : 'bg-[var(--navy-50)] text-[#1f3a5f] dark:text-[#c9a227]'
                      }`}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    {l.entity} {l.entity_id ? `#${l.entity_id}` : ''}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-[var(--text-muted)] max-w-md truncate">
                    {l.after_json || l.before_json || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
