const { initDB, getDB } = require('./db');
const GoogleFlightsScraper = require('./scraper/providers/google-flights');
const CtripScraper = require('./scraper/providers/ctrip');
const { checkAlerts } = require('./alerts');
const app = require('./dashboard');
const dotenv = require('dotenv');
const countryAirports = require('./data/country-airports');

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
        runMonitorLoop();
        
        // Schedule periodic scrapes
        const intervalMs = SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000;
        console.log(`Scheduling next scrape in ${SCRAPE_INTERVAL_HOURS} hours.`);
        setInterval(runMonitorLoop, intervalMs);

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
async function runMonitorLoop() {
    console.log(`[${new Date().toISOString()}] Starting monitor loop...`);
    const db = getDB();
    const googleScraper = new GoogleFlightsScraper();
    const ctripScraper = new CtripScraper();
    
    try {
        await googleScraper.init(true); // Headless
        await ctripScraper.init(true); // Headless

        // Get all routes to monitor
        const routes = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM monitored_routes', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (routes.length === 0) {
            console.log('No routes found to monitor. Add routes via the dashboard.');
        }

        for (const route of routes) {
            console.log(`Processing route: ${route.origin} -> ${route.destination} (${route.destination_type || 'country'})`);
            
            const searchDates = generateSearchDates(route.search_type);
            
            for (const { startDate, endDate } of searchDates) {
                try {
                    console.log(`Scraping ${route.origin} -> ${route.destination} for ${startDate} to ${endDate}...`);
                    
                    let results = [];
                    
                    // 1. Try Google Flights (Supports country directly)
                    try {
                        results = await googleScraper.scrape(route.origin, route.destination, startDate, endDate);
                    } catch (googleErr) {
                        console.error(`Google Flights scrape error: ${googleErr.message}`);
                    }

                    // 2. Try Ctrip (Requires expansion if destination is a country)
                    if (results.length === 0) {
                        console.log(`Google Flights returned no results. Trying Ctrip...`);
                        
                        const ctripDestinations = (route.destination_type === 'country' || !route.destination_type)
                            ? (countryAirports[route.destination] || [route.destination])
                            : [route.destination];
                            
                        for (const airport of ctripDestinations) {
                            try {
                                console.log(`  Checking airport: ${airport}...`);
                                const ctripResults = await ctripScraper.scrape(route.origin, airport, startDate, endDate);
                                results = results.concat(ctripResults);
                            } catch (ctripErr) {
                                console.error(`  Ctrip scrape error for ${airport}: ${ctripErr.message}`);
                            }
                        }
                    }
                    
                    console.log(`Found ${results.length} total results for ${startDate}.`);
                    
                    const airportNames = require('./data/airport-names');

                    for (const flight of results) {
                        const priceData = {
                            route_id: route.id,
                            price: flight.price,
                            scrape_date: new Date().toISOString(),
                            travel_date: startDate,
                            airline: flight.airline,
                            duration: flight.duration || 'N/A',
                            flight_number: flight.flightNumber || 'N/A',
                            departure_time: flight.departureTime || 'N/A',
                            origin_airport_name: flight.originAirportName || airportNames[route.origin] || route.origin,
                            destination_airport_name: flight.destinationAirportName || airportNames[flight.destinationAirport] || airportNames[route.destination] || route.destination
                        };
                        
                        try {
                            await checkAlerts(priceData, db);
                        } catch (alertErr) {
                            console.error(`Alert Engine error for ${route.origin}-${route.destination}:`, alertErr.message);
                        }
                    }
                } catch (scrapeErr) {
                    console.error(`Error processing ${route.origin}-${route.destination} on ${startDate}:`, scrapeErr.message);
                }
            }
        }
    } catch (err) {
        console.error('Monitor loop error:', err);
    } finally {
        await googleScraper.close();
        await ctripScraper.close();
        console.log(`[${new Date().toISOString()}] Monitor loop finished.`);
    }
}

/**
 * Helper to generate travel dates based on search type.
 * - WEEKEND: Next 4 weekends (Friday to Monday)
 * - FLEXIBLE: 1st of each month for the next 6 months (7-day trip)
 * @param {string} type - The type of search (e.g., 'WEEKEND' or 'FLEXIBLE').
 * @returns {Array<{startDate: string, endDate: string}>} Array of date pairs.
 */
function generateSearchDates(type) {
    const dates = [];
    const today = new Date();
    
    if (type === 'WEEKEND' || type === 'weekend') {
        // Next 26 weekends (Fri to Mon) - approx 6 months
        for (let i = 1; i <= 26; i++) {
            const friday = new Date(today);
            // Find next Friday
            friday.setDate(today.getDate() + (5 - today.getDay() + 7) % 7 + (i - 1) * 7);
            
            const monday = new Date(friday);
            monday.setDate(friday.getDate() + 3);
            
            dates.push({
                startDate: formatDate(friday),
                endDate: formatDate(monday)
            });
        }
    } else if (type === 'FLEXIBLE' || type === 'flexible') {
        // 1st of each month for the next 6 months (7-day trip)
        for (let i = 1; i <= 6; i++) {
            const start = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            
            dates.push({
                startDate: formatDate(start),
                endDate: formatDate(end)
            });
        }
    } else {
        // Default: Bi-weekly for the next 6 months if unknown type
        for (let i = 1; i <= 12; i++) {
            const start = new Date(today);
            start.setDate(today.getDate() + i * 14);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            
            dates.push({
                startDate: formatDate(start),
                endDate: formatDate(end)
            });
        }
    }
    
    return dates;
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
