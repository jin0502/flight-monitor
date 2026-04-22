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
async function runMonitorLoop() {
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');
    console.log(`[${gmt8Time}] Starting monitor loop...`);
    const db = getDB();
    const googleScraper = new GoogleFlightsScraper();
    const ctripScraper = new CtripScraper();
    const tripDotComScraper = new TripDotComScraper();
    
    let sharedBrowser = null;
    
    try {
        // Launch a single shared browser with aggressive resource-saving flags
        sharedBrowser = await chromium.launch({ 
            headless: true,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--disable-extensions',
                '--disable-component-update',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--js-flags="--max-old-space-size=256 --stack-size=1024"'
            ]
        });

        // Create ONE context and ONE page to be shared by all scrapers
        const context = await sharedBrowser.newContext({
            viewport: { width: 800, height: 600 }, // Smaller viewport saves memory
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });
        
        const sharedPage = await context.newPage();
        
        // Aggressive resource blocking on the shared page
        await sharedPage.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet', 'other'].includes(type)) {
                // We keep stylesheets for some sites that might break, 
                // but blocking them saves the most CPU. 
                // Let's stick to images/media/fonts for stability.
                if (['image', 'media', 'font'].includes(type)) {
                    route.abort();
                } else {
                    route.continue();
                }
            } else {
                route.continue();
            }
        });

        await googleScraper.initWithPage(sharedPage);
        await ctripScraper.initWithPage(sharedPage);
        await tripDotComScraper.initWithPage(sharedPage);

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
                    
                    // 1. Try Ctrip (Chinese) - TOP PRIORITY
                    const destinations = (route.destination_type === 'country' || !route.destination_type)
                        ? (countryAirports[route.destination] || [route.destination])
                        : [route.destination];
                        
                    for (const airport of destinations) {
                        try {
                            console.log(`  Checking airport: ${airport}...`);
                            const ctripResults = await ctripScraper.scrape(route.origin, airport, startDate, endDate);
                            results = results.concat(ctripResults);
                        } catch (ctripErr) {
                            console.error(`  Ctrip.com error for ${airport}: ${ctripErr.message}`);
                        }
                    }

                    // 2. Try Trip.com (International) if still no results
                    if (results.length === 0) {
                        console.log(`Ctrip.com returned no results. Trying Trip.com (International)...`);
                        
                        for (const airport of destinations) {
                            try {
                                console.log(`  Checking airport: ${airport}...`);
                                const tripResults = await tripDotComScraper.scrape(route.origin, airport, startDate, endDate);
                                results = results.concat(tripResults);
                            } catch (tripErr) {
                                console.error(`  Trip.com error for ${airport}: ${tripErr.message}`);
                            }
                        }
                    }

                    // 3. Try Google Flights if still no results
                    if (results.length === 0) {
                        console.log(`Trip.com returned no results. Trying Google Flights...`);
                        try {
                            results = await googleScraper.scrape(route.origin, route.destination, startDate, endDate);
                        } catch (googleErr) {
                            console.error(`Google Flights scrape error: ${googleErr.message}`);
                        }
                    }
                    
                    console.log(`Found ${results.length} total results for ${startDate}.`);
                    
                    const airportNames = require('./data/airport-names');

                    for (const flight of results) {
                        const now = new Date();
                        const gmt8ScrapeDate = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');

                        const priceData = {
                            route_id: route.id,
                            price: flight.price,
                            scrape_date: gmt8ScrapeDate,
                            travel_date: startDate,
                            airline: flight.airline,
                            duration: flight.duration || 'N/A',
                            flight_number: flight.flightNumber || 'N/A',
                            departure_time: flight.departureTime || 'N/A',
                            // Return Info
                            return_date: endDate || null,
                            return_flight_number: flight.returnFlightNumber || 'N/A',
                            return_departure_time: flight.returnDepartureTime || 'N/A',
                            return_airline: flight.returnAirline || 'N/A',
                            origin_airport: route.origin,
                            destination_airport: flight.destinationAirport || airport,
                            origin_airport_name: flight.originAirportName || airportNames[route.origin] || route.origin,
                            destination_airport_name: flight.destinationAirportName || airportNames[flight.destinationAirport] || airportNames[airport] || airportNames[route.destination] || route.destination
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
        // Scrapers with initWithPage don't close the page/context themselves
        if (sharedBrowser) {
            await sharedBrowser.close();
        }
        const now = new Date();
        const gmt8EndTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');
        console.log(`[${gmt8EndTime}] Monitor loop finished.`);
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
