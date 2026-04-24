const { chromium } = require('playwright');

async function debugBatchSearch() {
    console.log('--- DEBUG BATCHSEARCH (PVG -> CAN) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('batchSearch')) {
            try {
                const body = await response.json();
                console.log(`Captured batchSearch! Keys: ${Object.keys(body).join(', ')}`);
                if (body.data) console.log(`Data Keys: ${Object.keys(body.data).join(', ')}`);
                
                // Let's find where the list is
                const findList = (obj, depth = 0) => {
                    if (depth > 3) return;
                    for (const key in obj) {
                        if (key.toLowerCase().includes('list') && Array.isArray(obj[key])) {
                            console.log(`Found list candidate: ${key} (length: ${obj[key].length})`);
                        }
                        if (typeof obj[key] === 'object' && obj[key] !== null) {
                            findList(obj[key], depth + 1);
                        }
                    }
                };
                findList(body);
            } catch (e) {}
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-can?depdate=2026-06-15', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(10000);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

debugBatchSearch();
