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
        const url = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${this.getTodayStr()}`;
        console.log(`[CalendarScanner] Scanning ${origin} -> ${destination} via ${url}`);

        let calendarData = [];
        
        const apiHandler = async (response) => {
            const respUrl = response.url();
            // Match the low price calendar API (Ctrip updated endpoints)
            if (respUrl.includes('/getLowPrice') || respUrl.includes('/getlowpricecalendar') || respUrl.includes('/calendar/search')) {
                try {
                    const body = await response.json();
                    let list = null;
                    
                    // Handle different response structures
                    if (body.result && body.result.lowPriceList) list = body.result.lowPriceList;
                    else if (body.data && body.data.lowPriceList) list = body.data.lowPriceList;
                    else if (body.lowPriceList) list = body.lowPriceList;
                    
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
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            
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
     * @param {Array} data - Raw lowPriceList items.
     * @returns {Array<string>} - Top date strings.
     */
    processCalendarData(data) {
        const months = {};
        
        data.forEach(item => {
            if (!item.date || !item.price) return;
            const month = item.date.substring(0, 7); // YYYY-MM
            if (!months[month]) months[month] = [];
            months[month].push(item);
        });

        const topDates = [];
        Object.keys(months).forEach(month => {
            const sorted = months[month].sort((a, b) => a.price - b.price);
            const top3 = sorted.slice(0, 3).map(item => item.date);
            topDates.push(...top3);
        });

        return topDates;
    }

    getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}

module.exports = CalendarScanner;
