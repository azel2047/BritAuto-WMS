import { db } from '../db/connection.ts';

export interface AuditInput {
  userId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

export function writeAuditLog(input: AuditInput) {
  db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity, entity_id, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.userId,
    input.action,
    input.entity,
    input.entityId != null ? String(input.entityId) : null,
    input.before !== undefined ? JSON.stringify(input.before) : null,
    input.after !== undefined ? JSON.stringify(input.after) : null
  );
}

export function listAuditLogs(limit = 100) {
  return db.prepare(`
    SELECT a.*, u.name as user_name, u.username, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC
    LIMIT ?
  `).all(limit);
}
