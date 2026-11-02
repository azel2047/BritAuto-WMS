import { db } from '../db/connection.ts';
import { broadcastEvent } from '../events/sse.ts';

export interface NotificationInput {
  userId?: number | null;
  role?: string | null;
  type: string;
  message: string;
}

export function createNotification(input: NotificationInput) {
  const res = db.prepare(`
    INSERT INTO notifications (user_id, role, type, message, read_at, created_at)
    VALUES (?, ?, ?, ?, NULL, datetime('now'))
  `).run(input.userId ?? null, input.role ?? null, input.type, input.message);

  broadcastEvent('notification', {
    id: res.lastInsertRowid,
    ...input,
    created_at: new Date().toISOString(),
  });
}

export function listNotificationsForUser(userId: number, role: string) {
  return db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ? OR role = ? OR (user_id IS NULL AND role IS NULL)
    ORDER BY id DESC
    LIMIT 50
  `).all(userId, role);
}

export function markNotificationRead(id: number) {
  db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ?`).run(id);
}
