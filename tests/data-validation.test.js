const fs = require('fs');
const path = require('path');

describe('Data Validation Tests', () => {
  const availableYears = [2024, 2025, 2026, 2027];
  const expectedStates = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
  const validVacationTypes = [
    'winterferien', 'osterferien', 'pfingstferien', 
    'sommerferien', 'herbstferien', 'weihnachtsferien', 
    'fruehjahrsferien' // Hamburg special case
  ];

  let allData = {};

  beforeAll(() => {
    // Load all year data files
    availableYears.forEach(year => {
      try {
        const filePath = path.join(__dirname, `../routes/years/${year}.json`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        allData[year] = data;
      } catch (error) {
        throw new Error(`Failed to load data for year ${year}: ${error.message}`);
      }
    });
  });

  describe('File Structure Tests', () => {
    test.each(availableYears)('should load valid JSON for year %d', (year) => {
      expect(allData[year]).toBeDefined();
      expect(Array.isArray(allData[year])).toBe(true);
      expect(allData[year].length).toBeGreaterThan(0);
    });

    test.each(availableYears)('should have all required files for year %d', (year) => {
      const filePath = path.join(__dirname, `../routes/years/${year}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Data Structure Validation', () => {
    test.each(availableYears)('should have valid structure for all entries in year %d', (year) => {
      const data = allData[year];
      
      data.forEach((vacation, index) => {
        // Required fields
        expect(vacation).toHaveProperty('start');
        expect(vacation).toHaveProperty('end');
        expect(vacation).toHaveProperty('year');
        expect(vacation).toHaveProperty('stateCode');
        expect(vacation).toHaveProperty('name');
        expect(vacation).toHaveProperty('slug');

        // Data types
        expect(typeof vacation.start).toBe('string');
        expect(typeof vacation.end).toBe('string');
        expect(typeof vacation.year).toBe('number');
        expect(typeof vacation.stateCode).toBe('string');
        expect(typeof vacation.name).toBe('string');
        expect(typeof vacation.slug).toBe('string');

        // Year consistency
        expect(vacation.year).toBe(year);

        // State code validation
        expect(expectedStates).toContain(vacation.stateCode);

        // Vacation type validation
        expect(validVacationTypes).toContain(vacation.name);
      });
    });

    test.each(availableYears)('should have valid date formats for year %d', (year) => {
      const data = allData[year];
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
      
      data.forEach((vacation, index) => {
        expect(vacation.start).toMatch(dateRegex);
        expect(vacation.end).toMatch(dateRegex);
        
        // Start date should be <= end date
        const startDate = new Date(vacation.start);
        const endDate = new Date(vacation.end);
        expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    test.each(availableYears)('should have valid slug format for year %d', (year) => {
      const data = allData[year];
      
      data.forEach((vacation, index) => {
        const expectedSlug = `${vacation.name}-${vacation.year}-${vacation.stateCode}`;
        expect(vacation.slug).toBe(expectedSlug);
      });
    });
  });

  describe('Completeness Tests', () => {
    test.each(availableYears)('should have all 16 German states for year %d', (year) => {
      const data = allData[year];
      const statesInData = [...new Set(data.map(v => v.stateCode))].sort();
      expect(statesInData).toEqual(expectedStates.sort());
    });

    test.each(availableYears)('should have essential vacation types for each state in year %d', (year) => {
      const data = allData[year];
      
      expectedStates.forEach(stateCode => {
        const stateVacations = data.filter(v => v.stateCode === stateCode);
        expect(stateVacations.length).toBeGreaterThan(0);
        
        const vacationTypes = [...new Set(stateVacations.map(v => v.name))];
        
        // Most states should have at least summer holidays
        expect(vacationTypes).toContain('sommerferien');
        // Note: Not all states have Christmas holidays in all years
      });
    });
  });

  describe('Business Logic Tests', () => {
    test('should have fixed Baden-Württemberg winterferien issue in 2027', () => {
      const bw2027 = allData[2027].filter(v => v.stateCode === 'BW');
      
      // Check for the problematic entry that was fixed
      const marchEntries = bw2027.filter(v => {
        const startDate = new Date(v.start);
        return startDate.getMonth() === 2 && startDate.getDate() >= 25; // March, day >= 25
      });
      
      // These should be osterferien, not winterferien
      marchEntries.forEach(vacation => {
        expect(vacation.name).toBe('osterferien');
        expect(vacation.name).not.toBe('winterferien');
      });
    });

    test('should handle Hamburg special naming convention', () => {
      // Hamburg uses "fruehjahrsferien" instead of "osterferien"
      availableYears.forEach(year => {
        const hamburgData = allData[year].filter(v => v.stateCode === 'HH');
        
        if (hamburgData.length > 0) {
          const vacationTypes = [...new Set(hamburgData.map(v => v.name))];
          
          // Hamburg might use either convention depending on the year
          const hasSpringHolidays = vacationTypes.includes('fruehjahrsferien');
          const hasEasterHolidays = vacationTypes.includes('osterferien');
          
          // Hamburg should have one or the other, but not necessarily both
          expect(hasSpringHolidays || hasEasterHolidays).toBe(true);
        }
      });
    });

    test('should have reasonable vacation date ranges', () => {
      availableYears.forEach(year => {
        const data = allData[year];
        
        data.forEach(vacation => {
          const startDate = new Date(vacation.start);
          const endDate = new Date(vacation.end);
          const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          
          // Reasonable vacation lengths (0 days for single-day holidays to 50+ days for summer)
          expect(durationDays).toBeGreaterThanOrEqual(0);
          expect(durationDays).toBeLessThan(60); // No vacation should be longer than 60 days
          
          // Summer holidays are typically the longest
          if (vacation.name === 'sommerferien') {
            expect(durationDays).toBeGreaterThanOrEqual(30); // At least 30 days for summer holidays
          }
        });
      });
    });

    test('should have vacations occurring in correct months', () => {
      availableYears.forEach(year => {
        const data = allData[year];
        
        data.forEach(vacation => {
          const startDate = new Date(vacation.start);
          const month = startDate.getMonth() + 1; // 1-indexed
          
          switch (vacation.name) {
            case 'winterferien':
              // Winter holidays typically in January-March
              expect([1, 2, 3]).toContain(month);
              break;
            case 'osterferien':
            case 'fruehjahrsferien':
              // Easter/Spring holidays typically in March-May
              expect([3, 4, 5]).toContain(month);
              break;
            case 'pfingstferien':
              // Whitsun holidays typically in April-June (varies by year)
              expect([4, 5, 6]).toContain(month);
              break;
            case 'sommerferien':
              // Summer holidays typically in June-September
              expect([6, 7, 8, 9]).toContain(month);
              break;
            case 'herbstferien':
              // Autumn holidays typically in September-November
              expect([9, 10, 11]).toContain(month);
              break;
            case 'weihnachtsferien':
              // Christmas holidays typically in December (and January of next year)
              expect([12, 1]).toContain(month);
              break;
          }
        });
      });
    });
  });

  describe('Consistency Tests', () => {
    test('should have consistent data structure across all years', () => {
      const firstYear = availableYears[0];
      const firstYearFields = Object.keys(allData[firstYear][0]).sort();
      
      availableYears.slice(1).forEach(year => {
        if (allData[year].length > 0) {
          const yearFields = Object.keys(allData[year][0]).sort();
          expect(yearFields).toEqual(firstYearFields);
        }
      });
    });

    test('should have similar vacation counts across years for each state', () => {
      expectedStates.forEach(stateCode => {
        const countsByYear = availableYears.map(year => {
          return allData[year].filter(v => v.stateCode === stateCode).length;
        });
        
        // No state should have drastically different vacation counts
        // (allowing for some variation due to different holiday calendars)
        const minCount = Math.min(...countsByYear);
        const maxCount = Math.max(...countsByYear);
        
        expect(maxCount - minCount).toBeLessThanOrEqual(5); // Allow up to 5 entries difference
      });
    });
  });

  describe('Regression Tests', () => {
    test('should not have excessive duplicate entries', () => {
      availableYears.forEach(year => {
        const data = allData[year];
        const slugs = data.map(v => v.slug);
        const slugCounts = {};
        
        slugs.forEach(slug => {
          slugCounts[slug] = (slugCounts[slug] || 0) + 1;
        });
        
        // Allow some duplicates (like split holidays) but not excessive ones
        Object.values(slugCounts).forEach(count => {
          expect(count).toBeLessThanOrEqual(5); // Max 5 entries with same slug (some states have split holidays)
        });
      });
    });

    test('should not have entries with identical start and end times that seem incorrect', () => {
      availableYears.forEach(year => {
        const data = allData[year];
        const singleDayVacations = data.filter(v => v.start === v.end);
        
        // Single day vacations are allowed but should be reasonable in number
        // No state should have more than 3 single-day vacations
        expectedStates.forEach(stateCode => {
          const singleDayForState = singleDayVacations.filter(v => v.stateCode === stateCode);
          expect(singleDayForState.length).toBeLessThanOrEqual(3);
        });
      });
    });
  });
});