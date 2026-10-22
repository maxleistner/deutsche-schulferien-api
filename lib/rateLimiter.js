const { rateLimit } = require("express-rate-limit");

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Best-effort limiter: counters live in each serverless instance's memory (express-rate-limit
// evicts expired entries itself), so enforcement is per instance. Use Vercel Firewall
// rate limiting for a hard, global limit.
const createApiLimiter = ({
  windowMs = toPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  limit = toPositiveInt(process.env.RATE_LIMIT_MAX, 100),
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message: "Too many requests. Please try again later.",
          statusCode: 429,
          documentation: "/docs",
        },
      });
    },
  });

module.exports = { createApiLimiter };
