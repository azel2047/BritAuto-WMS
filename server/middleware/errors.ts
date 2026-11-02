import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { InsufficientStockError } from '../domain/src/stock.ts';
import { InvalidTransitionError } from '../domain/src/workorder.ts';
import { RateNotFoundError } from '../domain/src/invoice.ts';

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join('.') || 'input';
    res.status(400).json({
      error: {
        code: 'VALIDASI_GAGAL',
        message: `Input tidak valid pada ${field}: ${first?.message || 'Periksa kembali data yang dimasukkan'}`,
      },
    });
    return;
  }
  if (err instanceof InsufficientStockError) {
    res.status(422).json({
      error: {
        code: 'STOK_TIDAK_CUKUP',
        message: `Stok spare part tidak mencukupi (${err.message})`,
      },
    });
    return;
  }
  if (err instanceof InvalidTransitionError) {
    res.status(422).json({
      error: {
        code: 'TRANSISI_STATUS_TIDAK_VALID',
        message: err.message,
      },
    });
    return;
  }
  if (err instanceof RateNotFoundError) {
    res.status(422).json({
      error: {
        code: 'TARIF_TIDAK_DITEMUKAN',
        message: err.message,
      },
    });
    return;
  }
  if (err instanceof RangeError) {
    res.status(422).json({
      error: {
        code: 'NILAI_TIDAK_VALID',
        message: err.message,
      },
    });
    return;
  }
  console.error('[Server Error]', err);
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal pada server';
  res.status(500).json({ error: { code: 'SERVER_ERROR', message } });
}
