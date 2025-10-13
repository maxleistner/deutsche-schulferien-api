const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const cors = require('cors');
const path = require('path');

// Import the routes
const vacationsRouter = require('../routes/vacations');

// Create test app (similar to index.js but without listen)
const createApp = () => {
  const app = express();
  
  app.use(cors());
  app.use(logger('tiny'));
  app.use(bodyParser.json());
  
  app.use('/', vacationsRouter);
  
  // Error handling middleware
  app.use((req, res, next) => {
    const err = new Error(`${req.method} ${req.url} Not Found`);
    err.status = 404;
    next(err);
  });
  
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

describe('German School Holidays API', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/v1/:year', () => {
    describe('Valid year requests', () => {
      test('should return all vacations for year 2024', async () => {
        const response = await request(app)
          .get('/api/v1/2024')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        // All entries should be for 2024
        response.body.forEach(vacation => {
          expect(vacation.year).toBe(2024);
          expect(vacation).toHaveProperty('start');
          expect(vacation).toHaveProperty('end');
          expect(vacation).toHaveProperty('stateCode');
          expect(vacation).toHaveProperty('name');
          expect(vacation).toHaveProperty('slug');
        });
      });

      test('should return all vacations for year 2025', async () => {
        const response = await request(app)
          .get('/api/v1/2025')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(vacation => {
          expect(vacation.year).toBe(2025);
        });
      });

      test('should return all vacations for year 2026', async () => {
        const response = await request(app)
          .get('/api/v1/2026')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(vacation => {
          expect(vacation.year).toBe(2026);
        });
      });

      test('should return all vacations for year 2027 (including fixed BW entry)', async () => {
        const response = await request(app)
          .get('/api/v1/2027')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(vacation => {
          expect(vacation.year).toBe(2027);
        });

        // Check that BW now has osterferien instead of the wrong winterferien
        const bwVacations = response.body.filter(v => v.stateCode === 'BW');
        const bwOsterferien = bwVacations.filter(v => v.name === 'osterferien');
        const bwWinterferien = bwVacations.filter(v => v.name === 'winterferien');
        
        expect(bwOsterferien.length).toBeGreaterThan(0);
        // BW should not have winterferien in 2027 data
        expect(bwWinterferien.length).toBe(0);
      });
    });

    describe('Invalid year requests', () => {
      test('should return error for non-existent year', async () => {
        const response = await request(app)
          .get('/api/v1/2020');

        expect([404, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      });

      test('should return error for future year', async () => {
        const response = await request(app)
          .get('/api/v1/2030');

        expect([404, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      });

      test('should return error for invalid year format', async () => {
        const response = await request(app)
          .get('/api/v1/abc');

        expect([404, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('GET /api/v1/:year/:state', () => {
    const germanStates = [
      'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 
      'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'
    ];

    describe('Valid state requests', () => {
      test.each(germanStates)('should return vacations for state %s in 2024', async (stateCode) => {
        const response = await request(app)
          .get(`/api/v1/2024/${stateCode}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(vacation => {
          expect(vacation.year).toBe(2024);
          expect(vacation.stateCode).toBe(stateCode);
        });
      });

      test('should return Bayern vacations for 2025', async () => {
        const response = await request(app)
          .get('/api/v1/2025/BY')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        // Bayern should have winter, easter, whitsun, summer, autumn, and christmas holidays
        const vacationTypes = [...new Set(response.body.map(v => v.name))];
        expect(vacationTypes).toContain('winterferien');
        expect(vacationTypes).toContain('osterferien');
        expect(vacationTypes).toContain('sommerferien');
        expect(vacationTypes).toContain('weihnachtsferien');
      });

      test('should return Hamburg vacations with special naming', async () => {
        const response = await request(app)
          .get('/api/v1/2027/HH')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        // Hamburg uses "fruehjahrsferien" instead of "osterferien"
        const vacationTypes = [...new Set(response.body.map(v => v.name))];
        expect(vacationTypes).toContain('fruehjahrsferien');
        expect(vacationTypes).toContain('sommerferien');
        expect(vacationTypes).toContain('weihnachtsferien');
      });
    });

    describe('Invalid state requests', () => {
      test('should return 404 for invalid state code', async () => {
        const response = await request(app)
          .get('/api/v1/2024/XX')
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error.message).toContain('No vacations found');
      });

      test('should return 404 for lowercase state code', async () => {
        const response = await request(app)
          .get('/api/v1/2024/by')
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });

      test('should return error for valid state but invalid year', async () => {
        const response = await request(app)
          .get('/api/v1/2020/BY');

        expect([404, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Data structure validation', () => {
    test('should return proper data structure for each vacation entry', async () => {
      const response = await request(app)
        .get('/api/v1/2024/BY')
        .expect(200);

      response.body.forEach(vacation => {
        // Required fields
        expect(vacation).toHaveProperty('start');
        expect(vacation).toHaveProperty('end');
        expect(vacation).toHaveProperty('year');
        expect(vacation).toHaveProperty('stateCode');
        expect(vacation).toHaveProperty('name');
        expect(vacation).toHaveProperty('slug');

        // Data type validation
        expect(typeof vacation.start).toBe('string');
        expect(typeof vacation.end).toBe('string');
        expect(typeof vacation.year).toBe('number');
        expect(typeof vacation.stateCode).toBe('string');
        expect(typeof vacation.name).toBe('string');
        expect(typeof vacation.slug).toBe('string');

        // Date format validation (ISO 8601)
        expect(vacation.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
        expect(vacation.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);

        // Slug format validation
        expect(vacation.slug).toBe(`${vacation.name}-${vacation.year}-${vacation.stateCode}`);

        // Valid vacation types
        const validTypes = ['winterferien', 'osterferien', 'pfingstferien', 
                           'sommerferien', 'herbstferien', 'weihnachtsferien', 
                           'fruehjahrsferien'];
        expect(validTypes).toContain(vacation.name);

        // Date logic - start should not be after end
        expect(new Date(vacation.start).getTime()).toBeLessThanOrEqual(new Date(vacation.end).getTime());
      });
    });

    test('should have consistent state codes across all years', async () => {
      const years = [2024, 2025, 2026, 2027];
      const statesByYear = {};

      for (const year of years) {
        const response = await request(app)
          .get(`/api/v1/${year}`)
          .expect(200);
        
        statesByYear[year] = [...new Set(response.body.map(v => v.stateCode))].sort();
      }

      // All years should have the same 16 German states
      const expectedStates = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 
                             'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'].sort();
      
      Object.values(statesByYear).forEach(states => {
        expect(states).toEqual(expectedStates);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle requests with trailing slash', async () => {
      const response = await request(app)
        .get('/api/v1/2024/')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle requests without trailing slash', async () => {
      const response = await request(app)
        .get('/api/v1/2024')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 404 for non-API routes', async () => {
      const response = await request(app)
        .get('/invalid-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Not Found');
    });

    test('should handle HEAD requests', async () => {
      await request(app)
        .head('/api/v1/2024')
        .expect(200);
    });

    test('should handle OPTIONS requests (CORS)', async () => {
      await request(app)
        .options('/api/v1/2024')
        .expect(204); // CORS returns 204 No Content
    });

    test('should not accept POST requests', async () => {
      await request(app)
        .post('/api/v1/2024')
        .expect(404);
    });

    test('should not accept PUT requests', async () => {
      await request(app)
        .put('/api/v1/2024')
        .expect(404);
    });

    test('should not accept DELETE requests', async () => {
      await request(app)
        .delete('/api/v1/2024')
        .expect(404);
    });
  });

  describe('Performance and load tests', () => {
    test('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/v1/2024')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    test('should respond within reasonable time', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/v1/2024')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});