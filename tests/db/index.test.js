const { initDB, getDB, saveFlight, saveRoutePrice } = require('../../src/db/index');

describe('Database System', () => {
    let db;

    beforeAll(async () => {
        db = await initDB(':memory:');
    });

    afterAll((done) => {
        db.close(done);
    });

    test('should create the route_prices table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='route_prices'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('route_prices');
            done();
        });
    });

    test('should create the flights table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='flights'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('flights');
            done();
        });
    });

    test('should create the flight_combinations table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='flight_combinations'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('flight_combinations');
            done();
        });
    });

    test('saveRoutePrice should insert a price', async () => {
        const data = { origin: 'PVG', dest: 'NRT', date: '2026-05-01', price: 1500 };
        await saveRoutePrice(data);
        
        return new Promise((resolve) => {
            db.get("SELECT * FROM route_prices WHERE origin='PVG' AND dest='NRT'", (err, row) => {
                expect(row.price).toBe(1500);
                resolve();
            });
        });
    });

    test('saveFlight should insert a flight with comfort data', async () => {
        const flight = {
            origin: 'PVG',
            destination: 'NRT',
            date: '2026-05-01',
            flightNo: 'JL872',
            airline: 'Japan Airlines',
            departTime: '09:00',
            arrivalTime: '13:00',
            price: 2500,
            aircraftType: 'Boeing 787',
            hasWifi: 1,
            hasEntertainment: 1,
            hasPower: 1
        };

        const id = await saveFlight(flight);
        expect(id).toBeDefined();

        return new Promise((resolve) => {
            db.get("SELECT * FROM flights WHERE id = ?", [id], (err, row) => {
                expect(row.flight_no).toBe('JL872');
                expect(row.aircraft_type).toBe('Boeing 787');
                expect(row.has_wifi).toBe(1);
                expect(row.has_entertainment).toBe(1);
                expect(row.has_power).toBe(1);
                resolve();
            });
        });
    });

    test('saveFlight should update on conflict and preserve comfort if missing in update', async () => {
        const initial = {
            origin: 'SHA',
            destination: 'HND',
            date: '2026-05-02',
            flightNo: 'MU537',
            airline: 'China Eastern',
            price: 2000,
            aircraftType: 'Airbus A330'
        };

        await saveFlight(initial);

        const update = {
            origin: 'SHA',
            destination: 'HND',
            date: '2026-05-02',
            flightNo: 'MU537',
            price: 1800 // Price dropped, comfort missing in this "scrape"
        };

        await saveFlight(update);

        return new Promise((resolve) => {
            db.get("SELECT * FROM flights WHERE origin='SHA' AND flight_no='MU537'", (err, row) => {
                expect(row.price).toBe(1800);
                expect(row.aircraft_type).toBe('Airbus A330'); // Preserved!
                resolve();
            });
        });
    });
});
