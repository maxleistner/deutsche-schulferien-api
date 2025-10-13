const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import the system router and create test app
const systemRouter = require('../routes/system');

const createTestApp = () => {
  const app = express();
  
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/', systemRouter);
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({
      error: {
        message: err.message,
      },
    });
  });
  
  return app;
};

describe('System Endpoints', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    test('should return basic health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      
      expect(response.body.status).toBe('ok');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      
      // Validate timestamp format (ISO 8601)
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });

    test('should have consistent uptime on subsequent calls', async () => {
      const response1 = await request(app)
        .get('/health')
        .expect(200);

      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await request(app)
        .get('/health')
        .expect(200);

      expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);
    });
  });

  describe('GET /ready', () => {
    test('should return readiness status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect((res) => {
          // Accept either 200 or 503
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('status');
      
      if (response.status === 200) {
        expect(response.body.status).toBe('ready');
        expect(response.body).toHaveProperty('availableYears');
        expect(response.body).toHaveProperty('cacheStatus');
        expect(Array.isArray(response.body.availableYears)).toBe(true);
        expect(response.body.cacheStatus).toBe('warm');
      } else {
        expect(response.body.status).toBe('not ready');
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('GET /status', () => {
    test('should return comprehensive service status', async () => {
      const response = await request(app)
        .get('/status')
        .expect((res) => {
          // Accept either 200 or 500
          expect([200, 500]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');

      expect(response.body.service).toBe('German School Holidays API');
      expect(typeof response.body.version).toBe('string');
      expect(['operational', 'degraded', 'error']).toContain(response.body.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('endpoints');
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('system');

        // Validate endpoints section
        expect(response.body.endpoints).toHaveProperty('v1');
        expect(response.body.endpoints).toHaveProperty('v2');
        expect(response.body.endpoints.v1).toHaveProperty('status');
        expect(response.body.endpoints.v1).toHaveProperty('description');
        expect(response.body.endpoints.v2).toHaveProperty('status');
        expect(response.body.endpoints.v2).toHaveProperty('description');

        // Validate data section
        expect(response.body.data).toHaveProperty('availableYears');
        expect(response.body.data).toHaveProperty('totalYears');
        expect(response.body.data).toHaveProperty('yearRange');
        expect(response.body.data).toHaveProperty('cacheStatus');
        expect(Array.isArray(response.body.data.availableYears)).toBe(true);
        expect(typeof response.body.data.totalYears).toBe('number');

        // Validate system section
        expect(response.body.system).toHaveProperty('nodeVersion');
        expect(response.body.system).toHaveProperty('platform');
        expect(response.body.system).toHaveProperty('memoryUsage');
        expect(response.body.system).toHaveProperty('environment');
        expect(typeof response.body.system.nodeVersion).toBe('string');
        expect(typeof response.body.system.platform).toBe('string');
        expect(typeof response.body.system.memoryUsage).toBe('object');
        expect(typeof response.body.system.environment).toBe('string');

        // Validate memory usage structure
        expect(response.body.system.memoryUsage).toHaveProperty('rss');
        expect(response.body.system.memoryUsage).toHaveProperty('heapTotal');
        expect(response.body.system.memoryUsage).toHaveProperty('heapUsed');
        expect(response.body.system.memoryUsage).toHaveProperty('external');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should have proper year range format when years are available', async () => {
      const response = await request(app)
        .get('/status');

      if (response.status === 200 && response.body.data.totalYears > 0) {
        expect(response.body.data.yearRange).toMatch(/^\d{4} - \d{4}$/);
        
        const [startYear, endYear] = response.body.data.yearRange.split(' - ').map(Number);
        expect(startYear).toBeLessThanOrEqual(endYear);
        expect(response.body.data.availableYears).toContain(startYear);
        expect(response.body.data.availableYears).toContain(endYear);
      }
    });
  });

  describe('Response headers and format', () => {
    test('should return JSON content type for all endpoints', async () => {
      const endpoints = ['/health', '/ready', '/status'];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint);
          
        expect(response.headers['content-type']).toMatch(/application\/json/);
      }
    });

    test('should have consistent timestamp format across endpoints', async () => {
      const healthResponse = await request(app).get('/health');
      const statusResponse = await request(app).get('/status');

      // Both should have valid ISO timestamps
      const healthTimestamp = new Date(healthResponse.body.timestamp);
      const statusTimestamp = new Date(statusResponse.body.timestamp);

      expect(healthTimestamp).toBeInstanceOf(Date);
      expect(statusTimestamp).toBeInstanceOf(Date);
      expect(isNaN(healthTimestamp.getTime())).toBe(false);
      expect(isNaN(statusTimestamp.getTime())).toBe(false);

      // Timestamps should be recent (within last 10 seconds)
      const now = new Date();
      const tenSecondsAgo = new Date(now.getTime() - 10000);
      
      expect(healthTimestamp.getTime()).toBeGreaterThan(tenSecondsAgo.getTime());
      expect(statusTimestamp.getTime()).toBeGreaterThan(tenSecondsAgo.getTime());
    });
  });

  describe('Performance', () => {
    test('health check should be fast', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });

    test('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(0).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('Error handling', () => {
    test('should handle non-existent endpoints gracefully', async () => {
      await request(app)
        .get('/non-existent')
        .expect(404);
    });
  });
});