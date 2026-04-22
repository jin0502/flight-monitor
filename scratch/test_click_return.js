const { chromium } = require('playwright');

async function testReturnClick() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let clicked = false;
    let urls = [];
    
    page.on('response', async (response) => {
        if (!clicked) return;
        const url = response.url();
        if (url.includes('/search/') || url.includes('flightItinerary')) {
            urls.push(url.substring(0, 100));
            try {
                const text = await response.text();
                if (text.length > 1000) {
                    const body = JSON.parse(text);
                    if (body.data?.flightItineraryList?.length > 0) {
                        const first = body.data.flightItineraryList[0];
                        if (first.flightSegments && first.flightSegments.length > 1) {
                            console.log(`\nFound round-trip data in URL: ${url}`);
                            const best = body.data.flightItineraryList.sort((a, b) => (a.priceList[0]?.adultPrice || 99999) - (b.priceList[0]?.adultPrice || 99999))[0];
                            const outboundSeg = best.flightSegments[0].flightList[0];
                            const returnSeg = best.flightSegments[1].flightList[0];
                            console.log(`Price: ¥${best.priceList[0]?.adultPrice}`);
                            console.log(`OUT: ${outboundSeg.flightNo}`);
                            console.log(`RET: ${returnSeg.flightNo} ${returnSeg.departureDateTime}`);
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
            
            console.log('\nAPIs called after click:');
            console.log([...new Set(urls)].join('\n'));
        }
    }
    await browser.close();
}

testReturnClick().catch(console.error);
