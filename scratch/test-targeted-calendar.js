const { chromium } = require('playwright');

async function testTargetedCalendarAPI() {
    console.log('--- LIVE CALENDAR API TEST (PVG -> TYO) ---');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let capturedData = null;
    let apiUrl = null;

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('LowestPriceSearch') || url.includes('/getLowPrice')) {
            apiUrl = url.split('?')[0];
            try {
                capturedData = await response.json();
            } catch (e) {}
        }
    });

    try {
        const url = 'https://flights.ctrip.com/online/list/oneway-pvg-tyo?depdate=2026-05-25';
        console.log(`Navigating to: ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        if (capturedData) {
            console.log('\n--- API TEST SUCCESS ---');
            console.log(`Endpoint: ${apiUrl}`);
            
            const list = capturedData.lowPriceList || capturedData.data?.lowPriceList || capturedData.priceList;
            
            if (list && list.length > 0) {
                console.log(`Total data points: ${list.length}`);
                
                const sample = list.filter(i => i.price || i.adultPrice).slice(0, 3).map(item => ({
                    date: item.date || item.dDate,
                    price: item.price || item.adultPrice,
                    is_direct: item.isDirect || true
                }));
                console.log('\n[Sample Record Detail]');
                console.log(JSON.stringify(sample, null, 2));

                const { start } = getScanHorizon();
                console.log(`\nScan starts at: ${start}`);
                const filtered = list.filter(item => {
                    const d = item.date || item.dDate;
                    return d && d >= start;
                });
                console.log(`Filtered dates (>= start): ${filtered.length}`);
            }
        } else {
            console.log('\n❌ No API intercepted.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
        console.log('\n--- TEST COMPLETE ---');
    }
}

function getScanHorizon() {
    const now = new Date();
    const startDate = new Date(now.getTime() + (28 * 24 * 60 * 60 * 1000));
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDate(startDate) };
}

testTargetedCalendarAPI();
