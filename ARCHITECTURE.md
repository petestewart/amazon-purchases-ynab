# Application Architecture

## Overview

This application receives Amazon order confirmation emails, parses them, fetches individual item prices, calculates tax, and creates transactions in YNAB.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Gmail Account                          │
│                                                                 │
│  Amazon Order Email ──> Gmail Filter ──> Forward to Webhook    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                    Email Service (SendGrid/Mailgun)             │
│                                                                 │
│  Receives forwarded email ──> HTTP POST to webhook             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v HTTP POST /webhook/email
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js Server                          │
│                      (src/index.ts)                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Webhook Handler                              │  │
│  │  - Verify webhook secret                                 │  │
│  │  - Parse email payload                                    │  │
│  │  - Validate Amazon email                                  │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│                   v                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Order Processor                                 │  │
│  │           (src/services/orderProcessor.ts)                │  │
│  │                                                           │  │
│  │  Main orchestrator - coordinates all services            │  │
│  └────┬─────────────────────────────────────────────────────┘  │
│       │                                                         │
│       v                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │    Email Parser (src/services/emailParser.ts)            │  │
│  │                                                           │  │
│  │  - Parse HTML/text email content                         │  │
│  │  - Extract order number                                   │  │
│  │  - Extract grand total                                    │  │
│  │  - Extract items with quantities                          │  │
│  │  - Extract product URLs                                   │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│                   v                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Decision: Single or Multiple Items?               │  │
│  └─────┬───────────────────────────────────────────┬─────────┘  │
│        │                                           │             │
│        │ Single Item                  Multiple    │             │
│        v                               Items       v             │
│  ┌─────────────────┐              ┌───────────────────────────┐ │
│  │  Create Single  │              │   Price Fetcher           │ │
│  │  Transaction    │              │   (priceFetcher.ts)       │ │
│  │  with Grand     │              │                           │ │
│  │  Total          │              │  For each item:           │ │
│  └────────┬────────┘              │  - Clean product URL      │ │
│           │                       │  - Fetch Amazon page      │ │
│           │                       │  - Parse price            │ │
│           │                       │  - Rate limit delays      │ │
│           │                       └──────────┬────────────────┘ │
│           │                                  │                  │
│           │                                  v                  │
│           │                       ┌──────────────────────────┐ │
│           │                       │   Tax Calculator         │ │
│           │                       │   (taxCalculator.ts)     │ │
│           │                       │                          │ │
│           │                       │  - Sum item prices       │ │
│           │                       │  - Calculate total tax   │ │
│           │                       │  - Distribute tax        │ │
│           │                       │    proportionally        │ │
│           │                       └──────────┬───────────────┘ │
│           │                                  │                  │
│           │                                  v                  │
│           │                       ┌──────────────────────────┐ │
│           │                       │  Create Multiple         │ │
│           │                       │  Transactions            │ │
│           │                       │  (one per item)          │ │
│           │                       └──────────┬───────────────┘ │
│           │                                  │                  │
│           └──────────────┬───────────────────┘                  │
│                          │                                      │
│                          v                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         YNAB Client (src/services/ynabClient.ts)         │  │
│  │                                                           │  │
│  │  - Convert amounts to milliunits                         │  │
│  │  - Format transaction data                                │  │
│  │  - Create transactions via YNAB API                       │  │
│  │  - Handle rate limiting                                   │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             v HTTPS
                   ┌─────────────────────┐
                   │     YNAB API        │
                   │                     │
                   │  - Create           │
                   │    transactions     │
                   └─────────────────────┘
```

## Component Details

### 1. Express Server (`src/index.ts`)

**Responsibilities**:
- HTTP server for webhook endpoints
- Request validation and authentication
- Health check endpoint
- Error handling

**Key Endpoints**:
- `POST /webhook/email` - Receive email webhooks
- `POST /webhook/gmail` - Gmail push notifications (future)
- `POST /process` - Manual processing for testing
- `GET /health` - Health check

### 2. Email Parser (`src/services/emailParser.ts`)

**Responsibilities**:
- Parse HTML email content using Cheerio
- Extract structured data from unstructured emails
- Fallback to plain text parsing if HTML fails

**Extracted Data**:
- Order number (e.g., `113-8378477-8133849`)
- Grand total (e.g., `$26.82`)
- Items with names and quantities
- Product URLs for each item
- Delivery address (optional)

**Parsing Strategy**:
1. Load HTML with Cheerio
2. Search for order number pattern
3. Find grand total (multiple selector attempts)
4. Extract items by finding product links
5. Associate quantity with each item
6. Fallback to text parsing if HTML fails

### 3. Price Fetcher (`src/services/priceFetcher.ts`)

**Responsibilities**:
- Fetch current prices from Amazon product pages
- Handle Amazon's various price selectors
- Rate limiting to avoid blocking

**Process**:
1. Clean product URL (extract ASIN)
2. Fetch product page with proper headers
3. Try multiple price selectors (Cheerio)
4. Extract numeric price value
5. Add delays between requests

**Selectors Tried** (in order):
- `.a-price .a-offscreen`
- `#priceblock_ourprice`
- `#priceblock_dealprice`
- `.a-price-whole`
- `#priceblock_saleprice`
- `#kindle-price`
- `#price_inside_buybox`
- And more...

### 4. Tax Calculator (`src/services/taxCalculator.ts`)

**Responsibilities**:
- Calculate proportional tax for each item
- Handle rounding errors
- Validate calculations

**Formula**:
```
subtotal = sum of all item prices (before tax)
total_tax = grand_total - subtotal
item_tax = (item_price / subtotal) × total_tax
item_total = item_price + item_tax
```

**Example**:
```
Item 1: $10.00
Item 2: $15.00
Subtotal: $25.00
Grand Total: $27.00
Total Tax: $2.00

Item 1 Tax: ($10 / $25) × $2 = $0.80
Item 2 Tax: ($15 / $25) × $2 = $1.20

Item 1 Total: $10.80
Item 2 Total: $16.20
```

### 5. YNAB Client (`src/services/ynabClient.ts`)

**Responsibilities**:
- Interact with YNAB API
- Convert amounts to milliunits (YNAB format)
- Create transactions
- Verify connection and configuration

**Transaction Format**:
```typescript
{
  account_id: "amazon-card-account-id",
  date: "2025-11-16",
  amount: -26820, // -$26.82 in milliunits
  payee_name: "Amazon - Product Name",
  memo: "Order #113-8378477-8133849",
  cleared: "uncleared",
  approved: true
}
```

### 6. Order Processor (`src/services/orderProcessor.ts`)

**Responsibilities**:
- Orchestrate the entire workflow
- Handle single vs multi-item logic
- Implement fallback strategies
- Error handling and logging

**Workflow**:

**Single Item**:
```
Parse Email → Create Transaction (Grand Total) → Done
```

**Multiple Items**:
```
Parse Email → Fetch Prices → Calculate Tax → Create Transactions → Done
                    ↓ (if fails)
                Fallback to Single Transaction
```

## Data Flow

### Single Item Order

```
Email → Parser → {
  orderNumber: "123-456-789"
  items: [{ name: "Product", quantity: 1 }]
  grandTotal: 29.99
}
→ YNAB: Create 1 transaction ($29.99)
```

### Multi-Item Order

```
Email → Parser → {
  orderNumber: "123-456-789"
  items: [
    { name: "Item 1", quantity: 1, url: "..." }
    { name: "Item 2", quantity: 2, url: "..." }
  ]
  grandTotal: 85.50
}
→ Price Fetcher → {
  Item 1: $25.00
  Item 2: $12.00 each = $24.00
  Subtotal: $49.00
}
→ Tax Calculator → {
  Total Tax: $85.50 - $49.00 = $36.50
  Item 1 Tax: ($25/$49) × $36.50 = $18.62
  Item 2 Tax: ($24/$49) × $36.50 = $17.88
}
→ YNAB: Create 2 transactions
  - Item 1: $43.62
  - Item 2: $41.88
```

## Error Handling

### Graceful Degradation

1. **Price Fetching Fails** → Fallback to consolidated transaction
2. **Tax Calculation Error** → Adjust prices proportionally
3. **YNAB API Error** → Log error, return failure
4. **Email Parsing Fails** → Return error response

### Logging

All operations are logged using Winston:
- `logs/error.log` - Errors only
- `logs/combined.log` - All logs
- Console (development mode)

## Configuration

All configuration via environment variables:

```
YNAB_API_TOKEN      → YNAB Client
YNAB_BUDGET_ID      → YNAB Client
YNAB_ACCOUNT_ID     → YNAB Client
WEBHOOK_SECRET      → Express Server
DEFAULT_TAX_RATE    → Tax Calculator (fallback)
PORT                → Express Server
LOG_LEVEL           → Logger
```

## Security Considerations

1. **Webhook Secret**: Validates incoming requests
2. **YNAB Token**: Kept in environment variables, never logged
3. **HTTPS**: Required in production
4. **Rate Limiting**: Built into price fetcher
5. **Input Validation**: Email parsing validates all extracted data

## Performance

- **Concurrent Price Fetching**: Sequential with delays to avoid rate limiting
- **Request Timeout**: 15 seconds for Amazon requests
- **Webhook Response**: Fast acknowledgment, async processing
- **Logging**: Async, non-blocking

## Scalability

Current design handles:
- Single instance deployment
- Moderate email volume (<100/day)
- Sequential order processing

For higher volume, consider:
- Queue-based processing (Redis, RabbitMQ)
- Multiple worker instances
- Caching of Amazon prices
- Batch YNAB transaction creation

## Future Enhancements

1. **Gmail API Integration**: Direct Gmail integration instead of webhooks
2. **Amazon API**: Use official API instead of scraping (if available)
3. **Multiple Accounts**: Support different credit cards per order
4. **Order History**: Store processed orders to avoid duplicates
5. **Web Dashboard**: View processing history and stats
6. **Notification**: Email/Slack notifications on errors
7. **Price Caching**: Cache Amazon prices to reduce requests
