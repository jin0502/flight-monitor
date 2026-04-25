const request = require('supertest');
const { initDB, getDB, saveFlight, saveCombinations } = require('../../src/db');
const path = require('path');

// Mock Basic Auth for testing
process.env.ADMIN_PASSWORD = 'testpassword';
const authHeader = 'Basic ' + Buffer.from('admin:testpassword').toString('base64');

let app;

describe('Dashboard API (New Architecture)', () => {
  beforeAll(async () => {
    await initDB(':memory:');
    app = require('../../src/dashboard/index');
  });

  afterAll((done) => {
    getDB().close(done);
  });

  describe('GET /api/oneway', () => {
    it('should return all scanned one-way flights', async () => {
      const flight = {
        origin: 'PVG',
        destination: 'NRT',
        date: '2026-05-01',
        flightNo: 'JL872',
        airline: 'Japan Airlines',
        price: 2500
      };
      await saveFlight(flight);

      const response = await request(app)
        .get('/api/oneway')
        .set('Authorization', authHeader);
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].flight_no).toBe('JL872');
    });

    it('should require authentication', async () => {
        const response = await request(app).get('/api/oneway');
        expect(response.status).toBe(401);
    });
  });

  describe('GET /api/combinations', () => {
    it('should return paired flight combinations with comfort data', async () => {
      const outFlight = {
        origin: 'PVG',
        destination: 'NRT',
        date: '2026-05-01',
        flightNo: 'JL872',
        airline: 'Japan Airlines',
        price: 2500,
        aircraftType: 'Boeing 787',
        hasWifi: 1
      };
      const retFlight = {
        origin: 'NRT',
        destination: 'PVG',
        date: '2026-05-07',
        flightNo: 'JL873',
        airline: 'Japan Airlines',
        price: 2300,
        aircraftType: 'Boeing 787',
        hasPower: 1
      };

      const outId = await saveFlight(outFlight);
      const retId = await saveFlight(retFlight);

      await saveCombinations([{
        outbound: outFlight,
        inbound: retFlight,
        total_price: 4800,
        gap_days: 6
      }]);

      const response = await request(app)
        .get('/api/combinations')
        .set('Authorization', authHeader);
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].total_price).toBe(4800);
      expect(response.body[0].out_aircraft).toBe('Boeing 787');
      expect(response.body[0].out_wifi).toBe(1);
      expect(response.body[0].ret_power).toBe(1);
    });
  });

  describe('GET /api/airports', () => {
    it('should return the curated list of airports', async () => {
      const response = await request(app)
        .get('/api/airports')
        .set('Authorization', authHeader);
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('code');
      expect(response.body[0]).toHaveProperty('name');
    });
  });
});
