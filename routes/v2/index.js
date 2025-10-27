const express = require('express');
const dataLoader = require('../../lib/dataLoader');
const {
  filterByDateRange,
  filterByTypes,
  filterByStates,
  searchHolidays,
  selectFields,
  findHolidaysOnDate,
  getUpcomingHolidays,
  getCurrentHolidays
} = require('../../lib/filters');

const router = express.Router();


// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validate year parameter
const validateYear = (year) => {
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    throw new Error('Year must be a valid number between 1900 and 2100');
  }
  return yearNum;
};


// GET /api/v2/current - Get currently active holidays
router.get('/current', asyncHandler(async (req, res) => {
  const { states, fields } = req.query;

  try {
    let allHolidays = dataLoader.getAllData();
    let currentHolidays = getCurrentHolidays(allHolidays);
    
    // Apply filters
    if (states) {
      currentHolidays = filterByStates(currentHolidays, states);
    }
    
    // Apply field selection last
    if (fields) {
      currentHolidays = selectFields(currentHolidays, fields);
    }

    res.json(currentHolidays);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/next/:days - Get holidays in the next N days
router.get('/next/:days', asyncHandler(async (req, res) => {
  const days = parseInt(req.params.days);
  const { states, fields } = req.query;

  if (isNaN(days) || days < 1 || days > 365) {
    return res.status(400).json({
      error: {
        message: 'Days must be a number between 1 and 365'
      }
    });
  }

  try {
    let allHolidays = dataLoader.getAllData();
    let upcomingHolidays = getUpcomingHolidays(allHolidays, days);
    
    // Apply filters
    if (states) {
      upcomingHolidays = filterByStates(upcomingHolidays, states);
    }
    
    // Apply field selection last
    if (fields) {
      upcomingHolidays = selectFields(upcomingHolidays, fields);
    }

    // Sort by start date
    upcomingHolidays.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json(upcomingHolidays);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/date/:date - Check if a specific date is a holiday
router.get('/date/:date', asyncHandler(async (req, res) => {
  const { states, fields } = req.query;

  try {
    let allHolidays = dataLoader.getAllData();
    let holidaysOnDate = findHolidaysOnDate(allHolidays, req.params.date);
    
    // Apply filters
    if (states) {
      holidaysOnDate = filterByStates(holidaysOnDate, states);
    }
    
    // Apply field selection last
    if (fields) {
      holidaysOnDate = selectFields(holidaysOnDate, fields);
    }

    res.json({
      date: req.params.date,
      isHoliday: holidaysOnDate.length > 0,
      holidays: holidaysOnDate
    });
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/search - Search holidays by name
router.get('/search', asyncHandler(async (req, res) => {
  const { q, states, year, fields } = req.query;

  if (!q) {
    return res.status(400).json({
      error: {
        message: 'Query parameter "q" is required'
      }
    });
  }

  try {
    let holidays = dataLoader.getAllData();
    
    // Apply search
    holidays = searchHolidays(holidays, q);
    
    // Apply additional filters
    if (year) {
      const yearNum = validateYear(year);
      holidays = holidays.filter(holiday => holiday.year === yearNum);
    }
    
    if (states) {
      holidays = filterByStates(holidays, states);
    }
    
    // Apply field selection last
    if (fields) {
      holidays = selectFields(holidays, fields);
    }

    // Sort by year and start date
    holidays.sort((a, b) => {
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      return new Date(a.start) - new Date(b.start);
    });

    res.json({
      query: q,
      results: holidays.length,
      holidays: holidays
    });
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/stats/:year - Get holiday statistics for a year
router.get('/stats/:year', asyncHandler(async (req, res) => {
  try {
    const year = validateYear(req.params.year);
    const holidays = dataLoader.loadYearData(year);
    
    // Calculate statistics
    const stats = {
      year: year,
      totalHolidays: holidays.length,
      byState: {},
      byType: {},
      averageDuration: 0,
      longestHoliday: null,
      shortestHoliday: null
    };

    let totalDays = 0;
    let minDays = Infinity;
    let maxDays = 0;

    holidays.forEach(holiday => {
      // Count by state
      stats.byState[holiday.stateCode] = (stats.byState[holiday.stateCode] || 0) + 1;
      
      // Count by type
      stats.byType[holiday.name] = (stats.byType[holiday.name] || 0) + 1;
      
      // Calculate duration
      const start = new Date(holiday.start);
      const end = new Date(holiday.end);
      const duration = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
      
      totalDays += duration;
      
      if (duration > maxDays) {
        maxDays = duration;
        stats.longestHoliday = {
          ...holiday,
          duration: duration
        };
      }
      
      if (duration < minDays) {
        minDays = duration;
        stats.shortestHoliday = {
          ...holiday,
          duration: duration
        };
      }
    });

    stats.averageDuration = Math.round((totalDays / holidays.length) * 100) / 100;

    res.json(stats);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/compare/:yearA/:yearB - Compare holidays between two years
router.get('/compare/:yearA/:yearB', asyncHandler(async (req, res) => {
  try {
    const yearA = validateYear(req.params.yearA);
    const yearB = validateYear(req.params.yearB);
    const holidaysA = dataLoader.loadYearData(yearA);
    const holidaysB = dataLoader.loadYearData(yearB);
    
    const comparison = {
      yearA: yearA,
      yearB: yearB,
      totalHolidaysA: holidaysA.length,
      totalHolidaysB: holidaysB.length,
      difference: holidaysB.length - holidaysA.length,
      byState: {},
      byType: {}
    };

    // Get all states and types
    const allStates = [...new Set([...holidaysA, ...holidaysB].map(h => h.stateCode))];
    const allTypes = [...new Set([...holidaysA, ...holidaysB].map(h => h.name))];

    // Compare by state
    allStates.forEach(state => {
      const countA = holidaysA.filter(h => h.stateCode === state).length;
      const countB = holidaysB.filter(h => h.stateCode === state).length;
      comparison.byState[state] = {
        [yearA]: countA,
        [yearB]: countB,
        difference: countB - countA
      };
    });

    // Compare by type
    allTypes.forEach(type => {
      const countA = holidaysA.filter(h => h.name === type).length;
      const countB = holidaysB.filter(h => h.name === type).length;
      comparison.byType[type] = {
        [yearA]: countA,
        [yearB]: countB,
        difference: countB - countA
      };
    });

  res.json(comparison);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/:year - Enhanced year endpoint with filtering
// NOTE: This must be at the end to avoid conflicts with named routes
router.get('/:year', asyncHandler(async (req, res) => {
  try {
    const year = validateYear(req.params.year);
    const { from, to, type, states, fields } = req.query;
    
    let holidays = dataLoader.loadYearData(year);

    // Apply filters in sequence
    if (from || to) {
      holidays = filterByDateRange(holidays, from, to);
    }
    
    if (type) {
      holidays = filterByTypes(holidays, type);
    }
    
    if (states) {
      holidays = filterByStates(holidays, states);
    }
    
    // Apply field selection last
    if (fields) {
      holidays = selectFields(holidays, fields);
    }

    if (holidays.length === 0) {
      return res.status(404).json({
        error: {
          message: 'No holidays found matching the specified criteria'
        }
      });
    }

    res.json(holidays);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

// GET /api/v2/:year/:state - Enhanced state endpoint (backward compatible)
// NOTE: This must be at the end to avoid conflicts with named routes
router.get('/:year/:state', asyncHandler(async (req, res) => {
  try {
    const year = validateYear(req.params.year);
    const { from, to, type, fields } = req.query;
    
    let holidays = dataLoader.loadYearData(year);
    
    // Filter by state (using the existing logic for compatibility)
    holidays = holidays.filter(holiday => 
      holiday.stateCode === req.params.state.toUpperCase() && 
      holiday.year === year
    );

    // Apply additional filters
    if (from || to) {
      holidays = filterByDateRange(holidays, from, to);
    }
    
    if (type) {
      holidays = filterByTypes(holidays, type);
    }
    
    // Apply field selection last
    if (fields) {
      holidays = selectFields(holidays, fields);
    }

    if (holidays.length === 0) {
      return res.status(404).json({
        error: {
          message: 'No holidays found matching the specified criteria'
        }
      });
    }

    res.json(holidays);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message
      }
    });
  }
}));

module.exports = router;
