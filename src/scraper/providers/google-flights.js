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

    // curr=CNY forces currency, hl=zh-CN forces Chinese language for easier parsing
    const url = `https://www.google.com/travel/flights?q=Flights%20to%20${destination}%20from%20${origin}%20on%20${startDate}%20through%20${endDate}&curr=CNY&hl=zh-CN`;
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });

      // Handle cookie consent
      try {
        const consentSelectors = [
          'button[aria-label="全部接受"]',
          'button[aria-label="同意"]',
          'button:has-text("全部接受")',
          'button:has-text("同意")',
          'button:has-text("Accept all")',
          'button:has-text("I agree")'
        ];
        
        for (const selector of consentSelectors) {
          const btn = await this.page.$(selector);
          if (btn) {
            await btn.click();
            await this.page.waitForLoadState('networkidle');
            break;
          }
        }
      } catch (e) {
        // Silent catch
      }

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
          
          // Airline: .sSHqwe
          const airlineEl = el.querySelector('.sSHqwe');
          const airline = airlineEl ? airlineEl.innerText : 'Unknown';
          
          // Duration: .gv33Mc
          const durationEl = el.querySelector('.gv33Mc');
          const duration = durationEl ? durationEl.innerText : 'Unknown';
          
          // Stops: .Ef6thf
          const stopsEl = el.querySelector('.Ef6thf');
          const stopsText = stopsEl ? stopsEl.innerText : '';
          
          // Times
          const timeSpans = el.querySelectorAll('.mv1WYe span[role="text"]');
          let departureTime = '';
          let arrivalTime = '';
          
          if (timeSpans.length >= 2) {
            departureTime = timeSpans[0].innerText;
            arrivalTime = timeSpans[1].innerText;
          }

          // Airport Names (if available in sub-text)
          // Google sometimes puts airport names in aria-labels or smaller spans
          const secondaryInfo = el.querySelectorAll('.sSHqwe span');
          let destinationAirportName = '';
          if (secondaryInfo.length > 0) {
              // This is a naive heuristic, often the destination airport name is here
          }

          // Flight Number
          const flightNumberMatch = el.innerText.match(/[A-Z0-9]{2,3}\d{3,4}/);
          const flightNumber = flightNumberMatch ? flightNumberMatch[0] : 'N/A';

          const priceMatch = priceText.replace(/[^\d]/g, '');
          const price = priceMatch ? parseInt(priceMatch, 10) : null;

          return {
            price,
            airline,
            duration,
            isNonStop: stopsText.toLowerCase().includes('nonstop') || stopsText.includes('直飞'),
            departureTime,
            arrivalTime,
            flightNumber,
            destinationAirportName,
            rawPrice: priceText,
            rawStops: stopsText
          };
        });
      });

      return flights.filter(f => f.price !== null && f.airline !== 'Unknown');
      
    } catch (error) {
      console.error(`Error scraping Google Flights: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GoogleFlightsScraper;
