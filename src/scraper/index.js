const { firefox } = require('playwright');

class BaseScraper {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Initialize the Playwright browser, context, and page.
   * @param {boolean} headless - Whether to run the browser in headless mode.
   */
  async init(headless = true) {
    this.browser = await firefox.launch({ headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
    });
    this.page = await this.context.newPage();
  }

  /**
   * Close the browser instance.
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Abstract method for scraping logic.
   * @param {string} origin - Origin airport code.
   * @param {string} destination - Destination airport code.
   * @param {string} startDate - Start date (YYYY-MM-DD).
   * @param {string} endDate - End date (YYYY-MM-DD).
   * @returns {Promise<Array>} - Scraped flight results.
   */
  async scrape(origin, destination, startDate, endDate) {
    throw new Error('Method scrape() must be implemented');
  }
}

module.exports = BaseScraper;
