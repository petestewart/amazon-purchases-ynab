import * as ynab from 'ynab';
import logger from '../utils/logger';
import { config } from '../config';
import { ItemWithTax } from '../types';
import type { SaveTransaction } from 'ynab/dist/models/SaveTransaction';
import { TransactionClearedStatus } from 'ynab/dist/models/TransactionClearedStatus';

/**
 * YNAB API client for creating transactions
 */
export class YNABClient {
  private api: ynab.API;

  constructor() {
    this.api = new ynab.API(config.ynab.apiToken);
  }

  /**
   * Create a single transaction in YNAB
   */
  async createTransaction(
    amount: number,
    payeeName: string,
    memo: string,
    date: Date = new Date()
  ): Promise<string> {
    try {
      const transaction: SaveTransaction = {
        account_id: config.ynab.accountId,
        date: this.formatDate(date),
        amount: this.convertToMilliunits(amount),
        payee_name: payeeName,
        memo: memo,
        cleared: TransactionClearedStatus.Uncleared,
        approved: true,
      };

      logger.info(`Creating YNAB transaction: ${payeeName} - $${amount.toFixed(2)}`);

      const response = await this.api.transactions.createTransaction(config.ynab.budgetId, {
        transaction,
      });

      const createdId = response.data.transaction_ids?.[0];
      if (!createdId) {
        throw new Error('YNAB response missing transaction id');
      }
      logger.info(`Transaction created with ID: ${createdId}`);

      return createdId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      logger.error(`Error creating YNAB transaction: ${errorMessage}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Create multiple transactions in YNAB (for multi-item orders)
   */
  async createTransactions(
    items: ItemWithTax[],
    orderNumber: string,
    date: Date = new Date()
  ): Promise<string[]> {
    const transactionIds: string[] = [];

    for (const item of items) {
      try {
        // Create a descriptive payee name and memo
        const payeeName = `Amazon - ${this.truncate(item.name, 50)}`;
        const memo = `Order #${orderNumber}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}`;

        const transactionId = await this.createTransaction(
          -item.total, // Negative because it's an expense
          payeeName,
          memo,
          date
        );

        transactionIds.push(transactionId);

        // Small delay between transactions to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        logger.error(`Failed to create transaction for item: ${item.name}`, error);
        // Continue with other items even if one fails
      }
    }

    return transactionIds;
  }

  /**
   * Create a single consolidated transaction for an order
   */
  async createConsolidatedTransaction(
    orderNumber: string,
    grandTotal: number,
    itemNames: string[],
    date: Date = new Date()
  ): Promise<string> {
    const payeeName = 'Amazon';

    // Create memo with item names (truncated if too long)
    let memo = `Order #${orderNumber}: ${itemNames.join(', ')}`;
    if (memo.length > 200) {
      memo = `Order #${orderNumber}: ${itemNames.length} items`;
    }

    return this.createTransaction(-grandTotal, payeeName, memo, date);
  }

  /**
   * Verify YNAB connection and configuration
   */
  async verifyConnection(): Promise<boolean> {
    try {
      logger.info('Verifying YNAB connection...');

      // Test API connection
      const userResponse = await this.api.user.getUser();
      logger.info(`Connected as: ${userResponse.data.user.id}`);

      // Verify budget exists
      const budgetResponse = await this.api.budgets.getBudgetById(config.ynab.budgetId);
      logger.info(`Budget: ${budgetResponse.data.budget.name}`);

      // Verify account exists
      const accountsResponse = await this.api.accounts.getAccounts(config.ynab.budgetId);
      const account = accountsResponse.data.accounts.find(
        (acc) => acc.id === config.ynab.accountId
      );

      if (!account) {
        logger.error(`Account ${config.ynab.accountId} not found in budget`);
        return false;
      }

      logger.info(`Account: ${account.name} (${account.type})`);
      logger.info('YNAB connection verified successfully');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      logger.error(`Error verifying YNAB connection: ${errorMessage}`, {
        error,
      });
      return false;
    }
  }

  /**
   * Convert dollar amount to YNAB milliunits (e.g., $12.34 = 12340)
   */
  private convertToMilliunits(amount: number): number {
    return Math.round(amount * 1000);
  }

  /**
   * Format date as YYYY-MM-DD for YNAB API
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const ynabClient = new YNABClient();
