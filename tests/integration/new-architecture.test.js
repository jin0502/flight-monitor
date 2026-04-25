const DirectCalendarScanner = require('../../src/scanner/direct-calendar-scanner');
const OneWayScanner = require('../../src/scanner/oneway-scanner');
const CombinationEngine = require('../../src/scanner/combination-engine');
const { initDB, getDB, saveFlight } = require('../../src/db');

describe('New Architecture Integration', () => {
    let db;

    beforeAll(async () => {
        await initDB(':memory:');
        db = getDB();
    });

    afterAll((done) => {
        db.close(done);
    });

    describe('DirectCalendarScanner', () => {
        it('should correctly identify domestic vs international routes', () => {
            const scanner = new DirectCalendarScanner();
            expect(scanner.isDomesticRoute('PVG', 'CAN')).toBe(true); // Guangzhou
            expect(scanner.isDomesticRoute('PVG', 'NRT')).toBe(false);
        });
    });

    describe('CombinationEngine', () => {
        it('should pair flights within 3-9 day gap and calculate total price', async () => {
            const engine = new CombinationEngine();
            
            const outFlight = {
                origin: 'PVG',
                destination: 'TYO',
                flight_date: '2026-06-01',
                flightNo: 'JL872',
                airline: 'Japan Airlines',
                price: 1000
            };

            const retFlight = {
                origin: 'TYO',
                destination: 'PVG',
                flight_date: '2026-06-08',
                flightNo: 'JL873',
                airline: 'Japan Airlines',
                price: 800
            };

            // Phase 2: Save to DB
            const outId = await saveFlight(outFlight);
            const retId = await saveFlight(retFlight);
            outFlight.id = outId;
            retFlight.id = retId;

            // Phase 3: Combine
            const deals = engine.combine([outFlight], [retFlight]);
            
            expect(deals.length).toBe(1);
            expect(deals[0].total_price).toBe(1800);
            expect(deals[0].gap_days).toBe(7);
        });
    });
});
