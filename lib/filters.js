/**
 * Filtering utilities for holiday data
 */

/**
 * Parse and validate an ISO date string
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {Date} - Parsed date object
 * @throws {Error} - If date is invalid
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Date must be a non-empty string');
  }
  
  // Accept YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }
  
  // Parse components to validate ranges
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Basic validation
  if (month < 1 || month > 12) {
    throw new Error('Invalid date');
  }
  
  // Days per month (considering leap years)
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  if (day < 1 || day > daysInMonth[month - 1]) {
    throw new Error('Invalid date');
  }
  
  const date = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  return date;
}

/**
 * Check if a holiday falls within a date range
 * @param {Object} holiday - Holiday object with start and end dates
 * @param {Date} fromDate - Start date of range
 * @param {Date} toDate - End date of range
 * @returns {boolean} - True if holiday overlaps with range
 */
function isInDateRange(holiday, fromDate, toDate) {
  const holidayStart = new Date(holiday.start);
  const holidayEnd = new Date(holiday.end);
  
  // Holiday overlaps if:
  // - Holiday starts before range ends AND holiday ends after range starts
  return holidayStart <= toDate && holidayEnd >= fromDate;
}

/**
 * Filter holidays by date range
 * @param {Array} holidays - Array of holiday objects
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @returns {Array} - Filtered holidays
 */
function filterByDateRange(holidays, from, to) {
  if (!from && !to) {
    return holidays;
  }
  
  let fromDate = from ? parseDate(from) : new Date('1900-01-01');
  let toDate = to ? parseDate(to) : new Date('2100-12-31');
  
  if (fromDate > toDate) {
    throw new Error('From date must be before or equal to to date');
  }
  
  return holidays.filter(holiday => isInDateRange(holiday, fromDate, toDate));
}

/**
 * Filter holidays by types
 * @param {Array} holidays - Array of holiday objects
 * @param {string} typesStr - Comma-separated list of holiday types
 * @returns {Array} - Filtered holidays
 */
function filterByTypes(holidays, typesStr) {
  if (!typesStr) {
    return holidays;
  }
  
  const types = typesStr.split(',').map(type => type.trim().toLowerCase());
  const validTypes = ['winterferien', 'osterferien', 'pfingstferien', 'sommerferien', 'herbstferien', 'weihnachtsferien', 'fruehjahrsferien'];
  
  // Validate types
  const invalidTypes = types.filter(type => !validTypes.includes(type));
  if (invalidTypes.length > 0) {
    throw new Error(`Invalid holiday types: ${invalidTypes.join(', ')}. Valid types are: ${validTypes.join(', ')}`);
  }
  
  return holidays.filter(holiday => types.includes(holiday.name.toLowerCase()));
}

/**
 * Filter holidays by states
 * @param {Array} holidays - Array of holiday objects
 * @param {string} statesStr - Comma-separated list of state codes
 * @returns {Array} - Filtered holidays
 */
function filterByStates(holidays, statesStr) {
  if (!statesStr) {
    return holidays;
  }
  
  const states = statesStr.split(',').map(state => state.trim().toUpperCase());
  const validStates = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
  
  // Validate states
  const invalidStates = states.filter(state => !validStates.includes(state));
  if (invalidStates.length > 0) {
    throw new Error(`Invalid state codes: ${invalidStates.join(', ')}. Valid codes are: ${validStates.join(', ')}`);
  }
  
  return holidays.filter(holiday => states.includes(holiday.stateCode));
}

/**
 * Search holidays by text query
 * @param {Array} holidays - Array of holiday objects
 * @param {string} query - Search query
 * @returns {Array} - Filtered holidays
 */
function searchHolidays(holidays, query) {
  if (!query || typeof query !== 'string') {
    return holidays;
  }
  
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) {
    return holidays;
  }
  
  return holidays.filter(holiday => {
    return (
      holiday.name.toLowerCase().includes(searchTerm) ||
      holiday.slug.toLowerCase().includes(searchTerm) ||
      holiday.stateCode.toLowerCase().includes(searchTerm)
    );
  });
}

/**
 * Select specific fields from holidays
 * @param {Array} holidays - Array of holiday objects
 * @param {string} fieldsStr - Comma-separated list of fields to include
 * @returns {Array} - Holidays with only selected fields
 */
function selectFields(holidays, fieldsStr) {
  if (!fieldsStr) {
    return holidays;
  }
  
  const fields = fieldsStr.split(',').map(field => field.trim());
  const validFields = ['start', 'end', 'year', 'stateCode', 'name', 'slug'];
  
  // Validate fields
  const invalidFields = fields.filter(field => !validFields.includes(field));
  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`);
  }
  
  return holidays.map(holiday => {
    const selected = {};
    fields.forEach(field => {
      if (holiday.hasOwnProperty(field)) {
        selected[field] = holiday[field];
      }
    });
    return selected;
  });
}

/**
 * Check if a specific date is a holiday
 * @param {Array} holidays - Array of holiday objects
 * @param {string} dateStr - Date to check (YYYY-MM-DD)
 * @returns {Array} - Array of holidays that include this date
 */
function findHolidaysOnDate(holidays, dateStr) {
  const targetDate = parseDate(dateStr);
  
  return holidays.filter(holiday => {
    const start = new Date(holiday.start);
    const end = new Date(holiday.end);
    return targetDate >= start && targetDate <= end;
  });
}

/**
 * Get holidays for next N days from today
 * @param {Array} holidays - Array of holiday objects
 * @param {number} days - Number of days to look ahead
 * @returns {Array} - Holidays in the next N days
 */
function getUpcomingHolidays(holidays, days) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
  
  return holidays.filter(holiday => {
    const holidayStart = new Date(holiday.start);
    return holidayStart >= now && holidayStart <= futureDate;
  });
}

/**
 * Get holidays that are currently active
 * @param {Array} holidays - Array of holiday objects
 * @returns {Array} - Currently active holidays
 */
function getCurrentHolidays(holidays) {
  const now = new Date();
  
  return holidays.filter(holiday => {
    const start = new Date(holiday.start);
    const end = new Date(holiday.end);
    return now >= start && now <= end;
  });
}

module.exports = {
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
};