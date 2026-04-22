const BaseScraper = require('../index');

class CtripScraper extends BaseScraper {
  constructor() {
    super();
  }

  /**
   * Scrape flight data from Ctrip.com (Chinese).
   * @param {string} origin - Origin airport code (e.g., SHA).
   * @param {string} destination - Destination airport code (e.g., TAO).
   * @param {string} startDate - Start date (YYYY-MM-DD).
   * @param {string} endDate - End date (YYYY-MM-DD).
   * @returns {Promise<Array>} - List of flight objects.
   */
  async scrape(origin, destination, startDate, endDate) {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call init() first.');
    }

    // Direct URL navigation is more reliable for Ctrip
    const url = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${startDate}`;
    
    try {
      console.log(`Navigating to Ctrip: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait for content to load (Ctrip uses a skeleton UI)
      try {
        await this.page.waitForSelector('.flight-item, .search-result-item', { timeout: 15000 });
      } catch (e) {
        console.warn('Ctrip: Results selector not found, checking for alternative selectors...');
      }

      // Extract data
      const flights = await this.page.$$eval('.flight-item, .search-result-item, [class*="flight-item"]', (elements) => {
        return elements.map(el => {
          // Price
          const priceEl = el.querySelector('.price, [class*="price"]');
          const priceText = priceEl ? priceEl.innerText : '';
          
          // Airline
          const airlineEl = el.querySelector('.airline-name, [class*="airline-name"]');
          const airline = airlineEl ? airlineEl.innerText : 'Unknown';
          
          // Times
          const depTimeEl = el.querySelector('.depart-box .time, [class*="depart"] .time');
          const departureTime = depTimeEl ? depTimeEl.innerText : '';

          // Flight Number
          // Heuristic: Search for patterns like MU3752, SC4660
          // We exclude CNY and other currency-like patterns
          const text = el.textContent || '';
          const flightNumberMatch = text.match(/\b(?!CNY|USD)[A-Z]{1,2}\d{3,4}\b/);
          let flightNumber = flightNumberMatch ? flightNumberMatch[0] : 'N/A';
          
          if (flightNumber === 'N/A') {
              // Try broader match if specific one fails
              const match = text.match(/[A-Z][A-Z0-9]\d{3,4}/);
              flightNumber = match ? match[0] : 'N/A';
          }

          // Airport Names
          const airportEls = el.querySelectorAll('.airport, [class*="airport"]');
          const originAirportName = airportEls[0] ? airportEls[0].innerText : '';
          const destinationAirportName = airportEls[1] ? airportEls[1].innerText : '';

          const priceMatch = priceText.replace(/[^\d]/g, '');
          const price = priceMatch ? parseInt(priceMatch, 10) : null;

          return {
            price,
            airline,
            departureTime,
            flightNumber,
            originAirportName,
            destinationAirportName,
            rawPrice: priceText
          };
        });
      });

      return flights.filter(f => f.price !== null).map(f => ({
          ...f,
          destinationAirport: destination
      }));
      
    } catch (error) {
      console.error(`Error scraping Ctrip.com (Chinese): ${error.message}`);
      return [];
    }
  }
}

module.exports = CtripScraper;
