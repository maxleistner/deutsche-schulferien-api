const request = require('supertest');
const dataLoader = require('../lib/dataLoader');

describe('Unique id field', () => {
  const years = dataLoader.getAvailableYears();

  test.each(years)('every entry in %d has an id made of slug and start date', (year) => {
    dataLoader.loadYearData(year).forEach((holiday) => {
      expect(holiday.id).toBe(`${holiday.slug}-${holiday.start.slice(0, 10)}`);
    });
  });

  test.each(years)('ids are unique in %d', (year) => {
    const ids = dataLoader.loadYearData(year).map((holiday) => holiday.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('Buß- und Bettag in Bavaria keeps its type but gets its own id', async () => {
    const app = require('../index');
    const res = await request(app).get('/api/v2/2027/BY?type=herbstferien');
    expect(res.status).toBe(200);
    expect(res.body.map((h) => h.slug)).toEqual(['herbstferien-2027-BY', 'herbstferien-2027-BY']);
    expect(res.body.map((h) => h.id)).toEqual(['herbstferien-2027-BY-2027-11-02', 'herbstferien-2027-BY-2027-11-17']);
  });

  test('id can be selected via fields', async () => {
    const app = require('../index');
    const res = await request(app).get('/api/v2/2027/BY?fields=id');
    expect(res.status).toBe(200);
    res.body.forEach((h) => expect(Object.keys(h)).toEqual(['id']));
  });
});
