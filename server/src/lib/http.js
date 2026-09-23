export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Wrap an async handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function badRequest(message, extra) {
  return new ApiError(400, message, extra);
}

export function notFound(message = 'Not found') {
  return new ApiError(404, message);
}

/** Clamp an unknown query value into a sane integer range. */
export function intParam(value, fallback, { min = 0, max = 1000 } = {}) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
