const { initDB, getDB } = require('./db');
const { checkAlerts } = require('./alerts');
const app = require('./dashboard');
const dotenv = require('dotenv');
const airports = require('./data/airports');

dotenv.config();

const PORT = process.env.PORT || 3000;
const SCRAPE_INTERVAL_HOURS = parseFloat(process.env.SCRAPE_INTERVAL_HOURS) || 4;

async function main() {
    try {
        console.log('Initializing Shanghai Flight Monitor...');
        await initDB();
        // app.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));
        
        await runMonitorLoop();
        
        const scheduleNext = () => {
            console.log(`Scheduling next scrape in ${SCRAPE_INTERVAL_HOURS} hours.`);
            setTimeout(async () => {
                await runMonitorLoop();
                scheduleNext();
            }, SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000);
        };
        scheduleNext();
    } catch (err) {
        console.error('Startup error:', err);
        process.exit(1);
    }
}

const { runFullScan } = require('./scanner');
const { sendTopDealAlerts, sendTelegramNotification } = require('./alerts');

async function runMonitorLoop() {
    console.log(`[${new Date().toLocaleString()}] Starting Scan & Combination Cycle...`);
    
    try {
        const args = process.argv.slice(2);
        const originArg = args.includes('--origin') ? args[args.indexOf('--origin') + 1] : 'SHA';
        const destArg = args.includes('--dest') ? args[args.indexOf('--dest') + 1] : null;

        // 1. Run the LITE orchestrator (Phase 1 Scans)
        await runFullScan(originArg, destArg);
        
        // 2. Run Phase 3: Combination Engine (PER CITY)
        const engine = new (require('./scanner/combination-engine'))();
        
        // Identify unique cities to alert on
        const uniqueCityCodes = [...new Set(airports.map(a => a.cityCode))];
        
        console.log(`[Orchestrator] Generating top deals for ${uniqueCityCodes.length} cities...`);
        
        const globalCounts = {};

        for (const cityCode of uniqueCityCodes) {
            // If user specified a --dest, only alert on that city
            if (destArg) {
                const targetAirport = airports.find(a => a.code === destArg);
                if (targetAirport && cityCode !== targetAirport.cityCode) continue;
            }

            const cityDeals = await engine.generateCombinations(cityCode);
            if (cityDeals.length > 0) {
                const sessionCounts = await sendTopDealAlerts(cityDeals, getDB());
                for (const [cat, count] of Object.entries(sessionCounts)) {
                    globalCounts[cat] = (globalCounts[cat] || 0) + count;
                }
            }
        }

        // 3. Send Telegram Summary Alerts (One message per category)
        for (const [category, count] of Object.entries(globalCounts)) {
            console.log(`[Orchestrator] Sending Telegram summary for ${category}: ${count} deals`);
            await sendTelegramNotification(`${count} new deals for ${category}`).catch(e => {
                console.error(`[Orchestrator] Telegram summary failed for ${category}: ${e.message}`);
            });
        }

    } catch (err) {
        console.error('Monitor loop error:', err);
    }
}

main();
