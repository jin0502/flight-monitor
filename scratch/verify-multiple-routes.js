const { chromium } = require('playwright');

const routes = [
    { from: 'PVG', to: 'PEK', type: 'domestic' },
    { from: 'PVG', to: 'CTU', type: 'domestic' },
    { from: 'PVG', to: 'NRT', type: 'intl' },
    { from: 'PVG', to: 'ICN', type: 'intl' }
];

async function verifyRoutes() {
    const browser = await chromium.launch({ headless: true });
    
    for (const route of routes) {
        console.log(`\n--- VERIFYING ${route.from} -> ${route.to} (${route.type.toUpperCase()}) ---`);
        const context = await browser.newContext();
        const page = await context.newPage();
        
        let calendarValid = false;
        let detailedValid = false;
        let detailedLocation = 'None';
        let calendarResponses = 0;

        page.on('response', async (response) => {
            const url = response.url();
            
            // Check Calendar
            if (url.includes('LowestPriceSearch')) {
                calendarResponses++;
                try {
                    const body = await response.json();
                    const list = body.lowPriceList || body.data?.lowPriceList || body.priceList;
                    if (list && list.some(i => (i.price || i.adultPrice) > 0)) {
                        calendarValid = true;
                    }
                } catch (e) {}
            }

            // Check Detailed
            if (url.includes('/getFlightList') || url.includes('/search/pull/')) {
                try {
                    const body = await response.json();
                    const rootList = body.flightItineraryList;
                    const dataList = body.data?.flightItineraryList;
                    const resultList = body.result?.flightItineraryList;

                    if (rootList?.length > 0) { detailedValid = true; detailedLocation = 'Root'; }
                    else if (dataList?.length > 0) { detailedValid = true; detailedLocation = 'Data'; }
                    else if (resultList?.length > 0) { detailedValid = true; detailedLocation = 'Result'; }
                } catch (e) {}
            }
        });

        try {
            const depDate = '2026-06-15';
            const url = `https://flights.ctrip.com/online/list/oneway-${route.from.toLowerCase()}-${route.to.toLowerCase()}?depdate=${depDate}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(10000); // Wait for all pulls
            
            console.log(`Calendar Responses: ${calendarResponses}`);
            console.log(`Calendar has valid prices: ${calendarValid}`);
            console.log(`Detailed flights found: ${detailedValid} (at ${detailedLocation})`);
        } catch (err) {
            console.error(`Error on ${route.to}:`, err.message);
        } finally {
            await context.close();
        }
    }
    
    await browser.close();
}

verifyRoutes();
