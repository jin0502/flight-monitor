const https = require('https');
const airports = require('../data/airports');

class DirectCalendarScanner {
    constructor() {
        this.domesticApiUrl = 'https://flights.ctrip.com/itinerary/api/12808/lowestPrice';
        this.intlApiUrl = 'https://m.ctrip.com/restapi/soa2/15380/bjjson/FlightIntlAndInlandLowestPriceSearch';
    }

    /**
     * Finds the cheapest dates using direct HTTP APIs.
     * @param {string} origin - Origin airport code.
     * @param {string} destination - Destination airport code.
     * @returns {Promise<Array<{date: string, price: number}>>} - List of date/price objects.
     */
    async findCheapDates(origin, destination) {
        const isDomestic = this.isDomesticRoute(origin, destination);
        
        try {
            if (isDomestic) {
                return await this.fetchDomestic(origin, destination);
            } else {
                return await this.fetchInternational(origin, destination);
            }
        } catch (err) {
            console.error(`[DirectCalendarScanner] Error fetching ${origin} -> ${destination}:`, err.message);
            return [];
        }
    }

    async fetchDomestic(origin, destination) {
        const dCity = this.mapToCityCode(origin);
        const aCity = this.mapToCityCode(destination);
        
        console.log(`[DirectCalendarScanner] Using Domestic API for ${dCity} -> ${aCity}`);
        const url = `${this.domesticApiUrl}?flightWay=Oneway&dcity=${dCity}&acity=${aCity}&direct=true&army=false`;
        
        const response = await this.get(url);
        const data = JSON.parse(response);
        
        if (!data.data || !data.data.oneWayPrice || !data.data.oneWayPrice[0]) {
            return [];
        }
        
        const priceMap = data.data.oneWayPrice[0];
        const items = Object.keys(priceMap)
            .filter(d => priceMap[d] > 0)
            .map(d => ({
                date: `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`,
                price: priceMap[d]
            }))
            .sort((a, b) => a.price - b.price)
            .slice(0, 15); // Get more candidates for combinations
            
        return items;
    }

    async fetchInternational(origin, destination) {
        console.log(`[DirectCalendarScanner] Using International API for ${origin} -> ${destination}`);
        
        const dCity = this.mapToCityCode(origin);
        const aCity = this.mapToCityCode(destination);
        
        const payload = {
            "departNewCityCode": dCity,
            "arriveNewCityCode": aCity,
            "searchType": 2,
            "flag": 1,
            "channelName": "FlightIntlOnline",
            "calendarSelections": [{ "selectionType": 8, "selectionContent": ["3"] }],
            "startDate": new Date().toISOString().split('T')[0],
            "grade": 3,
            "passengerList": [{ "passengercount": 1, "passengertype": "Adult" }]
        };

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        };

        const response = await this.post(this.intlApiUrl, payload, headers);
        const data = JSON.parse(response);
        
        if (!data.priceList || !Array.isArray(data.priceList)) return [];
        
        const items = data.priceList
            .filter(item => item.price > 0)
            .sort((a, b) => a.price - b.price)
            .slice(0, 15)
            .map(item => {
                const ms = parseInt(item.departDate.match(/\d+/)[0]);
                const d = new Date(ms);
                return {
                    date: d.toISOString().split('T')[0],
                    price: item.price
                };
            });
            
        return items;
    }

    isDomesticRoute(origin, destination) {
        const o = airports.find(a => a.code === origin);
        const d = airports.find(a => a.code === destination);
        const isOriginChina = o?.region === 'China' || origin === 'PVG' || origin === 'SHA';
        const isDestChina = d?.region === 'China' || destination === 'PVG' || destination === 'SHA';
        return isOriginChina && isDestChina;
    }

    mapToCityCode(code) {
        const mapping = {
            'PVG': 'SHA',
            'SHA': 'SHA',
            'NRT': 'TYO',
            'HND': 'TYO',
            'KIX': 'OSA',
            'NGO': 'OSA',
            'ICN': 'SEL',
            'GMP': 'SEL',
            'BKK': 'BKK',
            'DMK': 'BKK'
        };
        return mapping[code] || code;
    }

    get(url) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };
            https.get(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    post(url, payload, headers) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const data = JSON.stringify(payload);
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Length': Buffer.byteLength(data)
                }
            };
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(body));
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
}

module.exports = DirectCalendarScanner;
