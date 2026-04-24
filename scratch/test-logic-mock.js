const CalendarScanner = require('../src/scanner/calendar-scanner');
const OneWayScanner = require('../src/scanner/oneway-scanner');
const CombinationEngine = require('../src/scanner/combination-engine');
const { initDB, getDB } = require('../src/db');
require('dotenv').config();

async function runMockTest() {
    console.log('--- STARTING LOGIC VERIFICATION (MOCKED DATA) ---');
    
    // 1. Init DB
    await initDB();
    const db = getDB();
    console.log('✅ DB Initialized');

    // 2. Verify Calendar Logic
    const calendar = new CalendarScanner({}); // Dummy page
    const mockRawCalendar = [
        { date: '2026-05-01', price: 1000 },
        { date: '2026-05-02', price: 900 },
        { date: '2026-05-03', price: 1100 },
        { date: '2026-05-10', price: 800 },
        { date: '2026-06-01', price: 1200 }
    ];
    const cheapDates = calendar.processCalendarData(mockRawCalendar);
    console.log('✅ Calendar Logic Result:', cheapDates);
    // Should be top 3 for May: 2026-05-10 (800), 2026-05-02 (900), 2026-05-01 (1000)
    // Plus 2026-06-01

    // 3. Verify OneWay Processing Logic
    const scanner = new OneWayScanner({});
    const mockApiFlights = [
        {
            priceList: [{ adultPrice: 1500 }],
            flightSegments: [{
                airlineName: 'China Eastern',
                duration: '3h',
                flightList: [{
                    flightNo: 'MU523',
                    departureDateTime: '2026-05-10 09:00:00'
                }]
            }]
        }
    ];
    const processed = scanner.processApiFlights(mockApiFlights, 'PVG', 'TYO', '2026-05-10');
    console.log('✅ OneWay Logic Result:', processed[0].airline, processed[0].price);

    // Save outbound to DB
    await scanner.saveToDB(processed);

    // Save an inbound manually for combination test
    const inboundMock = [{
        origin: 'TYO',
        destination: 'PVG',
        flight_date: '2026-05-15',
        price: 1200,
        airline: 'JAL',
        flight_number: 'JL891',
        departure_time: '14:00',
        duration: '3h',
        is_direct: 1,
        scrape_date: new Date().toISOString(),
        source: 'ctrip',
        month_key: '2026-05'
    }];
    await scanner.saveToDB(inboundMock);
    console.log('✅ Mocks saved to DB');

    // 4. Verify Combination Engine
    const engine = new CombinationEngine();
    const deals = await engine.generateCombinations();
    console.log('✅ Combination Engine Result:', deals.length, 'deals found');
    if (deals.length > 0) {
        console.log(`   Best Deal: PVG <-> TYO for ¥${deals[0].total_price} (${deals[0].gap_days} days)`);
    }

    console.log('--- LOGIC VERIFICATION COMPLETE ---');
    process.exit(0);
}

runMockTest().catch(console.error);
