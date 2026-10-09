const express = require('express');
const dataLoader = require('../../lib/dataLoader');
const { buildCalendar } = require('../../lib/ical');
const {
  VALID_STATES,
  badRequest,
  parseYear,
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

// Errors thrown in these handlers carry a status (400/404) and are rendered by the
// API error handler in index.js as { error: { message, statusCode, documentation } }.

const notFound = (message = 'No holidays found matching the specified criteria') => {
  const error = new Error(message);
  error.status = 404;
  return error;
};

// Time-dependent endpoints change daily, so they get a short CDN cache
const shortCache = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=900');
  next();
};


// GET /api/v2/current - Get currently active holidays
router.get('/current', shortCache, (req, res) => {
  const { states, fields } = req.query;

  let currentHolidays = getCurrentHolidays(dataLoader.getAllData());

  if (states) {
    currentHolidays = filterByStates(currentHolidays, states);
  }

  // Apply field selection last
  if (fields) {
    currentHolidays = selectFields(currentHolidays, fields);
  }

  res.json(currentHolidays);
});

// GET /api/v2/next/:days - Get holidays in the next N days
router.get('/next/:days', shortCache, (req, res) => {
  const days = Number(req.params.days);
  const { states, fields } = req.query;

  if (!/^\d+$/.test(req.params.days) || days < 1 || days > 365) {
    throw badRequest('Days must be a number between 1 and 365');
  }

  let upcomingHolidays = getUpcomingHolidays(dataLoader.getAllData(), days);

  if (states) {
    upcomingHolidays = filterByStates(upcomingHolidays, states);
  }

  // Sort by start date before field selection may drop it
  upcomingHolidays.sort((a, b) => a.start.localeCompare(b.start));

  if (fields) {
    upcomingHolidays = selectFields(upcomingHolidays, fields);
  }

  res.json(upcomingHolidays);
});

// GET /api/v2/date/:date - Check if a specific date is a holiday
router.get('/date/:date', (req, res) => {
  const { states, fields } = req.query;

  let holidaysOnDate = findHolidaysOnDate(dataLoader.getAllData(), req.params.date);

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
});

// GET /api/v2/search - Search holidays by name
router.get('/search', (req, res) => {
  const { q, states, year, fields } = req.query;

  if (!q) {
    throw badRequest('Query parameter "q" is required');
  }

  let holidays = searchHolidays(dataLoader.getAllData(), q);

  if (year) {
    const yearNum = parseYear(year);
    holidays = holidays.filter(holiday => holiday.year === yearNum);
  }

  if (states) {
    holidays = filterByStates(holidays, states);
  }

  // Sort by year and start date before field selection may drop them
  holidays.sort((a, b) => a.year - b.year || a.start.localeCompare(b.start));

  if (fields) {
    holidays = selectFields(holidays, fields);
  }

  res.json({
    query: q,
    results: holidays.length,
    holidays: holidays
  });
});

// GET /api/v2/stats/:year - Get holiday statistics for a year
router.get('/stats/:year', (req, res) => {
  const year = parseYear(req.params.year);
  const holidays = dataLoader.loadYearData(year);

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
    stats.byState[holiday.stateCode] = (stats.byState[holiday.stateCode] || 0) + 1;
    stats.byType[holiday.name] = (stats.byType[holiday.name] || 0) + 1;

    const start = new Date(holiday.start);
    const end = new Date(holiday.end);
    const duration = Math.ceil((end - start) / (24 * 60 * 60 * 1000));

    totalDays += duration;

    if (duration > maxDays) {
      maxDays = duration;
      stats.longestHoliday = { ...holiday, duration: duration };
    }

    if (duration < minDays) {
      minDays = duration;
      stats.shortestHoliday = { ...holiday, duration: duration };
    }
  });

  stats.averageDuration = Math.round((totalDays / holidays.length) * 100) / 100;

  res.json(stats);
});

// GET /api/v2/compare/:yearA/:yearB - Compare holidays between two years
router.get('/compare/:yearA/:yearB', (req, res) => {
  const yearA = parseYear(req.params.yearA);
  const yearB = parseYear(req.params.yearB);
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

  const allStates = [...new Set([...holidaysA, ...holidaysB].map(h => h.stateCode))];
  const allTypes = [...new Set([...holidaysA, ...holidaysB].map(h => h.name))];

  allStates.forEach(state => {
    const countA = holidaysA.filter(h => h.stateCode === state).length;
    const countB = holidaysB.filter(h => h.stateCode === state).length;
    comparison.byState[state] = {
      [yearA]: countA,
      [yearB]: countB,
      difference: countB - countA
    };
  });

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
});

// GET /api/v2/ical/:state.ics - Subscribable calendar (all available years) for one state
router.get('/ical/:state.ics', (req, res) => {
  const stateCode = req.params.state.toUpperCase();

  if (!VALID_STATES.includes(stateCode)) {
    throw badRequest(`Invalid state code: ${req.params.state}. Valid codes are: ${VALID_STATES.join(', ')}`);
  }

  let holidays = dataLoader.getAllData().filter(holiday => holiday.stateCode === stateCode);

  if (req.query.type) {
    holidays = filterByTypes(holidays, req.query.type);
  }

  holidays.sort((a, b) => a.start.localeCompare(b.start));

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `inline; filename="schulferien-${stateCode}.ics"`);
  res.send(buildCalendar(holidays, stateCode));
});

// GET /api/v2/:year - Enhanced year endpoint with filtering
// NOTE: This must be at the end to avoid conflicts with named routes
router.get('/:year', (req, res) => {
  const year = parseYear(req.params.year);
  const { from, to, type, states, fields } = req.query;

  let holidays = dataLoader.loadYearData(year);

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
    throw notFound();
  }

  res.json(holidays);
});

// GET /api/v2/:year/:state - Enhanced state endpoint (backward compatible)
// NOTE: This must be at the end to avoid conflicts with named routes
router.get('/:year/:state', (req, res) => {
  const year = parseYear(req.params.year);
  const { from, to, type, fields } = req.query;

  let holidays = dataLoader.loadYearData(year).filter(holiday =>
    holiday.stateCode === req.params.state.toUpperCase() &&
    holiday.year === year
  );

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
    throw notFound();
  }

  res.json(holidays);
});

module.exports = router;
