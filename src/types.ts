export interface AmazonOrderItem {
  name: string;
  quantity: number;
  productUrl?: string;
  price?: number; // Price per unit (if available from email)
  totalPrice?: number; // Total price for this item (price * quantity)
}

export interface AmazonOrder {
  orderNumber: string;
  grandTotal: number;
  items: AmazonOrderItem[];
  orderDate?: Date;
  deliveryAddress?: string;
}

export interface ParsedEmail {
  order: AmazonOrder;
  rawHtml: string;
  rawText: string;
}

export interface ItemWithTax {
  name: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface YNABTransactionInput {
  accountId: string;
  date: string; // YYYY-MM-DD format
  amount: number; // In milliunits (e.g., -12.34 = -12340)
  payee_name?: string;
  memo?: string;
  cleared?: 'cleared' | 'uncleared' | 'reconciled';
  approved?: boolean;
  import_id?: string;
}

export interface Config {
  port: number;
  nodeEnv: string;
  ynab: {
    apiToken: string;
    budgetId: string;
    accountId: string;
  };
  webhookSecret?: string;
  defaultTaxRate: number;
  logLevel: string;
}

export interface EmailWebhookPayload {
  html: string;
  text: string;
  from: string;
  to: string;
  subject: string;
  headers?: Record<string, string>;
}
