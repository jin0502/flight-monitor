const CalendarScanner = require('../src/scanner/calendar-scanner');
const OneWayScanner = require('../src/scanner/oneway-scanner');
const CombinationEngine = require('../src/scanner/combination-engine');
const { initDB, getDB } = require('../src/db');
const { chromium } = require('playwright');
require('dotenv').config();

async function runTest() {
    console.log('--- STARTING INTEGRATION TEST ---');
    
    // 1. Init Database
    await initDB();
    console.log('✅ Database initialized');

    // 2. Launch Browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('✅ Browser launched');

    try {
        // 3. Test CalendarScanner
        const calendarScanner = new CalendarScanner(page);
        console.log('🔍 Testing CalendarScanner for TYO...');
        const cheapDates = await calendarScanner.findCheapDates('PVG', 'TYO');
        
        if (cheapDates.length === 0) {
            console.log('❌ No cheap dates found (Check network/API)');
        } else {
            console.log(`✅ Found ${cheapDates.length} cheap date candidates`);

            // 4. Test OneWayScanner
            const oneWayScanner = new OneWayScanner(page);
            console.log('🔍 Testing OneWayScanner for top candidates...');
            const candidatesToScrape = cheapDates.slice(0, 1); // Just 1 to be fast
            
            for (const date of candidatesToScrape) {
                console.log(`   Scraping PVG -> TYO on ${date}`);
                await oneWayScanner.scrapeDetailed('PVG', 'TYO', date);
                
                // Also scrape the return for combination test
                // We'll just fake a return date 5 days later
                const inDate = new Date(date);
                inDate.setDate(inDate.getDate() + 5);
                const inDateStr = inDate.toISOString().split('T')[0];
                console.log(`   Scraping TYO -> PVG on ${inDateStr}`);
                await oneWayScanner.scrapeDetailed('TYO', 'PVG', inDateStr);
            }
            console.log('✅ One-way scraping complete');

            // 5. Test CombinationEngine
            const engine = new CombinationEngine();
            console.log('🔍 Testing CombinationEngine...');
            const combinations = await engine.generateCombinations();
            console.log(`✅ Generated ${combinations.length} combinations`);

            if (combinations.length > 0) {
                console.log('🏆 Top Deal Found:');
                const deal = combinations[0];
                console.log(`   Price: ¥${deal.total_price}`);
                console.log(`   Route: PVG <-> ${deal.destination_code}`);
                console.log(`   Dates: ${deal.out_date} / ${deal.ret_date}`);
            }
        }
    } finally {
        await browser.close();
        console.log('✅ Browser closed');
    }

    console.log('--- TEST COMPLETE ---');
    process.exit(0);
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
