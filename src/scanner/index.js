const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DirectCalendarScanner = require('./direct-calendar-scanner');
const OneWayScanner = require('./oneway-scanner');
const CombinationEngine = require('./combination-engine');
const airports = require('../data/airports');
const database = require('../db');

async function runFullScan(targetOrigin = 'PVG', targetDest = null) {
    console.log(`[Orchestrator] Starting scan cycle. Origin: ${targetOrigin}, Destination: ${targetDest || 'ALL'}`);
    
    const isHeadless = process.argv.includes('--headless');
    console.log(`[Orchestrator] Browser Mode: ${isHeadless ? 'HEADLESS' : 'VISIBLE'}`);

    let context;
    try {
        const userDataDir = path.join(process.cwd(), 'data/ctrip_session');
        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

        context = await chromium.launchPersistentContext(userDataDir, {
            headless: isHeadless,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                '--disable-dev-shm-usage'
            ]
        });
        const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

        // Initialize Scanners
        const directScanner = new DirectCalendarScanner();
        const onewayScanner = new OneWayScanner(page);
        const combinationEngine = new CombinationEngine();

        // Filter airports if targetDest is specified
        const finalAirports = targetDest 
            ? airports.filter(a => a.code.toUpperCase() === targetDest.toUpperCase())
            : airports;

        // 1. & 2. Scan all airports
        for (const airport of finalAirports) {
            console.log(`[Orchestrator] Processing airport: ${airport.name} (${airport.code})`);
            
            // --- OUTBOUND ---
            let outDates = await directScanner.findCheapDates(targetOrigin, airport.code);
            if (!outDates) outDates = [];

            console.log(`[Orchestrator] Starting Phase 2 (Outbound) for ${outDates.length} dates...`);
            for (const priceItem of outDates) {
                const details = await onewayScanner.scrapeDetailed(targetOrigin, airport.code, priceItem.date);
                for (const flight of details) {
                    await database.saveFlight({
                        origin: targetOrigin,
                        dest: airport.code,
                        date: priceItem.date,
                        flight_no: flight.flightNo,
                        airline: flight.airline,
                        depart_time: flight.departTime,
                        arrival_time: flight.arrivalTime,
                        price: flight.isFallback ? priceItem.price : flight.price
                    });
                }
                await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
            }

            // --- INBOUND ---
            let inDates = await directScanner.findCheapDates(airport.code, targetOrigin);
            if (!inDates) inDates = [];

            console.log(`[Orchestrator] Starting Phase 2 (Inbound) for ${inDates.length} dates...`);
            for (const priceItem of inDates) {
                const details = await onewayScanner.scrapeDetailed(airport.code, targetOrigin, priceItem.date);
                for (const flight of details) {
                    await database.saveFlight({
                        origin: airport.code,
                        dest: targetOrigin,
                        date: priceItem.date,
                        flight_no: flight.flightNo,
                        airline: flight.airline,
                        depart_time: flight.departTime,
                        arrival_time: flight.arrivalTime,
                        price: flight.isFallback ? priceItem.price : flight.price
                    });
                }
                await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
            }
        }

        // 3. Generate Combinations
        const topDeals = await combinationEngine.generateCombinations();
        console.log(`[Orchestrator] Scan complete. Found ${topDeals.length} top deals to alert.`);
        return topDeals;

    } catch (err) {
        console.error('[Orchestrator] Critical error during scan:', err);
        return [];
    } finally {
        if (context) await context.close();
    }
}

module.exports = { runFullScan };
