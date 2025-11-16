import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

export const config: Config = {
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  ynab: {
    apiToken: getEnvVar('YNAB_API_TOKEN'),
    budgetId: getEnvVar('YNAB_BUDGET_ID'),
    accountId: getEnvVar('YNAB_ACCOUNT_ID'),
  },
  webhookSecret: process.env.WEBHOOK_SECRET,
  defaultTaxRate: parseFloat(getEnvVar('DEFAULT_TAX_RATE', '0.08')),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
};
