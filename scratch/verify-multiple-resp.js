const { chromium } = require('playwright');

async function verifyMultipleCalendarResponses() {
    console.log('--- VERIFYING MULTIPLE RESPONSES (PVG -> CAN) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let responseCount = 0;
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('LowestPriceSearch')) {
            responseCount++;
            try {
                const body = await response.json();
                const list = body.lowPriceList || body.data?.lowPriceList || body.priceList;
                const hasPrice = list && list.some(i => (i.price || i.adultPrice) > 0);
                console.log(`Response #${responseCount}: ${list ? list.length : 0} items. Has valid prices: ${hasPrice}`);
            } catch (e) {}
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-can?depdate=2026-05-22', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(10000);
        console.log(`Total LowestPriceSearch responses intercepted: ${responseCount}`);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

verifyMultipleCalendarResponses();
