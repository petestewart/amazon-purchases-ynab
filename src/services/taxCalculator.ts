import logger from '../utils/logger';
import { AmazonOrderItem, ItemWithTax } from '../types';

/**
 * Calculates tax for individual items based on the order total
 */
export class TaxCalculator {
  /**
   * Calculate tax for each item proportionally
   *
   * @param items - Items with their prices
   * @param grandTotal - The grand total from the email (including tax)
   * @returns Items with calculated tax
   */
  calculateItemTaxes(items: AmazonOrderItem[], grandTotal: number): ItemWithTax[] {
    // Calculate total price of all items (without tax)
    const subtotal = items.reduce((sum, item) => {
      if (!item.price) {
        throw new Error(`Item "${item.name}" is missing price`);
      }
      return sum + (item.price * item.quantity);
    }, 0);

    logger.info(`Subtotal: $${subtotal.toFixed(2)}, Grand Total: $${grandTotal.toFixed(2)}`);

    // Calculate total tax
    const totalTax = grandTotal - subtotal;

    if (totalTax < 0) {
      logger.warn('Calculated tax is negative. Using 0 tax.');
      // If tax is negative, proportionally adjust prices
      return this.adjustPricesProportionally(items, grandTotal);
    }

    logger.info(`Total tax: $${totalTax.toFixed(2)}`);

    // Distribute tax proportionally across items
    const itemsWithTax: ItemWithTax[] = [];
    let remainingTax = totalTax;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemSubtotal = item.price! * item.quantity;
      const isLastItem = i === items.length - 1;

      let itemTax: number;

      if (isLastItem) {
        // Last item gets the remaining tax (to handle rounding errors)
        itemTax = remainingTax;
      } else {
        // Proportional tax: (item_subtotal / subtotal) * total_tax
        itemTax = (itemSubtotal / subtotal) * totalTax;
        remainingTax -= itemTax;
      }

      const itemTotal = itemSubtotal + itemTax;

      itemsWithTax.push({
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.price!,
        subtotal: itemSubtotal,
        tax: itemTax,
        total: itemTotal,
      });

      logger.debug(`Item: ${item.name}, Subtotal: $${itemSubtotal.toFixed(2)}, Tax: $${itemTax.toFixed(2)}, Total: $${itemTotal.toFixed(2)}`);
    }

    // Verify total matches grand total
    const calculatedTotal = itemsWithTax.reduce((sum, item) => sum + item.total, 0);
    const difference = Math.abs(calculatedTotal - grandTotal);

    if (difference > 0.02) {
      logger.warn(`Calculated total ($${calculatedTotal.toFixed(2)}) differs from grand total ($${grandTotal.toFixed(2)}) by $${difference.toFixed(2)}`);
    }

    return itemsWithTax;
  }

  /**
   * If we can't calculate tax (e.g., prices don't match), adjust prices proportionally
   */
  private adjustPricesProportionally(items: AmazonOrderItem[], grandTotal: number): ItemWithTax[] {
    const subtotal = items.reduce((sum, item) => sum + (item.price! * item.quantity), 0);
    const ratio = grandTotal / subtotal;

    return items.map(item => {
      const itemSubtotal = item.price! * item.quantity;
      const adjustedTotal = itemSubtotal * ratio;

      return {
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.price!,
        subtotal: itemSubtotal,
        tax: 0, // We're not separating tax in this case
        total: adjustedTotal,
      };
    });
  }

  /**
   * Calculate tax for a single item order
   */
  calculateSingleItemTax(itemPrice: number, grandTotal: number): number {
    return grandTotal - itemPrice;
  }
}

export const taxCalculator = new TaxCalculator();
