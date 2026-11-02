import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './server/db/connection.ts';
import { apiRouter } from './server/routes/api.ts';
import { errorHandler } from './server/middleware/errors.ts';
import { startReminderScheduler } from './server/jobs/scheduler.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  initDatabase();
  startReminderScheduler();

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Mount API routes
  app.use('/api', apiRouter);

  // Centralized error handler for /api
  app.use('/api', errorHandler);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Brit Auto WMS] Server berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Gagal menjalankan server Brit Auto WMS:', err);
  process.exit(1);
});
