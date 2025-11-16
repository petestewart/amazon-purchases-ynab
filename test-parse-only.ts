/**
 * Test script to verify email parsing works without YNAB credentials
 * Usage: npx ts-node test-parse-only.ts
 */

import * as fs from 'fs';
import { emailParser } from './src/services/emailParser';

console.log('🧪 Testing Amazon Email Parser\n');

// Read the sample email
const html = fs.readFileSync('sample-amazon-email.html', 'utf-8');

try {
  // Parse the email
  const result = emailParser.parseEmail(html, '');

  console.log('✅ Email parsed successfully!\n');
  console.log('📦 Order Details:');
  console.log('─────────────────────────────────────');
  console.log(`Order Number: ${result.order.orderNumber}`);
  console.log(`Grand Total: $${result.order.grandTotal.toFixed(2)}`);
  console.log(`Number of Items: ${result.order.items.length}`);
  console.log();

  console.log('📋 Items:');
  console.log('─────────────────────────────────────');
  result.order.items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name}`);
    console.log(`   Quantity: ${item.quantity}`);
    if (item.productUrl) {
      console.log(`   URL: ${item.productUrl.substring(0, 60)}...`);
    }
    console.log();
  });

  console.log('✨ Next Steps:');
  console.log('─────────────────────────────────────');
  console.log('1. Get YNAB credentials from: https://app.ynab.com/settings/developer');
  console.log('2. Copy .env.example to .env and fill in your YNAB details');
  console.log('3. Run: npm run dev');
  console.log('4. Test with: ./test-email.sh sample-amazon-email.html');

} catch (error) {
  console.error('❌ Failed to parse email:', error);
  process.exit(1);
}
