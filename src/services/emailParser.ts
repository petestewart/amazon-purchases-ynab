import * as cheerio from 'cheerio';
import logger from '../utils/logger';
import { AmazonOrder, AmazonOrderItem, ParsedEmail } from '../types';

/**
 * Parses an Amazon order confirmation email
 */
export class EmailParser {
  /**
   * Main entry point to parse an email
   */
  parseEmail(html: string, text: string): ParsedEmail {
    logger.info('Parsing Amazon order email');

    const order = this.parseFromHtml(html) || this.parseFromText(text);

    if (!order) {
      throw new Error('Could not parse Amazon order from email');
    }

    logger.info(`Parsed order ${order.orderNumber} with ${order.items.length} items`);

    return {
      order,
      rawHtml: html,
      rawText: text,
    };
  }

  /**
   * Decode quoted-printable encoded text
   */
  private decodeQuotedPrintable(text: string): string {
    return text
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Parse order information from HTML content
   */
  private parseFromHtml(html: string): AmazonOrder | null {
    try {
      // Decode quoted-printable encoding if present
      const decodedHtml = this.decodeQuotedPrintable(html);
      const $ = cheerio.load(decodedHtml);

      // Extract order number - multiple possible selectors
      const orderNumber = this.extractOrderNumber($) || '';
      if (!orderNumber) {
        logger.warn('Could not extract order number from HTML');
        return null;
      }

      // Extract grand total
      const grandTotal = this.extractGrandTotal($);
      if (grandTotal === 0) {
        logger.warn('Could not extract grand total from HTML');
        return null;
      }

      // Extract items
      const items = this.extractItems($);
      if (items.length === 0) {
        logger.warn('Could not extract items from HTML');
        return null;
      }

      // Extract delivery address (optional)
      const deliveryAddress = this.extractDeliveryAddress($);

      return {
        orderNumber,
        grandTotal,
        items,
        deliveryAddress,
        orderDate: new Date(),
      };
    } catch (error) {
      logger.error('Error parsing HTML', error);
      return null;
    }
  }

  /**
   * Extract order number from various possible locations
   */
  private extractOrderNumber($: cheerio.CheerioAPI): string | null {
    // Try to find "Order #" text
    const orderText = $('*:contains("Order #")')
      .filter(function() {
        return $(this).children().length === 0; // Only text nodes
      })
      .first()
      .text();

    const match = orderText.match(/Order\s*#\s*[\u200B]?(\d{3}-\d{7}-\d{7})/);
    if (match) {
      return match[1];
    }

    // Alternative: Look in spans/divs with specific text
    const orderNumberText = $('span, div')
      .filter(function() {
        const text = $(this).text();
        return /\d{3}-\d{7}-\d{7}/.test(text);
      })
      .first()
      .text();

    const altMatch = orderNumberText.match(/(\d{3}-\d{7}-\d{7})/);
    return altMatch ? altMatch[1] : null;
  }

  /**
   * Extract grand total from the email
   */
  private extractGrandTotal($: cheerio.CheerioAPI): number {
    // Look for "Grand Total" text and find the amount in the next cell or nearby
    const grandTotalElement = $('*:contains("Grand Total")').filter(function() {
      const text = $(this).text().trim();
      return text === 'Grand Total:' || text === 'Grand Total';
    }).first();

    if (grandTotalElement.length > 0) {
      // Try to find the amount in the next sibling cell
      let amountText = grandTotalElement.next().text();

      // If not found, try looking in the parent row for a bold amount
      if (!amountText || !/\$/.test(amountText)) {
        amountText = grandTotalElement.closest('tr').find('td').filter(function() {
          return /\$\s*\d+\.\d{2}/.test($(this).text());
        }).text();
      }

      const match = amountText.match(/\$\s*([\d,]+\.\d{2})/);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }

    // Alternative: Look for bold text with currency
    const amountText = $('td, div')
      .filter(function() {
        const text = $(this).text();
        return /\$\s*\d+\.\d{2}/.test(text) &&
               (text.includes('Total') || text.includes('total'));
      })
      .first()
      .text();

    const match = amountText.match(/\$\s*([\d,]+\.\d{2})/);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }

    return 0;
  }

  /**
   * Extract items from the email
   */
  private extractItems($: cheerio.CheerioAPI): AmazonOrderItem[] {
    const items: AmazonOrderItem[] = [];

    // Method 1: Look for product links and associated text
    // Include redirect URLs that contain encoded /dp/ (%2Fdp%2F) or /gp/product/ (%2Fgp%2Fproduct%2F)
    $('a[href*="amazon.com/dp/"], a[href*="amazon.com/gp/product/"], a[href*="amazon.com/gp/r.html"]').each((_, elem) => {
      const $link = $(elem);

      // Get product URL (decode it)
      let productUrl = $link.attr('href') || '';

      // Skip recommended products (these appear in "Continue shopping deals" section)
      if (productUrl.includes('AGH3Col') || productUrl.includes('dealz_cs')) {
        return;
      }

      if (productUrl.includes('amazon.com/gp/r.html')) {
        // This is a redirect URL, extract the actual product URL
        const urlMatch = productUrl.match(/U=([^&]+)/);
        if (urlMatch) {
          productUrl = decodeURIComponent(urlMatch[1]);
        }
      }

      // Skip if this isn't a product URL (after decoding)
      if (!productUrl.includes('/dp/') && !productUrl.includes('/gp/product/')) {
        return;
      }

      // Extract product name from link text or alt attribute
      let name = $link.text().trim();
      if (!name) {
        name = $link.find('img').attr('alt') || '';
      }

      // Skip if name is empty or too generic
      if (!name || name.length < 3) {
        return;
      }

      // Look for quantity nearby
      let quantity = 1;
      const parent = $link.closest('td, div');
      const quantityText = parent.find('*:contains("Quantity")').text();
      const qtyMatch = quantityText.match(/Quantity:\s*(\d+)/i);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
      }

      // Check if this item already exists
      const existingItem = items.find(item =>
        item.name === name || item.productUrl === productUrl
      );

      if (!existingItem && name) {
        items.push({
          name,
          quantity,
          productUrl: productUrl || undefined,
        });
      }
    });

    // Method 2: Fallback - look for list items with product names
    if (items.length === 0) {
      $('li, div').filter(function() {
        const text = $(this).text();
        return text.includes('Quantity:') && !text.includes('Grand Total');
      }).each((_, elem) => {
        const text = $(elem).text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length >= 2) {
          const name = lines[0];
          const qtyMatch = text.match(/Quantity:\s*(\d+)/i);
          const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

          items.push({
            name,
            quantity,
          });
        }
      });
    }

    return items;
  }

  /**
   * Extract delivery address (optional)
   */
  private extractDeliveryAddress($: cheerio.CheerioAPI): string | undefined {
    // Look for address-like patterns
    const addressText = $('*:contains("MADISON, TN"), *:contains("Delivering to")')
      .first()
      .text()
      .trim();

    return addressText || undefined;
  }

  /**
   * Fallback: Parse from plain text email
   */
  private parseFromText(text: string): AmazonOrder | null {
    try {
      // Extract order number
      const orderMatch = text.match(/Order\s*#\s*(\d{3}-\d{7}-\d{7})/);
      if (!orderMatch) {
        return null;
      }
      const orderNumber = orderMatch[1];

      // Extract grand total
      const totalMatch = text.match(/Grand Total[:\s]*\$?\s*([\d,]+\.\d{2})/i);
      if (!totalMatch) {
        return null;
      }
      const grandTotal = parseFloat(totalMatch[1].replace(/,/g, ''));

      // Extract items (this is more challenging with plain text)
      const items: AmazonOrderItem[] = [];
      const lines = text.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for lines followed by "Quantity: X"
        if (line && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const qtyMatch = nextLine.match(/Quantity:\s*(\d+)/i);

          if (qtyMatch && !line.includes('Grand Total') && !line.includes('Order #')) {
            items.push({
              name: line,
              quantity: parseInt(qtyMatch[1], 10),
            });
          }
        }
      }

      if (items.length === 0) {
        return null;
      }

      return {
        orderNumber,
        grandTotal,
        items,
        orderDate: new Date(),
      };
    } catch (error) {
      logger.error('Error parsing plain text email', error);
      return null;
    }
  }
}

export const emailParser = new EmailParser();
