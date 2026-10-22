const { rateLimit } = require("express-rate-limit");

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// Counters live in the memory of each serverless instance, so this is a best-effort
// limit per instance. A hard global limit belongs in the Vercel Firewall.
const apiRateLimit = ({
  windowMs = positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  limit = positiveInt(process.env.RATE_LIMIT_MAX, 100),
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      // The /api middleware sets long CDN cache headers before this runs; a 429 must never be cached
      res.set("Cache-Control", "no-store");
      res.status(429).json({
        error: { message: "Too many requests. Please try again later.", statusCode: 429, documentation: "/docs" },
      });
    },
  });

module.exports = { apiRateLimit };
