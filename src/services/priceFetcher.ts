import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';

/**
 * Fetches product prices from Amazon product pages
 */
export class PriceFetcher {
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Fetch the price of a product from its Amazon URL
   */
  async fetchPrice(productUrl: string): Promise<number | null> {
    try {
      logger.info(`Fetching price from: ${productUrl}`);

      // Clean up the URL - extract just the product page
      const cleanUrl = this.cleanProductUrl(productUrl);
      if (!cleanUrl) {
        logger.warn(`Invalid product URL: ${productUrl}`);
        return null;
      }

      // Fetch the product page
      const response = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      // Try multiple selectors to find the price
      const price = this.extractPriceFromPage($);

      if (price) {
        logger.info(`Found price: $${price} for ${cleanUrl}`);
        return price;
      }

      logger.warn(`Could not extract price from: ${cleanUrl}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`HTTP error fetching price: ${error.message}`, {
          status: error.response?.status,
          url: productUrl,
        });
      } else {
        logger.error(`Error fetching price: ${error}`, { url: productUrl });
      }
      return null;
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
