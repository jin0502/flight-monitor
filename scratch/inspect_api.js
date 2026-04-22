const { chromium } = require('playwright');

async function deepApiSearch() {
    const browser = await chromium.launch({ headless: true, args: ['--disable-http-cache'] });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        bypassCSP: true
    });
    const page = await context.newPage();
    
    // Disable cache
    await page.route('**/*', route => route.continue());
    
    let allPullResponses = [];
    
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/search/') && url.includes('pull')) {
            try {
                const text = await response.text();
                if (text.length > 10000) {
                    const body = JSON.parse(text);
                    if (body.data?.flightItineraryList?.length > 0) {
                        allPullResponses.push(body.data);
                        console.log(`Captured pull response: ${body.data.flightItineraryList.length} itineraries, ${text.length} chars`);
                    }
                }
            } catch(e) {}
        }
    });
    
    // Use different dates to avoid all caching
    await page.goto('https://flights.ctrip.com/online/list/round-sha-tyo?depdate=2026-06-10_2026-06-15', { waitUntil: 'domcontentloaded' });
    try { await page.waitForSelector('.flight-item', { timeout: 20000 }); } catch(e) {}
    
    // Wait for multiple pull cycles  
    for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(2000);
        if (allPullResponses.length > 0) break;
    }
    
    if (allPullResponses.length === 0) {
        console.log('No API data captured after extended wait');
        await browser.close();
        return;
    }
    
    const fullData = allPullResponses[allPullResponses.length - 1]; // latest
    const list = fullData.flightItineraryList;
    
    console.log(`\nAnalyzing ${list.length} itineraries...`);
    
    // Segment counts
    const segCounts = {};
    for (const item of list) {
        segCounts[item.flightSegments.length] = (segCounts[item.flightSegments.length] || 0) + 1;
    }
    console.log('Segment counts:', segCounts);
    
    // First 3 itineraries detailed
    for (let i = 0; i < Math.min(3, list.length); i++) {
        const item = list[i];
        console.log(`\n[${i}] ${item.itineraryId}`);
        for (const seg of item.flightSegments) {
            for (const f of seg.flightList) {
                console.log(`  Seg${seg.segmentNo}: ${f.flightNo} ${f.departureAirportCode}->${f.arrivalAirportCode} ${f.departureDateTime}`);
            }
        }
        // Price segment info
        if (item.priceList?.[0]?.priceUnitList?.[0]?.flightSeatList) {
            console.log(`  Seats:`, item.priceList[0].priceUnitList[0].flightSeatList.map(s => `seg${s.segmentNo}:seq${s.sequenceNo}`));
        }
    }
    
    // All keys on first itinerary
    console.log('\nFirst itinerary keys:', Object.keys(list[0]));
    
    // DOM IDs
    const domIds = await page.evaluate(() => {
        return [...document.querySelectorAll('.flight-item')].slice(0, 5).map(el => {
            const id = el.querySelector('[id*="airlineName"]')?.id;
            return id;
        });
    });
    console.log('\nDOM IDs:', domIds);
    
    // Suffix analysis
    for (const domId of domIds) {
        if (!domId) continue;
        const match = domId.match(/airlineName(.+)-(\d+)$/);
        if (match) console.log(`  ${match[1]} suffix=${match[2]}`);
    }
    
    await browser.close();
}

deepApiSearch().catch(console.error);
