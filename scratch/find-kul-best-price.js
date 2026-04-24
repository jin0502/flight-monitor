const { chromium } = require('playwright');

async function findKulBestPrice() {
    console.log('--- SCANNING PVG -> KUL BEST PRICES ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let rawList = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('LowestPriceSearch') || url.includes('getLowPrice')) {
            try {
                const json = await response.json();
                const list = json.priceList || json.data?.lowPriceList || json.result?.lowPriceList || json.lowPriceList;
                if (list) rawList = list;
            } catch (e) {}
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-kul?depdate=2026-05-25');
        await page.waitForTimeout(10000);

        if (rawList.length > 0) {
            const months = {};
            rawList.forEach(item => {
                const rawDate = item.date || item.dDate || item.departDate;
                let dateStr;
                
                if (!rawDate) return;

                if (rawDate.includes('/Date')) {
                    const ts = parseInt(rawDate.match(/\d+/)[0]);
                    const d = new Date(ts);
                    dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                } else {
                    dateStr = rawDate;
                }

                const price = item.price || item.adultPrice;
                if (!price || price === 0) return;

                const m = dateStr.substring(0, 7);
                if (!months[m]) months[m] = [];
                months[m].push({ date: dateStr, price });
            });

            console.log('\n--- PVG -> KUL MONTHLY BEST PRICES ---');
            Object.keys(months).sort().forEach(m => {
                const sorted = months[m].sort((a, b) => a.price - b.price);
                const best = sorted[0];
                console.log(`${m}: ${best.price}¥ (on ${best.date})`);
            });

        } else {
            console.log('❌ Failed to capture data.');
        }
    } finally {
        await browser.close();
    }
}

findKulBestPrice();
