# Testing Guide

## Quick Test (Just Did This! ✅)

We just verified the email parser works:
- Order Number: `113-8378477-8133849`
- Grand Total: `$26.82`
- Items: 2 (Pet Bed Pillow × 1, Epsom Salt Soak × 4)

## Testing Options

### Option 1: Test Parsing Only (No YNAB Needed)

Already done! Run again anytime:

```bash
node test-parser-simple.js
```

This verifies email parsing works without needing YNAB credentials.

---

### Option 2: Full Test with Mock YNAB (Won't Create Real Transactions)

For testing the full flow without creating real transactions:

1. **Set up mock environment variables:**

```bash
cat > .env << 'EOF'
PORT=3000
NODE_ENV=development

# Use dummy values for testing
YNAB_API_TOKEN=test_token_will_fail_gracefully
YNAB_BUDGET_ID=test-budget-id
YNAB_ACCOUNT_ID=test-account-id

WEBHOOK_SECRET=test123
DEFAULT_TAX_RATE=0.08
LOG_LEVEL=debug
EOF
```

2. **Build and run:**

```bash
npm run build
npm start
```

Note: This will fail when trying to connect to YNAB, but you can test the parsing and see detailed logs.

---

### Option 3: Full Test with Real YNAB (Recommended)

This creates REAL transactions in YNAB!

#### Step 1: Get YNAB Credentials

**A. Get API Token:**
1. Go to https://app.ynab.com/settings/developer
2. Click "New Token"
3. Give it a name like "Amazon Importer Test"
4. Click "Generate" and copy the token

**B. Get Budget ID:**
1. Open your YNAB budget in a browser
2. Look at the URL: `https://app.ynab.com/xxxxx-xxxxx-xxxxx/budget/...`
3. The `xxxxx-xxxxx-xxxxx` part is your Budget ID

**C. Get Account ID:**
We'll get this after starting the app (it will list your accounts).

#### Step 2: Configure Environment

```bash
cat > .env << 'EOF'
PORT=3000
NODE_ENV=development

YNAB_API_TOKEN=your_token_from_step_A
YNAB_BUDGET_ID=your_budget_id_from_step_B
YNAB_ACCOUNT_ID=will_update_after_step_3

WEBHOOK_SECRET=
DEFAULT_TAX_RATE=0.08
LOG_LEVEL=info
EOF
```

#### Step 3: Find Your Account ID

```bash
npm run build
npm start
```

Look for output like:
```
Connected as: xxxx
Budget: My Budget
Account: Amazon Visa (credit)
Account ID: xxxxx-xxxxx-xxxxx
```

Stop the server (Ctrl+C) and update `.env` with the correct `YNAB_ACCOUNT_ID`.

#### Step 4: Test the Full Flow

**Terminal 1 - Start the server:**
```bash
npm run dev
```

**Terminal 2 - Send test email:**
```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d "{\"html\": $(cat sample-amazon-email.html | jq -Rs .)}"
```

#### Step 5: Check Results

You should see:
- In the terminal: Success message with transaction details
- In `logs/combined.log`: Detailed processing logs
- **In YNAB**: New transaction(s) created!

---

## Testing Scenarios

### Scenario 1: Single Item Order

Use `sample-amazon-email.html` but remove one item:

```bash
# Edit sample-amazon-email.html to only have one item
# Then test:
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d "{\"html\": $(cat sample-amazon-email.html | jq -Rs .)}"
```

Expected: 1 transaction with grand total

### Scenario 2: Multi-Item Order

Use the existing `sample-amazon-email.html`:

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d "{\"html\": $(cat sample-amazon-email.html | jq -Rs .)}"
```

Expected:
- App fetches prices from Amazon
- Calculates tax for each item
- Creates 2 transactions in YNAB

### Scenario 3: Test with Your Own Email

Save an actual Amazon order email:

1. Forward an Amazon order email to yourself
2. View source / download as HTML
3. Save as `my-order.html`
4. Test:

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d "{\"html\": $(cat my-order.html | jq -Rs .)}"
```

### Scenario 4: Webhook Test (SendGrid format)

Simulate what SendGrid would send:

```bash
curl -X POST http://localhost:3000/webhook/email \
  -H "Content-Type: application/json" \
  -d "{
    \"html\": $(cat sample-amazon-email.html | jq -Rs .),
    \"text\": \"Order #113-8378477-8133849 Grand Total: \$26.82\",
    \"from\": \"auto-confirm@amazon.com\",
    \"to\": \"you@example.com\",
    \"subject\": \"Ordered: Pet Bed Pillow and 4 more items\"
  }"
```

---

## Checking Logs

View detailed logs:

```bash
# Follow logs in real-time
tail -f logs/combined.log

# View errors only
tail -f logs/error.log

# Search for specific order
grep "113-8378477-8133849" logs/combined.log
```

---

## Troubleshooting Tests

### "Connection refused"
- Server not running
- Solution: Run `npm run dev` first

### "Unauthorized" webhook error
- Webhook secret mismatch
- Solution: Remove `WEBHOOK_SECRET` from `.env` or provide matching header

### "Invalid YNAB token"
- Token expired or wrong
- Solution: Generate new token at https://app.ynab.com/settings/developer

### "Price fetching failed"
- Amazon might be blocking requests
- Solution: Normal - app will fallback to consolidated transaction

### "No transactions created"
- Check account ID is correct
- Check budget isn't in read-only mode
- Check logs for specific error

---

## Clean Up Test Data

If you created test transactions in YNAB:

1. Open YNAB
2. Go to your Amazon account
3. Find the test transactions
4. Delete them

---

## Next Steps After Testing

1. ✅ Verified parsing works
2. ✅ Tested with YNAB
3. 🚀 Set up email forwarding (see README.md)
4. 🚀 Deploy to production (see README.md)

## Quick Reference

```bash
# Test parsing only
node test-parser-simple.js

# Start dev server
npm run dev

# Test manual endpoint
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d "{\"html\": $(cat sample-amazon-email.html | jq -Rs .)}"

# Check logs
tail -f logs/combined.log

# Health check
curl http://localhost:3000/health
```
