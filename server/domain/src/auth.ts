/** FR-AK-02, NFR-01, NFR-02 */
export type Role = 'SA' | 'KR' | 'TK' | 'SP' | 'AD' | 'PM';
export type Level = 'K' | 'L' | 'L*' | 'K*' | '-';
const R: Role[] = ['SA', 'KR', 'TK', 'SP', 'AD', 'PM'];
const rows: [string, ...Level[]][] = [
  ['customer_vehicle', 'K', 'L', '-', '-', 'K', 'L'],
  ['rate_master', 'L', '-', '-', '-', 'K', 'K'],
  ['part_master', 'L', '-', '-', 'K', 'K', 'L'],
  ['work_order', 'K', 'L', 'L*', 'L', 'K', 'L'],
  ['assignment', 'L', 'K', 'L*', '-', 'L', 'L'],
  ['clock', 'L', 'K', 'K*', '-', 'L', 'L'],
  ['part_issue', 'L', '-', '-', 'K', 'L', 'L'],
  ['stock_in_opname', '-', '-', '-', 'K', 'K', 'L'],
  ['invoice', 'K', '-', '-', '-', 'K', 'L'],
  ['reminder', 'K', '-', '-', '-', 'L', 'L'],
  ['tools', '-', 'K', 'L*', '-', 'K', 'L'],
  ['reports', '-', '-', '-', 'L*', 'L', 'K'],
  ['users', '-', '-', '-', '-', 'K', 'K'],
  ['mobile_monitor', '-', '-', '-', '-', '-', 'L'],
];
const MATRIX = new Map<string, Record<Role, Level>>(rows.map(([k, ...v]) => [k, Object.fromEntries(R.map((r, i) => [r, v[i]])) as Record<Role, Level>]));
export function authorize(role: Role, resource: string, action: 'read' | 'write', isOwner = false): boolean {
  const lvl = MATRIX.get(resource)?.[role] ?? '-';
  if (lvl === '-') return false;
  const own = lvl.endsWith('*');
  if (own && !isOwner) return false;
  const base = lvl[0];
  return action === 'read' ? true : base === 'K';
}
export interface LoginState { failed: number; lockedUntil: number | null }
export function registerFailedLogin(s: LoginState, nowMs: number, max = 5, lockMinutes = 15): LoginState {
  const failed = s.failed + 1;
  return failed >= max ? { failed, lockedUntil: nowMs + lockMinutes * 60_000 } : { failed, lockedUntil: s.lockedUntil };
}
export const isLocked = (s: LoginState, nowMs: number): boolean => s.lockedUntil !== null && nowMs < s.lockedUntil;
