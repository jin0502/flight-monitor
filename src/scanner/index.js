const { chromium } = require('playwright');
const CalendarScanner = require('./calendar-scanner');
const OneWayScanner = require('./oneway-scanner');
const CombinationEngine = require('./combination-engine');
const airports = require('../data/airports');

async function runFullScan() {
    console.log('[Orchestrator] Starting full scan cycle...');
    
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        const calendarScanner = new CalendarScanner(page);
        const onewayScanner = new OneWayScanner(page);
        const combinationEngine = new CombinationEngine();

        // 1. & 2. Scrutinize all airports (Outbound and Return)
        for (const airport of airports) {
            console.log(`[Orchestrator] Processing airport: ${airport.name} (${airport.code})`);
            
            // Outbound: PVG -> X
            const outDates = await calendarScanner.findCheapDates('PVG', airport.code);
            for (const date of outDates) {
                await onewayScanner.scrapeDetailed('PVG', airport.code, date);
            }

            // Inbound: X -> PVG
            const inDates = await calendarScanner.findCheapDates(airport.code, 'PVG');
            for (const date of inDates) {
                await onewayScanner.scrapeDetailed(airport.code, 'PVG', date);
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
