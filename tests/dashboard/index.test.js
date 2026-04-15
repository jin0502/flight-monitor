const request = require('supertest');
const { initDB, getDB } = require('../../src/db');
const path = require('path');
const fs = require('fs');

let app;

describe('Dashboard API', () => {
  beforeAll(async () => {
    // Initialize DB in memory for testing
    await initDB(':memory:');
    
    // We'll require the app after DB is initialized because index.js might try to getDB() on load
    // Actually, we'll need to make sure src/dashboard/index.js doesn't call app.listen() if required as a module
    app = require('../../src/dashboard/index');
  });

  afterAll((done) => {
    getDB().close(done);
  });

  describe('GET /api/routes', () => {
    it('should return an empty list of routes initially', async () => {
      const response = await request(app).get('/api/routes');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/routes', () => {
    it('should add a new route', async () => {
      const newRoute = {
        origin: 'PVG',
        destination: 'NRT',
        region: 'Japan',
        search_type: 'one-way',
        alert_threshold: 1500
      };
      const response = await request(app).post('/api/routes').send(newRoute);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.origin).toBe('PVG');
    });

    it('should fail if required fields are missing', async () => {
      const incompleteRoute = { origin: 'PVG' };
      const response = await request(app).post('/api/routes').send(incompleteRoute);
      expect(response.status).toBe(400);
    });

    it('should fail if adding a duplicate route', async () => {
      const route = {
        origin: 'PVG',
        destination: 'NRT',
        region: 'Japan',
        search_type: 'one-way'
      };
      // First insertion (might already be there from previous test if not using :memory: correctly, but we are using :memory: and initDB in beforeAll)
      // Actually, beforeAll runs once per describe block? No, once per file.
      // We should probably use beforeEach to clear the DB or ensure isolation.
      await request(app).post('/api/routes').send(route);
      const response = await request(app).post('/api/routes').send(route);
      expect(response.status).toBe(500); // SQLite UNIQUE constraint violation returns error
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/routes/:id', () => {
    it('should delete an existing route', async () => {
      // First, add a route to delete
      const newRoute = {
        origin: 'SHA',
        destination: 'HND',
        region: 'Japan',
        search_type: 'one-way'
      };
      const addRes = await request(app).post('/api/routes').send(newRoute);
      const routeId = addRes.body.id;

      const delRes = await request(app).delete(`/api/routes/${routeId}`);
      expect(delRes.status).toBe(204);

      // Verify it's gone
      const listRes = await request(app).get('/api/routes');
      const found = listRes.body.find(r => r.id === routeId);
      expect(found).toBeUndefined();
    });
  });

  describe('GET /api/prices/:route_id', () => {
    it('should return price history for a specific route', async () => {
      // Add a route first
      const newRoute = {
        origin: 'PVG',
        destination: 'ICN',
        region: 'Korea',
        search_type: 'one-way'
      };
      const addRes = await request(app).post('/api/routes').send(newRoute);
      const routeId = addRes.body.id;

      // Add a price entry directly to DB for testing
      const db = getDB();
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO price_history (route_id, price, scrape_date, travel_date, airline) VALUES (?, ?, ?, ?, ?)',
          [routeId, 1200, '2026-04-14', '2026-05-01', 'China Eastern'],
          (err) => err ? reject(err) : resolve()
        );
      });

      const response = await request(app).get(`/api/prices/${routeId}`);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].price).toBe(1200);
    });
  });
});
