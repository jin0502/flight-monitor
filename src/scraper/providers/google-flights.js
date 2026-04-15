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

    const url = `https://www.google.com/travel/flights?q=Flights%20to%20${destination}%20from%20${origin}%20on%20${startDate}%20through%20${endDate}`;
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });

      // Handle cookie consent
      try {
        const consentSelectors = [
          'button[aria-label="Accept all"]',
          'button[aria-label="I agree"]',
          'button:has-text("Accept all")',
          'button:has-text("I agree")',
          'button:has-text("同意")',
          'button:has-text("全部接受")'
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
          // Price: usually in a span with aria-label containing "Price" or with class .YMlS1d
          const priceEl = el.querySelector('.YMlS1d') || el.querySelector('span[aria-label*="Price"]');
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

          const priceMatch = priceText.replace(/[^\d]/g, '');
          const price = priceMatch ? parseInt(priceMatch, 10) : null;

          return {
            price,
            airline,
            duration,
            isNonStop: stopsText.toLowerCase().includes('nonstop') || stopsText.includes('直飞'),
            departureTime,
            arrivalTime,
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
