import type { ErrorRequestHandler } from 'express';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly field?: string, public readonly retryAfter?: number) { super(message); }
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  // Express identifies error middleware by its four-argument signature.
  void _next;
  if (res.headersSent) return;
  if (error instanceof ApiError) {
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) } });
    return;
  }
  const detail = error as { type?: string; code?: string; status?: number };
  if (detail.type === 'entity.too.large' || detail.type === 'entity.parse.failed' || detail.type === 'charset.unsupported' || detail.type === 'encoding.unsupported' || detail.status === 400) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Некорректный JSON или слишком большой запрос.' } });
    return;
  }
  const unavailable = typeof detail.code === 'string' && (/^(08|53|57|58)/.test(detail.code) || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(detail.code));
  res.status(unavailable ? 503 : 500).json({ error: { code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR', message: unavailable ? 'База данных временно недоступна.' : 'Не удалось выполнить запрос.' } });
};
