import { db } from '../db/connection.ts';

export function getMonthlyReport(period: string) {
  // Revenue = sum of invoices.total in period
  const revRow = db
    .prepare(`SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as invoice_count FROM invoices WHERE substr(issued_at, 1, 7) = ?`)
    .get(period) as { revenue: number; invoice_count: number };

  // Operational expenses in period
  const expRow = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) as operational_expenses FROM expenses WHERE substr(spent_at, 1, 7) = ?`)
    .get(period) as { operational_expenses: number };

  // Part purchase costs in period (stock_movements IN * unit_cost)
  const partCostRow = db
    .prepare(`
      SELECT COALESCE(SUM(qty * unit_cost), 0) as part_purchases
      FROM stock_movements
      WHERE type = 'IN' AND substr(created_at, 1, 7) = ?
    `)
    .get(period) as { part_purchases: number };

  const woRow = db
    .prepare(`
      SELECT COUNT(*) as total_wo,
             SUM(CASE WHEN status = 'DITUTUP' THEN 1 ELSE 0 END) as closed_wo
      FROM work_orders
      WHERE substr(received_at, 1, 7) = ?
    `)
    .get(period) as { total_wo: number; closed_wo: number };

  const totalExpenses = expRow.operational_expenses + partCostRow.part_purchases;
  const grossProfit = revRow.revenue - totalExpenses;

  // Top 10 selling parts in period (or all-time if period has few, prioritized by period)
  const topParts = db
    .prepare(`
      SELECT p.id, p.code, p.name, p.unit,
             SUM(wp.qty - wp.returned_qty) as total_qty,
             SUM((wp.qty - wp.returned_qty) * wp.unit_price) as total_sales
      FROM wo_parts wp
      JOIN parts p ON p.id = wp.part_id
      WHERE substr(wp.issued_at, 1, 7) = ?
      GROUP BY p.id
      HAVING total_qty > 0
      ORDER BY total_qty DESC
      LIMIT 10
    `)
    .all(period) as {
    id: number;
    code: string;
    name: string;
    unit: string;
    total_qty: number;
    total_sales: number;
  }[];

  // Last 5 months trend ending at period
  const [yearStr, monthStr] = period.split('-');
  const baseYear = Number(yearStr) || 2026;
  const baseMonth = Number(monthStr) || 11;
  const trendMonths: string[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(Date.UTC(baseYear, baseMonth - 1 - i, 1));
    trendMonths.push(d.toISOString().slice(0, 7));
  }

  const trend = trendMonths.map(m => {
    const r = db
      .prepare(`SELECT COALESCE(SUM(total), 0) as rev FROM invoices WHERE substr(issued_at, 1, 7) = ?`)
      .get(m) as { rev: number };
    const e = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) as exp FROM expenses WHERE substr(spent_at, 1, 7) = ?`)
      .get(m) as { exp: number };
    const p = db
      .prepare(`SELECT COALESCE(SUM(qty * unit_cost), 0) as pur FROM stock_movements WHERE type = 'IN' AND substr(created_at, 1, 7) = ?`)
      .get(m) as { pur: number };
    const w = db
      .prepare(`SELECT COUNT(*) as c FROM work_orders WHERE substr(received_at, 1, 7) = ?`)
      .get(m) as { c: number };
    const expTotal = e.exp + p.pur;
    return {
      period: m,
      revenue: r.rev,
      expenses: expTotal,
      profit: r.rev - expTotal,
      woCount: w.c,
    };
  });

  return {
    period,
    revenue: revRow.revenue,
    invoiceCount: revRow.invoice_count,
    operationalExpenses: expRow.operational_expenses,
    partPurchases: partCostRow.part_purchases,
    totalExpenses,
    grossProfit,
    totalWo: woRow.total_wo || 0,
    closedWo: woRow.closed_wo || 0,
    topParts,
    trend,
  };
}

export function generateMonthlyReportCsv(period: string): string {
  const report = getMonthlyReport(period);
  const BOM = '\uFEFF';
  const lines: string[] = [
    `LAPORAN BULANAN BENGKEL BRIT AUTO;Periode ${period}`,
    '',
    'RINGKASAN KEUANGAN;NILAI (IDR)',
    `Pendapatan Invoice;${report.revenue}`,
    `Pengeluaran Operasional;${report.operationalExpenses}`,
    `Pembelian Spare Part;${report.partPurchases}`,
    `Total Pengeluaran;${report.totalExpenses}`,
    `Laba Kotor;${report.grossProfit}`,
    `Total Work Order;${report.totalWo}`,
    `Work Order Selesai/Ditutup;${report.closedWo}`,
    '',
    'TREN 5 BULAN TERAKHIR',
    'Periode;Pendapatan;Pengeluaran;Laba Kotor;Jumlah WO',
    ...report.trend.map(t => `${t.period};${t.revenue};${t.expenses};${t.profit};${t.woCount}`),
    '',
    '10 SPARE PART TERLARIS BULAN INI',
    'Kode Part;Nama Spare Part;Satuan;Qty Terpakai;Nilai Penjualan (IDR)',
    ...report.topParts.map(p => `${p.code};"${p.name}";${p.unit};${p.total_qty};${p.total_sales}`),
  ];
  return BOM + lines.join('\r\n');
}
