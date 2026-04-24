const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureRawData() {
    console.log('--- CAPTURING RAW CALENDAR DATA ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let captured = null;

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('LowestPriceSearch') || url.includes('getLowPrice')) {
            try {
                const json = await response.json();
                captured = json;
                console.log(`Captured API: ${url.split('?')[0]}...`);
            } catch (e) {}
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-tyo?depdate=2026-05-25');
        await page.waitForTimeout(10000);

        if (captured) {
            const outputPath = path.join(__dirname, 'raw_api_data.json');
            // We'll save just a subset if it's huge, but typically it's a few hundred entries
            fs.writeFileSync(outputPath, JSON.stringify(captured, null, 2));
            console.log(`Success! Raw data saved to ${outputPath}`);
        } else {
            console.log('Failed to capture API response.');
        }
    } finally {
        await browser.close();
    }
}

captureRawData();
