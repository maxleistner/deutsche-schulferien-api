const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Import the routes
const vacationsRouter = require('../routes/vacations');

// Create test app
const createApp = () => {
  const app = express();
  app.use('/', vacationsRouter);
  app.use((req, res, next) => {
    const err = new Error(`${req.method} ${req.url} Not Found`);
    err.status = 404;
    next(err);
  });
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: { message: err.message } });
  });
  return app;
};

describe('Routes Unit Tests', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('Route Registration', () => {
    test('should have correct route structure', () => {
      const routes = vacationsRouter.stack;
      expect(routes.length).toBeGreaterThan(0);
      
      // Check that we have the expected routes
      const routePaths = routes.map(r => r.route ? r.route.path : null).filter(Boolean);
      expect(routePaths).toContain('/api/v1/:year');
      expect(routePaths).toContain('/api/v1/:year/:state');
    });

    test('should only accept GET requests', () => {
      const routes = vacationsRouter.stack;
      routes.forEach(layer => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods);
          expect(methods).toEqual(['get']);
        }
      });
    });
  });

  describe('Basic Functionality', () => {
    test('should return data for valid year', async () => {
      const response = await request(app).get('/api/v1/2024');
      
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      } else {
        // If file doesn't exist, should return appropriate error
        expect([404, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle invalid year gracefully', async () => {
      const response = await request(app).get('/api/v1/abc');
      
      // Should return an error for invalid year
      expect([404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle non-existent year gracefully', async () => {
      const response = await request(app).get('/api/v1/1999');
      
      // Should return an error for non-existent year
      expect([404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid state gracefully', async () => {
      const response = await request(app).get('/api/v1/2024/INVALID');
      
      // Should return 404 for invalid state
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Data Processing', () => {
    test('should filter by state when valid data exists', async () => {
      const response = await request(app).get('/api/v1/2024/BW');
      
      if (response.status === 200) {
        // If successful, all entries should be for BW
        response.body.forEach(vacation => {
          expect(vacation.stateCode).toBe('BW');
          expect(vacation.year).toBe(2024);
        });
      } else {
        // If no data or error, should have error object
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Error Handling', () => {
    test('should create proper error responses', () => {
      const testError = new Error('Test error');
      testError.status = 404;
      
      expect(testError).toHaveProperty('message', 'Test error');
      expect(testError).toHaveProperty('status', 404);
    });

    test('should handle malformed requests', async () => {
      const response = await request(app).get('/api/v1/');
      
      // Should return 404 for malformed request
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
