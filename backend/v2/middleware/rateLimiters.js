import rateLimit from "express-rate-limit";

const createLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
      });
    },
  });

export const v2TweetCreateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 15,
});

export const v2LikeToggleLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 90,
});

export const v2DmSendLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 45,
});
