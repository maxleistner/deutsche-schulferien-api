const {
  parseDate,
  isInDateRange,
  filterByDateRange,
  filterByTypes,
  filterByStates,
  searchHolidays,
  selectFields,
  findHolidaysOnDate,
  getUpcomingHolidays,
  getCurrentHolidays
} = require('../lib/filters');

describe('Filters Utility', () => {
  const sampleHolidays = [
    {
      start: "2024-07-25T00:00Z",
      end: "2024-09-08T00:00Z",
      year: 2024,
      stateCode: "BY",
      name: "sommerferien",
      slug: "sommerferien-2024-BY"
    },
    {
      start: "2024-03-25T00:00Z",
      end: "2024-04-06T00:00Z",
      year: 2024,
      stateCode: "BW",
      name: "osterferien",
      slug: "osterferien-2024-BW"
    },
    {
      start: "2024-12-23T00:00Z",
      end: "2025-01-05T00:00Z",
      year: 2024,
      stateCode: "BY",
      name: "weihnachtsferien",
      slug: "weihnachtsferien-2024-BY"
    },
    {
      start: "2024-02-12T00:00Z",
      end: "2024-02-17T00:00Z",
      year: 2024,
      stateCode: "BY",
      name: "winterferien",
      slug: "winterferien-2024-BY"
    }
  ];

  describe('parseDate', () => {
    test('should parse valid date string', () => {
      const date = parseDate('2024-07-25');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-07-25T00:00:00.000Z');
    });

    test('should throw error for invalid date format', () => {
      expect(() => parseDate('2024/07/25')).toThrow('Date must be in YYYY-MM-DD format');
      expect(() => parseDate('24-07-25')).toThrow('Date must be in YYYY-MM-DD format');
      expect(() => parseDate('invalid')).toThrow('Date must be in YYYY-MM-DD format');
    });

    test('should throw error for invalid date', () => {
      expect(() => parseDate('2024-13-01')).toThrow('Invalid date');
      expect(() => parseDate('2024-02-30')).toThrow('Invalid date');
    });

    test('should throw error for empty or non-string input', () => {
      expect(() => parseDate('')).toThrow('Date must be a non-empty string');
      expect(() => parseDate(null)).toThrow('Date must be a non-empty string');
      expect(() => parseDate(123)).toThrow('Date must be a non-empty string');
    });
  });

  describe('isInDateRange', () => {
    test('should return true when holiday overlaps with range', () => {
      const holiday = sampleHolidays[0]; // Summer holidays 2024-07-25 to 2024-09-08
      const fromDate = new Date('2024-08-01T00:00:00.000Z');
      const toDate = new Date('2024-08-31T00:00:00.000Z');
      
      expect(isInDateRange(holiday, fromDate, toDate)).toBe(true);
    });

    test('should return false when holiday does not overlap with range', () => {
      const holiday = sampleHolidays[0]; // Summer holidays 2024-07-25 to 2024-09-08
      const fromDate = new Date('2024-01-01T00:00:00.000Z');
      const toDate = new Date('2024-06-30T00:00:00.000Z');
      
      expect(isInDateRange(holiday, fromDate, toDate)).toBe(false);
    });
  });

  describe('filterByDateRange', () => {
    test('should return all holidays when no date range specified', () => {
      const result = filterByDateRange(sampleHolidays);
      expect(result).toEqual(sampleHolidays);
    });

    test('should filter holidays by date range', () => {
      const result = filterByDateRange(sampleHolidays, '2024-07-01', '2024-09-30');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });

    test('should filter with only from date', () => {
      const result = filterByDateRange(sampleHolidays, '2024-07-01');
      expect(result).toHaveLength(2); // Summer and Christmas holidays
    });

    test('should filter with only to date', () => {
      const result = filterByDateRange(sampleHolidays, null, '2024-04-30');
      expect(result).toHaveLength(2); // Easter and winter holidays
    });

    test('should throw error when from date is after to date', () => {
      expect(() => {
        filterByDateRange(sampleHolidays, '2024-08-01', '2024-07-01');
      }).toThrow('From date must be before or equal to to date');
    });
  });

  describe('filterByTypes', () => {
    test('should return all holidays when no types specified', () => {
      const result = filterByTypes(sampleHolidays);
      expect(result).toEqual(sampleHolidays);
    });

    test('should filter by single type', () => {
      const result = filterByTypes(sampleHolidays, 'sommerferien');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });

    test('should filter by multiple types', () => {
      const result = filterByTypes(sampleHolidays, 'sommerferien,winterferien');
      expect(result).toHaveLength(2);
    });

    test('should be case insensitive', () => {
      const result = filterByTypes(sampleHolidays, 'SOMMERFERIEN');
      expect(result).toHaveLength(1);
    });

    test('should throw error for invalid holiday types', () => {
      expect(() => {
        filterByTypes(sampleHolidays, 'invalidferien');
      }).toThrow('Invalid holiday types: invalidferien');
    });

    test('should handle whitespace in type list', () => {
      const result = filterByTypes(sampleHolidays, ' sommerferien , winterferien ');
      expect(result).toHaveLength(2);
    });
  });

  describe('filterByStates', () => {
    test('should return all holidays when no states specified', () => {
      const result = filterByStates(sampleHolidays);
      expect(result).toEqual(sampleHolidays);
    });

    test('should filter by single state', () => {
      const result = filterByStates(sampleHolidays, 'BY');
      expect(result).toHaveLength(3); // BY has 3 holidays
    });

    test('should filter by multiple states', () => {
      const result = filterByStates(sampleHolidays, 'BY,BW');
      expect(result).toHaveLength(4);
    });

    test('should be case insensitive', () => {
      const result = filterByStates(sampleHolidays, 'by');
      expect(result).toHaveLength(3);
    });

    test('should throw error for invalid state codes', () => {
      expect(() => {
        filterByStates(sampleHolidays, 'XX');
      }).toThrow('Invalid state codes: XX');
    });
  });

  describe('searchHolidays', () => {
    test('should return all holidays when no query specified', () => {
      const result = searchHolidays(sampleHolidays);
      expect(result).toEqual(sampleHolidays);
    });

    test('should search by holiday name', () => {
      const result = searchHolidays(sampleHolidays, 'sommer');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });

    test('should search by state code', () => {
      const result = searchHolidays(sampleHolidays, 'BY');
      expect(result).toHaveLength(3);
    });

    test('should be case insensitive', () => {
      const result = searchHolidays(sampleHolidays, 'SOMMER');
      expect(result).toHaveLength(1);
    });

    test('should search in slug', () => {
      const result = searchHolidays(sampleHolidays, '2024-BY');
      expect(result).toHaveLength(3);
    });
  });

  describe('selectFields', () => {
    test('should return all fields when no fields specified', () => {
      const result = selectFields(sampleHolidays);
      expect(result).toEqual(sampleHolidays);
    });

    test('should select specific fields', () => {
      const result = selectFields(sampleHolidays, 'name,stateCode');
      expect(result[0]).toEqual({
        name: 'sommerferien',
        stateCode: 'BY'
      });
    });

    test('should throw error for invalid fields', () => {
      expect(() => {
        selectFields(sampleHolidays, 'invalidField');
      }).toThrow('Invalid fields: invalidField');
    });

    test('should handle whitespace in field list', () => {
      const result = selectFields(sampleHolidays, ' name , stateCode ');
      expect(result[0]).toEqual({
        name: 'sommerferien',
        stateCode: 'BY'
      });
    });
  });

  describe('findHolidaysOnDate', () => {
    test('should find holidays on a specific date', () => {
      const result = findHolidaysOnDate(sampleHolidays, '2024-08-15');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });

    test('should return empty array when no holidays on date', () => {
      const result = findHolidaysOnDate(sampleHolidays, '2024-01-15');
      expect(result).toHaveLength(0);
    });

    test('should find holidays on exact start date', () => {
      const result = findHolidaysOnDate(sampleHolidays, '2024-07-25');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });

    test('should find holidays on exact end date', () => {
      const result = findHolidaysOnDate(sampleHolidays, '2024-09-08');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });
  });

  describe('getUpcomingHolidays', () => {
    // Mock current date for consistent testing
    const originalDate = Date;
    const mockDate = new Date('2024-06-01T00:00:00.000Z');
    
    beforeAll(() => {
      global.Date = jest.fn((...args) => 
        args.length ? new originalDate(...args) : mockDate
      );
      global.Date.now = () => mockDate.getTime();
    });

    afterAll(() => {
      global.Date = originalDate;
    });

    test('should find holidays starting within specified days', () => {
      const result = getUpcomingHolidays(sampleHolidays, 60);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });

    test('should return empty array when no upcoming holidays', () => {
      const result = getUpcomingHolidays(sampleHolidays, 30);
      expect(result).toHaveLength(0);
    });
  });

  describe('getCurrentHolidays', () => {
    const originalDate = Date;
    const mockDate = new Date('2024-08-15T00:00:00.000Z'); // During summer holidays
    
    beforeAll(() => {
      global.Date = jest.fn((...args) => 
        args.length ? new originalDate(...args) : mockDate
      );
    });

    afterAll(() => {
      global.Date = originalDate;
    });

    test('should find currently active holidays', () => {
      const result = getCurrentHolidays(sampleHolidays);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sommerferien');
    });
  });
});