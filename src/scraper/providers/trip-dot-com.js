const BaseScraper = require('../index');

class TripDotComScraper extends BaseScraper {
  constructor() {
    super();
  }

  /**
   * Scrape flight data from Trip.com (International).
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

    const url = `https://www.trip.com/flights/${origin.toLowerCase()}-to-${destination.toLowerCase()}/tickets-${origin.toLowerCase()}-${destination.toLowerCase()}?ddate=${startDate}&rdate=${endDate}&curr=CNY`;
    
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (e) {}

      // Wait for flight results
      const resultSelectors = ['.flight-item', '.search-result-item', 'div[class*="FlightItem"]'];
      let foundSelector = null;
      for (const selector of resultSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          foundSelector = selector;
          break;
        } catch (e) {}
      }

      if (!foundSelector) return [];

      const flights = await this.page.$$eval(foundSelector, (elements) => {
        return elements.map(el => {
          // Price
          const priceEl = el.querySelector('.price-amount, .price, [class*="price"], [class*="Price"]');
          const priceText = priceEl ? priceEl.innerText : '';
          
          // Airline
          const airlineEl = el.querySelector('.airline-name, .airline, [class*="airline"], [class*="AirlineName"]');
          const airline = airlineEl ? airlineEl.innerText : 'Unknown';
          
          // Times & Airports
          // Trip.com uses specific internal classes like .is-departure_2a2b
          const depEl = el.querySelector('[class*="departure"], .is-departure_2a2b');
          const arrEl = el.querySelector('[class*="arrival"], .is-arrival_f407');
          
          let departureTime = '';
          if (depEl) {
              const timeSpan = depEl.querySelector('span span') || depEl.querySelector('.time');
              departureTime = timeSpan ? timeSpan.innerText : '';
          }

          let destinationAirportName = '';
          if (arrEl) {
              destinationAirportName = arrEl.getAttribute('aria-label') || '';
              // Clean up "Arrival at Tokyo Haneda Airport" -> "Tokyo Haneda Airport"
              destinationAirportName = destinationAirportName.replace(/Arrival at /i, '').replace(/到达 /i, '');
          }

          // Flight Number
          // Often hidden in data attributes or detail sections
          // We use textContent to find hidden flight numbers
          const flightNoEl = el.querySelector('[class*="flight-no"], [class*="FlightNo"]');
          let flightNumber = flightNoEl ? (flightNoEl.textContent || flightNoEl.innerText).trim() : 'N/A';
          
          if (flightNumber === 'N/A' || flightNumber.length > 10 || /CNY|USD/.test(flightNumber)) {
              // Try to find it in the entire text of the element (including hidden)
              const text = el.textContent || '';
              const match = text.match(/\b(?!CNY|USD)[A-Z]{1,2}\d{3,4}\b/);
              flightNumber = match ? match[0] : 'N/A';
          }

          const priceMatch = priceText.replace(/[^\d]/g, '');
          const price = priceMatch ? parseInt(priceMatch, 10) : null;

          return {
            price,
            airline,
            departureTime,
            flightNumber,
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
      console.error(`Error scraping Trip.com: ${error.message}`);
      return [];
    }
  }
}

module.exports = TripDotComScraper;

