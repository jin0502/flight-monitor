const BaseScraper = require('../index');

class CtripScraper extends BaseScraper {
  constructor() {
    super();
  }

  /**
   * Scrape flight data from Ctrip.com (Chinese).
   * 
   * ARCHITECTURE NOTE (Round-Trip):
   * Ctrip's round-trip page is a TWO-STEP flow:
   *   Step 1: Shows outbound flights with "best combination price"
   *   Step 2: After selecting outbound, shows return flights
   * 
   * The return flight number/airline is NOT available in Step 1 DOM or API.
   * The price shown IS the round-trip combination price.
   * We extract what's available and clearly mark return details as TBD.
   *
   * @param {string} origin - Origin airport code (e.g., SHA).
   * @param {string} destination - Destination airport code (e.g., TYO).
   * @param {string} startDate - Start date (YYYY-MM-DD).
   * @param {string} endDate - End date (YYYY-MM-DD).
   * @returns {Promise<Array>} - List of flight objects.
   */
  async scrape(origin, destination, startDate, endDate) {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call init() first.');
    }

    let url = `https://flights.ctrip.com/online/list/oneway-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${startDate}`;
    if (endDate) {
        url = `https://flights.ctrip.com/online/list/round-${origin.toLowerCase()}-${destination.toLowerCase()}?depdate=${startDate}_${endDate}`;
    }
    
    try {
      console.log(`Navigating to Ctrip: ${url}`);
      
      // Strategy: intercept the search API for structured data, fall back to DOM
      let apiFlights = null;
      
      const apiHandler = async (response) => {
          const respUrl = response.url();
          if (respUrl.includes('/search/pull/') && !apiFlights) {
              try {
                  const body = await response.json();
                  if (body.data && body.data.flightItineraryList && body.data.flightItineraryList.length > 0) {
                      apiFlights = body.data.flightItineraryList;
                  }
              } catch(e) { /* skip non-json */ }
          }
      };
      
      this.page.on('response', apiHandler);
      
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait for results to render
      try {
        await this.page.waitForSelector('.flight-item, .search-result-item, .search_flight_item, [class*="FlightItem"]', { timeout: 15000 });
      } catch (e) {
        console.warn('Ctrip: Results selector not found, checking API data...');
      }
      
      // Give the API poll time to return flight data
      await this.page.waitForTimeout(5000);
      
      // Remove listener to prevent memory leaks
      this.page.removeListener('response', apiHandler);
      
      // === PRIMARY: Extract from API response (structured, reliable) ===
      let finalFlights = [];
      if (apiFlights && apiFlights.length > 0) {
          console.log(`Ctrip API: captured ${apiFlights.length} itineraries`);
          
          const flights = apiFlights
              .filter(item => item.priceList && item.priceList.length > 0)
              .map(item => {
                  const seg = item.flightSegments[0];
                  const flight = seg.flightList[0];
                  const price = item.priceList[0];
                  
                  // Extract departure time as HH:mm from "2026-05-20 08:15:00"
                  const depTime = flight.departureDateTime.split(' ')[1].substring(0, 5);
                  
                  return {
                      price: price.adultPrice,
                      airline: seg.airlineName,
                      departureTime: depTime,
                      flightNumber: flight.flightNo,
                      departureAirportCode: flight.departureAirportCode,
                      arrivalAirportCode: flight.arrivalAirportCode,
                      // Return flight: not available in outbound-step API
                      // The price IS round-trip combination price
                      returnDepartureTime: '',
                      returnFlightNumber: '',
                      rawPrice: `¥${price.adultPrice}`
                  };
              })
              .sort((a, b) => a.price - b.price);
          
          // Now extract combination prices from DOM (these are the real round-trip prices)
          const domPrices = await this.page.$$eval(
              '.flight-item, .search-result-item, .search_flight_item, [class*="FlightItem"]', 
              (elements) => {
                  return elements.map(el => {
                      const priceEl = el.querySelector('.price, [class*="price"]');
                      const priceText = priceEl ? priceEl.innerText.replace(/[^\d]/g, '') : '';
                      
                      // Get the itinerary ID from element IDs
                      const idEl = el.querySelector('[id*="airlineName"]');
                      const idMatch = idEl ? idEl.id.match(/airlineName(.+)/) : null;
                      const itineraryId = idMatch ? idMatch[1] : null;
                      
                      return {
                          domPrice: priceText ? parseInt(priceText, 10) : null,
                          itineraryId
                      };
                  });
              }
          );
          
          // Merge DOM combination prices with API data
          for (const dp of domPrices) {
              if (!dp.domPrice || !dp.itineraryId) continue;
              const match = flights.find(f => dp.itineraryId.startsWith(f.flightNumber));
              if (match && dp.domPrice < match.price) {
                  // DOM shows the round-trip combination price (lower than one-way API price)
                  match.price = dp.domPrice;
                  match.rawPrice = `¥${dp.domPrice}`;
              }
          }
          
          flights.sort((a, b) => a.price - b.price);
          
          finalFlights = flights.map(f => ({
              ...f,
              destinationAirport: f.arrivalAirportCode || destination
          }));
      } else {
          // === FALLBACK: DOM-only extraction ===
          console.log('Ctrip: No API data captured, falling back to DOM extraction');
          const domFlights = await this.page.$$eval(
          '.flight-item, .search-result-item, .search_flight_item, [class*="FlightItem"]', 
          (elements) => {
              return elements.map(el => {
                  const priceEl = el.querySelector('.price, [class*="price"]');
                  const priceText = priceEl ? priceEl.innerText : '';
                  
                  const airlineEl = el.querySelector('.airline-name, [class*="airline-name"]');
                  const airline = airlineEl ? airlineEl.innerText : 'Unknown';
                  
                  // In Ctrip round-trip, .time elements are: [outbound departure, outbound arrival]
                  const timeEls = el.querySelectorAll('.time');
                  const departureTime = timeEls[0] ? timeEls[0].innerText.trim() : '';
                  
                  // Flight number from .plane-No
                  const planeNoEl = el.querySelector('.plane-No');
                  const planeText = planeNoEl ? planeNoEl.textContent : '';
                  const fnMatch = planeText.match(/[A-Z][A-Z0-9]\d{2,4}/);
                  const flightNumber = fnMatch ? fnMatch[0] : 'N/A';
                  
                  const priceMatch = priceText.replace(/[^\d]/g, '');
                  const price = priceMatch ? parseInt(priceMatch, 10) : null;
                  
                  return {
                      price,
                      airline,
                      departureTime,
                      flightNumber,
                      returnDepartureTime: '',
                      returnFlightNumber: '',
                      rawPrice: priceText
                  };
              });
          }
        );

          finalFlights = domFlights.filter(f => f.price !== null).map(f => ({
              ...f,
              destinationAirport: destination
          }));
          finalFlights.sort((a, b) => a.price - b.price);
      }
      
      if (finalFlights.length > 0 && endDate) {
          console.log('Ctrip: Fetching return details for the cheapest flight...');
          let routeSearchData = null;
          const routeHandler = async (response) => {
              if (response.url().includes('/search/routeSearch') || response.url().includes('flightItinerary')) {
                  try {
                      const body = await response.json();
                      if (body.data && body.data.flightItineraryList && body.data.flightItineraryList.length > 0) {
                          const first = body.data.flightItineraryList[0];
                          if (first.flightSegments && first.flightSegments.length > 1) {
                              routeSearchData = body.data.flightItineraryList;
                          }
                      }
                  } catch(e) {}
              }
          };
          this.page.on('response', routeHandler);
          
          const btns = await this.page.$$('.btn-book, [class*="price"] button, .flight-operate .btn');
          if (btns.length > 0) {
              await btns[0].click({ force: true }).catch(() => {});
              
              // Wait up to 5s for the API
              for(let i=0; i<10; i++) {
                  await this.page.waitForTimeout(500);
                  if (routeSearchData) break;
              }
              
              if (routeSearchData) {
                  // Find the best combination
                  const best = routeSearchData.sort((a, b) => (a.priceList[0]?.adultPrice || 99999) - (b.priceList[0]?.adultPrice || 99999))[0];
                  if (best && best.flightSegments && best.flightSegments.length > 1) {
                      const returnSeg = best.flightSegments[1].flightList[0];
                      const retTime = returnSeg.departureDateTime.split(' ')[1].substring(0, 5);
                      const airlineName = returnSeg.marketAirlineName || returnSeg.airlineName || 'Unknown Airline';
                      
                      finalFlights[0].returnDepartureTime = retTime;
                      finalFlights[0].returnFlightNumber = returnSeg.flightNo;
                      finalFlights[0].returnAirline = airlineName;
                      console.log(`Ctrip: Captured return flight -> ${airlineName} ${returnSeg.flightNo} ${retTime}`);
                  }
              } else {
                  console.log('Ctrip: Failed to capture return flight details (API timeout)');
              }
          }
          this.page.removeListener('response', routeHandler);
      }

      return finalFlights;
      
    } catch (error) {
      console.error(`Error scraping Ctrip.com (Chinese): ${error.message}`);
      return [];
    }
  }
}

module.exports = CtripScraper;
