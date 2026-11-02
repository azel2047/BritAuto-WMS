import type Database from 'better-sqlite3';
import { normalizePlate } from '../domain/src/plates.ts';

export function seedDatabase(db: Database.Database, hashPassword: (pw: string) => string) {
  const tx = db.transaction(() => {
    const defaultPw = hashPassword('Brit2026!');

    // 1. Settings
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('bonus_threshold', '0.4');
    insertSetting.run('lock_after', '5');
    insertSetting.run('lock_minutes', '15');
    insertSetting.run('workshop_name', 'Bengkel Brit Auto');
    insertSetting.run('workshop_address', 'Jl. RS Fatmawati Raya No. 88, Cilandak, Jakarta Selatan');
    insertSetting.run('workshop_phone', '021-7591-8899');

    // 2. Users (9 demo accounts: agus PM, admin AD, sari SA, hasan KR, andi/budi/candra/dedi TK, spare SP)
    const insertUser = db.prepare(`
      INSERT INTO users (name, username, password_hash, role, active)
      VALUES (?, ?, ?, ?, 1)
    `);
    insertUser.run('Agus Sugiantu', 'agus', defaultPw, 'PM');       // id 1
    insertUser.run('Rina Wijaya', 'admin', defaultPw, 'AD');        // id 2
    insertUser.run('Sari Puspita', 'sari', defaultPw, 'SA');        // id 3
    insertUser.run('Hasan Basri', 'hasan', defaultPw, 'KR');        // id 4
    insertUser.run('Andi Pratama', 'andi', defaultPw, 'TK');        // id 5
    insertUser.run('Budi Santoso', 'budi', defaultPw, 'TK');        // id 6
    insertUser.run('Candra Kusuma', 'candra', defaultPw, 'TK');     // id 7
    insertUser.run('Dedi Kurniawan', 'dedi', defaultPw, 'TK');      // id 8
    insertUser.run('Hendra Gunawan', 'spare', defaultPw, 'SP');     // id 9

    // 3. Customers (6 customers)
    const insertCustomer = db.prepare(`
      INSERT INTO customers (name, phone, email, address)
      VALUES (?, ?, ?, ?)
    `);
    insertCustomer.run('Hendra Tanuwijaya', '08118203940', 'hendra.tan@gmail.com', 'Jl. Sriwijaya No. 14, Kebayoran Baru, Jakarta Selatan'); // 1
    insertCustomer.run('Dr. Kartika Atmaja', '081299001122', 'kartika.atmaja@klinik.id', 'Jl. Bukit Golf Utama Blok PA-12, Pondok Indah'); // 2
    insertCustomer.run('Raden Mas Suryo', '08167788990', 'rm.suryo@keraton.co.id', 'Jl. Teuku Umar No. 42, Menteng, Jakarta Pusat'); // 3
    insertCustomer.run('William Halim', '08111998877', 'william@halimgroup.com', 'Apartemen Pacific Place Residence Lt. 28, SCBD'); // 4
    insertCustomer.run('Dewi Lestari Ningrum', '081388776655', 'dewi.ningrum@yahoo.com', 'Jl. Kemang Timur V No. 9, Jakarta Selatan'); // 5
    insertCustomer.run('Alexander Prawiro', '081511223344', 'alex.prawiro@bina.id', 'Jl. Puri Indah Raya Blok I-3, Jakarta Barat'); // 6

    // 4. Vehicles (8 vehicles, including B 128 XL -> B 21 XL plate change history)
    const insertVehicle = db.prepare(`
      INSERT INTO vehicles (customer_id, plate_current, brand, model, year, vin, odometer_last)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPlate = db.prepare(`
      INSERT INTO vehicle_plates (vehicle_id, plate, plate_norm, valid_from, valid_to)
      VALUES (?, ?, ?, ?, ?)
    `);

    // V1: Jaguar XF (B 1234 JAG)
    insertVehicle.run(1, 'B 1234 JAG', 'Jaguar', 'XF', 2021, 'SAJAA05M8MFS10293', 42500);
    insertPlate.run(1, 'B 1234 JAG', normalizePlate('B 1234 JAG'), '2021-03-10', null);

    // V2: Jaguar F-Pace (Old plate: B 128 XL -> Current plate: B 21 XL) [BR-01 Demo Acceptance #2]
    insertVehicle.run(1, 'B 21 XL', 'Jaguar', 'F-Pace', 2020, 'SADCA2BN7LA654321', 58200);
    insertPlate.run(2, 'B 128 XL', normalizePlate('B 128 XL'), '2020-05-01', '2025-11-15');
    insertPlate.run(2, 'B 21 XL', normalizePlate('B 21 XL'), '2025-11-15', null);

    // V3: Land Rover Range Rover Evoque (D 777 LR)
    insertVehicle.run(2, 'D 777 LR', 'Land Rover', 'Range Rover Evoque', 2022, 'SALVA2BG8NH882101', 35100);
    insertPlate.run(3, 'D 777 LR', normalizePlate('D 777 LR'), '2022-02-18', null);

    // V4: Bentley Continental GT (B 9 BNT)
    insertVehicle.run(3, 'B 9 BNT', 'Bentley', 'Continental GT', 2021, 'SCBCU7ZA0MC099112', 19400);
    insertPlate.run(4, 'B 9 BNT', normalizePlate('B 9 BNT'), '2021-08-01', null);

    // V5: Rolls-Royce Ghost (F 55 RR)
    insertVehicle.run(4, 'F 55 RR', 'Rolls-Royce', 'Ghost', 2020, 'SCA664S58LU100554', 24800);
    insertPlate.run(5, 'F 55 RR', normalizePlate('F 55 RR'), '2020-10-12', null);

    // V6: Land Rover Defender 110 (B 808 DEF)
    insertVehicle.run(5, 'B 808 DEF', 'Land Rover', 'Defender 110', 2023, 'SALEA7BW1P2190888', 29500);
    insertPlate.run(6, 'B 808 DEF', normalizePlate('B 808 DEF'), '2023-01-20', null);

    // V7: Land Rover Range Rover Vogue (B 1001 RRV)
    insertVehicle.run(6, 'B 1001 RRV', 'Land Rover', 'Range Rover Vogue', 2019, 'SALGS2SV9KA541209', 74200);
    insertPlate.run(7, 'B 1001 RRV', normalizePlate('B 1001 RRV'), '2019-06-14', null);

    // V8: Bentley Bentayga (B 888 BTY)
    insertVehicle.run(4, 'B 888 BTY', 'Bentley', 'Bentayga', 2022, 'SJAAM2ZV5NC038441', 31000);
    insertPlate.run(8, 'B 888 BTY', normalizePlate('B 888 BTY'), '2022-07-05', null);

    // 5. Job Types (12 jenis pekerjaan)
    const insertJobType = db.prepare(`
      INSERT INTO job_types (id, name, category, standard_minutes, warranty_days, component_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertJobType.run('SRV_BERKALA', 'Servis Berkala 10.000 KM', 'Perawatan Berkala', 120, 30, 'MESIN_DASAR');
    insertJobType.run('GANTI_OLI', 'Ganti Oli Mesin & Filter', 'Perawatan Berkala', 60, 14, 'OLI_MESIN');
    insertJobType.run('REM_DEPAN', 'Ganti Kampas & Cakram Rem Depan', 'Sistem Rem', 90, 90, 'REM_DEPAN');
    insertJobType.run('REM_BELAKANG', 'Ganti Kampas Rem Belakang & Kalibrasi EPB', 'Sistem Rem', 75, 90, 'REM_BELAKANG');
    insertJobType.run('AC_SERVIS', 'Servis Sistem AC & Ganti Kompresor', 'AC & Pendingin', 150, 90, 'KOMPRESOR_AC');
    insertJobType.run('AC_KONDENSOR', 'Penggantian Kondensor & Flushing AC', 'AC & Pendingin', 120, 90, 'KONDENSOR_AC');
    insertJobType.run('SUSPENSI_UDARA', 'Kalibrasi & Perbaikan Air Suspension', 'Kaki-Kaki & Suspensi', 180, 180, 'AIR_SUSPENSION');
    insertJobType.run('DIAGNOSA_ECU', 'Diagnosa Sistem Elektrikal & Pemrograman ECU', 'Elektrikal', 90, 30, 'ECU_MODUL');
    insertJobType.run('TRANSMISI_ATF', 'Flushing Oli Transmisi ZF 8-Speed & Mechatronic', 'Transmisi', 150, 90, 'TRANSMISI_ZF');
    insertJobType.run('COOLING_SYS', 'Perbaikan Sistem Pendingin & Water Pump', 'Mesin', 180, 120, 'WATER_PUMP');
    insertJobType.run('BUSI_IGNITION', 'Ganti Busi Iridium & Ignition Coil Set', 'Mesin', 90, 60, 'IGNITION_COIL');
    insertJobType.run('AKI_BATERAI', 'Penggantian Aki AGM & Registrasi BMS', 'Elektrikal', 45, 180, 'AKI_AGM');

    // 6. Job Rates (BR-08: specific model > brand > general)
    const insertRate = db.prepare(`
      INSERT INTO job_rates (job_type_id, brand, model, rate, valid_from)
      VALUES (?, ?, ?, ?, ?)
    `);
    const brands = ['Jaguar', 'Land Rover', 'Bentley', 'Rolls-Royce'];
    const baseRates: Record<string, Record<string, number>> = {
      SRV_BERKALA: { 'Jaguar': 1500000, 'Land Rover': 1650000, 'Bentley': 2800000, 'Rolls-Royce': 3500000 },
      GANTI_OLI: { 'Jaguar': 550000, 'Land Rover': 650000, 'Bentley': 1100000, 'Rolls-Royce': 1400000 },
      REM_DEPAN: { 'Jaguar': 1200000, 'Land Rover': 1350000, 'Bentley': 2400000, 'Rolls-Royce': 2900000 },
      REM_BELAKANG: { 'Jaguar': 1000000, 'Land Rover': 1150000, 'Bentley': 2100000, 'Rolls-Royce': 2500000 },
      AC_SERVIS: { 'Jaguar': 1800000, 'Land Rover': 1950000, 'Bentley': 3200000, 'Rolls-Royce': 3800000 },
      AC_KONDENSOR: { 'Jaguar': 1400000, 'Land Rover': 1500000, 'Bentley': 2500000, 'Rolls-Royce': 3000000 },
      SUSPENSI_UDARA: { 'Jaguar': 2200000, 'Land Rover': 2500000, 'Bentley': 4200000, 'Rolls-Royce': 4900000 },
      DIAGNOSA_ECU: { 'Jaguar': 850000, 'Land Rover': 950000, 'Bentley': 1500000, 'Rolls-Royce': 1800000 },
      TRANSMISI_ATF: { 'Jaguar': 1750000, 'Land Rover': 1900000, 'Bentley': 3100000, 'Rolls-Royce': 3600000 },
      COOLING_SYS: { 'Jaguar': 1900000, 'Land Rover': 2100000, 'Bentley': 3400000, 'Rolls-Royce': 4000000 },
      BUSI_IGNITION: { 'Jaguar': 950000, 'Land Rover': 1100000, 'Bentley': 2200000, 'Rolls-Royce': 2600000 },
      AKI_BATERAI: { 'Jaguar': 500000, 'Land Rover': 550000, 'Bentley': 900000, 'Rolls-Royce': 1100000 },
    };
    for (const [jobId, brandMap] of Object.entries(baseRates)) {
      for (const b of brands) {
        insertRate.run(jobId, b, null, brandMap[b], '2025-01-01');
      }
    }
    // Model-specific overrides (BR-08)
    insertRate.run('SRV_BERKALA', 'Jaguar', 'XF', 1600000, '2026-01-01');
    insertRate.run('SRV_BERKALA', 'Jaguar', 'F-Pace', 1700000, '2026-01-01');
    insertRate.run('SRV_BERKALA', 'Land Rover', 'Defender 110', 1850000, '2026-01-01');
    insertRate.run('SUSPENSI_UDARA', 'Land Rover', 'Range Rover Vogue', 2800000, '2026-01-01');

    // 7. Suppliers (3 pemasok) & 25 Spare Parts
    const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact) VALUES (?, ?)');
    insertSupplier.run('PT EuroParts Nusantara', '021-5588991 / sales@europarts.co.id');
    insertSupplier.run('CV British Motor Spares', '021-4209911 / order@britishspares.id');
    insertSupplier.run('PT Castrol & ZF Distribusi', '021-8901122 / b2b@lubricant.co.id');

    const insertPart = db.prepare(`
      INSERT INTO parts (code, name, unit, stock_qty, min_stock, buy_price, sell_price, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const partsData: [string, string, string, number, number, number, number, number][] = [
      ['PRT-OLI-001', 'Oli Mesin Castrol Edge Professional 5W-30 (1L)', 'Liter', 3, 5, 195000, 285000, 3], // Low stock (3 <= 5) per SKILL §4
      ['PRT-OLI-002', 'Oli Mesin Mobil 1 FS 0W-40 European Car (1L)', 'Liter', 28, 12, 230000, 340000, 3],
      ['PRT-FLT-001', 'Filter Oli Original Jaguar / Land Rover AJ200', 'Pcs', 10, 5, 320000, 480000, 1],
      ['PRT-FLT-002', 'Filter Oli Original Bentley W12 / V8', 'Pcs', 4, 4, 680000, 950000, 2], // Low stock (4 <= 4)
      ['PRT-FLT-003', 'Filter Udara Mesin Jaguar XF / F-Pace', 'Pcs', 8, 4, 450000, 680000, 1],
      ['PRT-FLT-004', 'Filter Kabin Karbon Aktif Range Rover', 'Pcs', 7, 4, 520000, 790000, 1],
      ['PRT-REM-001', 'Kampas Rem Depan Brembo Jaguar XF / F-Pace', 'Set', 2, 4, 1850000, 2450000, 1], // Low stock (2 <= 4)
      ['PRT-REM-002', 'Kampas Rem Belakang Jaguar / Land Rover', 'Set', 6, 3, 1450000, 1950000, 1],
      ['PRT-REM-003', 'Kampas Rem Depan Bentley Continental GT OEM', 'Set', 3, 2, 4800000, 6200000, 2],
      ['PRT-REM-004', 'Cakram Rem (Brake Disc) Depan Range Rover (Pair)', 'Set', 4, 2, 3600000, 4850000, 1],
      ['PRT-REM-005', 'Minyak Rem DOT 4 LV Pentosin (1L)', 'Botol', 14, 6, 240000, 360000, 3],
      ['PRT-AC-001', 'Kompresor AC Denso Original Jaguar / Land Rover', 'Unit', 2, 2, 6900000, 8800000, 2], // Low stock (2 <= 2)
      ['PRT-AC-002', 'Kondensor AC Aluminium Range Rover Evoque / XF', 'Unit', 3, 2, 3400000, 4500000, 2],
      ['PRT-AC-003', 'Freon R134a / R1234yf High Purity Service Pack', 'Tabung', 9, 4, 420000, 650000, 3],
      ['PRT-SUS-001', 'Air Suspension Strut Depan Range Rover / Bentley', 'Unit', 3, 2, 9500000, 12500000, 2],
      ['PRT-SUS-002', 'Kompresor Air Suspension AMK Original Land Rover', 'Unit', 2, 2, 7800000, 9900000, 2],
      ['PRT-TRN-001', 'Oli Transmisi ZF LifeguardFluid 8 (1L)', 'Liter', 18, 10, 390000, 560000, 3],
      ['PRT-TRN-002', 'Bak Carter & Filter Transmisi ZF 8HP Kit', 'Set', 5, 3, 2400000, 3300000, 3],
      ['PRT-CLG-001', 'Water Pump Assembly Jaguar / Land Rover Ingenium', 'Unit', 4, 2, 2900000, 3950000, 1],
      ['PRT-CLG-002', 'Thermostat Housing Assembly Original JLR', 'Unit', 5, 3, 1650000, 2350000, 1],
      ['PRT-CLG-003', 'Coolant Concentrate Extended Life JLR (1L)', 'Botol', 15, 6, 180000, 275000, 3],
      ['PRT-IGN-001', 'Busi Laser Iridium NGK Jaguar / Land Rover', 'Pcs', 24, 8, 290000, 440000, 1],
      ['PRT-IGN-002', 'Ignition Coil Bosch Original European', 'Pcs', 10, 4, 780000, 1150000, 1],
      ['PRT-ELC-001', 'Aki Varta Silver Dynamic AGM 95Ah 850A', 'Unit', 4, 2, 3850000, 4950000, 1],
      ['PRT-WPR-001', 'Wiper Blade Frameless Set Jaguar / Range Rover', 'Set', 6, 3, 620000, 890000, 1],
    ];
    for (const p of partsData) {
      insertPart.run(...p);
    }

    // 8. Service Intervals (6 bulan / 10.000 km)
    const insertInterval = db.prepare(`
      INSERT INTO service_intervals (brand, model, km_interval, month_interval)
      VALUES (?, ?, ?, ?)
    `);
    insertInterval.run('Jaguar', null, 10000, 6);
    insertInterval.run('Land Rover', null, 10000, 6);
    insertInterval.run('Bentley', null, 10000, 6);
    insertInterval.run('Rolls-Royce', null, 10000, 6);

    // 9. Tech Work Hours (for current and past months)
    const insertWorkHours = db.prepare(`
      INSERT INTO tech_work_hours (technician_id, period, available_hours)
      VALUES (?, ?, ?)
    `);
    const months = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    for (const m of months) {
      for (const techId of [5, 6, 7, 8]) {
        insertWorkHours.run(techId, m, 160);
      }
    }

    // 10. Tools & Tool Loans
    const insertTool = db.prepare('INSERT INTO tools (code, name, qty) VALUES (?, ?, ?)');
    insertTool.run('TL-JLR-01', 'JLR Pathfinder SDD Diagnostic Interface', 2);
    insertTool.run('TL-BNT-01', 'VAS 6154 Bentley ODIS Diagnostic Scanner', 1);
    insertTool.run('TL-TRQ-01', 'Kunci Momen Digital Stahlwille 20-200 Nm', 3);
    insertTool.run('TL-TIM-01', 'Timing Chain Locking Tool Kit JLR Ingenium', 2);
    insertTool.run('TL-SUS-01', 'Air Suspension Nitrogen Pressure Tester', 2);
    insertTool.run('TL-BRK-01', 'Brake Bleeding Pressure Unit ATE FB30', 2);

    const insertLoan = db.prepare(`
      INSERT INTO tool_loans (tool_id, technician_id, loaned_at, returned_at, condition_note)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLoan.run(1, 5, '2026-11-02T01:30:00Z', null, 'Kondisi lengkap dengan kabel OBD');
    insertLoan.run(3, 6, '2026-11-02T02:00:00Z', null, 'Kalibrasi normal');
    insertLoan.run(4, 7, '2026-10-28T02:00:00Z', '2026-10-28T09:00:00Z', 'Lengkap dikembalikan');

    // 11. Historical & Active Work Orders (15 WOs across 2026-07 to 2026-11)
    const insertWO = db.prepare(`
      INSERT INTO work_orders (wo_number, vehicle_id, status, received_at, odometer_in, condition_note, estimate_total, no_parts_required, is_warranty_wo, created_by, reviewed_by, reviewed_at, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertIssue = db.prepare('INSERT INTO wo_issues (work_order_id, description) VALUES (?, ?)');
    const insertJob = db.prepare(`
      INSERT INTO wo_jobs (work_order_id, job_type_id, technician_id, status, rate_applied, standard_minutes, waiting_part)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTimeLog = db.prepare(`
      INSERT INTO time_logs (wo_job_id, technician_id, clock_on, clock_off, duration_minutes, waiting_part_minutes, waiting_part)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertWoPart = db.prepare(`
      INSERT INTO wo_parts (work_order_id, wo_job_id, part_id, qty, unit_price, issued_by, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (invoice_number, work_order_id, issued_at, subtotal_labor, subtotal_parts, other_cost, discount, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInvItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, item_type, description, qty, unit_price, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (invoice_id, paid_at, method, amount)
      VALUES (?, ?, ?, ?)
    `);
    const insertWarranty = db.prepare(`
      INSERT INTO warranties (vehicle_id, wo_job_id, component_key, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Helper for closed historical WO
    let woCounter = 0;
    let jobCounter = 0;
    let invCounter = 0;

    function createClosedWO(opts: {
      woNum: string;
      invNum: string;
      vehicleId: number;
      dateIso: string;
      odometer: number;
      issue: string;
      jobs: { jobTypeId: string; techId: number; rate: number; stdMin: number; actualMin: number; warrantyDays: number; compKey: string }[];
      parts: { partId: number; name: string; qty: number; price: number }[];
      otherCost?: number;
      discount?: number;
      paidStatus?: 'LUNAS' | 'BELUM_BAYAR';
    }) {
      woCounter++;
      const woId = woCounter;
      const laborTotal = opts.jobs.reduce((s, j) => s + j.rate, 0);
      const partsTotal = opts.parts.reduce((s, p) => s + p.qty * p.price, 0);
      const other = opts.otherCost ?? 0;
      const disc = opts.discount ?? 0;
      const total = laborTotal + partsTotal + other - disc;

      insertWO.run(
        opts.woNum,
        opts.vehicleId,
        'DITUTUP',
        `${opts.dateIso}T08:30:00Z`,
        opts.odometer,
        'Bodi mulus, barang berharga tidak ada',
        total,
        opts.parts.length === 0 ? 1 : 0,
        0,
        3,
        3,
        `${opts.dateIso}T15:30:00Z`,
        `${opts.dateIso}T16:00:00Z`
      );
      insertIssue.run(woId, opts.issue);

      let firstJobId = 0;
      for (const j of opts.jobs) {
        jobCounter++;
        const jId = jobCounter;
        if (!firstJobId) firstJobId = jId;
        insertJob.run(woId, j.jobTypeId, j.techId, 'SELESAI', j.rate, j.stdMin, 0);
        const startMs = Date.parse(`${opts.dateIso}T09:00:00Z`);
        const endIso = new Date(startMs + j.actualMin * 60_000).toISOString();
        insertTimeLog.run(jId, j.techId, `${opts.dateIso}T09:00:00Z`, endIso, j.actualMin, 0, 0);

        if (j.warrantyDays > 0) {
          const endD = new Date(`${opts.dateIso}T00:00:00Z`);
          endD.setUTCDate(endD.getUTCDate() + j.warrantyDays);
          insertWarranty.run(opts.vehicleId, jId, j.compKey, opts.dateIso, endD.toISOString().slice(0, 10));
        }
      }

      for (const p of opts.parts) {
        insertWoPart.run(woId, firstJobId, p.partId, p.qty, p.price, 9, `${opts.dateIso}T10:15:00Z`);
      }

      invCounter++;
      const invId = invCounter;
      const st = opts.paidStatus ?? 'LUNAS';
      insertInvoice.run(opts.invNum, woId, `${opts.dateIso}T16:00:00Z`, laborTotal, partsTotal, other, disc, total, st);

      for (const j of opts.jobs) {
        insertInvItem.run(invId, 'JASA', `Jasa ${j.jobTypeId}`, 1, j.rate, j.rate);
      }
      for (const p of opts.parts) {
        insertInvItem.run(invId, 'PART', p.name, p.qty, p.price, p.qty * p.price);
      }
      if (other > 0) {
        insertInvItem.run(invId, 'LAIN', 'Biaya Consumable & Cleaning', 1, other, other);
      }
      if (st === 'LUNAS') {
        insertPayment.run(invId, `${opts.dateIso}T16:30:00Z`, 'Transfer BCA', total);
      }
    }

    // WO 1 (2026-04-15) - V2 (B 128 XL -> B 21 XL) -> Makes V2 due for 6-month service reminder!
    createClosedWO({
      woNum: 'WO-20260415-001',
      invNum: 'INV-20260415-001',
      vehicleId: 2,
      dateIso: '2026-04-15',
      odometer: 47500,
      issue: 'Servis berkala 45.000 KM dan ganti oli mesin (saat masih plat B 128 XL)',
      jobs: [{ jobTypeId: 'SRV_BERKALA', techId: 5, rate: 1700000, stdMin: 120, actualMin: 110, warrantyDays: 30, compKey: 'MESIN_DASAR' }],
      parts: [
        { partId: 1, name: 'Oli Mesin Castrol Edge Professional 5W-30 (1L)', qty: 7, price: 285000 },
        { partId: 3, name: 'Filter Oli Original Jaguar / Land Rover AJ200', qty: 1, price: 480000 },
      ],
    });

    // WO 2 (2026-04-20) - V7 (Range Rover Vogue) -> Makes V7 due for 6-month service reminder!
    createClosedWO({
      woNum: 'WO-20260420-001',
      invNum: 'INV-20260420-001',
      vehicleId: 7,
      dateIso: '2026-04-20',
      odometer: 63500,
      issue: 'Servis berkala dan ganti kampas rem belakang',
      jobs: [
        { jobTypeId: 'SRV_BERKALA', techId: 6, rate: 1650000, stdMin: 120, actualMin: 115, warrantyDays: 30, compKey: 'MESIN_DASAR' },
        { jobTypeId: 'REM_BELAKANG', techId: 7, rate: 1150000, stdMin: 75, actualMin: 70, warrantyDays: 90, compKey: 'REM_BELAKANG' },
      ],
      parts: [
        { partId: 1, name: 'Oli Mesin Castrol Edge Professional 5W-30 (1L)', qty: 8, price: 285000 },
        { partId: 8, name: 'Kampas Rem Belakang Jaguar / Land Rover', qty: 1, price: 1950000 },
      ],
    });

    // WO 3 (2026-07-10) - V4 Bentley Continental GT
    createClosedWO({
      woNum: 'WO-20260710-001',
      invNum: 'INV-20260710-001',
      vehicleId: 4,
      dateIso: '2026-07-10',
      odometer: 16000,
      issue: 'Servis berkala tahunan Bentley W12 & ganti kampas rem depan',
      jobs: [
        { jobTypeId: 'SRV_BERKALA', techId: 5, rate: 2800000, stdMin: 120, actualMin: 105, warrantyDays: 30, compKey: 'MESIN_DASAR' },
        { jobTypeId: 'REM_DEPAN', techId: 6, rate: 2400000, stdMin: 90, actualMin: 85, warrantyDays: 90, compKey: 'REM_DEPAN' },
      ],
      parts: [
        { partId: 2, name: 'Oli Mesin Mobil 1 FS 0W-40 European Car (1L)', qty: 10, price: 340000 },
        { partId: 4, name: 'Filter Oli Original Bentley W12 / V8', qty: 1, price: 950000 },
        { partId: 9, name: 'Kampas Rem Depan Bentley Continental GT OEM', qty: 1, price: 6200000 },
      ],
    });

    // WO 4 (2026-08-12) - V5 Rolls-Royce Ghost
    createClosedWO({
      woNum: 'WO-20260812-001',
      invNum: 'INV-20260812-001',
      vehicleId: 5,
      dateIso: '2026-08-12',
      odometer: 22100,
      issue: 'Perbaikan Air Suspension depan & ganti aki AGM',
      jobs: [
        { jobTypeId: 'SUSPENSI_UDARA', techId: 5, rate: 4900000, stdMin: 180, actualMin: 160, warrantyDays: 180, compKey: 'AIR_SUSPENSION' },
        { jobTypeId: 'AKI_BATERAI', techId: 7, rate: 1100000, stdMin: 45, actualMin: 40, warrantyDays: 180, compKey: 'AKI_AGM' },
      ],
      parts: [
        { partId: 15, name: 'Air Suspension Strut Depan Range Rover / Bentley', qty: 1, price: 12500000 },
        { partId: 24, name: 'Aki Varta Silver Dynamic AGM 95Ah 850A', qty: 1, price: 4950000 },
      ],
    });

    // WO 5 (2026-09-05) - V1 Jaguar XF (AC_SERVIS with 90 days warranty -> active warranty until Dec 2026! Great for BR-09 demo)
    createClosedWO({
      woNum: 'WO-20260905-001',
      invNum: 'INV-20260905-001',
      vehicleId: 1,
      dateIso: '2026-09-05',
      odometer: 31500, // Current odometer on V1 is 42500 (+11,000 km -> due by KM!)
      issue: 'AC kurang dingin, ganti kompresor AC dan servis berkala',
      jobs: [
        { jobTypeId: 'AC_SERVIS', techId: 5, rate: 1800000, stdMin: 150, actualMin: 130, warrantyDays: 90, compKey: 'KOMPRESOR_AC' },
        { jobTypeId: 'SRV_BERKALA', techId: 6, rate: 1600000, stdMin: 120, actualMin: 100, warrantyDays: 30, compKey: 'MESIN_DASAR' },
      ],
      parts: [
        { partId: 12, name: 'Kompresor AC Denso Original Jaguar / Land Rover', qty: 1, price: 8800000 },
        { partId: 14, name: 'Freon R134a / R1234yf High Purity Service Pack', qty: 1, price: 650000 },
        { partId: 1, name: 'Oli Mesin Castrol Edge Professional 5W-30 (1L)', qty: 6, price: 285000 },
      ],
    });

    // WO 6 (2026-09-19) - V3 Range Rover Evoque
    createClosedWO({
      woNum: 'WO-20260919-001',
      invNum: 'INV-20260919-001',
      vehicleId: 3,
      dateIso: '2026-09-19',
      odometer: 33200,
      issue: 'Ganti kampas & cakram rem depan serta flushing minyak rem',
      jobs: [
        { jobTypeId: 'REM_DEPAN', techId: 7, rate: 1350000, stdMin: 90, actualMin: 80, warrantyDays: 90, compKey: 'REM_DEPAN' },
      ],
      parts: [
        { partId: 7, name: 'Kampas Rem Depan Brembo Jaguar XF / F-Pace', qty: 1, price: 2450000 },
        { partId: 10, name: 'Cakram Rem (Brake Disc) Depan Range Rover (Pair)', qty: 1, price: 4850000 },
        { partId: 11, name: 'Minyak Rem DOT 4 LV Pentosin (1L)', qty: 2, price: 360000 },
      ],
    });

    // WO 7 (2026-10-08) - V6 Defender 110
    createClosedWO({
      woNum: 'WO-20261008-001',
      invNum: 'INV-20261008-001',
      vehicleId: 6,
      dateIso: '2026-10-08',
      odometer: 28000,
      issue: 'Flushing oli transmisi ZF 8-Speed & ganti filter kabin',
      jobs: [
        { jobTypeId: 'TRANSMISI_ATF', techId: 5, rate: 1900000, stdMin: 150, actualMin: 120, warrantyDays: 90, compKey: 'TRANSMISI_ZF' },
      ],
      parts: [
        { partId: 17, name: 'Oli Transmisi ZF LifeguardFluid 8 (1L)', qty: 7, price: 560000 },
        { partId: 18, name: 'Bak Carter & Filter Transmisi ZF 8HP Kit', qty: 1, price: 3300000 },
        { partId: 6, name: 'Filter Kabin Karbon Aktif Range Rover', qty: 1, price: 790000 },
      ],
    });

    // WO 8 (2026-10-18) - V8 Bentley Bentayga
    createClosedWO({
      woNum: 'WO-20261018-001',
      invNum: 'INV-20261018-001',
      vehicleId: 8,
      dateIso: '2026-10-18',
      odometer: 30500,
      issue: 'Ganti busi Iridium, Ignition Coil, dan diagnosa ECU',
      jobs: [
        { jobTypeId: 'BUSI_IGNITION', techId: 6, rate: 2200000, stdMin: 90, actualMin: 75, warrantyDays: 60, compKey: 'IGNITION_COIL' },
        { jobTypeId: 'DIAGNOSA_ECU', techId: 8, rate: 1500000, stdMin: 90, actualMin: 80, warrantyDays: 30, compKey: 'ECU_MODUL' },
      ],
      parts: [
        { partId: 22, name: 'Busi Laser Iridium NGK Jaguar / Land Rover', qty: 8, price: 440000 },
        { partId: 23, name: 'Ignition Coil Bosch Original European', qty: 4, price: 1150000 },
      ],
    });

    // WO 9 (2026-10-25) - V2 Jaguar F-Pace (B 21 XL)
    createClosedWO({
      woNum: 'WO-20261025-001',
      invNum: 'INV-20261025-001',
      vehicleId: 2,
      dateIso: '2026-10-25',
      odometer: 58200,
      issue: 'Perbaikan sistem pendingin & ganti water pump',
      jobs: [
        { jobTypeId: 'COOLING_SYS', techId: 5, rate: 1900000, stdMin: 180, actualMin: 150, warrantyDays: 120, compKey: 'WATER_PUMP' },
      ],
      parts: [
        { partId: 19, name: 'Water Pump Assembly Jaguar / Land Rover Ingenium', qty: 1, price: 3950000 },
        { partId: 20, name: 'Thermostat Housing Assembly Original JLR', qty: 1, price: 2350000 },
        { partId: 21, name: 'Coolant Concentrate Extended Life JLR (1L)', qty: 4, price: 275000 },
      ],
    });

    // Add extra productive time logs in 2026-10 & 2026-11 so Technician KPI page shows rich realistic numbers (>40% bonus threshold for Andi & Budi!)
    // Andi (tech 5): 160h available = 9600 min. Let's give Andi ~82 hours (4920 min = 51.25% productivity -> BONUS ELIGIBLE) in 2026-11 and 2026-10
    // Budi (tech 6): ~72 hours (4320 min = 45.0% -> BONUS ELIGIBLE)
    // Candra (tech 7): ~58 hours (3480 min = 36.25% -> BELUM BONUS)
    // Dedi (tech 8): ~52 hours (3120 min = 32.5% -> BELUM BONUS)

    // WO 10 (2026-11-01) - Closed yesterday in Nov 2026
    createClosedWO({
      woNum: 'WO-20261101-001',
      invNum: 'INV-20261101-001',
      vehicleId: 4,
      dateIso: '2026-11-01',
      odometer: 19400,
      issue: 'Perawatan sistem AC & penggantian kondensor Bentley',
      jobs: [
        { jobTypeId: 'AC_KONDENSOR', techId: 5, rate: 2500000, stdMin: 120, actualMin: 95, warrantyDays: 90, compKey: 'KONDENSOR_AC' },
        { jobTypeId: 'GANTI_OLI', techId: 6, rate: 1100000, stdMin: 60, actualMin: 50, warrantyDays: 14, compKey: 'OLI_MESIN' },
      ],
      parts: [
        { partId: 13, name: 'Kondensor AC Aluminium Range Rover Evoque / XF', qty: 1, price: 4500000 },
        { partId: 2, name: 'Oli Mesin Mobil 1 FS 0W-40 European Car (1L)', qty: 8, price: 340000 },
      ],
    });

    // Additional time logs for 2026-11 & 2026-10 on completed jobs to represent multi-day overhaul batches
    insertTimeLog.run(1, 5, '2026-10-02T01:00:00Z', '2026-10-04T09:00:00Z', 4200, 0, 0);
    insertTimeLog.run(3, 6, '2026-10-05T01:00:00Z', '2026-10-07T08:00:00Z', 4000, 0, 0);
    insertTimeLog.run(2, 7, '2026-10-10T01:00:00Z', '2026-10-12T04:00:00Z', 3300, 0, 0);
    insertTimeLog.run(13, 8, '2026-10-15T01:00:00Z', '2026-10-17T01:00:00Z', 2900, 0, 0);

    // And for 2026-11 (current month)
    insertTimeLog.run(15, 5, '2026-11-01T01:00:00Z', '2026-11-01T10:00:00Z', 4850, 0, 0);
    insertTimeLog.run(16, 6, '2026-11-01T01:00:00Z', '2026-11-01T09:00:00Z', 4270, 0, 0);
    insertTimeLog.run(9, 7, '2026-11-01T01:00:00Z', '2026-11-01T07:00:00Z', 3480, 0, 0);
    insertTimeLog.run(13, 8, '2026-11-01T01:00:00Z', '2026-11-01T06:00:00Z', 3120, 0, 0);

    // Now create 5 ACTIVE Work Orders in different statuses for live demo!
    // WO 11: MENUNGGU_PENUGASAN (V1 Jaguar XF B 1234 JAG)
    woCounter++;
    const wo11 = woCounter;
    insertWO.run('WO-20261102-001', 1, 'MENUNGGU_PENUGASAN', '2026-11-02T01:15:00Z', 42500, 'Baret halus bumper kiri depan, BBM 3/4', 2450000, 0, 0, 3, null, null, null);
    insertIssue.run(wo11, 'Suara mendecit saat pengereman kecepatan rendah & cek modul elektrikal');
    jobCounter++;
    insertJob.run(wo11, 'REM_DEPAN', null, 'MENUNGGU', 1200000, 90, 0);
    jobCounter++;
    insertJob.run(wo11, 'DIAGNOSA_ECU', null, 'MENUNGGU', 850000, 90, 0);

    // WO 12: DITUGASKAN (V3 Range Rover Evoque D 777 LR) - Assigned to Andi (5) and Budi (6), ready to Clock On!
    woCounter++;
    const wo12 = woCounter;
    insertWO.run('WO-20261102-002', 3, 'DITUGASKAN', '2026-11-02T01:30:00Z', 35100, 'Kondisi eksterior baik, velg kanan belakang lecet tipis', 2300000, 0, 0, 3, null, null, null);
    insertIssue.run(wo12, 'Servis berkala 35.000 KM dan ganti oli mesin');
    jobCounter++;
    insertJob.run(wo12, 'SRV_BERKALA', 5, 'MENUNGGU', 1650000, 120, 0);
    jobCounter++;
    insertJob.run(wo12, 'GANTI_OLI', 6, 'MENUNGGU', 650000, 60, 0);

    // WO 13: DIKERJAKAN (V5 Rolls-Royce Ghost F 55 RR) - Candra (7) is currently clocked on!
    woCounter++;
    const wo13 = woCounter;
    insertWO.run('WO-20261102-003', 5, 'DIKERJAKAN', '2026-11-02T00:45:00Z', 24800, 'Kondisi sangat mulus, payung pintu lengkap', 5300000, 0, 0, 3, null, null, null);
    insertIssue.run(wo13, 'Getaran halus pada transmisi saat perpindahan gigi 2 ke 3');
    jobCounter++;
    const jobWo13 = jobCounter;
    insertJob.run(wo13, 'TRANSMISI_ATF', 7, 'BERJALAN', 3600000, 150, 0);
    insertTimeLog.run(jobWo13, 7, '2026-11-02T01:10:00Z', null, null, 0, 0);

    // WO 14: SELESAI_DIKERJAKAN (V6 Land Rover Defender 110 B 808 DEF) - Ready for SA Review & Close!
    woCounter++;
    const wo14 = woCounter;
    insertWO.run('WO-20261102-004', 6, 'SELESAI_DIKERJAKAN', '2026-11-01T23:30:00Z', 29500, 'Ada lumpur di undercarriage, bodi aman', 4110000, 0, 0, 3, null, null, null);
    insertIssue.run(wo14, 'Ganti oli mesin & kampas rem belakang Defender');
    jobCounter++;
    const jobWo14a = jobCounter;
    insertJob.run(wo14, 'GANTI_OLI', 8, 'SELESAI', 650000, 60, 0);
    insertTimeLog.run(jobWo14a, 8, '2026-11-02T00:00:00Z', '2026-11-02T00:50:00Z', 50, 0, 0);
    jobCounter++;
    const jobWo14b = jobCounter;
    insertJob.run(wo14, 'REM_BELAKANG', 8, 'SELESAI', 1150000, 75, 0);
    insertTimeLog.run(jobWo14b, 8, '2026-11-02T00:55:00Z', '2026-11-02T02:00:00Z', 65, 0, 0);
    // Issue parts to WO 14 so it is ready to be reviewed and closed!
    insertWoPart.run(wo14, jobWo14a, 2, 6, 340000, 9, '2026-11-02T00:15:00Z');
    insertWoPart.run(wo14, jobWo14b, 8, 1, 1950000, 9, '2026-11-02T01:05:00Z');

    // WO 15: DIPERIKSA (V8 Bentley Bentayga B 888 BTY) - Already reviewed by SA, ready for 1-click Close & Invoice!
    woCounter++;
    const wo15 = woCounter;
    insertWO.run('WO-20261102-005', 8, 'DIPERIKSA', '2026-11-01T22:00:00Z', 31000, 'Kondisi prima', 2390000, 0, 0, 3, 3, '2026-11-02T01:20:00Z', null);
    insertIssue.run(wo15, 'Inspeksi komputer ECU & ganti wiper blade depan');
    jobCounter++;
    const jobWo15 = jobCounter;
    insertJob.run(wo15, 'DIAGNOSA_ECU', 6, 'SELESAI', 1500000, 90, 0);
    insertTimeLog.run(jobWo15, 6, '2026-11-01T22:30:00Z', '2026-11-01T23:45:00Z', 75, 0, 0);
    insertWoPart.run(wo15, jobWo15, 25, 1, 890000, 9, '2026-11-01T23:00:00Z');

    // 12. Complaints (Sample Warranty & Non-Warranty complaints)
    const insertComplaint = db.prepare(`
      INSERT INTO complaints (vehicle_id, work_order_id, complaint_date, description, prev_component_key, faulty_component_key, type, part_charged, labor_charged, cost_borne, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertComplaint.run(
      1,
      5,
      '2026-10-28',
      'AC kembali kurang dingin setelah penggantian kompresor bulan September',
      'KOMPRESOR_AC',
      'KOMPRESOR_AC',
      'GARANSI',
      0,
      0,
      'Ditanggung Bengkel 100% (Jasa Rp0, Part Rp0)',
      'TERBUKA'
    );
    insertComplaint.run(
      3,
      6,
      '2026-10-30',
      'Muncul bunyi di bagian kondensor AC setelah servis rem depan',
      'REM_DEPAN',
      'KONDENSOR_AC',
      'NON_GARANSI',
      1,
      0,
      'Part Dibayar Pelanggan, Jasa Gratis (BR-09)',
      'TERBUKA'
    );

    // 13. Service Followups (3 vehicles due for service reminder)
    const insertFollowup = db.prepare(`
      INSERT INTO service_followups (vehicle_id, due_date, reason, status, result, scheduled_visit_date, handled_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertFollowup.run(1, '2026-11-02', 'Melewati batas interval jarak (+11.000 km sejak servis terakhir)', 'PENDING', null, null, null);
    insertFollowup.run(2, '2026-10-15', 'Melewati batas interval 6 bulan & +10.700 km sejak servis berkala', 'PENDING', null, null, null);
    insertFollowup.run(7, '2026-10-20', 'Melewati batas interval 6 bulan (+10.700 km sejak servis 2026-04-20)', 'PENDING', null, null, null);

    // 14. Expenses across 5 months
    const insertExpense = db.prepare(`
      INSERT INTO expenses (category, description, amount, spent_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertExpense.run('Operasional & Listrik', 'Tagihan Listrik & Air Bengkel Juli 2026', 4850000, '2026-07-25', 2);
    insertExpense.run('Operasional & Listrik', 'Tagihan Listrik & Air Bengkel Agustus 2026', 5100000, '2026-08-25', 2);
    insertExpense.run('Perawatan Alat', 'Kalibrasi Lift Hidrolik Rotary 4-Post', 3200000, '2026-08-18', 2);
    insertExpense.run('Operasional & Listrik', 'Tagihan Listrik & Internet Bengkel September 2026', 4950000, '2026-09-25', 2);
    insertExpense.run('Consumables', 'Pembelian Brake Cleaner, Majun & cairan pembersih', 2400000, '2026-10-10', 2);
    insertExpense.run('Operasional & Listrik', 'Tagihan Listrik & Keamanan Bengkel Oktober 2026', 5250000, '2026-10-25', 2);
    insertExpense.run('Lisensi Diagnosa', 'Perpanjangan Langganan JLR TOPix Cloud Bulanan', 3500000, '2026-11-01', 2);

    // 15. Stock Opname sample (1 Approved last month, 1 Draft/Submitted ready for approval demo)
    const insertOpname = db.prepare(`
      INSERT INTO stock_opnames (period, status, created_by, approved_by, created_at, approved_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertOpnameItem = db.prepare(`
      INSERT INTO stock_opname_items (opname_id, part_id, system_qty, physical_qty, diff, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertOpname.run('2026-10', 'APPROVED', 9, 1, '2026-10-31T08:00:00Z', '2026-10-31T10:00:00Z');
    insertOpnameItem.run(1, 1, 4, 3, -1, 'Tumpah saat pengisian ke gelas ukur');
    insertOpnameItem.run(1, 25, 5, 6, 1, 'Stok retur belum masuk rak');

    insertOpname.run('2026-11', 'SUBMITTED', 9, null, '2026-11-02T01:00:00Z', null);
    insertOpnameItem.run(2, 5, 8, 7, -1, 'Kemasan filter sobek terkena lembab');
    insertOpnameItem.run(2, 11, 14, 15, 1, 'Kelebihan hitung dari batch sebelumnya');

    // 16. Initial Notifications (BR-05 low stock alerts + WO assignment alerts)
    const insertNotif = db.prepare(`
      INSERT INTO notifications (user_id, role, type, message, read_at, created_at)
      VALUES (?, ?, ?, ?, NULL, datetime('now'))
    `);
    insertNotif.run(null, 'SP', 'LOW_STOCK', 'Stok Oli Mesin Castrol Edge Professional 5W-30 (1L) tersisa 3 (min 5)');
    insertNotif.run(null, 'PM', 'LOW_STOCK', 'Stok Oli Mesin Castrol Edge Professional 5W-30 (1L) tersisa 3 (min 5)');
    insertNotif.run(null, 'SP', 'LOW_STOCK', 'Stok Kampas Rem Depan Brembo Jaguar XF / F-Pace tersisa 2 (min 4)');
    insertNotif.run(null, 'PM', 'LOW_STOCK', 'Stok Kampas Rem Depan Brembo Jaguar XF / F-Pace tersisa 2 (min 4)');
    insertNotif.run(null, 'KR', 'WO_NEW', 'WO baru WO-20261102-001 (B 1234 JAG) menunggu penugasan teknisi');
    insertNotif.run(null, 'SA', 'REMINDER_DUE', '3 kendaraan jatuh tempo servis berkala dan menunggu follow-up');

    // 17. Initial Audit Logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, before_json, after_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    insertAudit.run(1, 'SEED_INIT', 'system', '1', null, JSON.stringify({ message: 'Database awal Brit Auto WMS dimuat' }));
    insertAudit.run(3, 'CHANGE_PLATE', 'vehicles', '2', JSON.stringify({ plate: 'B 128 XL' }), JSON.stringify({ plate: 'B 21 XL' }));
    insertAudit.run(3, 'CREATE_WO', 'work_orders', '11', null, JSON.stringify({ wo_number: 'WO-20261102-001', plate: 'B 1234 JAG' }));
  });

  tx();
}
