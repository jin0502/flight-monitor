const CalendarScanner = require('../../src/scanner/calendar-scanner');
const OneWayScanner = require('../../src/scanner/oneway-scanner');
const CombinationEngine = require('../../src/scanner/combination-engine');
const { initDB, getDB } = require('../../src/db');
const { chromium } = require('playwright');

describe('New Architecture Integration', () => {
    let db;

    beforeAll(async () => {
        // Use an in-memory or temporary DB for testing
        process.env.DB_PATH = ':memory:';
        await initDB();
        db = getDB();
    });

    describe('CalendarScanner', () => {
        it('should process raw calendar data and pick top dates within window', () => {
            const scanner = new CalendarScanner({});
            // June 2026 is safe (>4 weeks from 2026-04-24)
            const mockData = [
                { date: '2026-06-01', price: 1000 },
                { date: '2026-06-02', price: 500 },
                { date: '2026-06-03', price: 1200 },
                { date: '2026-06-04', price: 800 },
                { date: '2026-04-25', price: 100 } // Should be filtered out (<4 weeks)
            ];
            const result = scanner.processCalendarData(mockData);
            expect(result).toContain('2026-06-02');
            expect(result).toContain('2026-06-04');
            expect(result).toContain('2026-06-01');
            expect(result).not.toContain('2026-04-25');
        });
    });

    describe('OneWayScanner', () => {
        it('should correctly process Ctrip API results and filter for direct flights', () => {
            const scanner = new OneWayScanner({});
            const mockApiResults = [
                {
                    priceList: [{ adultPrice: 1200 }],
                    flightSegments: [{
                        airlineName: 'Test Airline',
                        flightList: [{ flightNo: 'TEST123', departureDateTime: '2026-06-01 09:00:00' }]
                    }]
                }
            ];
            const processed = scanner.processApiFlights(mockApiResults, 'PVG', 'TYO', '2026-06-01');
            expect(processed.length).toBe(1);
            expect(processed[0].price).toBe(1200);
        });
    });

    describe('CombinationEngine', () => {
        it('should pair flights within 3-9 day gap and calculate total price', async () => {
            const scanner = new OneWayScanner({});
            
            // Outbound June 1
            await scanner.saveToDB([{
                origin: 'PVG', destination: 'TYO', flight_date: '2026-06-01',
                price: 1000, airline: 'A', flight_number: 'A1', departure_time: '09:00',
                duration: '3h', is_direct: 1, scrape_date: '2026-04-24', source: 'test', month_key: '2026-06'
            }]);

            // Inbound June 9 (8 day gap - should now match)
            await scanner.saveToDB([{
                origin: 'TYO', destination: 'PVG', flight_date: '2026-06-09',
                price: 800, airline: 'B', flight_number: 'B1', departure_time: '14:00',
                duration: '3h', is_direct: 1, scrape_date: '2026-04-24', source: 'test', month_key: '2026-06'
            }]);

            const engine = new CombinationEngine();
            const deals = await engine.generateCombinations();
            
            expect(deals.length).toBe(1);
            expect(deals[0].total_price).toBe(1800);
            expect(deals[0].gap_days).toBe(8);
        });
    });
});
