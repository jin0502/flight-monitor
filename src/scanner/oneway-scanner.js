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
            // Match the flight list API (Ctrip updated endpoints)
            if ((respUrl.includes('/getFlightList') || respUrl.includes('/search/pull/')) && !apiFlights) {
                try {
                    const body = await response.json();
                    if (body.data && body.data.flightItineraryList) {
                        apiFlights = body.data.flightItineraryList;
                    } else if (body.result && body.result.flightItineraryList) {
                        apiFlights = body.result.flightItineraryList;
                    }
                } catch (e) {}
            }
        };

        this.page.on('response', apiHandler);

        try {
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await this.page.waitForTimeout(5000); // Wait for API and rendering
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
            const price = item.priceList[0].adultPrice;
            const airline = segment.airlineName;
            const flightNumber = flight.flightNo;
            const depTime = flight.departureDateTime.split(' ')[1].substring(0, 5);
            
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
            INSERT OR REPLACE INTO oneway_flights 
            (origin, destination, flight_date, price, airline, flight_number, departure_time, duration, is_direct, scrape_date, source, month_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    }
}

module.exports = OneWayScanner;
