import rateLimit from "express-rate-limit";

const createLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

export const otpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
});

export const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
});

export const writeLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 40,
});

export const paymentLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
});
