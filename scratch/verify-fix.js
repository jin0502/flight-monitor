const { chromium } = require('playwright');
const CalendarScanner = require('../src/scanner/calendar-scanner');

async function verifyFix() {
    console.log('--- VERIFYING FIX (PVG -> TYO) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const scanner = new CalendarScanner(page);
    
    try {
        const dates = await scanner.findCheapDates('PVG', 'TYO');
        console.log('\n--- VERIFICATION RESULTS ---');
        console.log('Cheapest dates found:', dates);
        
        if (dates.length > 0) {
            console.log('✅ SUCCESS: Scanner successfully extracted dates!');
        } else {
            console.log('❌ FAILURE: Still no dates found.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

verifyFix();
