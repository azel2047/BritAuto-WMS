import { calculateAndSyncReminders } from '../services/reminderService.ts';

let timer: NodeJS.Timeout | null = null;

export function startReminderScheduler() {
  try {
    calculateAndSyncReminders();
  } catch (err) {
    console.error('[Scheduler] Gagal menghitung reminder awal:', err);
  }

  // Check every hour; run at 07:00 Asia/Jakarta (00:00 UTC)
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === 0) {
      try {
        calculateAndSyncReminders();
      } catch (err) {
        console.error('[Scheduler] Gagal menghitung reminder harian:', err);
      }
    }
  }, 60 * 60 * 1000);
}
