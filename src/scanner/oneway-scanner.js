const { chromium } = require('playwright');
const airports = require('../data/airports');

class OneWayScanner {
    constructor(page) {
        this.page = page;
    }

    async scrapeDetailed(origin, destination, date) {
        console.log(`[OneWayScanner] API fetch: ${origin} -> ${destination} on ${date}`);

        let apiFlights = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount < maxRetries && !apiFlights) {
            try {
                // Ensure we are on the right domain for cookies (ctrip.com for 14022 API)
                if (!this.page.url().includes('ctrip.com')) {
                    console.log(`[OneWayScanner] Navigating to ctrip.com for session context...`);
                    await this.page.goto('https://flights.ctrip.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                }

                apiFlights = await this.page.evaluate(async (params) => {
                    const { origin, destination, date } = params;

                    // Map to city codes (SHA instead of PVG etc) for mainland API
                    const mapCity = (code) => {
                        const m = { 'PVG': 'SHA', 'SHA': 'SHA', 'NRT': 'TYO', 'HND': 'TYO', 'KIX': 'OSA', 'NGO': 'OSA', 'ICN': 'SEL', 'GMP': 'SEL' };
                        return m[code] || code;
                    };

                    const payload = {
                        "searchCriteria": {
                            "tripType": 1,
                            "journeyNo": 1,
                            "passengerInfoType": { "adultCount": 1, "childCount": 0, "infantCount": 0 },
                            "journeyInfoTypes": [{
                                "journeyNo": 1,
                                "departDate": date,
                                "departCode": mapCity(origin),
                                "arriveCode": mapCity(destination)
                            }]
                        },
                        "Head": {
                            "Locale": "zh-CN",
                            "Currency": "CNY",
                            "Group": "Trip",
                            "Source": "ONLINE",
                            "Version": "3"
                        }
                    };

                    const res = await fetch("https://m.ctrip.com/restapi/soa2/14022/flightListSearch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json();
                    
                    if (!json.fltitem || json.fltitem.length === 0) {
                        console.log(`[OneWayScanner] API returned empty fltitem. Response Status: ${JSON.stringify(json.ResponseStatus || {})}`);
                        if (json.rltmsg) console.log(`[OneWayScanner] Result Msg: ${json.rltmsg}`);
                    }

                    return json.fltitem || json.data?.flightItineraryList || [];
                }, { origin, destination, date });

                if (apiFlights && apiFlights.length > 0) {
                    console.log(`[OneWayScanner] SUCCESS! Fetched ${apiFlights.length} flights via internal API.`);
                } else {
                    console.log(`[OneWayScanner] Empty results from API.`);
                    if (retryCount === 0) {
                        await this.page.goto('https://flights.ctrip.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }
                }

            } catch (err) {
                console.log(`[OneWayScanner] Error: ${err.message}. Retry ${retryCount + 1}`);
                retryCount++;
                try { await this.page.goto('https://flights.ctrip.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) {}
            }
        }

        // Delay to prevent rate limiting
        await new Promise(r => setTimeout(r, 2000));

        if (!apiFlights || apiFlights.length === 0) {
            console.log(`[OneWayScanner] Failed to fetch flight list.`);
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
                        "Locale": "en-US",
                        "Currency": "USD",
                        "Group": "Trip",
                        "Source": "ONLINE"
                    }
                };

                const res = await fetch("https://us.trip.com/restapi/soa2/14427/BatchGetFlightComfort", {
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
                        "Locale": "en-US",
                        "Currency": "USD",
                        "Group": "Trip",
                        "Source": "ONLINE"
                    }
                };

                const res = await fetch("https://us.trip.com/restapi/soa2/14427/poiSearch", {
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
