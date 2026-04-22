const { chromium } = require('playwright');

/**
 * BaseScraper is an abstract class providing Playwright browser initialization and teardown capabilities.
 * Specific scraper implementations should extend this class and implement the `scrape` method.
 */
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
    this.browser = await chromium.launch({ 
      headless,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--js-flags="--max-old-space-size=256"' // Limit JS memory
      ]
    });
    
    await this.setupContextAndPage();
  }

  /**
   * Initialize using an existing browser instance to save memory.
   * @param {Browser} browser - Existing Playwright browser instance.
   */
  async initWithBrowser(browser) {
    this.browser = browser;
    this.isSharedBrowser = true;
    await this.setupContextAndPage();
  }

  /**
   * Internal helper to setup context, page, and resource blocking.
   * @private
   */
  async setupContextAndPage() {
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();

    // CPU & Memory Optimization: Block unnecessary resources
    await this.page.route('**/*', (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      
      if (['image', 'media', 'font'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  /**
   * Close the browser instance (or just the context if shared).
   */
  async close() {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser && !this.isSharedBrowser) {
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
