const { chromium } = require('playwright');
const path = require('path');
const CtripScraper = require(path.resolve(__dirname, '../src/scraper/providers/ctrip'));

async function testCtripRoundTrip() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    const scraper = new CtripScraper();
    await scraper.initWithPage(page);
    
    console.log('Starting Round-Trip scrap test (Ctrip)...');
    
    const results = await scraper.scrape('SHA', 'TYO', '2026-05-20', '2026-05-25');
    
    if (results.length > 0) {
        console.log(`\n--- Found ${results.length} Flight Options ---`);
        
        // Show Top 5
        results.slice(0, 5).forEach((flight, i) => {
            console.log(`\n[Option ${i+1}] ${flight.airline}`);
            console.log(`  Price: ¥${flight.price} (Round-Trip Combination)`);
            console.log(`  Outbound: ${flight.flightNumber} departs ${flight.departureTime}`);
            console.log(`  Airport: ${flight.departureAirportCode || 'PVG'} → ${flight.arrivalAirportCode || flight.destinationAirport}`);
            if (flight.returnFlightNumber) {
                console.log(`  Return: ${flight.returnFlightNumber} departs ${flight.returnDepartureTime}`);
            } else {
                console.log(`  Return: (auto-selected by Ctrip for best price)`);
            }
        });

        const flight = results[0]; // Cheapest
        
        console.log('\n--- Notification Preview (Cheapest) ---');
        const now = new Date();
        const gmt8 = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');
        const scrapedAt = gmt8.replace('T', ' ').substring(0, 16);
        
        let msg = `🚀 <b>Flight Alert!</b>\n\n`;
        msg += `📍 <b>Route:</b> ${flight.departureAirportCode || 'PVG'} ✈️ ${flight.arrivalAirportCode || flight.destinationAirport}\n`;
        msg += `💰 <b>Price:</b> <b>¥${flight.price}</b> (Round-Trip)\n`;
        msg += `📅 <b>Date:</b> 2026-05-20\n`;
        msg += `⏰ <b>Takeoff:</b> ${flight.departureTime}\n`;
        msg += `🔢 <b>Flight No:</b> ${flight.flightNumber}\n`;
        msg += `🏢 <b>Airline:</b> ${flight.airline}\n\n`;
        msg += `\n--- <b>RETURN FLIGHT</b> ---\n`;
        msg += `📅 <b>Date:</b> 2026-05-25\n`;
        msg += `⏰ <b>Takeoff:</b> ${flight.returnDepartureTime || '(auto-selected)'}\n`;
        msg += `🔢 <b>Flight No:</b> ${flight.returnFlightNumber || '(auto-selected)'}\n`;
        msg += `🏢 <b>Airline:</b> ${flight.returnAirline || '(auto-selected)'}\n\n`;
        msg += `⚠️ <b>Type:</b> THRESHOLD\n`;
        msg += `📅 <b>Scraped At:</b> ${scrapedAt}`;
        
        console.log(msg);
    } else {
        console.log('No results found.');
    }
    
    await browser.close();
}

testCtripRoundTrip().catch(console.error);
