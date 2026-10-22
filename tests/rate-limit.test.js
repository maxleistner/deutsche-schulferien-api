const express = require('express');
const request = require('supertest');
const { createApiLimiter } = require('../lib/rateLimiter');

const buildApp = (options, trustProxy = 1) => {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use('/api', createApiLimiter(options));
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  app.get('/health', (req, res) => res.json({ ok: true }));
  return app;
};

const from = (app, ip, path = '/api/ping') =>
  request(app).get(path).set('X-Forwarded-For', ip);

describe('API rate limiter', () => {
  test('allows requests below the limit', async () => {
    const app = buildApp({ limit: 3 });
    for (let i = 0; i < 3; i++) {
      const res = await from(app, '1.1.1.1');
      expect(res.status).toBe(200);
    }
  });

  test('returns 429 with the API error shape above the limit', async () => {
    const app = buildApp({ limit: 2 });
    await from(app, '1.1.1.1');
    await from(app, '1.1.1.1');
    const res = await from(app, '1.1.1.1');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ statusCode: 429, documentation: '/docs' });
    expect(res.headers.ratelimit).toBeDefined();
  });

  test('allows requests again after the window passes', async () => {
    const app = buildApp({ limit: 1, windowMs: 200 });
    expect((await from(app, '1.1.1.1')).status).toBe(200);
    expect((await from(app, '1.1.1.1')).status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await from(app, '1.1.1.1')).status).toBe(200);
  });

  test('tracks distinct client IPs independently behind a trusted proxy', async () => {
    const app = buildApp({ limit: 1 });
    expect((await from(app, '1.1.1.1')).status).toBe(200);
    expect((await from(app, '1.1.1.1')).status).toBe(429);
    expect((await from(app, '2.2.2.2')).status).toBe(200);
  });

  test('a spoofed leftmost X-Forwarded-For entry does not evade the limit', async () => {
    const app = buildApp({ limit: 1 });
    // The proxy appends the real client IP (3.3.3.3); the client-supplied prefix is ignored.
    expect((await from(app, '9.9.9.1, 3.3.3.3')).status).toBe(200);
    expect((await from(app, '9.9.9.2, 3.3.3.3')).status).toBe(429);
  });

  test('does not limit routes outside /api', async () => {
    const app = buildApp({ limit: 1 });
    await from(app, '1.1.1.1');
    expect((await from(app, '1.1.1.1')).status).toBe(429);
    for (let i = 0; i < 5; i++) {
      expect((await from(app, '1.1.1.1', '/health')).status).toBe(200);
    }
  });
});

describe('real app', () => {
  const app = require('../index');

  test('serves API responses with rate limit headers', async () => {
    const res = await request(app).get('/api/v2/states').set('X-Forwarded-For', '4.4.4.4');
    expect(res.headers.ratelimit).toBeDefined();
  });

  test('does not rate limit /health', async () => {
    const res = await request(app).get('/health');
    expect(res.headers.ratelimit).toBeUndefined();
  });
});
