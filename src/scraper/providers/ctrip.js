const BaseScraper = require('../index');

class CtripScraper extends BaseScraper {
  constructor() {
    super();
  }

  /**
   * Scrape flight data from Trip.com (Ctrip).
   * @param {string} origin - Origin airport code (e.g., PVG).
   * @param {string} destination - Destination airport code (e.g., TYO).
   * @param {string} startDate - Start date (YYYY-MM-DD).
   * @param {string} endDate - End date (YYYY-MM-DD).
   * @returns {Promise<Array>} - List of flight objects.
   */
  async scrape(origin, destination, startDate, endDate) {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call init() first.');
    }

    // curr=CNY forces prices in Chinese Yuan
    const url = `https://www.trip.com/flights/${origin.toLowerCase()}-to-${destination.toLowerCase()}/tickets-${origin.toLowerCase()}-${destination.toLowerCase()}?ddate=${startDate}&rdate=${endDate}&curr=CNY`;
    
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (e) {
        // ignore networkidle timeout
      }

      // Handle common overlays or popups
      try {
        const closeSelectors = [
          '.close-icon',
          '.pop-close',
          'i.ls-close',
          '.modal-close'
        ];
        for (const selector of closeSelectors) {
          const btn = await this.page.$(selector);
          if (btn) {
            await btn.click();
          }
        }
      } catch (e) {
        // Silent catch
      }

      // Wait for flight results to load
      const resultSelectors = [
        '.flight-item',
        '.search-result-item',
        '.flight-card',
        '.m-flight-item',
        'div[class*="FlightItem"]',
        'div[class*="SearchItem"]'
      ];

      let foundSelector = null;
      for (const selector of resultSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          foundSelector = selector;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!foundSelector) {
        // If it times out, try scrolling down a bit
        await this.page.evaluate(() => window.scrollBy(0, 1000));
        await this.page.waitForTimeout(2000);
        for (const selector of resultSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            foundSelector = selector;
            break;
          } catch (e) {
            continue;
          }
        }
      }

      if (!foundSelector) {
        console.log(`No flights found or timed out on Trip.com for ${origin}->${destination}`);
        return [];
      }

      // Extract data
      const flights = await this.page.$$eval(foundSelector, (elements) => {
        return elements.map(el => {
          // Price
          const priceEl = el.querySelector('.price-amount, .price, .item-price, [class*="price"], [class*="Price"]');
          const priceText = priceEl ? priceEl.innerText : '';
          
          // Airline
          const airlineEl = el.querySelector('.airline-name, .airline, .name, [class*="AirlineName"], [class*="airline"]');
          const airline = airlineEl ? airlineEl.innerText : 'Unknown';
          
          // Duration
          const durationEl = el.querySelector('.duration, .flight-duration, .time-use, [class*="Duration"]');
          const duration = durationEl ? durationEl.innerText : 'Unknown';
          
          // Non-stop info
          const stopsEl = el.querySelector('.stop-info, .stops, .flight-stop, [class*="Stop"]');
          const stopsText = stopsEl ? stopsEl.innerText : '';
          
          // Times (Departure/Arrival)
          const timeEls = el.querySelectorAll('.time, .hour, .flight-time, [class*="Time"]');
          let departureTime = '';
          let arrivalTime = '';
          
          if (timeEls.length >= 2) {
            departureTime = timeEls[0].innerText;
            arrivalTime = timeEls[1].innerText;
          }

          // Flight Number - Trip.com usually has a dedicated element or it's in the text
          const flightNoEl = el.querySelector('.flight-no, .flight-number, [class*="FlightNo"]');
          let flightNumber = flightNoEl ? flightNoEl.innerText : 'N/A';
          
          if (flightNumber === 'N/A') {
              const match = el.innerText.match(/[A-Z0-9]{2,3}\d{3,4}/);
              flightNumber = match ? match[0] : 'N/A';
          }

          const priceMatch = priceText.replace(/[^\d]/g, '');
          const price = priceMatch ? parseInt(priceMatch, 10) : null;

          return {
            price,
            airline,
            duration,
            isNonStop: stopsText.toLowerCase().includes('direct') || stopsText.toLowerCase().includes('non-stop') || stopsText.includes('直飞'),
            departureTime,
            arrivalTime,
            flightNumber,
            rawPrice: priceText,
            rawStops: stopsText
          };
        });
      });

      return flights.filter(f => f.price !== null && f.airline !== 'Unknown');
      
    } catch (error) {
      console.error(`Error scraping Trip.com: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CtripScraper;
