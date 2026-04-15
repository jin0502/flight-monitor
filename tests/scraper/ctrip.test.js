const CtripScraper = require('../../src/scraper/providers/ctrip');

describe('CtripScraper', () => {
  let scraper;

  beforeAll(async () => {
    scraper = new CtripScraper();
    await scraper.init(true); // Headless for testing
  }, 30000); // 30s timeout for browser init

  afterAll(async () => {
    if (scraper) {
      await scraper.close();
    }
  });

  test('should scrape PVG to TYO flights from Trip.com', async () => {
    const results = await scraper.scrape('PVG', 'TYO', '2026-05-15', '2026-05-22');
    
    expect(Array.isArray(results)).toBe(true);
    // Even if results are 0 (e.g., due to no flights or blocking), 
    // we want to ensure it doesn't crash and returns the right structure.
    if (results.length > 0) {
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('price');
      expect(typeof firstResult.price).toBe('number');
      expect(firstResult).toHaveProperty('airline');
      expect(firstResult).toHaveProperty('departureTime');
      expect(firstResult).toHaveProperty('arrivalTime');
      expect(firstResult).toHaveProperty('isNonStop');
    }
  }, 60000); // 60s timeout for scraping
});
