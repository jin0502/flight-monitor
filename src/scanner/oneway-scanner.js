const { chromium } = require('playwright');
const airports = require('../data/airports');

class OneWayScanner {
    constructor(page) {
        this.page = page;
        // Pipe browser console logs to terminal
        this.page.on('console', msg => {
            if (msg.type() === 'log' || msg.type() === 'error') {
                console.log(`[Browser] ${msg.text()}`);
            }
        });
    }

    async scrapeDetailed(origin, destination, date) {
        console.log(`[OneWayScanner] Navigation search for: ${origin} -> ${destination} on ${date}`);

        // Construct the real search URL
        const searchUrl = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${date}&cabin=y_s&adult=1&child=0&infant=0`;
        
        let apiFlights = [];
        try {
            // Wait for the specific API response while navigating
            const responsePromise = this.page.waitForResponse(res => res.url().includes('flightListSearch') && res.status() === 200, { timeout: 30000 });
            
            await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            try {
                const response = await responsePromise;
                const json = await response.json();
                apiFlights = json.fltitem || [];
                console.log(`[OneWayScanner] Interception SUCCESS! Found ${apiFlights.length} flights.`);
            } catch (pErr) {
                console.log(`[OneWayScanner] Interception timed out, trying DOM fallback...`);
                // Wait for the list to appear in DOM
                await this.page.waitForSelector('.search-list, .flight-item', { timeout: 15000 }).catch(() => {});
                
                // DOM FALLBACK: Extract basic data if API intercept fails
                apiFlights = await this.page.evaluate(() => {
                    const items = document.querySelectorAll('.search-list-item, .flight-item');
                    return Array.from(items).map(el => {
                        const price = el.querySelector('.price, .item-price')?.innerText.replace(/[^0-9]/g, '');
                        const fn = el.querySelector('.flight-no, .item-flight-no')?.innerText;
                        const airline = el.querySelector('.airline-name, .item-airline-name')?.innerText;
                        const times = el.querySelectorAll('.time, .item-time');
                        return {
                            msegments: [{
                                fn: fn || 'UNK',
                                an: airline || 'UNK',
                                dt: times[0]?.innerText || '00:00',
                                at: times[1]?.innerText || '00:00'
                            }],
                            lp: parseInt(price) || 0
                        };
                    }).filter(f => f.lp > 0);
                });
                console.log(`[OneWayScanner] DOM Fallback SUCCESS! Found ${apiFlights.length} flights.`);
            }

        } catch (err) {
            console.log(`[OneWayScanner] Navigation Failed: ${err.message}.`);
        }

        if (!apiFlights || apiFlights.length === 0) {
            return [];
        }

        const results = apiFlights.map(f => {
            // Ctrip 14022 format handling
            const segment = f.msegments ? f.msegments[0] : (f.flightSegments ? f.flightSegments[0] : f);
            const price = f.lp || (f.priceList ? f.priceList[0].price : (f.price || 0));
            
            return {
                origin: origin.toUpperCase(),
                destination: destination.toUpperCase(),
                flight_date: date,
                flightNo: segment.fn || segment.flightNo || 'UNKNOWN',
                airline: segment.an || segment.airlineName || 'UNKNOWN',
                departTime: segment.dt || segment.departDateTime || '00:00',
                arrivalTime: segment.at || segment.arriveDateTime || '00:00',
                price: price
            };
        });

        // ENRICHMENT: Fetch comfort data for the top 5 cheapest flights
        const top5 = results.sort((a, b) => a.price - b.price).slice(0, 5);
        if (top5.length > 0) {
            console.log(`[OneWayScanner] Enriching comfort data for top ${top5.length} flights...`);
            const comfortData = await this.scrapeComfort(top5);
            
            top5.forEach(f => {
                const c = comfortData.find(cd => cd.flightNo === f.flightNo);
                if (c) {
                    f.aircraftType = c.aircraftType;
                    f.seatPitch = c.seatPitch;
                    f.hasWifi = c.hasWifi ? 1 : 0;
                    f.hasEntertainment = c.hasEntertainment ? 1 : 0;
                    f.hasPower = c.hasPower ? 1 : 0;
                }
            });
        }

        console.log(`[OneWayScanner] Successfully processed ${results.length} flights.`);
        return results;
    }

    async scrapeComfort(flights) {
        try {
            const comfortList = await this.page.evaluate(async (flightList) => {
                const payload = {
                    "FlightSegmentList": flightList.map(f => ({
                        "dCity": f.origin,
                        "aCity": f.destination,
                        "dDate": f.flight_date,
                        "flightNo": f.flightNo
                    })),
                    "Head": {
                        "Locale": "zh-CN",
                        "Currency": "CNY",
                        "Group": "Ctrip",
                        "Source": "PC"
                    }
                };

                const res = await fetch("https://flights.ctrip.com/restapi/soa2/14427/BatchGetFlightComfort", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                
                const json = await res.json();
                return json.flightComfortList || [];
            }, flights);

            return comfortList.map(c => ({
                flightNo: c.flightNo,
                aircraftType: c.aircraftType,
                seatPitch: c.seatPitch,
                hasWifi: c.hasWifi,
                hasEntertainment: c.hasEntertainment,
                hasPower: c.hasPower
            }));
        } catch (err) {
            console.error(`[OneWayScanner] Comfort Error: ${err.message}`);
            return [];
        }
    }

    async searchPOI(keyword) {
        try {
            const results = await this.page.evaluate(async (key) => {
                const payload = {
                    "key": key,
                    "mode": "0",
                    "tripType": "OW",
                    "Head": {
                        "Locale": "zh-CN",
                        "Currency": "CNY",
                        "Group": "Ctrip",
                        "Source": "PC"
                    }
                };

                const res = await fetch("https://flights.ctrip.com/restapi/soa2/14427/poiSearch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                
                const json = await res.json();
                return json.results || [];
            }, keyword);

            return results;
        } catch (err) {
            console.error(`[OneWayScanner] POI Error: ${err.message}`);
            return [];
        }
    }

    isInternational(origin, destination) {
        const oCode = origin.toUpperCase();
        const dCode = destination.toUpperCase();
        
        const isOriginChina = oCode === 'PVG' || oCode === 'SHA' || airports.find(a => a.code === oCode)?.region === 'China';
        const isDestChina = dCode === 'PVG' || dCode === 'SHA' || airports.find(a => a.code === dCode)?.region === 'China';
        
        return !isOriginChina || !isDestChina;
    }
}

module.exports = OneWayScanner;
