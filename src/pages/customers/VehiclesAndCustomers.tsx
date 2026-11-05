import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Car,
  Plus,
  History,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateId, formatRupiah } from '../../lib/format';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  Modal,
  EmptyState,
  TableSkeleton,
  ErrorCard,
  PaginationBar,
} from '../../components/ui/Modal';
import { StatusBadge, PlateChip } from '../../components/domain/StatusBadge';

export const VehiclesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();

  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [page, setPage] = useState(1);
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

  const {
    data: vehicles = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
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
      showToast('Plat nomor diperbarui', 'success');
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
      showToast('Kendaraan disimpan', 'success');
      setAddVehicleModal(false);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canWrite = user?.role === 'SA' || user?.role === 'AD';
  const canSeePhone = user?.role === 'PM' || user?.role === 'AD' || user?.role === 'SA';
  const canSeeFinancials = user?.role === 'PM' || user?.role === 'AD' || user?.role === 'SA';

  const pageSize = 20;
  const pagedVehicles = vehicles.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageLayout
      title="Kendaraan"
      primaryAction={
        canWrite ? (
          <button type="button" onClick={() => setAddVehicleModal(true)} className="wc-btn-primary">
            <Plus className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Tambah Kendaraan</span>
          </button>
        ) : undefined
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
                setSearchParams(e.target.value ? { q: e.target.value } : {});
              }}
              placeholder="Cari plat aktif/lama (mis: B 128 XL)..."
              className="w-full wc-input pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="wc-btn-secondary"
          >
            <Users className="w-4 h-4 stroke-[1.5]" />
            <span>Daftar Pelanggan</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          message={`Tidak ada kendaraan untuk pencarian "${query}".`}
          actionLabel="Reset Pencarian"
          onAction={() => {
            setQuery('');
            setSearchParams({});
          }}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          {/* Desktop Table: maks 6 kolom */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Kendaraan</th>
                  <th>Plat Lama</th>
                  <th>Pelanggan</th>
                  <th className="text-right">Odometer</th>
                  <th>Garansi</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pagedVehicles.map((v: any) => {
                  const oldPlates = (v.plates || []).filter((p: any) => p.plate !== v.plate_current);
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <PlateChip plate={v.plate_current} />
                          <span className="text-[12px] leading-4 text-[var(--text-muted)]">
                            {v.brand} {v.model} ({v.year})
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                        {oldPlates.length > 0 ? oldPlates.map((p: any) => p.plate).join(', ') : '-'}
                      </td>
                      <td>
                        <div className="text-[14px] leading-5 text-[var(--text)]">{v.customer_name}</div>
                        {canSeePhone && v.customer_phone && (
                          <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                            {v.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-mono text-[14px] leading-5 tabular-nums whitespace-nowrap">
                        {Number(v.odometer_last).toLocaleString('id-ID')} km
                      </td>
                      <td>
                        {v.active_warranties?.length > 0 ? (
                          <StatusBadge status="GARANSI" kind="warranty" />
                        ) : (
                          <span className="text-[12px] leading-4 text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="wc-row-action inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedVehicleId(v.id)}
                            className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                          >
                            <History className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>Riwayat</span>
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setChangePlateModal({ id: v.id, current: v.plate_current });
                                  setNewPlateInput('');
                                }}
                                className="wc-btn-secondary min-h-[32px] py-1 px-2.5 text-[12px]"
                              >
                                <RefreshCw className="w-3.5 h-3.5 stroke-[1.5]" />
                                <span>Ganti Plat</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/work-orders/new?vehicleId=${v.id}`)}
                                className="wc-btn-primary min-h-[32px] py-1 px-2.5 text-[12px]"
                              >
                                <span>Terima</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile 2-Row Cards */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {pagedVehicles.map((v: any) => (
              <div key={v.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <PlateChip plate={v.plate_current} />
                  <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)] tabular-nums">
                    {Number(v.odometer_last).toLocaleString('id-ID')} km
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] leading-5 text-[var(--text)] truncate">
                    {v.brand} {v.model} · {v.customer_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleId(v.id)}
                    className="text-[12px] leading-4 font-medium text-[var(--primary)] hover:underline shrink-0 cursor-pointer"
                  >
                    Riwayat
                  </button>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={vehicles.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal: Riwayat Servis */}
      <Modal
        open={selectedVehicleId !== null}
        onClose={() => setSelectedVehicleId(null)}
        title="Riwayat Servis"
        maxWidth="max-w-2xl"
      >
        {vehicleHistory.length === 0 ? (
          <p className="text-[14px] leading-5 text-[var(--text-muted)] py-6 text-center">
            Belum ada riwayat servis.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {vehicleHistory.map((wo: any) => (
              <div key={wo.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[14px] leading-5 text-[var(--text)]">
                      {wo.wo_number}
                    </span>
                    <StatusBadge status={wo.status} kind="wo" />
                  </div>
                  <div className="text-[12px] leading-4 text-[var(--text-muted)] mt-1">
                    {formatDateId(wo.received_at)} · {Number(wo.odometer_in).toLocaleString('id-ID')} km
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canSeeFinancials && (
                    <span className="font-mono text-[14px] leading-5 font-medium tabular-nums">
                      {formatRupiah(wo.invoice_total ?? wo.estimate_total)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVehicleId(null);
                      navigate(`/work-orders/${wo.id}`);
                    }}
                    className="wc-btn-secondary min-h-[36px]"
                  >
                    <span>Buka</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal: Ganti Plat */}
      <Modal
        open={changePlateModal !== null}
        onClose={() => setChangePlateModal(null)}
        title={`Ganti Plat (${changePlateModal?.current})`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!changePlateModal || !newPlateInput.trim()) return;
            changePlateMutation.mutate({ id: changePlateModal.id, newPlate: newPlateInput });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Plat nomor baru *
            </label>
            <input
              type="text"
              required
              value={newPlateInput}
              onChange={e => setNewPlateInput(e.target.value.toUpperCase())}
              placeholder="B 99 UK"
              className="w-full wc-input font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setChangePlateModal(null)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={changePlateMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Tambah Kendaraan */}
      <Modal open={addVehicleModal} onClose={() => setAddVehicleModal(false)} title="Tambah Kendaraan">
        <form
          onSubmit={e => {
            e.preventDefault();
            createVehicleMutation.mutate(newVehForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Pelanggan *
            </label>
            <select
              value={newVehForm.customerId}
              onChange={e => setNewVehForm(f => ({ ...f, customerId: Number(e.target.value) }))}
              className="w-full wc-input"
            >
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Plat nomor *
              </label>
              <input
                type="text"
                required
                value={newVehForm.plate}
                onChange={e => setNewVehForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
                placeholder="B 888 JAG"
                className="w-full wc-input font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Merek *
              </label>
              <select
                value={newVehForm.brand}
                onChange={e => setNewVehForm(f => ({ ...f, brand: e.target.value }))}
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
                Model *
              </label>
              <input
                type="text"
                required
                value={newVehForm.model}
                onChange={e => setNewVehForm(f => ({ ...f, model: e.target.value }))}
                placeholder="Defender 110"
                className="w-full wc-input"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Tahun *
              </label>
              <input
                type="number"
                required
                value={newVehForm.year}
                onChange={e => setNewVehForm(f => ({ ...f, year: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Nomor rangka (VIN)
              </label>
              <input
                type="text"
                value={newVehForm.vin}
                onChange={e => setNewVehForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))}
                className="w-full wc-input font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
                Odometer awal (km) *
              </label>
              <input
                type="number"
                required
                value={newVehForm.odometerLast}
                onChange={e => setNewVehForm(f => ({ ...f, odometerLast: Number(e.target.value) }))}
                className="w-full wc-input font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddVehicleModal(false)} className="wc-btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={createVehicleMutation.isPending} className="wc-btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};

export const CustomersPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  const {
    data: customers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['customers', q],
    queryFn: () => apiFetch(`/customers?q=${encodeURIComponent(q)}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      apiFetch('/customers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      showToast('Pelanggan disimpan', 'success');
      setModalOpen(false);
      setForm({ name: '', phone: '', email: '', address: '' });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const canWrite = user?.role === 'SA' || user?.role === 'AD';
  const canSeePhone = user?.role === 'PM' || user?.role === 'AD' || user?.role === 'SA';

  const pageSize = 20;
  const pagedCustomers = customers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageLayout
      title="Pelanggan"
      primaryAction={
        canWrite ? (
          <button type="button" onClick={() => setModalOpen(true)} className="wc-btn-primary">
            <UserPlus className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            <span>Tambah Pelanggan</span>
          </button>
        ) : undefined
      }
      toolbar={
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 stroke-[1.5] text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama atau telepon..."
            className="w-full wc-input pl-9"
          />
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          message="Tidak ada pelanggan ditemukan."
          actionLabel={canWrite ? 'Tambah Pelanggan' : undefined}
          onAction={canWrite ? () => setModalOpen(true) : undefined}
        />
      ) : (
        <div className="wc-card p-0 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="wc-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  {canSeePhone && <th>Telepon</th>}
                  <th>Email</th>
                  <th>Alamat</th>
                  <th className="text-right">Mobil</th>
                </tr>
              </thead>
              <tbody>
                {pagedCustomers.map((c: any) => (
                  <tr key={c.id}>
                    <td className="font-medium text-[var(--text)]">{c.name}</td>
                    {canSeePhone && (
                      <td className="font-mono text-[14px] leading-5 tabular-nums">{c.phone}</td>
                    )}
                    <td className="text-[14px] leading-5 text-[var(--text-muted)]">{c.email || '-'}</td>
                    <td className="text-[14px] leading-5 text-[var(--text-muted)] max-w-xs truncate">
                      {c.address || '-'}
                    </td>
                    <td className="text-right font-mono tabular-nums">{c.vehicle_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-[var(--border)]">
            {pagedCustomers.map((c: any) => (
              <div key={c.id} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] leading-5 text-[var(--text)]">{c.name}</span>
                  <span className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                    {c.vehicle_count} mobil
                  </span>
                </div>
                {canSeePhone && (
                  <div className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">{c.phone}</div>
                )}
              </div>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={customers.length}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Pelanggan">
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate(form);
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
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full wc-input"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Telepon *
            </label>
            <input
              type="text"
              required
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full wc-input font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full wc-input"
            />
          </div>
          <div>
            <label className="block text-[12px] leading-4 font-medium text-[var(--text)] mb-1.5">
              Alamat
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full p-3 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[14px] leading-5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
