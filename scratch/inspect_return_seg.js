const fs = require('fs');
const { chromium } = require('playwright');
async function testReturnClick() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
    const page = await context.newPage();
    let clicked = false;
    page.on('response', async (response) => {
        if (!clicked) return;
        const url = response.url();
        if (url.includes('/search/') || url.includes('flightItinerary')) {
            try {
                const text = await response.text();
                if (text.length > 1000) {
                    const body = JSON.parse(text);
                    if (body.data?.flightItineraryList?.length > 0) {
                        const first = body.data.flightItineraryList[0];
                        if (first.flightSegments && first.flightSegments.length > 1) {
                            const returnSeg = first.flightSegments[1].flightList[0];
                            console.log('Return flight segment keys:', Object.keys(returnSeg));
                            console.log('airlineName:', returnSeg.airlineName);
                            console.log('marketAirlineName:', returnSeg.marketAirlineName);
                            console.log('operatingAirlineName:', returnSeg.operatingAirlineName);
                            console.log('marketAirlineCode:', returnSeg.marketAirlineCode);
                            process.exit(0);
                        }
                    }
                }
            } catch(e) {}
        }
    });
    await page.goto('https://flights.ctrip.com/online/list/round-sha-tyo?depdate=2026-05-20_2026-05-25', { waitUntil: 'domcontentloaded' });
    try { await page.waitForSelector('.flight-item', { timeout: 15000 }); } catch(e) {}
    await page.waitForTimeout(3000);
    const items = await page.$$('.flight-item');
    if (items.length > 0) {
        const btn = await items[0].$('.btn-book, [class*="price"] button, .flight-operate .btn');
        if (btn) {
            clicked = true;
            await btn.click({ force: true });
            await page.waitForTimeout(6000);
        }
    }
    await browser.close();
}
testReturnClick().catch(console.error);
