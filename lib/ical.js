/**
 * iCalendar (RFC 5545) export of holidays as all-day events
 */

const { STATE_NAMES } = require('./filters');

// Stable per instance, so repeated downloads don't look like changed events
const DTSTAMP = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const VARIABLE_DAY_NOTE = 'Ferientag, soweit die Schulkonferenz keine abweichende Festlegung trifft';

/**
 * Escape a text value (RFC 5545, 3.3.11)
 * @param {string} text - Raw text
 * @returns {string} - Escaped text
 */
function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold a content line to at most 75 octets (RFC 5545, 3.1)
 * @param {string} line - Unfolded line
 * @returns {string} - Folded line
 */
function foldLine(line) {
  const parts = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (Buffer.byteLength(current + char) > limit) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * Format a holiday date (YYYY-MM-DDT..) as an iCalendar DATE, optionally shifted by days
 * @param {string} isoString - Date string from the data
 * @param {number} offsetDays - Days to add
 * @returns {string} - YYYYMMDD
 */
function toIcalDate(isoString, offsetDays = 0) {
  const date = new Date(isoString.slice(0, 10) + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Build an iCalendar feed for one state
 * @param {Array} holidays - Holidays of that state
 * @param {string} stateCode - State code
 * @returns {string} - iCalendar document
 */
function buildCalendar(holidays, stateCode) {
  const stateName = STATE_NAMES[stateCode];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//schulferien-api.de//Deutsche Schulferien API//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Schulferien ${stateName}`)}`,
    `X-WR-CALDESC:${escapeText(`Schulferien ${stateName} – https://schulferien-api.de`)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D'
  ];

  holidays.forEach(holiday => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${holiday.slug}-${toIcalDate(holiday.start)}@schulferien-api.de`,
      `DTSTAMP:${DTSTAMP}`,
      `DTSTART;VALUE=DATE:${toIcalDate(holiday.start)}`,
      // DTEND is exclusive for all-day events
      `DTEND;VALUE=DATE:${toIcalDate(holiday.end, 1)}`,
      `SUMMARY:${escapeText(`${holiday.name_cp} ${stateName}`)}`
    );
    if (holiday.name === 'variabler_ferientag') {
      lines.push(`DESCRIPTION:${escapeText(VARIABLE_DAY_NOTE)}`);
    }
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

module.exports = {
  buildCalendar,
  escapeText,
  foldLine,
  toIcalDate
};
