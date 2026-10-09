const request = require('supertest');
const { escapeText, foldLine, toIcalDate } = require('../lib/ical');

const app = require('../index');

describe('iCalendar export', () => {
  describe('helpers', () => {
    test('should escape special characters', () => {
      expect(escapeText('a,b;c\\d')).toBe('a\\,b\;c\\\\d');
    });

    test('should fold lines longer than 75 octets', () => {
      const folded = foldLine('X'.repeat(80) + 'ü'.repeat(40));
      folded.split('\r\n').forEach(line => {
        expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
      });
      expect(folded.replace(/\r\n /g, '')).toBe('X'.repeat(80) + 'ü'.repeat(40));
    });

    test('should format dates and make end dates exclusive', () => {
      expect(toIcalDate('2029-09-10T23:59Z')).toBe('20290910');
      expect(toIcalDate('2029-12-31T23:59Z', 1)).toBe('20300101');
    });
  });

  describe('GET /api/v2/ical/:state.ics', () => {
    test('should return a calendar for a state', async () => {
      const response = await request(app)
        .get('/api/v2/ical/BY.ics')
        .expect(200)
        .expect('Content-Type', /text\/calendar/);

      expect(response.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(response.text).toContain('X-WR-CALNAME:Schulferien Bayern');
      // Summer 2029 in Bavaria: 30.07.–10.09., DTEND is the day after
      expect(response.text).toContain('DTSTART;VALUE=DATE:20290730\r\nDTEND;VALUE=DATE:20290911\r\nSUMMARY:Sommerferien Bayern');
    });

    test('should accept lowercase state codes and type filters', async () => {
      const response = await request(app)
        .get('/api/v2/ical/bb.ics?type=variabler_ferientag')
        .expect(200);

      const summaries = response.text.match(/^SUMMARY:.*$/gm);
      expect(summaries.length).toBeGreaterThan(0);
      summaries.forEach(summary => expect(summary).toBe('SUMMARY:Variabler Ferientag Brandenburg'));
    });

    test('should have unique event UIDs', async () => {
      const response = await request(app)
        .get('/api/v2/ical/HB.ics')
        .expect(200);

      const uids = response.text.match(/^UID:.*$/gm);
      expect(new Set(uids).size).toBe(uids.length);
    });

    test('should reject unknown states', async () => {
      await request(app)
        .get('/api/v2/ical/XX.ics')
        .expect(400);
    });
  });
});
