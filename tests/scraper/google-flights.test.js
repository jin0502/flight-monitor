const GoogleFlightsScraper = require('../../src/scraper/providers/google-flights');

describe('GoogleFlightsScraper', () => {
  let scraper;

  beforeAll(async () => {
    scraper = new GoogleFlightsScraper();
    await scraper.init(true); // Headless for testing
  }, 30000); // 30s timeout for browser init

  afterAll(async () => {
    if (scraper) {
      await scraper.close();
    }
  });

  test('should scrape PVG to TYO flights', async () => {
    const results = await scraper.scrape('PVG', 'TYO', '2026-05-15', '2026-05-22');
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    const firstResult = results[0];
    expect(firstResult).toHaveProperty('price');
    expect(typeof firstResult.price).toBe('number');
    expect(firstResult).toHaveProperty('airline');
    expect(firstResult).toHaveProperty('departureTime');
    expect(firstResult).toHaveProperty('arrivalTime');
    expect(firstResult).toHaveProperty('isNonStop');
  }, 60000); // 60s timeout for scraping
});
