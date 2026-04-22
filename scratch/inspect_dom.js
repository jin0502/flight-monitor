const { chromium } = require('playwright');

async function inspectDom() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto('https://flights.ctrip.com/online/list/round-sha-tyo?depdate=2026-05-20_2026-05-25', { waitUntil: 'domcontentloaded' });
    
    try {
        await page.waitForSelector('.flight-item, .search-result-item, .search_flight_item, [class*="FlightItem"]', { timeout: 15000 });
    } catch(e) {
        console.log('Selector timeout, continuing anyway...');
    }
    
    // Wait a bit more for dynamic content
    await page.waitForTimeout(3000);
    
    const inspection = await page.evaluate(() => {
        const items = document.querySelectorAll('.flight-item, .search-result-item, .search_flight_item, [class*="FlightItem"]');
        const results = [];
        
        for (let i = 0; i < Math.min(3, items.length); i++) {
            const el = items[i];
            
            // All IDs inside this element
            const allIds = [...el.querySelectorAll('[id]')].map(e => e.id);
            
            // All data-* attributes
            const dataEls = [...el.querySelectorAll('*')].filter(e => 
                [...e.attributes].some(a => a.name.startsWith('data-'))
            ).map(e => ({
                tag: e.tagName,
                className: e.className.toString().substring(0, 80),
                data: Object.fromEntries(
                    [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value.substring(0, 200)])
                )
            }));
            
            // Flight numbers found in text
            const text = el.textContent;
            const flightNos = text.match(/[A-Z][A-Z0-9]\d{2,4}/g);
            
            // All anchor hrefs
            const links = [...el.querySelectorAll('a[href]')].map(a => ({ href: a.href.substring(0, 200), text: a.textContent.trim().substring(0, 50) }));
            
            // Airline name elements
            const airlineEls = [...el.querySelectorAll('[class*="airline"]')].map(e => ({ class: e.className.toString().substring(0, 80), text: e.textContent.trim().substring(0, 50) }));
            
            // Time elements
            const timeEls = [...el.querySelectorAll('[class*="time"]')].map(e => ({ class: e.className.toString().substring(0, 80), text: e.textContent.trim().substring(0, 30) }));
            
            // First 2000 chars of outerHTML
            const htmlSnippet = el.outerHTML.substring(0, 2000);
            
            results.push({
                index: i,
                className: el.className.toString().substring(0, 100),
                allIds,
                dataElements: dataEls.slice(0, 10),
                flightNosInText: flightNos,
                links: links.slice(0, 5),
                airlineEls,
                timeEls: timeEls.slice(0, 6),
                htmlSnippet
            });
        }
        return results;
    });
    
    console.log(JSON.stringify(inspection, null, 2));
    
    await browser.close();
}

inspectDom().catch(console.error);
