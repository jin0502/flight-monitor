const { initDB, getDB } = require('./db');
const GoogleFlightsScraper = require('./scraper/providers/google-flights');
const CtripScraper = require('./scraper/providers/ctrip');
const TripDotComScraper = require('./scraper/providers/trip-dot-com');
const { checkAlerts } = require('./alerts');
const app = require('./dashboard');
const dotenv = require('dotenv');
const countryAirports = require('./data/country-airports');
const { chromium } = require('playwright');

dotenv.config();

const PORT = process.env.PORT || 3000;
// Changed default from 12 to 4 hours
const SCRAPE_INTERVAL_HOURS = parseFloat(process.env.SCRAPE_INTERVAL_HOURS) || 4;

/**
 * Main function to start the application.
 * Initializes the database, starts the Express dashboard, and begins the monitoring loop.
 * @async
 * @returns {Promise<void>}
 */
async function main() {
    try {
        console.log('Initializing Shanghai Flight Monitor...');
        
        // 1. Initialize DB
        await initDB();
        console.log('Database initialized.');

        // 2. Start Dashboard
        app.listen(PORT, () => {
            console.log(`Dashboard running at http://localhost:${PORT}`);
        });

        // 3. Start Monitoring Loop
        console.log('Starting initial monitor loop...');
        await runMonitorLoop(); // Use await here to track first run
        
        // Schedule periodic scrapes using a safer timeout pattern
        const scheduleNext = () => {
            const intervalMs = SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000;
            console.log(`Scheduling next scrape in ${SCRAPE_INTERVAL_HOURS} hours.`);
            setTimeout(async () => {
                await runMonitorLoop();
                scheduleNext();
            }, intervalMs);
        };
        
        scheduleNext();

    } catch (err) {
        console.error('Startup error:', err);
        process.exit(1);
    }
}

/**
 * Main execution loop for scraping and alerting.
 * Retrieves monitored routes from the database, scrapes Google Flights and Ctrip for prices,
 * and passes the results to the alert engine.
 * @async
 * @returns {Promise<void>}
 */
const { runFullScan } = require('./scanner');
const { sendTopDealAlerts } = require('./alerts');

/**
 * Main execution loop for the new One-Way + Combination Engine.
 * Runs Phase 1 (Calendar Scan), Phase 2 (Detail Scan), and Phase 3 (Combination Engine).
 * @async
 * @returns {Promise<void>}
 */
async function runMonitorLoop() {
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');
    console.log(`[${gmt8Time}] Starting One-Way Scan & Combination Cycle...`);
    
    const db = getDB();
    
    try {
        // Run the orchestrator
        const topDeals = await runFullScan();
        
        if (topDeals && topDeals.length > 0) {
            console.log(`Found ${topDeals.length} deals. Sending alerts...`);
            await sendTopDealAlerts(topDeals, db);
        } else {
            console.log('No new deals found in this cycle.');
        }

    } catch (err) {
        console.error('Monitor loop error:', err);
    } finally {
        const nowEnd = new Date();
        const gmt8EndTime = new Date(nowEnd.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');
        console.log(`[${gmt8EndTime}] Scan & Combination Cycle finished.`);
    }
}

/**
 * Helper to format date as YYYY-MM-DD.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    process.exit(0);
});

// Run the app
main();
