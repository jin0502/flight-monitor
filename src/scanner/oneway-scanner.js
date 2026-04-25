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
        // Enable request interception
        await this.page.route('**/*', route => {
            const url = route.request().url();
            if (url.includes('captcha') || url.includes('sec.ctrip.com') || url.includes('tracking')) {
                return route.abort();
            }
            route.continue();
        });

        const isIntl = !this.isDomestic(origin, destination);
        const url = isIntl 
            ? `https://flights.ctrip.com/international/search/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${date}`
            : `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${date}`;
        
        console.log(`[OneWayScanner] Detailed scrape: ${origin} -> ${destination} on ${date} (${isIntl ? 'Intl' : 'Domestic'})`);
        console.log(`[OneWayScanner] URL: ${url}`);

        let apiFlights = null;
        let apiHandler;
        
        try {
            apiHandler = async (response) => {
                const respUrl = response.url();
                const isMatch = respUrl.includes('/getFlightList') || respUrl.includes('/search/pull/') || respUrl.includes('/batchSearch') || respUrl.includes('/products') || respUrl.includes('/FlightIntlAndInlandSearch');
                
                if (isMatch && !apiFlights) {
                    console.log(`[OneWayScanner] Intercepted URL: ${respUrl.split('?')[0]}`);
                    try {
                        const body = await response.json();
                        
                        // Check for needUserLogin
                        if (body.data?.needUserLogin === true || body.needUserLogin === true) {
                            console.log('[OneWayScanner] Re-authentication required (needUserLogin: true)');
                            const { sendAuthAlert } = require('../alerts');
                            // Use a simple global flag to avoid spamming alerts in one cycle
                            if (!global.authAlertSent) {
                                sendAuthAlert().catch(e => console.error('Alert Error:', e.message));
                                global.authAlertSent = true;
                            }
                        }

                        const list = body.flightItineraryList || body.data?.flightItineraryList || body.result?.flightItineraryList || body.data?.itineraryList;
                        
                        if (list && list.length > 0) {
                            console.log(`[OneWayScanner] Captured ${list.length} flights.`);
                            apiFlights = list;
                        } else {
                            console.log(`[OneWayScanner] Match found but list is empty. Keys: ${Object.keys(body).join(', ')}`);
                            if (body.data) {
                                console.log(`[OneWayScanner] Data keys: ${Object.keys(body.data).join(', ')}`);
                            }
                        }
                    } catch (e) {
                        console.log(`[OneWayScanner] JSON Parse Error: ${e.message}`);
                    }
                }
            };

            this.page.on('response', apiHandler);

            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            
            // Add a small human-like scroll to trigger activity/pull requests
            await this.page.mouse.wheel(0, 500);
            await this.page.waitForTimeout(2000);

            try {
                const selectors = [
                    '.login-pop-close', '.pc_login_close',
                    '.ant-modal-close'
                ];
                for (const selector of selectors) {
                    if (await this.page.isVisible(selector)) {
                        await this.page.click(selector);
                    }
                }
            } catch (e) {
                // Ignore if popups not present
            }

            // Simulate human behavior
            await this.page.mouse.move(Math.random() * 500, Math.random() * 500);
            await this.page.evaluate(() => window.scrollBy(0, 300));
            await this.page.waitForTimeout(1000);
            await this.page.evaluate(() => window.scrollBy(0, -300));

            await this.page.waitForTimeout(7000); // Wait for API and rendering
        } catch (err) {
            console.error(`[OneWayScanner] Error during detailed scrape: ${err.message}`);
        } finally {
            if (apiHandler) this.page.removeListener('response', apiHandler);
        }

        if (!apiFlights || apiFlights.length === 0) {
            console.log(`[OneWayScanner] Failed to capture detailed flight list. Returning fallback placeholder.`);
            return [{
                flightNo: 'UNKNOWN',
                airline: 'UNKNOWN',
                departTime: '00:00',
                arrivalTime: '00:00',
                price: 0, // Orchestrator should handle this by using calendar price
                isFallback: true
            }];
        }

        const processed = this.processApiFlights(apiFlights, origin, destination, date);
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

        // Sort by price and take top 5 (User suggestion: cheapest are usually on top anyway)
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
