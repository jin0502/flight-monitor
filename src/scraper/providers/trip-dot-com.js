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
          const legs = el.querySelectorAll('[class*="flight-item-leg"], .flight-item-leg, [class*="Leg"]');
          
          let departureTime = '';
          let returnDepartureTime = '';
          let flightNumber = 'N/A';
          let returnFlightNumber = 'N/A';

          if (legs.length > 0) {
              // Outbound
              const depEl = legs[0].querySelector('[class*="departure"], .is-departure_2a2b');
              if (depEl) {
                  const timeSpan = depEl.querySelector('span span') || depEl.querySelector('.time');
                  departureTime = timeSpan ? timeSpan.innerText : '';
              }
              
              const legText = legs[0].textContent || '';
              const outMatch = legText.match(/\b(?!CNY|USD)[A-Z0-9]{2}\d{3,4}\b/);
              flightNumber = outMatch ? outMatch[0] : 'N/A';

              // Return (if round trip)
              if (legs.length > 1) {
                  const retEl = legs[1].querySelector('[class*="departure"], .is-departure_2a2b');
                  if (retEl) {
                      const timeSpan = retEl.querySelector('span span') || retEl.querySelector('.time');
                      returnDepartureTime = timeSpan ? timeSpan.innerText : '';
                  }
                  
                  const retLegText = legs[1].textContent || '';
                  const retMatch = retLegText.match(/\b(?!CNY|USD)[A-Z0-9]{2}\d{3,4}\b/);
                  returnFlightNumber = retMatch ? retMatch[0] : 'N/A';
              }
          }

          // Fallback for single-leg format or if legs selector fails
          if (flightNumber === 'N/A') {
              const text = el.textContent || '';
              const matches = [...text.matchAll(/\b(?!CNY|USD)[A-Z]{1,2}\d{3,4}\b/g)];
              flightNumber = matches[0] ? matches[0][0] : 'N/A';
              if (legs.length > 1 && matches[1]) {
                  returnFlightNumber = matches[1][0];
              }
          }

          const priceMatch = priceText.replace(/[^\d]/g, '');
          const price = priceMatch ? parseInt(priceMatch, 10) : null;

          return {
            price,
            airline,
            departureTime,
            flightNumber,
            returnDepartureTime,
            returnFlightNumber,
            destinationAirportName: '', // Usually hard to get unique per leg in this view
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

