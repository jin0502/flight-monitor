const { chromium } = require('playwright');

async function debugDomestic() {
    console.log('--- DEBUG DOMESTIC (PVG -> CAN) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let capturedData = null;
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('LowestPriceSearch') || url.includes('/getLowPrice') || url.includes('/getlowpricecalendar')) {
            try {
                capturedData = await response.json();
                console.log(`Captured API: ${url}`);
            } catch (e) {}
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-can?depdate=2026-05-22', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);
        
        if (capturedData) {
            const list = capturedData.lowPriceList || capturedData.data?.lowPriceList || capturedData.priceList;
            if (list && list.length > 0) {
                console.log(`Total items: ${list.length}`);
                console.log('First item structure:', JSON.stringify(list[0], null, 2));
            } else {
                console.log('API found but list is empty.');
            }
        } else {
            console.log('No API captured.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

debugDomestic();
