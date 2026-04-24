const { chromium } = require('playwright');

async function peekKul() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('response', async (response) => {
        if (response.url().includes('LowestPriceSearch') || response.url().includes('getLowPrice')) {
            const json = await response.json();
            const list = json.priceList || json.data?.priceList || json.data?.lowPriceList;
            if (list && list.length > 0) {
                console.log('KUL SAMPLE:', list[0]);
            }
        }
    });
    await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-kul?depdate=2026-05-25');
    await page.waitForTimeout(10000);
    await browser.close();
}
peekKul();
