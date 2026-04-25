const { chromium } = require('playwright');
const CalendarScanner = require('./calendar-scanner');
const OneWayScanner = require('./oneway-scanner');
const CombinationEngine = require('./combination-engine');
const airports = require('../data/airports');

async function runFullScan(targetOrigin = 'PVG', targetDest = null) {
    console.log(`[Orchestrator] Starting scan cycle. Origin: ${targetOrigin}, Destination: ${targetDest || 'ALL'}`);
    
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }
        });
        const page = await context.newPage();

        const calendarScanner = new CalendarScanner(page);
        const onewayScanner = new OneWayScanner(page);
        const combinationEngine = new CombinationEngine();

        // Filter airports if targetDest is specified
        const scanAirports = targetDest 
            ? airports.filter(a => a.code.toUpperCase() === targetDest.toUpperCase())
            : airports;

        if (scanAirports.length === 0 && targetDest) {
            console.warn(`[Orchestrator] Target destination ${targetDest} not found in airport list. Scanning all.`);
        }

        const finalAirports = scanAirports.length > 0 ? scanAirports : airports;

        // 1. & 2. Scrutinize all airports (Outbound and Return)
        for (const airport of finalAirports) {
            console.log(`[Orchestrator] Processing airport: ${airport.name} (${airport.code})`);
            
            // Outbound: Origin -> Destination
            const outDates = await calendarScanner.findCheapDates(targetOrigin, airport.code);
            for (const date of outDates) {
                await onewayScanner.scrapeDetailed(targetOrigin, airport.code, date);
            }

            // Inbound: Destination -> Origin
            const inDates = await calendarScanner.findCheapDates(airport.code, targetOrigin);
            for (const date of inDates) {
                await onewayScanner.scrapeDetailed(airport.code, targetOrigin, date);
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
        if (browser) await browser.close();
    }
}

module.exports = { runFullScan };
