const { chromium } = require('playwright');

async function checkDomesticApi() {
    console.log('--- CHECKING DOMESTIC API URL (PVG -> PEK) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api') || url.includes('soa2')) {
            console.log(`Potential API: ${url}`);
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-pek?depdate=2026-06-15', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

checkDomesticApi();
