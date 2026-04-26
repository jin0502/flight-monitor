const https = require('https');
const airports = require('../data/airports');

class DirectCalendarScanner {
    constructor() {
        this.domesticApiUrl = 'https://flights.ctrip.com/itinerary/api/12808/lowestPrice';
        this.intlApiUrl = 'https://m.ctrip.com/restapi/soa2/15380/bjjson/FlightIntlAndInlandLowestPriceSearch';
    }

    async findCheapDates(origin, destination) {
        // ALWAYS normalize PVG/SHA to SHA for city-level scanning
        const normalizedOrigin = (origin === 'PVG' || origin === 'SHA') ? 'SHA' : origin;
        const normalizedDest = (destination === 'PVG' || destination === 'SHA') ? 'SHA' : destination;

        const isDomestic = this.isDomesticRoute(normalizedOrigin, normalizedDest);
        try {
            if (isDomestic) return await this.fetchDomestic(normalizedOrigin, normalizedDest);
            else return await this.fetchInternational(normalizedOrigin, normalizedDest);
        } catch (err) {
            if (err.message === 'ZERO_RESULTS') throw err;
            console.error(`[DirectCalendarScanner] Error fetching ${normalizedOrigin} -> ${normalizedDest}:`, err.message);
            return [];
        }
    }

    async fetchDomestic(origin, destination) {
        console.log(`[DirectCalendarScanner] Using Domestic API for ${origin} -> ${destination}`);
        const url = `${this.domesticApiUrl}?flightWay=Oneway&dcity=${origin}&acity=${destination}&direct=true&army=false`;
        
        const response = await this.get(url);
        const data = JSON.parse(response);
        
        if (!data.data || !data.data.oneWayPrice || !data.data.oneWayPrice[0]) {
            throw new Error('ZERO_RESULTS');
        }
        
        const priceMap = data.data.oneWayPrice[0];
        const items = Object.keys(priceMap)
            .filter(d => priceMap[d] > 0)
            .map(d => ({
                date: `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`,
                price: priceMap[d]
            }))
            .sort((a, b) => a.price - b.price)
            .slice(0, 15);
            
        if (items.length === 0) throw new Error('ZERO_RESULTS');
        return items;
    }

    async fetchInternational(origin, destination) {
        console.log(`[DirectCalendarScanner] Using International API for ${origin} -> ${destination}`);
        
        const payload = {
            "departNewCityCode": origin,
            "arriveNewCityCode": destination,
            "startDate": new Date().toISOString().split('T')[0],
            "grade": 3,
            "flag": 1,
            "channelName": "FlightIntlOnline",
            "searchType": 2,
            "passengerList": [{ "passengercount": 1, "passengertype": "Adult" }],
            "calendarSelections": [{ "selectionType": 8, "selectionContent": ["6"] }],
            "Head": {
                "Locale": "zh-CN",
                "Currency": "CNY",
                "Group": "Ctrip",
                "Source": "PC",
                "Version": "1.0",
                "cid": "09031038111298679086"
            }
        };

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': 'GUID=09031038111298679086; _deviceid=09031038111298679086'
        };

        const response = await this.post(this.intlApiUrl, payload, headers);
        const data = JSON.parse(response);
        const validItems = (data.priceList || []).filter(item => item.price > 0);

        if (validItems.length === 0) {
            console.log('\n--- ❌ ZERO FLIGHTS DEBUG ---');
            console.log(`Route: ${origin} -> ${destination}`);
            console.log(`Raw Response: ${response.substring(0, 200)}...`);
            throw new Error('ZERO_RESULTS');
        }
        
        return validItems
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
    }

    isDomesticRoute(origin, destination) {
        const domesticCities = ['SHA', 'PVG', 'CAN', 'SZX', 'CTU', 'CKG', 'XMN', 'XIY', 'KMG', 'SYX', 'FOC', 'KWL', 'LJG', 'HAK', 'URC', 'DLC', 'TNA', 'CGO', 'NNG', 'SJW', 'LHW', 'INC'];
        return domesticCities.includes(origin) && domesticCities.includes(destination);
    }

    get(url) {
        return new Promise((resolve, reject) => {
            const options = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } };
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
                hostname: urlObj.hostname, port: 443, path: urlObj.pathname,
                method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
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
