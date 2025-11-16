/**
 * Simple test to verify email parsing works
 * Usage: node test-parser-simple.js
 */

const fs = require('fs');
const cheerio = require('cheerio');

console.log('🧪 Testing Amazon Email Parser\n');

// Read the sample email
const html = fs.readFileSync('sample-amazon-email.html', 'utf-8');

try {
  const $ = cheerio.load(html);
  
  // Extract order number
  const orderText = $('*:contains("Order #")').first().text();
  const orderMatch = orderText.match(/Order\s*#\s*[\u200B]?(\d{3}-\d{7}-\d{7})/);
  const orderNumber = orderMatch ? orderMatch[1] : null;
  
  // Extract grand total
  const grandTotalText = $('*:contains("Grand Total")').text();
  const totalMatch = grandTotalText.match(/\$\s*([\d,]+\.\d{2})/);
  const grandTotal = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;
  
  // Extract items
  const items = [];
  $('a[href*="amazon.com/dp/"]').each((_, elem) => {
    const $link = $(elem);
    let name = $link.text().trim();
    if (!name) {
      name = $link.find('img').attr('alt') || '';
    }
    
    if (name && name.length > 3) {
      const parent = $link.closest('div');
      const quantityText = parent.parent().find('*:contains("Quantity")').text();
      const qtyMatch = quantityText.match(/Quantity:\s*(\d+)/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      
      const productUrl = $link.attr('href');
      
      // Check if already added
      if (!items.find(item => item.name === name)) {
        items.push({ name, quantity, productUrl });
      }
    }
  });

  console.log('✅ Email parsed successfully!\n');
  console.log('📦 Order Details:');
  console.log('─────────────────────────────────────');
  console.log(`Order Number: ${orderNumber}`);
  console.log(`Grand Total: $${grandTotal.toFixed(2)}`);
  console.log(`Number of Items: ${items.length}`);
  console.log();

  console.log('📋 Items:');
  console.log('─────────────────────────────────────');
  items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name}`);
    console.log(`   Quantity: ${item.quantity}`);
    if (item.productUrl) {
      console.log(`   URL: ${item.productUrl}`);
    }
    console.log();
  });

  console.log('✨ Parsing works! Next steps:');
  console.log('─────────────────────────────────────');
  console.log('1. Get YNAB API token: https://app.ynab.com/settings/developer');
  console.log('2. Copy .env.example to .env');
  console.log('3. Fill in your YNAB credentials in .env');
  console.log('4. Run the full app: npm run dev');
  console.log('5. Test with the sample email');
  console.log();
  
} catch (error) {
  console.error('❌ Failed to parse email:', error);
  process.exit(1);
}
