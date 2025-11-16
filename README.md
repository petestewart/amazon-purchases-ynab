# Amazon Purchases → YNAB Importer

Automatically create YNAB transactions from Amazon order confirmation emails. This app receives forwarded Amazon order emails and creates corresponding transactions in your YNAB budget.

## Features

- **Email Integration**: Receives forwarded Amazon order emails via webhook
- **Smart Parsing**: Extracts order details, items, and prices from Amazon emails
- **Single Item Orders**: Creates one transaction with the grand total
- **Multi-Item Orders**: Fetches individual prices, calculates proportional tax, and creates separate transactions per item
- **YNAB Integration**: Automatically creates transactions in your configured Amazon credit card account
- **Flexible**: Falls back to consolidated transactions if individual pricing fails

## How It Works

1. **Receive Email**: You forward an Amazon order confirmation email to a webhook endpoint
2. **Parse Email**: The app extracts order number, items, quantities, product links, and grand total
3. **Single Item**: If there's only 1 item, creates a single YNAB transaction with the grand total
4. **Multiple Items**:
   - Fetches current price for each item from Amazon product pages
   - Calculates proportional tax for each item based on the total
   - Creates separate YNAB transactions for each item with tax included
5. **Create Transactions**: Posts transactions to YNAB via their API

## Architecture

```
┌─────────────────┐
│  Amazon Email   │
│  (Forwarded)    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Email Service  │
│  (SendGrid/etc) │
└────────┬────────┘
         │ HTTP POST
         v
┌─────────────────┐
│  This App       │
│  (Express)      │
├─────────────────┤
│ Email Parser    │
│ Price Fetcher   │
│ Tax Calculator  │
│ YNAB Client     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  YNAB API       │
│  (Transactions) │
└─────────────────┘
```

## Prerequisites

- Node.js 18 or higher
- YNAB account with Personal Access Token
- Email forwarding service (SendGrid, Mailgun, or similar) OR manual testing

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd amazon-purchases-ynab
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# YNAB Configuration
YNAB_API_TOKEN=your_ynab_personal_access_token
YNAB_BUDGET_ID=your_ynab_budget_id
YNAB_ACCOUNT_ID=your_amazon_credit_card_account_id

# Optional: Webhook Security
WEBHOOK_SECRET=your_random_secret_string

# Optional: Default tax rate (8% = 0.08)
DEFAULT_TAX_RATE=0.08

# Logging
LOG_LEVEL=info
```

#### Getting YNAB Credentials

1. **API Token**: Go to https://app.ynab.com/settings/developer
   - Click "New Token"
   - Copy the token to `YNAB_API_TOKEN`

2. **Budget ID**:
   - Go to your YNAB budget in a browser
   - The URL will be: `https://app.ynab.com/<budget_id>/budget/...`
   - Copy the budget ID from the URL

3. **Account ID**:
   - Run the app with `npm run dev`
   - Check the logs - it will list your accounts on startup
   - Find your Amazon credit card account ID

### 3. Build and Run

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## Email Forwarding Setup

You have several options for receiving emails:

### Option 1: SendGrid Inbound Parse (Recommended)

1. Sign up for a free SendGrid account
2. Go to Settings → Inbound Parse
3. Add your webhook URL: `https://your-domain.com/webhook/email`
4. Create an email address like `amazon@yourdomain.com`
5. Set up Gmail forwarding to forward Amazon emails to this address

### Option 2: Mailgun Routes

1. Sign up for Mailgun
2. Create a route that forwards to your webhook
3. Configure Gmail to forward Amazon emails to your Mailgun address

### Option 3: Manual Testing

Use the `/process` endpoint for manual testing:

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html>...email html...</html>",
    "text": "email plain text..."
  }'
```

## Gmail Forwarding

To automatically forward Amazon order emails:

1. In Gmail, go to Settings → Filters and Blocked Addresses
2. Create a new filter:
   - **From**: `auto-confirm@amazon.com`
   - **Subject**: contains "Ordered:"
3. Choose action: "Forward to" → your webhook email address

## API Endpoints

### `POST /webhook/email`

Receives email webhooks from email services.

**Headers** (optional):
- `x-webhook-secret`: Your webhook secret for authentication

**Body** (SendGrid format):
```json
{
  "html": "<html>...</html>",
  "text": "plain text...",
  "from": "auto-confirm@amazon.com",
  "to": "your@email.com",
  "subject": "Ordered: \"Item Name\""
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Created 3 transactions for order 123-4567890-1234567..."
}
```

### `POST /process`

Manual processing endpoint for testing.

**Body**:
```json
{
  "html": "<html>...</html>",
  "text": "plain text..."
}
```

### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "service": "amazon-ynab-importer"
}
```

## Processing Logic

### Single Item Orders

For orders with only 1 item:
1. Creates a single YNAB transaction
2. Uses the grand total from the email (including tax)
3. Payee: `Amazon - [Item Name]`
4. Memo: `Order #[Order Number]`

### Multi-Item Orders

For orders with multiple items:
1. Extracts product URLs from the email
2. Fetches current price for each item from Amazon
3. Calculates subtotal (sum of all item prices)
4. Calculates total tax (grand total - subtotal)
5. Distributes tax proportionally: `item_tax = (item_price / subtotal) * total_tax`
6. Creates separate YNAB transactions for each item
7. Payee: `Amazon - [Item Name]`
8. Memo: `Order #[Order Number] (Qty: X)`

### Fallback Behavior

If price fetching fails for any item:
- Falls back to creating a single consolidated transaction
- Uses the grand total from the email
- Lists all items in the memo

## Logging

Logs are written to:
- `logs/error.log` - Error-level logs only
- `logs/combined.log` - All logs
- Console (in development mode)

Set log level in `.env`:
```env
LOG_LEVEL=debug  # debug, info, warn, error
```

## Deployment

### Deploy to Cloud

#### Heroku
```bash
heroku create your-app-name
heroku config:set YNAB_API_TOKEN=your_token
heroku config:set YNAB_BUDGET_ID=your_budget_id
heroku config:set YNAB_ACCOUNT_ID=your_account_id
git push heroku main
```

#### Railway
```bash
railway login
railway init
railway up
# Set environment variables in Railway dashboard
```

#### DigitalOcean App Platform
1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy

### Deploy with Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t amazon-ynab-importer .
docker run -p 3000:3000 --env-file .env amazon-ynab-importer
```

## Troubleshooting

### YNAB Connection Failed

- Verify your API token is correct
- Check that your budget ID and account ID are valid
- Ensure your API token has the necessary permissions

### Email Parsing Failed

- Check logs in `logs/combined.log`
- Verify the email is from Amazon (`auto-confirm@amazon.com`)
- Try the `/process` endpoint with the raw email HTML for debugging

### Price Fetching Failed

- Amazon may be rate-limiting requests
- The app adds delays between requests to avoid this
- Check if the product URLs in the email are valid
- Falls back to consolidated transaction automatically

### Transactions Not Appearing in YNAB

- Check that the account ID is correct
- Verify the budget ID is correct
- Look for error logs
- Check YNAB's "All Accounts" view - they might be in the wrong account

## Security Considerations

1. **Webhook Secret**: Always set a webhook secret in production to prevent unauthorized requests
2. **HTTPS**: Use HTTPS in production to protect your YNAB API token
3. **Environment Variables**: Never commit `.env` file to version control
4. **API Token**: Keep your YNAB API token secure - it has full access to your budget

## Development

### Code Structure

```
src/
├── config.ts              # Environment configuration
├── types.ts               # TypeScript type definitions
├── index.ts               # Express server & webhook endpoints
├── services/
│   ├── emailParser.ts     # Parse Amazon emails
│   ├── priceFetcher.ts    # Fetch prices from Amazon
│   ├── taxCalculator.ts   # Calculate proportional tax
│   ├── ynabClient.ts      # YNAB API integration
│   └── orderProcessor.ts  # Main orchestrator
└── utils/
    └── logger.ts          # Winston logger
```

### Testing

Run tests:
```bash
npm test
```

Lint code:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions:
- Check the logs in `logs/`
- Review the troubleshooting section
- Open an issue on GitHub

## Acknowledgments

- Built with [YNAB API](https://api.ynab.com/)
- Email parsing with [Cheerio](https://cheerio.js.org/)
- Web requests with [Axios](https://axios-http.com/)
