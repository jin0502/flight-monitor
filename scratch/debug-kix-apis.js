const { chromium } = require('playwright');

async function debugKixApis() {
    console.log('--- DEBUG KIX APIS (PVG -> KIX) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('batchSearch') || url.includes('search/pull') || url.includes('getFlightList')) {
            try {
                const body = await response.json();
                console.log(`API: ${url.split('?')[0]}`);
                
                const findList = (obj, path = '') => {
                    if (!obj || typeof obj !== 'object') return;
                    for (const key in obj) {
                        const currentPath = path ? `${path}.${key}` : key;
                        if (key.toLowerCase().includes('list') && Array.isArray(obj[key]) && obj[key].length > 0) {
                            console.log(`  Found list: ${currentPath} (length: ${obj[key].length})`);
                        }
                        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                            findList(obj[key], currentPath);
                        }
                    }
                };
                findList(body);
            } catch (e) {}
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-kix?depdate=2026-05-25', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(15000); // Wait longer
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

debugKixApis();
