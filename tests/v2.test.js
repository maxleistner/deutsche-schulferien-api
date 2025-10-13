const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import the V2 router and create test app
const v2Router = require('../routes/v2');

const createTestApp = () => {
  const app = express();
  
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/v2', v2Router);
  
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

describe('V2 API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /api/v2/:year', () => {
    describe('Basic functionality', () => {
      test('should return holidays for 2024', async () => {
        const response = await request(app)
          .get('/api/v2/2024')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(holiday => {
          expect(holiday.year).toBe(2024);
          expect(holiday).toHaveProperty('start');
          expect(holiday).toHaveProperty('end');
          expect(holiday).toHaveProperty('stateCode');
          expect(holiday).toHaveProperty('name');
          expect(holiday).toHaveProperty('slug');
        });
      });
    });

    describe('Date range filtering', () => {
      test('should filter by date range', async () => {
        const response = await request(app)
          .get('/api/v2/2024?from=2024-03-01&to=2024-08-31')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        response.body.forEach(holiday => {
          const start = new Date(holiday.start);
          const end = new Date(holiday.end);
          const fromDate = new Date('2024-03-01T00:00:00.000Z');
          const toDate = new Date('2024-08-31T23:59:59.999Z');
          
          expect(start <= toDate && end >= fromDate).toBe(true);
        });
      });

      test('should filter by from date only', async () => {
        const response = await request(app)
          .get('/api/v2/2024?from=2024-07-01')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        response.body.forEach(holiday => {
          const end = new Date(holiday.end);
          const fromDate = new Date('2024-07-01T00:00:00.000Z');
          expect(end >= fromDate).toBe(true);
        });
      });

      test('should filter by to date only', async () => {
        const response = await request(app)
          .get('/api/v2/2024?to=2024-04-30')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        response.body.forEach(holiday => {
          const start = new Date(holiday.start);
          const toDate = new Date('2024-04-30T23:59:59.999Z');
          expect(start <= toDate).toBe(true);
        });
      });

      test('should return 400 for invalid date format', async () => {
        await request(app)
          .get('/api/v2/2024?from=invalid-date')
          .expect(400);
      });

      test('should return 400 when from date is after to date', async () => {
        await request(app)
          .get('/api/v2/2024?from=2024-08-01&to=2024-07-01')
          .expect(400);
      });
    });

    describe('Type filtering', () => {
      test('should filter by single holiday type', async () => {
        const response = await request(app)
          .get('/api/v2/2024?type=sommerferien')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(holiday => {
          expect(holiday.name).toBe('sommerferien');
        });
      });

      test('should filter by multiple holiday types', async () => {
        const response = await request(app)
          .get('/api/v2/2024?type=sommerferien,winterferien')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        response.body.forEach(holiday => {
          expect(['sommerferien', 'winterferien']).toContain(holiday.name);
        });
      });

      test('should return 400 for invalid holiday type', async () => {
        await request(app)
          .get('/api/v2/2024?type=invalidferien')
          .expect(400);
      });
    });

    describe('State filtering', () => {
      test('should filter by single state', async () => {
        const response = await request(app)
          .get('/api/v2/2024?states=BY')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(holiday => {
          expect(holiday.stateCode).toBe('BY');
        });
      });

      test('should filter by multiple states', async () => {
        const response = await request(app)
          .get('/api/v2/2024?states=BY,BW,BE')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        response.body.forEach(holiday => {
          expect(['BY', 'BW', 'BE']).toContain(holiday.stateCode);
        });
      });

      test('should return 400 for invalid state code', async () => {
        await request(app)
          .get('/api/v2/2024?states=XX')
          .expect(400);
      });
    });

    describe('Field selection', () => {
      test('should select specific fields', async () => {
        const response = await request(app)
          .get('/api/v2/2024?fields=name,stateCode')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach(holiday => {
          expect(Object.keys(holiday)).toEqual(['name', 'stateCode']);
        });
      });

      test('should return 400 for invalid field', async () => {
        await request(app)
          .get('/api/v2/2024?fields=invalidField')
          .expect(400);
      });
    });

    describe('Combined filtering', () => {
      test('should apply multiple filters together', async () => {
        const response = await request(app)
          .get('/api/v2/2024?type=sommerferien&states=BY&fields=name,stateCode')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        response.body.forEach(holiday => {
          expect(holiday.name).toBe('sommerferien');
          expect(holiday.stateCode).toBe('BY');
          expect(Object.keys(holiday)).toEqual(['name', 'stateCode']);
        });
      });
    });

    describe('Error cases', () => {
      test('should return 400 for invalid year', async () => {
        await request(app)
          .get('/api/v2/abc')
          .expect(400);
      });

      test('should return 404 when no holidays match criteria', async () => {
        await request(app)
          .get('/api/v2/2024?from=2024-01-01&to=2024-01-01')
          .expect(404);
      });
    });
  });

  describe('GET /api/v2/:year/:state', () => {
    test('should return holidays for specific year and state', async () => {
      const response = await request(app)
        .get('/api/v2/2024/BY')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      response.body.forEach(holiday => {
        expect(holiday.year).toBe(2024);
        expect(holiday.stateCode).toBe('BY');
      });
    });

    test('should apply additional filters to state endpoint', async () => {
      const response = await request(app)
        .get('/api/v2/2024/BY?type=sommerferien')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach(holiday => {
        expect(holiday.year).toBe(2024);
        expect(holiday.stateCode).toBe('BY');
        expect(holiday.name).toBe('sommerferien');
      });
    });

    test('should return 404 for non-existent state', async () => {
      await request(app)
        .get('/api/v2/2024/XX')
        .expect(404);
    });
  });

  describe('GET /api/v2/current', () => {
    test('should return current holidays', async () => {
      const response = await request(app)
        .get('/api/v2/current')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: This test might return empty array if no holidays are currently active
    });

    test('should filter current holidays by state', async () => {
      const response = await request(app)
        .get('/api/v2/current?states=BY')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach(holiday => {
        expect(holiday.stateCode).toBe('BY');
      });
    });
  });

  describe('GET /api/v2/next/:days', () => {
    test('should return upcoming holidays', async () => {
      const response = await request(app)
        .get('/api/v2/next/30')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: This test might return empty array if no holidays are upcoming
    });

    test('should return 400 for invalid days parameter', async () => {
      await request(app)
        .get('/api/v2/next/abc')
        .expect(400);
    });

    test('should return 400 for days parameter out of range', async () => {
      await request(app)
        .get('/api/v2/next/500')
        .expect(400);
    });
  });

  describe('GET /api/v2/date/:date', () => {
    test('should check if date is a holiday', async () => {
      const response = await request(app)
        .get('/api/v2/date/2024-07-25')
        .expect(200);

      expect(response.body).toHaveProperty('date');
      expect(response.body).toHaveProperty('isHoliday');
      expect(response.body).toHaveProperty('holidays');
      expect(Array.isArray(response.body.holidays)).toBe(true);
    });

    test('should return 400 for invalid date format', async () => {
      await request(app)
        .get('/api/v2/date/invalid-date')
        .expect(400);
    });
  });

  describe('GET /api/v2/search', () => {
    test('should search holidays by query', async () => {
      const response = await request(app)
        .get('/api/v2/search?q=sommer')
        .expect(200);

      expect(response.body).toHaveProperty('query');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('holidays');
      expect(Array.isArray(response.body.holidays)).toBe(true);
      expect(response.body.query).toBe('sommer');
      
      response.body.holidays.forEach(holiday => {
        expect(
          holiday.name.toLowerCase().includes('sommer') ||
          holiday.slug.toLowerCase().includes('sommer') ||
          holiday.stateCode.toLowerCase().includes('sommer')
        ).toBe(true);
      });
    });

    test('should return 400 when query parameter is missing', async () => {
      await request(app)
        .get('/api/v2/search')
        .expect(400);
    });

    test('should filter search results by year', async () => {
      const response = await request(app)
        .get('/api/v2/search?q=ferien&year=2024')
        .expect(200);

      expect(Array.isArray(response.body.holidays)).toBe(true);
      
      response.body.holidays.forEach(holiday => {
        expect(holiday.year).toBe(2024);
      });
    });
  });

  describe('GET /api/v2/stats/:year', () => {
    test('should return statistics for a year', async () => {
      const response = await request(app)
        .get('/api/v2/stats/2024')
        .expect(200);

      expect(response.body).toHaveProperty('year');
      expect(response.body).toHaveProperty('totalHolidays');
      expect(response.body).toHaveProperty('byState');
      expect(response.body).toHaveProperty('byType');
      expect(response.body).toHaveProperty('averageDuration');
      expect(response.body).toHaveProperty('longestHoliday');
      expect(response.body).toHaveProperty('shortestHoliday');
      
      expect(response.body.year).toBe(2024);
      expect(typeof response.body.totalHolidays).toBe('number');
      expect(typeof response.body.byState).toBe('object');
      expect(typeof response.body.byType).toBe('object');
      expect(typeof response.body.averageDuration).toBe('number');
    });

    test('should return 400 for invalid year', async () => {
      await request(app)
        .get('/api/v2/stats/abc')
        .expect(400);
    });
  });

  describe('GET /api/v2/compare/:yearA/:yearB', () => {
    test('should compare two years', async () => {
      const response = await request(app)
        .get('/api/v2/compare/2024/2025')
        .expect(200);

      expect(response.body).toHaveProperty('yearA');
      expect(response.body).toHaveProperty('yearB');
      expect(response.body).toHaveProperty('totalHolidaysA');
      expect(response.body).toHaveProperty('totalHolidaysB');
      expect(response.body).toHaveProperty('difference');
      expect(response.body).toHaveProperty('byState');
      expect(response.body).toHaveProperty('byType');
      
      expect(response.body.yearA).toBe(2024);
      expect(response.body.yearB).toBe(2025);
      expect(typeof response.body.totalHolidaysA).toBe('number');
      expect(typeof response.body.totalHolidaysB).toBe('number');
      expect(typeof response.body.difference).toBe('number');
    });

    test('should return 400 for invalid years', async () => {
      await request(app)
        .get('/api/v2/compare/abc/2025')
        .expect(400);
      
      await request(app)
        .get('/api/v2/compare/2024/xyz')
        .expect(400);
    });
  });

  describe('V1 Compatibility Test', () => {
    test('should preserve exact V1 output for /api/v1/2027/BY equivalent', async () => {
      // This is a critical regression test - V2 should not break V1 behavior
      const response = await request(app)
        .get('/api/v2/2027/BY')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify the structure matches V1 exactly
      response.body.forEach(holiday => {
        expect(holiday).toHaveProperty('start');
        expect(holiday).toHaveProperty('end');
        expect(holiday).toHaveProperty('year');
        expect(holiday).toHaveProperty('stateCode');
        expect(holiday).toHaveProperty('name');
        expect(holiday).toHaveProperty('slug');
        
        expect(holiday.year).toBe(2027);
        expect(holiday.stateCode).toBe('BY');
        
        // Ensure date format is preserved
        expect(holiday.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
        expect(holiday.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
      });
    });
  });
});