import logger from '../utils/logger';
import { emailParser } from './emailParser';
import { priceFetcher } from './priceFetcher';
import { taxCalculator } from './taxCalculator';
import { ynabClient } from './ynabClient';
import { AmazonOrderItem } from '../types';

/**
 * Main orchestrator for processing Amazon orders and creating YNAB transactions
 */
export class OrderProcessor {
  /**
   * Process an Amazon order email and create YNAB transactions
   */
  async processOrder(html: string, text: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Starting order processing');

      // Step 1: Parse the email
      const parsed = emailParser.parseEmail(html, text);
      const { order } = parsed;

      logger.info(`Processing order ${order.orderNumber} with ${order.items.length} item(s)`);

      // Step 2: Handle based on number of items
      if (order.items.length === 1) {
        // Single item - use grand total directly
        return await this.processSingleItem(order.items[0], order.orderNumber, order.grandTotal);
      } else {
        // Multiple items - fetch prices and split tax
        return await this.processMultipleItems(order.items, order.orderNumber, order.grandTotal);
      }
    } catch (error) {
      logger.error('Error processing order', error);
      return {
        success: false,
        message: `Error processing order: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Process a single-item order
   */
  private async processSingleItem(
    item: AmazonOrderItem,
    orderNumber: string,
    grandTotal: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Processing single-item order: ${item.name}`);

      // Create a single transaction with the grand total
      const transactionId = await ynabClient.createConsolidatedTransaction(
        orderNumber,
        grandTotal,
        [item.name]
      );

      logger.info(`Single transaction created: ${transactionId}`);

      return {
        success: true,
        message: `Created transaction for order ${orderNumber}: ${item.name} - $${grandTotal.toFixed(2)}`,
      };
    } catch (error) {
      logger.error('Error processing single item', error);
      throw error;
    }
  }

  /**
   * Process a multi-item order
   */
  private async processMultipleItems(
    items: AmazonOrderItem[],
    orderNumber: string,
    grandTotal: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Processing multi-item order with ${items.length} items`);

      // Step 1: Fetch prices for items that have product URLs
      const itemsWithPrices = await this.fetchItemPrices(items);

      // Step 2: Validate that we have prices for all items
      const missingPrices = itemsWithPrices.filter((item) => !item.price);
      if (missingPrices.length > 0) {
        logger.warn(`Could not fetch prices for ${missingPrices.length} items. Falling back to consolidated transaction.`);
        return await this.fallbackToConsolidated(items, orderNumber, grandTotal);
      }

      // Step 3: Calculate tax for each item
      const itemsWithTax = taxCalculator.calculateItemTaxes(itemsWithPrices, grandTotal);

      // Step 4: Create individual transactions in YNAB
      const transactionIds = await ynabClient.createTransactions(
        itemsWithTax,
        orderNumber
      );

      logger.info(`Created ${transactionIds.length} transactions for order ${orderNumber}`);

      // Step 5: Generate summary
      const summary = itemsWithTax
        .map((item) => `${item.name}: $${item.total.toFixed(2)}`)
        .join(', ');

      return {
        success: true,
        message: `Created ${transactionIds.length} transactions for order ${orderNumber}: ${summary}`,
      };
    } catch (error) {
      logger.error('Error processing multiple items', error);

      // Fallback to consolidated transaction if individual processing fails
      logger.warn('Falling back to consolidated transaction due to error');
      return await this.fallbackToConsolidated(items, orderNumber, grandTotal);
    }
  }

  /**
   * Fetch prices for items from their product URLs
   */
  private async fetchItemPrices(items: AmazonOrderItem[]): Promise<AmazonOrderItem[]> {
    const itemsWithPrices = [...items];

    for (let i = 0; i < itemsWithPrices.length; i++) {
      const item = itemsWithPrices[i];

      if (item.productUrl) {
        logger.info(`Fetching price for: ${item.name}`);

        const price = await priceFetcher.fetchPrice(item.productUrl);

        if (price) {
          itemsWithPrices[i] = {
            ...item,
            price: price,
          };
          logger.info(`Price found: $${price} for ${item.name}`);
        } else {
          logger.warn(`Could not fetch price for: ${item.name}`);
        }
      } else {
        logger.warn(`No product URL for item: ${item.name}`);
      }
    }

    return itemsWithPrices;
  }

  /**
   * Fallback: Create a single consolidated transaction if we can't split items
   */
  private async fallbackToConsolidated(
    items: AmazonOrderItem[],
    orderNumber: string,
    grandTotal: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Creating consolidated transaction as fallback');

      const itemNames = items.map((item) => item.name);
      const transactionId = await ynabClient.createConsolidatedTransaction(
        orderNumber,
        grandTotal,
        itemNames
      );

      logger.info(`Consolidated transaction created: ${transactionId}`);

      return {
        success: true,
        message: `Created consolidated transaction for order ${orderNumber}: ${items.length} items - $${grandTotal.toFixed(2)}`,
      };
    } catch (error) {
      logger.error('Error creating consolidated transaction', error);
      throw error;
    }
  }
}

export const orderProcessor = new OrderProcessor();
