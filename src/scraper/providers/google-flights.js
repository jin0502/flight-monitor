const BaseScraper = require('../index');

class GoogleFlightsScraper extends BaseScraper {
  constructor() {
    super();
  }

  /**
   * Scrape flight data from Google Flights.
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

    const url = `https://www.google.com/travel/flights?q=Flights%20to%20${destination}%20from%20${origin}%20on%20${startDate}%20through%20${endDate}&curr=CNY&hl=zh-CN`;
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });

      // Wait for results
      try {
        await this.page.waitForSelector('li.pIav2d', { timeout: 20000 });
      } catch (e) {
        return [];
      }

      // Extract data
      const flights = await this.page.$$eval('li.pIav2d', (elements) => {
        return elements.map(el => {
          // Price
          const priceEl = el.querySelector('.YMlS1d') || el.querySelector('span[aria-label*="价格"]');
          const priceText = priceEl ? priceEl.innerText : '';
          
          // Airline
          const airlineEl = el.querySelector('.sSHqwe');
          const airline = airlineEl ? airlineEl.innerText : 'Unknown';
          
          // Times
          const timeSpans = el.querySelectorAll('.mv1WYe span[role="text"]');
          let departureTime = '';
          if (timeSpans.length >= 2) {
            departureTime = timeSpans[0].innerText;
          }

          // Airport Names
          // Google puts airport names in specific spans or aria-labels
          let destinationAirportName = '';
          const airportInfoEls = el.querySelectorAll('.sSHqwe span');
          if (airportInfoEls.length > 0) {
              // Usually the last span in the airline/airport container is the arrival airport
              destinationAirportName = airportInfoEls[airportInfoEls.length - 1].innerText;
          }

          // Flight Number
          // Heuristic: search for pattern like MU523, NH920
          const flightNumberMatch = el.innerText.match(/[A-Z0-9]{2,3}\d{3,4}/);
          const flightNumber = flightNumberMatch ? flightNumberMatch[0] : 'N/A';

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

      return flights.filter(f => f.price !== null);
      
    } catch (error) {
      console.error(`Error scraping Google Flights: ${error.message}`);
      return [];
    }
  }
}

module.exports = GoogleFlightsScraper;
