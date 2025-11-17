import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';

/**
 * Fetches product prices from Amazon product pages using Puppeteer
 */
export class PriceFetcher {
  /**
   * Fetch the price of a product from its Amazon URL
   */
  async fetchPrice(productUrl: string): Promise<number | null> {
    let browser = null;
    try {
      logger.info(`Fetching price from: ${productUrl}`);

      // Clean up the URL - extract just the product page
      const cleanUrl = this.cleanProductUrl(productUrl);
      if (!cleanUrl) {
        logger.warn(`Invalid product URL: ${productUrl}`);
        return null;
      }

      // Launch headless browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ],
      });

      const page = await browser.newPage();

      // Set viewport and user agent to appear more like a real browser
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to the product page
      await page.goto(cleanUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the page HTML
      const html = await page.content();

      // Close the browser
      await browser.close();
      browser = null;

      // Parse with Cheerio
      const $ = cheerio.load(html);

      // Try multiple selectors to find the price
      const price = this.extractPriceFromPage($);

      if (price) {
        logger.info(`Found price: $${price} for ${cleanUrl}`);
        return price;
      }

      logger.warn(`Could not extract price from: ${cleanUrl}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching price: ${error}`, { url: productUrl });
      return null;
    } finally {
      // Ensure browser is closed even if there's an error
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          logger.error(`Error closing browser: ${closeError}`);
        }
      }
    }
  }

  /**
   * Fetch prices for multiple products concurrently (with rate limiting)
   */
  async fetchPrices(productUrls: string[]): Promise<(number | null)[]> {
    const results: (number | null)[] = [];

    // Fetch prices with a delay between requests to avoid rate limiting
    for (const url of productUrls) {
      const price = await this.fetchPrice(url);
      results.push(price);

      // Add a delay between requests (1-2 seconds)
      if (productUrls.indexOf(url) < productUrls.length - 1) {
        await this.delay(1000 + Math.random() * 1000);
      }
    }

    return results;
  }

  /**
   * Clean up Amazon product URL to get the canonical product page
   */
  private cleanProductUrl(url: string): string | null {
    try {
      // If it's a redirect URL, extract the actual URL
      if (url.includes('amazon.com/gp/r.html')) {
        const match = url.match(/U=([^&]+)/);
        if (match) {
          url = decodeURIComponent(match[1]);
        }
      }

      // Extract ASIN or product ID
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) ||
                       url.match(/\/gp\/product\/([A-Z0-9]{10})/i);

      if (asinMatch) {
        const asin = asinMatch[1];
        return `https://www.amazon.com/dp/${asin}`;
      }

      return null;
    } catch (error) {
      logger.error(`Error cleaning URL: ${error}`, { url });
      return null;
    }
  }

  /**
   * Extract price from Amazon product page
   */
  private extractPriceFromPage($: cheerio.CheerioAPI): number | null {
    // Try multiple selectors in order of preference
    const selectors = [
      // Main price
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      // Sale price
      '#priceblock_saleprice',
      // Digital/Kindle price
      '#kindle-price',
      // Buy box price
      '#price_inside_buybox',
      // Newer layouts
      '[data-a-color="price"] .a-offscreen',
      '.apexPriceToPay .a-offscreen',
      // Fallback
      'span[data-a-size="large"] .a-price .a-offscreen',
    ];

    for (const selector of selectors) {
      const priceText = $(selector).first().text().trim();
      if (priceText) {
        // Extract numeric value
        const cleanPrice = priceText.replace(/[^0-9.]/g, '');
        const price = parseFloat(cleanPrice);

        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }

    // Last resort: Look for any element with a price pattern
    const pricePattern = /\$\s*([\d,]+\.\d{2})/;
    let foundPrice: number | null = null;

    $('*').each((_, elem) => {
      if (foundPrice) return false; // Break if we found a price

      const text = $(elem).text();
      const match = text.match(pricePattern);

      if (match && !text.toLowerCase().includes('list') && !text.toLowerCase().includes('was')) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0 && price < 10000) {
          foundPrice = price;
          return false; // Break
        }
      }

      return true; // Continue iteration
    });

    return foundPrice;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const priceFetcher = new PriceFetcher();
