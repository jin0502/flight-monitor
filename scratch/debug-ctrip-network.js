const { chromium } = require('playwright');

async function debugCtripNetwork() {
    console.log('--- CTRIP NETWORK DEBUG ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Log ALL fetch/xhr requests
    page.on('request', request => {
        const url = request.url();
        if (url.includes('api') || url.includes('Price') || url.includes('calendar')) {
            console.log(`>> [REQ] ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
        }
    });

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('lowestPrice') || url.includes('getLowPrice')) {
            console.log(`<< [RES] ${url}`);
            try {
                const json = await response.json();
                console.log('   [DATA FOUND] Keys:', Object.keys(json));
                if (json.data) console.log('   [DATA.DATA] Keys:', Object.keys(json.data));
            } catch (e) {
                console.log('   [ERROR] Could not parse JSON');
            }
        }
    });

    try {
        const url = 'https://flights.ctrip.com/online/list/oneway-pvg-tyo?depdate=2026-05-25';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // Wait for different interaction points
        console.log('Waiting for network activity...');
        await page.waitForTimeout(10000);

        // Try to hover over the calendar bar
        console.log('Hovering over calendar bar...');
        await page.hover('[class*="lowPriceBar"]').catch(() => console.log('LowPriceBar not found'));
        await page.waitForTimeout(3000);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
        console.log('--- DEBUG COMPLETE ---');
    }
}

debugCtripNetwork();
