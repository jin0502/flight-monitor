const { getDB } = require('../db');

class OneWayScanner {
    constructor(page) {
        this.page = page;
    }

    /**
     * Performs a detailed scrape for a specific date and route.
     * @param {string} origin 
     * @param {string} destination 
     * @param {string} date 
     * @returns {Promise<Array>} - List of flights found.
     */
    async scrapeDetailed(origin, destination, date) {
        const url = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${date}`;
        console.log(`[OneWayScanner] Detailed scrape: ${origin} -> ${destination} on ${date}`);

        let apiFlights = null;
        
        const apiHandler = async (response) => {
            const respUrl = response.url();
            const isMatch = respUrl.includes('/getFlightList') || respUrl.includes('/search/pull/') || respUrl.includes('/batchSearch');
            
            if (isMatch && !apiFlights) {
                try {
                    const body = await response.json();
                    const list = body.flightItineraryList || body.data?.flightItineraryList || body.result?.flightItineraryList || body.data?.itineraryList;
                    
                    if (list && list.length > 0) {
                        console.log(`[OneWayScanner] Captured flights from: ${respUrl.split('?')[0]} (${list.length} flights)`);
                        apiFlights = list;
                    } else {
                        // International batchSearch is a handshake, don't log "empty" unless it's domestic or pull
                        const isIntlBatch = respUrl.includes('/international/') && respUrl.includes('/batchSearch');
                        if (!isIntlBatch) {
                            console.log(`[OneWayScanner] Intercepted empty list from: ${respUrl.split('?')[0]}`);
                        }
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        };

        this.page.on('response', apiHandler);

        const randomDelay = Math.floor(Math.random() * 2000) + 1000;
        await this.page.waitForTimeout(randomDelay);

        try {
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            await this.page.waitForTimeout(10000); // Wait for API and rendering
        } catch (err) {
            console.error(`[OneWayScanner] Error during detailed scrape: ${err.message}`);
        } finally {
            this.page.removeListener('response', apiHandler);
        }

        if (!apiFlights || apiFlights.length === 0) {
            console.warn(`[OneWayScanner] No detailed flights found for ${origin} -> ${destination} on ${date}`);
            return [];
        }

        const processed = this.processApiFlights(apiFlights, origin, destination, date);
        await this.saveToDB(processed);
        
        return processed;
    }

    processApiFlights(apiFlights, origin, destination, date) {
        const results = [];
        const monthKey = date.substring(0, 7);

        apiFlights.forEach(item => {
            if (!item.priceList || item.priceList.length === 0) return;
            if (!item.flightSegments || item.flightSegments.length === 0) return;

            const segment = item.flightSegments[0];
            const flightList = segment.flightList;
            
            // FILTER: Direct flights only
            if (flightList.length > 1) return;

            const flight = flightList[0];
            
            // Handle different price structures
            const priceInfo = item.priceList[0];
            const price = priceInfo.adultPrice || priceInfo.price;
            
            // Handle different airline/flight number fields
            const airline = segment.airlineName || segment.airline;
            const flightNumber = flight.flightNo || flight.flightNumber;
            const depTimeRaw = flight.departureDateTime || flight.dTime;
            const depTime = depTimeRaw.includes(' ') ? depTimeRaw.split(' ')[1].substring(0, 5) : depTimeRaw.substring(0, 5);
            
            if (!price || !flightNumber) return;

            results.push({
                origin,
                destination,
                flight_date: date,
                price,
                airline,
                flight_number: flightNumber,
                departure_time: depTime,
                duration: segment.duration || 'N/A',
                is_direct: 1,
                scrape_date: new Date().toISOString(),
                source: 'ctrip',
                month_key: monthKey
            });
        });

        return results;
    }

    async saveToDB(flights) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO oneway_flights 
            (origin, destination, flight_date, price, airline, flight_number, departure_time, duration, is_direct, scrape_date, source, month_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(origin, destination, flight_date, flight_number) DO UPDATE SET
            price = excluded.price,
            scrape_date = excluded.scrape_date,
            departure_time = excluded.departure_time,
            duration = excluded.duration
        `);

        for (const f of flights) {
            await new Promise((resolve, reject) => {
                stmt.run(
                    f.origin, f.destination, f.flight_date, f.price, f.airline, 
                    f.flight_number, f.departure_time, f.duration, f.is_direct, 
                    f.scrape_date, f.source, f.month_key,
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        stmt.finalize();
        console.log(`[OneWayScanner] Saved/Updated ${flights.length} flights in DB.`);
    }
}

module.exports = OneWayScanner;
