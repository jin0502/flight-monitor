const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DirectCalendarScanner = require('./direct-calendar-scanner');
const OneWayScanner = require('./oneway-scanner');
const CombinationEngine = require('./combination-engine');
const airports = require('../data/airports');
const database = require('../db');
const { USER_AGENT } = require('../utils/config');

async function runFullScan(targetOrigin = 'PVG', targetDest = null) {
    console.log(`[Orchestrator] Starting scan cycle. Origin: ${targetOrigin}, Destination: ${targetDest || 'ALL'}`);
    
    let isHeadless = process.env.HEADLESS === 'true' || process.argv.includes('--headless');
    if (process.env.HEADLESS === undefined && process.platform === 'linux' && !process.env.DISPLAY) {
        isHeadless = true;
    }
    
    console.log(`[Orchestrator] Browser Mode: ${isHeadless ? 'HEADLESS' : 'VISIBLE'}`);

    let browser;
    try {
        browser = await chromium.launch({
            headless: isHeadless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const context = await browser.newContext({
            userAgent: USER_AGENT,
            viewport: { width: 1280, height: 720 }
        });

        // LOAD COOKIES MANUALLY FROM JSON
        const cookiesPath = path.join(process.cwd(), 'data/cookies.json');
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await context.addCookies(cookies);
            console.log(`[Orchestrator] Manually loaded ${cookies.length} cookies from JSON.`);
        } else {
            console.log('[Orchestrator] WARNING: data/cookies.json not found. Scanning as guest.');
        }

        const page = await context.newPage();
        
        if (targetDest) {
            const airport = airports.find(a => a.code === targetDest);
            if (airport) {
                await processAirport(page, airport, targetOrigin);
            }
        } else {
            for (const airport of airports) {
                if (airport.code === targetOrigin) continue;
                await processAirport(page, airport, targetOrigin);
            }
        }

    } catch (err) {
        console.error(`[Orchestrator] Fatal Error: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

async function processAirport(page, airport, targetOrigin) {
    console.log(`[Orchestrator] Processing airport: ${airport.name} (${airport.code})`);
    
    const calendarScanner = new DirectCalendarScanner();
    const oneWayScanner = new OneWayScanner(page);
    const engine = new CombinationEngine();

    try {
        const outboundDates = await calendarScanner.findCheapDates(targetOrigin, airport.code);
        const inboundDates = await calendarScanner.findCheapDates(airport.code, targetOrigin);

        // Phase 2: Detailed Scrapes
        const allOutbound = [];
        console.log(`[Orchestrator] Starting Phase 2 (Outbound) for ${outboundDates.length} dates...`);
        for (const date of outboundDates) {
            const flights = await oneWayScanner.scrapeDetailed(targetOrigin, airport.code, date);
            for (const f of flights) {
                await database.saveFlight(f).catch(e => console.error(`[Orchestrator] Error saving flight: ${e.message}`));
            }
            allOutbound.push(...flights);
        }

        const allInbound = [];
        console.log(`[Orchestrator] Starting Phase 2 (Inbound) for ${inboundDates.length} dates...`);
        for (const date of inboundDates) {
            const flights = await oneWayScanner.scrapeDetailed(airport.code, targetOrigin, date);
            for (const f of flights) {
                await database.saveFlight(f).catch(e => console.error(`[Orchestrator] Error saving flight: ${e.message}`));
            }
            allInbound.push(...flights);
        }

        if (allOutbound.length > 0 && allInbound.length > 0) {
            const combinations = engine.combine(allOutbound, allInbound);
            console.log(`[Orchestrator] Found ${combinations.length} potential combinations.`);
            await database.saveCombinations(combinations);
        }
    } catch (err) {
        if (err.message === 'AUTH_REQUIRED') {
            console.log(`[Orchestrator] Scan aborted: Re-authentication required.`);
            throw err; 
        }
        console.error(`[Orchestrator] Error processing ${airport.code}: ${err.message}`);
    }
}

module.exports = { runFullScan };
