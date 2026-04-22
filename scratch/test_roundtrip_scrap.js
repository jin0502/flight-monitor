const TripDotComScraper = require('../src/scraper/providers/trip-dot-com');
const { chromium } = require('playwright');
const path = require('path');

async function testRoundTripScrap() {
    console.log('Starting real Round-Trip scrap test (Trip.com)...');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const scraper = new TripDotComScraper();
    await scraper.initWithPage(page);
    
    // Search PVG -> TYO (Tokyo) which often has round-trip results
    // May 20-25, 2026
    const results = await scraper.scrape('PVG', 'TYO', '2026-05-20', '2026-05-25');
    
    if (results.length > 0) {
        const flight = results[0];
        console.log('\n--- Scraped Flight (Round Trip) ---');
        console.log(`Airline: ${flight.airline}`);
        console.log(`Price: ¥${flight.price}`);
        console.log(`Outbound: ${flight.flightNumber} at ${flight.departureTime}`);
        console.log(`Return: ${flight.returnFlightNumber} at ${flight.returnDepartureTime}`);
        
        // Mock the notification structure
        let alertMsg = `🚀 <b>Flight Alert!</b>\n\n`;
        alertMsg += `📍 <b>Route:</b> Shanghai ✈️ Tokyo\n`;
        alertMsg += `💰 <b>Price:</b> <b>¥${flight.price}</b>\n`;
        alertMsg += `📅 <b>Date:</b> 2026-05-20\n`;
        alertMsg += `⏰ <b>Takeoff:</b> ${flight.departureTime}\n`;
        alertMsg += `🔢 <b>Flight No:</b> ${flight.flightNumber}\n`;
        
        alertMsg += `\n🔄 <b>Return Flight:</b>\n`;
        alertMsg += `📅 <b>Date:</b> 2026-05-25\n`;
        alertMsg += `⏰ <b>Takeoff:</b> ${flight.returnDepartureTime}\n`;
        alertMsg += `🔢 <b>Flight No:</b> ${flight.returnFlightNumber}\n`;
        
        alertMsg += `\n🏢 <b>Airline:</b> ${flight.airline}\n\n`;
        alertMsg += `⚠️ <b>Type:</b> THRESHOLD`;
        
        console.log('\n--- Notification Structure ---');
        console.log(alertMsg);
    } else {
        console.log('No flights found.');
    }
    
    await browser.close();
}

testRoundTripScrap().catch(console.error);
