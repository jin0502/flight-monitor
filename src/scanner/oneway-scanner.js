const { getDB } = require('../db');
const airports = require('../data/airports');

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
        if (global.authAlertSent) {
            throw new Error('AUTH_REQUIRED');
        }

        const isIntl = !this.isDomestic(origin, destination);
        const url = isIntl 
            ? `https://flights.ctrip.com/international/search/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${date}`
            : `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${date}`;
        
        console.log(`[OneWayScanner] Detailed scrape: ${origin} -> ${destination} on ${date} (${isIntl ? 'Intl' : 'Domestic'})`);

        let apiFlights = null;

        try {
            // 1. Setup response capture promise
            const responsePromise = this.page.waitForResponse(response => {
                const respUrl = response.url();
                return (respUrl.includes('/getFlightList') || 
                        respUrl.includes('/search/pull/') || 
                        respUrl.includes('/batchSearch') || 
                        respUrl.includes('/products') || 
                        respUrl.includes('/FlightIntlAndInlandSearch')) && 
                        response.status() === 200;
            }, { timeout: 45000 }).then(async (response) => {
                try {
                    const body = await response.json();
                    
                    // Check for needUserLogin
                    if (body.data?.needUserLogin === true || body.needUserLogin === true) {
                        console.log('[OneWayScanner] Re-authentication required');
                        const { sendAuthAlert } = require('../alerts');
                        if (!global.authAlertSent) {
                            sendAuthAlert().catch(e => console.error('Alert Error:', e.message));
                            global.authAlertSent = true;
                        }
                        throw new Error('AUTH_REQUIRED');
                    }

                    const list = body.flightItineraryList || body.data?.flightItineraryList || body.result?.flightItineraryList || body.data?.itineraryList;
                    if (list && list.length > 0) {
                        console.log(`[OneWayScanner] Captured ${list.length} flights.`);
                        apiFlights = list;
                    }
                } catch (e) {
                    if (e.message === 'AUTH_REQUIRED') throw e;
                    console.log(`[OneWayScanner] JSON Parse Error: ${e.message}`);
                }
            }).catch(e => {
                if (e.name !== 'TimeoutError' && e.message !== 'AUTH_REQUIRED') {
                    console.log(`[OneWayScanner] Response Capture Error: ${e.message}`);
                }
            });

            // 2. Perform navigation
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            
            // 3. Human activity
            await this.page.mouse.wheel(0, 500);
            await this.page.waitForTimeout(2000);

            // 4. Wait for response processing
            await responsePromise;

            // 5. Interaction to trigger activity
            await this.page.mouse.move(Math.random() * 500, Math.random() * 500);
            await this.page.waitForTimeout(1000);

        } catch (err) {
            if (err.message === 'AUTH_REQUIRED') throw err;
            console.error(`[OneWayScanner] Error during detailed scrape: ${err.message}`);
        }

        if (!apiFlights || apiFlights.length === 0) {
            console.log(`[OneWayScanner] Failed to capture detailed flight list. Returning fallback placeholder.`);
            return [{
                flightNo: 'UNKNOWN',
                airline: 'UNKNOWN',
                departTime: '00:00',
                arrivalTime: '00:00',
                price: 0,
                isFallback: true
            }];
        }

        return this.processApiFlights(apiFlights, origin, destination, date);
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
            
            const arrTimeRaw = flight.arrivalDateTime || flight.aTime;
            const arrTime = arrTimeRaw.includes(' ') ? arrTimeRaw.split(' ')[1].substring(0, 5) : arrTimeRaw.substring(0, 5);

            if (!price || !flightNumber) return;

            results.push({
                origin,
                destination,
                flight_date: date,
                price,
                airline,
                flightNo: flightNumber,
                departTime: depTime,
                arrivalTime: arrTime,
                duration: segment.duration || 'N/A',
                is_direct: 1,
                scrape_date: new Date().toISOString(),
                source: 'ctrip',
                month_key: monthKey
            });
        });

        // Sort by price and take top 5
        results.sort((a, b) => a.price - b.price);
        return results.slice(0, 5);
    }

    isDomestic(origin, destination) {
        const o = airports.find(a => a.code === origin);
        const d = airports.find(a => a.code === destination);
        const isOriginChina = o?.region === 'China' || origin === 'PVG' || origin === 'SHA';
        const isDestChina = d?.region === 'China' || destination === 'PVG' || destination === 'SHA';
        return isOriginChina && isDestChina;
    }
}

module.exports = OneWayScanner;
