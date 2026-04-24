const { chromium } = require('playwright');
const CalendarScanner = require('../src/scanner/calendar-scanner');

async function testLiveCalendarAPI() {
    console.log('--- STARTING LIVE CALENDAR API TEST ---');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    const scanner = new CalendarScanner(page);
    const { start } = scanner.getScanHorizon();
    const origin = 'PVG';
    const destination = 'TYO';
    const url = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${start}`;
    
    console.log(`Target URL: ${url}`);
    console.log(`Looking for flights starting from: ${start}`);

    let capturedRaw = null;
    let apiUrl = null;

    page.on('response', async (response) => {
        const u = response.url();
        if (u.includes('/lowestPrice') || u.includes('/getLowPrice') || u.includes('/getlowpricecalendar')) {
            console.log(`\n[API FOUND] ${u}`);
            apiUrl = u;
            try {
                capturedRaw = await response.json();
                console.log('[API STATUS] Success (JSON received)');
            } catch (e) {
                console.log('[API STATUS] Failed to parse JSON');
            }
        }
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        console.log('\nPage loaded. Waiting for background APIs...');
        await page.waitForTimeout(5000);

        if (!capturedRaw) {
            console.log('\n[FALLBACK] Attempting to click calendar bar...');
            const trigger = await page.$('[class*="lowPriceBar"], [class*="calendar"], .low-price-bar');
            if (trigger) {
                await trigger.click();
                await page.waitForTimeout(5000);
            }
        }

        if (capturedRaw) {
            console.log('\n--- TEST RESULTS ---');
            console.log(`API URL: ${apiUrl}`);
            
            let list = capturedRaw.result?.lowPriceList || capturedRaw.data?.lowPriceList || capturedRaw.lowPriceList;
            
            if (list && list.length > 0) {
                console.log(`Total dates found: ${list.length}`);
                console.log('Sample data (first 3):');
                console.log(JSON.stringify(list.slice(0, 3), null, 2));
                
                const processed = scanner.processCalendarData(list);
                console.log(`\nProcessed Top Dates (within 4wk-6mo window): ${processed.length}`);
                console.log(processed.slice(0, 10).join(', ') + (processed.length > 10 ? '...' : ''));
            } else {
                console.log('API returned empty or unexpected structure.');
                console.log('Raw response keys:', Object.keys(capturedRaw));
            }
        } else {
            console.log('\n❌ No calendar API intercepted. The page might be using a different endpoint or blocked our request.');
        }

    } catch (err) {
        console.error(`\n❌ Error: ${err.message}`);
    } finally {
        await browser.close();
        console.log('\n--- TEST COMPLETE ---');
    }
}

testLiveCalendarAPI();
