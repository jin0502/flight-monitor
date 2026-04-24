const { chromium } = require('playwright');

async function peekData() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('response', async (response) => {
        if (response.url().includes('LowestPriceSearch')) {
            const json = await response.json();
            const list = json.priceList || json.data?.priceList;
            if (list) {
                console.log('ITEM KEYS:', Object.keys(list[0]));
                console.log('ITEM SAMPLE:', list[0]);
            }
        }
    });
    await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-tyo?depdate=2026-05-25');
    await page.waitForTimeout(10000);
    await browser.close();
}
peekData();
