const { chromium } = require('playwright');
const airports = require('../data/airports');

class CalendarScanner {
    constructor(page) {
        this.page = page;
    }

    /**
     * Finds the cheapest 3 dates for a given route and direction for the next 6 months.
     * @param {string} origin - Origin airport code.
     * @param {string} destination - Destination airport code.
     * @returns {Promise<Array<string>>} - List of YYYY-MM-DD date strings.
     */
    async findCheapDates(origin, destination) {
        const { start } = this.getScanHorizon();
        const url = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${start}`;
        console.log(`[CalendarScanner] Scanning ${origin} -> ${destination} via ${url}`);

        let calendarData = [];
        
        const apiHandler = async (response) => {
            const respUrl = response.url();
            // Match the low price calendar API (Ctrip updated endpoints)
            if (respUrl.includes('LowestPriceSearch') || respUrl.includes('/lowestPrice') || respUrl.includes('/getLowPrice') || respUrl.includes('/getlowpricecalendar') || respUrl.includes('/calendar/search')) {
                try {
                    const body = await response.json();
                    let list = null;
                    
                    // Handle different response structures
                    if (body.result && body.result.lowPriceList) list = body.result.lowPriceList;
                    else if (body.data && body.data.lowPriceList) list = body.data.lowPriceList;
                    else if (body.lowPriceList) list = body.lowPriceList;
                    else if (body.priceList) list = body.priceList; // New International endpoint structure
                    
                    if (list && list.length > 0) {
                        calendarData = list;
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        };

        this.page.on('response', apiHandler);

        try {
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            
            // Wait for API responses to settle
            await this.page.waitForTimeout(5000);

            if (calendarData.length === 0) {
                // Fallback: click on the calendar bar to trigger the fetch if it hasn't fired
                const calendarTrigger = await this.page.$('[class*="lowPriceBar"], [class*="calendar"], .low-price-bar');
                if (calendarTrigger) {
                    await calendarTrigger.click().catch(() => {});
                    await this.page.waitForTimeout(3000);
                }
            }

        } catch (err) {
            console.error(`[CalendarScanner] Error navigating to ${url}: ${err.message}`);
        } finally {
            this.page.removeListener('response', apiHandler);
        }

        if (calendarData.length === 0) {
            console.warn(`[CalendarScanner] No calendar data captured for ${origin} -> ${destination}`);
            return [];
        }

        // Process data to find top 3 cheapest dates per month
        return this.processCalendarData(calendarData);
    }

    /**
     * Groups dates by month and picks top 3 cheapest per month.
     * Filters for dates between 4 weeks from now and 6 months from now.
     * @param {Array} data - Raw lowPriceList items.
     * @returns {Array<string>} - Top date strings.
     */
    processCalendarData(data) {
        const months = {};
        const { start, end } = this.getScanHorizon();
        let skippedEmptyPrice = 0;
        let skippedOutOfRange = 0;
        
        data.forEach(item => {
            // Extract date - handle date, dDate, departDate and /Date(...)/ formats
            let rawDate = item.date || item.dDate || item.departDate;
            if (!rawDate) return;

            let dateStr = '';
            if (typeof rawDate === 'string' && rawDate.includes('/Date(')) {
                const match = rawDate.match(/\/Date\((\d+)/);
                if (match) {
                    const timestamp = parseInt(match[1]);
                    const d = new Date(timestamp);
                    dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
            } else if (typeof rawDate === 'number') {
                const d = new Date(rawDate);
                dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } else if (typeof rawDate === 'string') {
                dateStr = rawDate.substring(0, 10);
            }

            // Extract price - handle price and adultPrice, and ensure it's a valid number > 0
            const price = (item.price !== undefined && item.price !== null) ? item.price : item.adultPrice;

            if (!dateStr || price === undefined || price === null || price <= 0) {
                skippedEmptyPrice++;
                return;
            }
            
            // Filter: Only dates between 4 weeks from now and 6 months from now
            if (dateStr < start || dateStr > end) {
                skippedOutOfRange++;
                return;
            }

            const month = dateStr.substring(0, 7); // YYYY-MM
            if (!months[month]) months[month] = [];
            
            // Store a normalized object
            months[month].push({ date: dateStr, price: price });
        });

        const topDates = [];
        Object.keys(months).forEach(month => {
            // Sort by normalized price
            const sorted = months[month].sort((a, b) => a.price - b.price);
            // Map to normalized date
            const top3 = sorted.slice(0, 3).map(item => item.date);
            topDates.push(...top3);
        });

        console.log(`[CalendarScanner] Processed ${data.length} items. Horizon: ${start} to ${end}.`);
        console.log(`[CalendarScanner] Valid: ${topDates.length}, Empty Price: ${skippedEmptyPrice}, Out of Range: ${skippedOutOfRange}`);
        return topDates;
    }

    /**
     * Calculates the scan window: 4 weeks from now to 6 months from now.
     * @returns {Object} { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     */
    getScanHorizon() {
        const now = new Date();
        
        const startDate = new Date(now.getTime() + (28 * 24 * 60 * 60 * 1000));
        const endDate = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000));

        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        return {
            start: formatDate(startDate),
            end: formatDate(endDate)
        };
    }
}

module.exports = CalendarScanner;
