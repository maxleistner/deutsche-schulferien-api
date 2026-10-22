const express = require('express');
const request = require('supertest');
const { apiRateLimit } = require('../lib/rateLimit');

const appWith = (options) => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'public, s-maxage=86400');
    next();
  });
  app.use('/api', apiRateLimit(options));
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  app.get('/health', (req, res) => res.json({ ok: true }));
  return app;
};

const get = (app, xff, path = '/api/ping') => request(app).get(path).set('X-Forwarded-For', xff);

describe('API rate limit', () => {
  test('allows requests up to the limit', async () => {
    const app = appWith({ limit: 2 });
    expect((await get(app, '1.1.1.1')).status).toBe(200);
    expect((await get(app, '1.1.1.1')).status).toBe(200);
  });

  test('answers 429 in the API error format and never cacheable', async () => {
    const app = appWith({ limit: 1 });
    await get(app, '1.1.1.1');
    const res = await get(app, '1.1.1.1');
    expect(res.status).toBe(429);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error).toMatchObject({ statusCode: 429, documentation: '/docs' });
    expect(res.headers.ratelimit).toBeDefined();
  });

  test('counts clients separately', async () => {
    const app = appWith({ limit: 1 });
    await get(app, '1.1.1.1');
    expect((await get(app, '1.1.1.1')).status).toBe(429);
    expect((await get(app, '2.2.2.2')).status).toBe(200);
  });

  test('ignores client-supplied X-Forwarded-For entries before the proxy hop', async () => {
    const app = appWith({ limit: 1 });
    await get(app, '9.9.9.1, 3.3.3.3');
    expect((await get(app, '9.9.9.2, 3.3.3.3')).status).toBe(429);
  });

  test('resets after the window', async () => {
    const app = appWith({ limit: 1, windowMs: 150 });
    await get(app, '1.1.1.1');
    expect((await get(app, '1.1.1.1')).status).toBe(429);
    await new Promise((r) => setTimeout(r, 250));
    expect((await get(app, '1.1.1.1')).status).toBe(200);
  });

  test('does not limit routes outside /api', async () => {
    const app = appWith({ limit: 1 });
    await get(app, '1.1.1.1');
    expect((await get(app, '1.1.1.1', '/health')).status).toBe(200);
    expect((await get(app, '1.1.1.1', '/health')).status).toBe(200);
  });

  test('real app sends rate limit headers on /api but not on /health', async () => {
    const app = require('../index');
    expect((await request(app).get('/api/v2/states')).headers.ratelimit).toBeDefined();
    expect((await request(app).get('/health')).headers.ratelimit).toBeUndefined();
  });
});
