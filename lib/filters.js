/**
 * Filtering utilities for holiday data
 */

const STATE_NAMES = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen'
};
const VALID_STATES = Object.keys(STATE_NAMES);
const VALID_TYPES = ['winterferien', 'fruehjahrsferien', 'osterferien', 'pfingstferien', 'sommerferien', 'herbstferien', 'weihnachtsferien', 'variabler_ferientag'];
const VALID_FIELDS = ['start', 'end', 'year', 'stateCode', 'name', 'name_cp', 'slug'];

/**
 * Create an error that the API answers with 400 Bad Request
 * @param {string} message - Error message
 * @returns {Error} - Error with status 400
 */
function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/**
 * Parse and validate a year parameter
 * @param {string} value - Raw year value
 * @returns {number} - Year
 * @throws {Error} - If the value is not a four-digit year
 */
function parseYear(value) {
  if (!/^\d{4}$/.test(String(value))) {
    throw badRequest('Year must be a four-digit number, e.g. 2026');
  }
  return Number(value);
}

/**
 * Split a comma-separated query value into trimmed entries.
 * Repeated query keys (?states=BY&states=BW) arrive as an array and are accepted too.
 * @param {string|string[]} value - Raw query value
 * @returns {string[]} - Non-empty entries
 */
function toList(value) {
  const parts = Array.isArray(value) ? value : [value];
  return parts
    .flatMap(part => String(part).split(','))
    .map(part => part.trim())
    .filter(Boolean);
}

/**
 * Today's date (YYYY-MM-DD) in German local time, since holidays are calendar days in Germany
 * @param {Date} now - Reference point in time
 * @returns {string} - Date string
 */
function berlinDate(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}

/**
 * Add days to a YYYY-MM-DD date string
 * @param {string} dateStr - Date string
 * @param {number} days - Days to add
 * @returns {string} - Date string
 */
function addDays(dateStr, days) {
  const date = new Date(dateStr + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Parse and validate an ISO date string
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {Date} - Parsed date object
 * @throws {Error} - If date is invalid
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw badRequest('Date must be a non-empty string');
  }
  
  // Accept YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw badRequest('Date must be in YYYY-MM-DD format');
  }
  
  // Parse components to validate ranges
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Basic validation
  if (month < 1 || month > 12) {
    throw badRequest('Invalid date');
  }
  
  // Days per month (considering leap years)
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  if (day < 1 || day > daysInMonth[month - 1]) {
    throw badRequest('Invalid date');
  }
  
  const date = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw badRequest('Invalid date');
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
    throw badRequest('From date must be before or equal to to date');
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
  
  const types = toList(typesStr).map(type => type.toLowerCase());
  
  // Validate types
  const invalidTypes = types.filter(type => !VALID_TYPES.includes(type));
  if (invalidTypes.length > 0) {
    throw badRequest(`Invalid holiday types: ${invalidTypes.join(', ')}. Valid types are: ${VALID_TYPES.join(', ')}`);
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
  
  const states = toList(statesStr).map(state => state.toUpperCase());
  
  // Validate states
  const invalidStates = states.filter(state => !VALID_STATES.includes(state));
  if (invalidStates.length > 0) {
    throw badRequest(`Invalid state codes: ${invalidStates.join(', ')}. Valid codes are: ${VALID_STATES.join(', ')}`);
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
  if (!query) {
    return holidays;
  }
  
  const searchTerm = String(query).toLowerCase().trim();
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
  
  const fields = toList(fieldsStr);
  
  // Validate fields
  const invalidFields = fields.filter(field => !VALID_FIELDS.includes(field));
  if (invalidFields.length > 0) {
    throw badRequest(`Invalid fields: ${invalidFields.join(', ')}. Valid fields are: ${VALID_FIELDS.join(', ')}`);
  }
  
  return holidays.map(holiday => {
    const selected = {};
    fields.forEach(field => {
      if (Object.hasOwn(holiday, field)) {
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
 * Get holidays starting within the next N days (German local time, today included)
 * @param {Array} holidays - Array of holiday objects
 * @param {number} days - Number of days to look ahead
 * @param {Date} now - Reference point in time
 * @returns {Array} - Holidays in the next N days
 */
function getUpcomingHolidays(holidays, days, now = new Date()) {
  const today = berlinDate(now);
  const lastDay = addDays(today, days);
  
  return holidays.filter(holiday => {
    const start = holiday.start.slice(0, 10);
    return start >= today && start <= lastDay;
  });
}

/**
 * Get holidays that are active today (German local time)
 * @param {Array} holidays - Array of holiday objects
 * @param {Date} now - Reference point in time
 * @returns {Array} - Currently active holidays
 */
function getCurrentHolidays(holidays, now = new Date()) {
  const today = berlinDate(now);
  
  return holidays.filter(holiday => {
    return holiday.start.slice(0, 10) <= today && holiday.end.slice(0, 10) >= today;
  });
}

module.exports = {
  STATE_NAMES,
  VALID_STATES,
  VALID_TYPES,
  VALID_FIELDS,
  badRequest,
  parseYear,
  toList,
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