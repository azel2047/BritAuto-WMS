import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Car,
  Plus,
  History,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateId, formatRupiah } from '../../lib/format';
import { Modal, EmptyState } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/domain/StatusBadge';

export const VehiclesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [changePlateModal, setChangePlateModal] = useState<{ id: number; current: string } | null>(null);
  const [newPlateInput, setNewPlateInput] = useState('');
  const [addVehicleModal, setAddVehicleModal] = useState(false);

  const [newVehForm, setNewVehForm] = useState({
    customerId: 1,
    plate: '',
    brand: 'Jaguar',
    model: 'XF',
    year: 2023,
    vin: '',
    odometerLast: 10000,
  });

  useEffect(() => {
    const p = searchParams.get('q');
    if (p !== null) setQuery(p);
  }, [searchParams]);

  const { data: vehicles = [], isLoading } = useQuery<any[]>({
    queryKey: ['vehicles', query],
    queryFn: () => apiFetch(`/vehicles/search?q=${encodeURIComponent(query)}`),
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['customers'],
    queryFn: () => apiFetch('/customers'),
  });

  const { data: vehicleHistory = [] } = useQuery<any[]>({
    queryKey: ['vehicle-history', selectedVehicleId],
    queryFn: () => apiFetch(`/vehicles/${selectedVehicleId}/history`),
    enabled: !!selectedVehicleId,
  });

  const changePlateMutation = useMutation({
    mutationFn: ({ id, newPlate }: { id: number; newPlate: string }) =>
      apiFetch(`/vehicles/${id}/change-plate`, {
        method: 'POST',
        body: JSON.stringify({ newPlate }),
      }),
    onSuccess: () => {
      showToast('Nomor polisi berhasil diperbarui & riwayat plat disimpan (BR-01)', 'success');
      setChangePlateModal(null);
      setNewPlateInput('');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const createVehicleMutation = useMutation({
    mutationFn: (payload: typeof newVehForm) =>
      apiFetch('/vehicles', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      showToast('Kendaraan baru berhasil ditambahkan', 'success');
      setAddVehicleModal(false);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canWrite = user?.role === 'SA' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Data Kendaraan & Riwayat Nomor Polisi (BR-01)</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Pencarian instan mencakup plat nomor aktif maupun plat lama (contoh: ketik <strong>B 128 XL</strong> untuk menemukan <strong>B 21 XL</strong>).
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setAddVehicleModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-medium hover:bg-[#2c4f7c] whitespace-nowrap self-start"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Kendaraan</span>
          </button>
        )}
      </div>

      {/* Search Bar + Quick Demo Filter */}
      <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {});
              }}
              placeholder="Ketik plat lama/baru (mis: B 128 XL), nama pemilik, atau telepon..."
              className="w-full h-10 pl-10 pr-4 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#2c4f7c]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery('B 128 XL');
              setSearchParams({ q: 'B 128 XL' });
            }}
            className="px-3.5 py-2 rounded-[6px] border border-[#c9a227] bg-[#f6efd2] text-[#14243b] text-xs font-semibold hover:opacity-90 whitespace-nowrap"
          >
            Uji Demo Plat Lama: "B 128 XL"
          </button>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchParams({});
              }}
              className="px-3 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium hover:bg-[var(--navy-50)]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-[var(--surface)] rounded-[10px] border border-[var(--border)] animate-pulse" />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          message={`Tidak ditemukan kendaraan untuk pencarian "${query}".`}
          actionLabel="Tampilkan Semua Kendaraan"
          onAction={() => {
            setQuery('');
            setSearchParams({});
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v: any) => {
            const oldPlates = (v.plates || []).filter((p: any) => p.plate !== v.plate_current);
            return (
              <div
                key={v.id}
                className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="inline-flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-[#14243b] text-white font-mono font-bold text-sm tracking-wider">
                          {v.plate_current}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {v.brand} {v.model} ({v.year})
                        </span>
                      </div>
                      {oldPlates.length > 0 && (
                        <div className="mt-1.5 text-xs text-[#b36b00] bg-[#fdf1dc] px-2.5 py-1 rounded inline-block font-medium">
                          Riwayat Plat Lama: {oldPlates.map((p: any) => `${p.plate} (${p.valid_from} s/d ${p.valid_to})`).join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                      {Number(v.odometer_last).toLocaleString('id-ID')} km
                    </span>
                  </div>

                  <div className="text-xs text-[var(--text-muted)] space-y-0.5 pt-1 border-t border-[var(--border)]">
                    <div>
                      Pemilik: <strong className="text-[var(--text)]">{v.customer_name}</strong> · {v.customer_phone}
                    </div>
                    <div>VIN: <span className="font-mono">{v.vin || '-'}</span></div>
                  </div>

                  {v.active_warranties?.length > 0 && (
                    <div className="p-2.5 rounded-[6px] bg-[#e4f4ec] text-[#2e8b57] text-xs flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>
                        Garansi Aktif: {v.active_warranties.map((w: any) => `${w.component_key} (s/d ${formatDateId(w.end_date)})`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => setSelectedVehicleId(v.id)}
                    className="px-3 py-1.5 rounded-[6px] bg-[var(--navy-50)] hover:bg-[var(--navy-100)] text-[var(--text)] text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Servis & Garansi</span>
                  </button>
                  {canWrite && (
                    <>
                      <button
                        onClick={() => {
                          setChangePlateModal({ id: v.id, current: v.plate_current });
                          setNewPlateInput('');
                        }}
                        className="px-3 py-1.5 rounded-[6px] border border-[var(--border)] hover:bg-[var(--navy-50)] text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ganti Nomor Polisi</span>
                      </button>
                      <button
                        onClick={() => navigate(`/work-orders/new?vehicleId=${v.id}`)}
                        className="ml-auto px-3 py-1.5 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-medium hover:bg-[#2c4f7c]"
                      >
                        + Buat WO Servis
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Service History per Vehicle */}
      <Modal
        open={selectedVehicleId !== null}
        onClose={() => setSelectedVehicleId(null)}
        title="Riwayat Servis, Komponen & Invoice Kendaraan"
        maxWidth="max-w-3xl"
      >
        {vehicleHistory.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6 text-center">Belum ada riwayat servis untuk kendaraan ini.</p>
        ) : (
          <div className="space-y-4">
            {vehicleHistory.map((wo: any) => (
              <div key={wo.id} className="p-4 rounded-[8px] border border-[var(--border)] bg-[var(--navy-50)]/40 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#1f3a5f] dark:text-[#c9a227]">{wo.wo_number}</span>
                    <StatusBadge status={wo.status} kind="wo" />
                    {wo.invoice_number && (
                      <span className="font-mono text-xs text-[var(--text-muted)]">({wo.invoice_number})</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] tabular-nums">
                    {formatDateId(wo.received_at)} · Odometer: {Number(wo.odometer_in).toLocaleString('id-ID')} km
                  </div>
                </div>

                <div className="text-xs">
                  <strong>Keluhan:</strong> {wo.issues?.map((i: any) => i.description).join('; ') || '-'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block mb-1">Pekerjaan & Teknisi:</span>
                    <ul className="space-y-0.5">
                      {wo.jobs?.map((j: any) => (
                        <li key={j.id} className="flex justify-between">
                          <span>• {j.job_name} ({j.technician_name || 'Belum ditugaskan'})</span>
                          <span className="font-mono tabular-nums">{formatRupiah(j.rate_applied)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-1">Spare Part Diganti:</span>
                    {wo.parts?.length === 0 ? (
                      <span className="text-[var(--text-muted)] italic">Tanpa penggantian part</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {wo.parts?.map((p: any) => (
                          <li key={p.id} className="flex justify-between">
                            <span>• {p.part_name} (x{p.qty - p.returned_qty})</span>
                            <span className="font-mono tabular-nums">{formatRupiah((p.qty - p.returned_qty) * p.unit_price)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedVehicleId(null);
                      navigate(`/work-orders/${wo.id}`);
                    }}
                    className="text-xs font-medium text-[#1f6fb2] hover:underline inline-flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> Buka Detail WO
                  </button>
                  <span className="text-xs font-bold tabular-nums">
                    Total: {formatRupiah(wo.invoice_total ?? wo.estimate_total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal: Change Plate (BR-01) */}
      <Modal
        open={changePlateModal !== null}
        onClose={() => setChangePlateModal(null)}
        title={`Ganti Nomor Polisi (${changePlateModal?.current})`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!changePlateModal || !newPlateInput.trim()) return;
            changePlateMutation.mutate({ id: changePlateModal.id, newPlate: newPlateInput });
          }}
          className="space-y-4"
        >
          <p className="text-xs text-[var(--text-muted)]">
            Sesuai aturan <strong>BR-01</strong>, nomor polisi lama akan tetap tersimpan di riwayat kendaraan sehingga pencarian menggunakan plat lama maupun baru tetap menemukan kendaraan ini.
          </p>
          <div>
            <label className="block text-xs font-medium mb-1">Nomor Polisi Baru</label>
            <input
              type="text"
              required
              value={newPlateInput}
              onChange={e => setNewPlateInput(e.target.value.toUpperCase())}
              placeholder="Contoh: B 99 UK"
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono uppercase text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setChangePlateModal(null)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={changePlateMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Perubahan Plat
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Vehicle */}
      <Modal open={addVehicleModal} onClose={() => setAddVehicleModal(false)} title="Tambah Kendaraan Baru">
        <form
          onSubmit={e => {
            e.preventDefault();
            createVehicleMutation.mutate(newVehForm);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Pemilik (Pelanggan)</label>
            <select
              value={newVehForm.customerId}
              onChange={e => setNewVehForm(f => ({ ...f, customerId: Number(e.target.value) }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nomor Polisi</label>
              <input
                type="text"
                required
                value={newVehForm.plate}
                onChange={e => setNewVehForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
                placeholder="B 888 JAG"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono uppercase text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Merek Mobil Inggris</label>
              <select
                value={newVehForm.brand}
                onChange={e => setNewVehForm(f => ({ ...f, brand: e.target.value }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                <option value="Jaguar">Jaguar</option>
                <option value="Land Rover">Land Rover</option>
                <option value="Bentley">Bentley</option>
                <option value="Rolls-Royce">Rolls-Royce</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Model</label>
              <input
                type="text"
                required
                value={newVehForm.model}
                onChange={e => setNewVehForm(f => ({ ...f, model: e.target.value }))}
                placeholder="XF / Defender 110 / Ghost"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tahun</label>
              <input
                type="number"
                required
                value={newVehForm.year}
                onChange={e => setNewVehForm(f => ({ ...f, year: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nomor Rangka (VIN)</label>
              <input
                type="text"
                value={newVehForm.vin}
                onChange={e => setNewVehForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))}
                placeholder="SAJAA..."
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Odometer Awal (KM)</label>
              <input
                type="number"
                required
                value={newVehForm.odometerLast}
                onChange={e => setNewVehForm(f => ({ ...f, odometerLast: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddVehicleModal(false)}
              className="px-4 py-2 rounded-[6px] border border-[var(--border)] text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createVehicleMutation.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-xs font-semibold"
            >
              Simpan Kendaraan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const CustomersPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['customers', q],
    queryFn: () => apiFetch(`/customers?q=${encodeURIComponent(q)}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      apiFetch('/customers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      showToast('Data pelanggan berhasil disimpan', 'success');
      setModalOpen(false);
      setForm({ name: '', phone: '', email: '', address: '' });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canWrite = user?.role === 'SA' || user?.role === 'AD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Data Pelanggan</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Daftar pemilik kendaraan yang terdaftar di Bengkel Brit Auto.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1f3a5f] text-white text-sm font-medium hover:bg-[#2c4f7c]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Pelanggan</span>
          </button>
        )}
      </div>

      <div className="bg-[var(--surface)] p-4 rounded-[10px] border border-[var(--border)]">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari nama pelanggan, telepon, atau email..."
            className="w-full h-10 pl-10 pr-4 rounded-[6px] border border-[var(--border)] text-sm"
          />
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-[10px] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--navy-50)] text-[var(--text-muted)] text-xs uppercase">
                <th scope="col" className="py-3 px-4 font-semibold">Nama Pelanggan</th>
                <th scope="col" className="py-3 px-4 font-semibold">Telepon</th>
                <th scope="col" className="py-3 px-4 font-semibold">Email</th>
                <th scope="col" className="py-3 px-4 font-semibold">Alamat</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Jumlah Mobil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              {customers.map((c: any) => (
                <tr key={c.id} className="hover:bg-[var(--navy-50)]">
                  <td className="py-3 px-4 font-semibold">{c.name}</td>
                  <td className="py-3 px-4 font-mono text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" /> {c.phone}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {c.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" /> {c.email}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--text-muted)] max-w-xs truncate">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {c.address || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">{c.vehicle_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Pelanggan Baru">
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nomor Telepon / WhatsApp</label>
            <input
              type="text"
              required
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Alamat</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full p-3 rounded-[6px] border border-[var(--border)] text-sm"
            />
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
              Simpan Pelanggan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
