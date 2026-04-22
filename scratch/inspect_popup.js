const { chromium } = require('playwright');

async function extractReturnFromComfort() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Intercept the comfort API calls which contain BOTH outbound and return flight info
    const comfortData = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('getComfortTagList') || url.includes('getFlightComfort')) {
            try {
                const body = await response.json();
                comfortData.push({ url: url.substring(0, 100), data: body.data });
            } catch(e) {}
        }
    });
    
    await page.goto('https://flights.ctrip.com/online/list/round-sha-tyo?depdate=2026-05-20_2026-05-25', { waitUntil: 'domcontentloaded' });
    
    try { await page.waitForSelector('.flight-item', { timeout: 15000 }); } catch(e) {}
    await page.waitForTimeout(5000);
    
    console.log('=== Comfort API Data ===');
    console.log(`Captured ${comfortData.length} comfort API responses\n`);
    
    for (const c of comfortData) {
        console.log(`URL: ${c.url}`);
        if (Array.isArray(c.data)) {
            // Batch comfort tag list
            console.log(`  ${c.data.length} entries:`);
            for (const entry of c.data.slice(0, 5)) {
                console.log(`    ${entry.flightNo} ${entry.departureCityCode}->${entry.arrivalCityCode}`);
            }
        } else {
            console.log(`  ${JSON.stringify(c.data).substring(0, 200)}`);
        }
        console.log('');
    }
    
    // Now hover over or interact with the comfort info icons on each item
    const items = await page.$$('.flight-item');
    console.log(`\nFound ${items.length} flight items`);
    
    for (let i = 0; i < Math.min(3, items.length); i++) {
        // Look for the comfort popup data in hidden elements
        const comfortInfo = await items[i].evaluate(el => {
            const popups = el.querySelectorAll('.popup-comfortinfo .airline .name, [class*="comfort"] .name');
            return [...popups].map(p => p.textContent.trim());
        });
        
        if (comfortInfo.length > 0) {
            console.log(`\nItem ${i+1} comfort names: ${comfortInfo.join(' | ')}`);
        }
    }
    
    // Also check: are the comfort popups pre-rendered with both flight infos?
    const allComfortPopups = await page.evaluate(() => {
        const popups = document.querySelectorAll('.popup-comfortinfo');
        return [...popups].map((p, i) => ({
            index: i,
            visible: p.offsetHeight > 0,
            text: p.innerText.substring(0, 200),
            airlines: [...p.querySelectorAll('.airline .name')].map(n => n.textContent.trim())
        }));
    });
    
    console.log(`\n=== Pre-rendered Comfort Popups: ${allComfortPopups.length} ===`);
    for (const p of allComfortPopups) {
        console.log(`Popup ${p.index} (visible: ${p.visible}): ${p.airlines.join(' + ')}`);
    }
    
    await browser.close();
}

extractReturnFromComfort().catch(console.error);
