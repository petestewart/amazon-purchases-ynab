# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- YNAB account with Personal Access Token
- Amazon email forwarding setup

## Step 1: Install

```bash
git clone <your-repo-url>
cd amazon-purchases-ynab
npm install
```

## Step 2: Configure

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your YNAB credentials:

```env
YNAB_API_TOKEN=your_token_here
YNAB_BUDGET_ID=your_budget_id_here
YNAB_ACCOUNT_ID=your_account_id_here
```

### Getting YNAB Credentials

1. **API Token**: https://app.ynab.com/settings/developer → "New Token"
2. **Budget ID**: Open YNAB in browser, copy from URL: `https://app.ynab.com/<BUDGET_ID>/...`
3. **Account ID**: Run the app first, it will list your accounts

## Step 3: Run

```bash
npm run dev
```

You should see:
```
Server started on port 3000
Connected as: <your-user-id>
Budget: <your-budget-name>
Account: <your-account-name>
Ready to receive Amazon order emails!
```

## Step 4: Test

### Option A: Manual Test

Save this as `test.json`:

```json
{
  "html": "<your-email-html>",
  "text": "Order #123-456-789 Grand Total: $29.99"
}
```

Send it:

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d @test.json
```

### Option B: Use Sample Email

If you have an Amazon order email saved:

1. Save the HTML to `sample-email.html`
2. Run: `./test-email.sh sample-email.html`

## Step 5: Set Up Email Forwarding

### SendGrid (Recommended)

1. Sign up at https://sendgrid.com (free tier)
2. Go to Settings → Inbound Parse
3. Add webhook: `https://your-domain.com/webhook/email`
4. Note the email address (e.g., `amazon@yourdomain.com`)

### Gmail Forwarding

1. Gmail → Settings → Filters
2. Create filter:
   - From: `auto-confirm@amazon.com`
   - Subject: contains "Ordered:"
3. Forward to: `amazon@yourdomain.com` (your SendGrid email)

## Step 6: Deploy (Optional)

### Quick Deploy to Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

Then set environment variables in Railway dashboard.

### Docker Deployment

```bash
docker-compose up -d
```

## Verify It's Working

1. Place a test Amazon order (or use an old email)
2. Forward the email to your webhook address
3. Check logs: `tail -f logs/combined.log`
4. Check YNAB for new transaction

## Troubleshooting

### YNAB Connection Failed

- Verify API token is correct
- Check budget ID and account ID
- Ensure token has proper permissions

### Email Not Parsing

- Check `logs/combined.log` for errors
- Verify email is from `auto-confirm@amazon.com`
- Test with the manual endpoint first

### No Transaction Created

- Check logs for YNAB API errors
- Verify account ID is correct
- Check YNAB budget isn't in read-only mode

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand how it works
- Check [CONTRIBUTING.md](CONTRIBUTING.md) if you want to contribute

## Need Help?

- Check logs in `logs/combined.log`
- Review the troubleshooting section in README.md
- Open an issue on GitHub
