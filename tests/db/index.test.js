const { initDB, getDB } = require('../../src/db/index');
const sqlite3 = require('sqlite3').verbose();

describe('Database Initialization', () => {
    let db;

    beforeEach(async () => {
        // We'll use an in-memory database for testing
        db = await initDB(':memory:');
    });

    afterEach((done) => {
        db.close(done);
    });

    test('should create the monitored_routes table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='monitored_routes'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('monitored_routes');
            done();
        });
    });

    test('should create the price_history table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('price_history');
            done();
        });
    });

    test('should create the alerts table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='alerts'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('alerts');
            done();
        });
    });

    test('getDB should return the initialized database', async () => {
        const currentDB = getDB();
        expect(currentDB).toBe(db);
    });

    test('should be able to insert and retrieve a monitored route', (done) => {
        const route = {
            origin: 'SHA',
            destination: 'NRT',
            region: 'East Asia',
            search_type: 'one-way',
            alert_threshold: 1000
        };

        db.run(
            `INSERT INTO monitored_routes (origin, destination, region, search_type, alert_threshold) 
             VALUES (?, ?, ?, ?, ?)`,
            [route.origin, route.destination, route.region, route.search_type, route.alert_threshold],
            function(err) {
                expect(err).toBeNull();
                const routeId = this.lastID;
                
                db.get("SELECT * FROM monitored_routes WHERE id = ?", [routeId], (err, row) => {
                    expect(err).toBeNull();
                    expect(row.origin).toBe(route.origin);
                    expect(row.destination).toBe(route.destination);
                    done();
                });
            }
        );
    });

    test('should be able to insert price history with route foreign key', (done) => {
        db.run(
            `INSERT INTO monitored_routes (origin, destination, region, search_type) 
             VALUES ('PVG', 'ICN', 'East Asia', 'one-way')`,
            function(err) {
                const routeId = this.lastID;
                const priceData = {
                    route_id: routeId,
                    price: 800.50,
                    scrape_date: '2026-04-14',
                    travel_date: '2026-05-20',
                    airline: 'Spring Airlines',
                    duration: '2h 15m'
                };

                db.run(
                    `INSERT INTO price_history (route_id, price, scrape_date, travel_date, airline, duration) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [priceData.route_id, priceData.price, priceData.scrape_date, priceData.travel_date, priceData.airline, priceData.duration],
                    function(err) {
                        expect(err).toBeNull();
                        const historyId = this.lastID;
                        
                        db.get("SELECT * FROM price_history WHERE id = ?", [historyId], (err, row) => {
                            expect(err).toBeNull();
                            expect(row.price).toBe(priceData.price);
                            expect(row.route_id).toBe(routeId);
                            done();
                        });
                    }
                );
            }
        );
    });
});
