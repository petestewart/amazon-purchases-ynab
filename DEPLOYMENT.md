# Deployment Guide

This guide walks you through deploying the Amazon-YNAB importer to Railway and configuring email forwarding.

## Overview

The deployment architecture:
1. **Amazon** → sends order confirmation email to your Gmail
2. **Gmail** → auto-forwards to SendGrid Inbound Parse
3. **SendGrid** → POSTs email to your Railway app webhook
4. **Railway App** → parses email, fetches prices, creates YNAB transactions

## Prerequisites

- GitHub account
- Railway account (free tier available)
- SendGrid account (free tier available)
- Gmail account
- YNAB account with API access token

## Part 1: Deploy to Railway

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your `amazon-purchases-ynab` repository
6. Railway will automatically detect the Dockerfile and start building

### Step 3: Configure Environment Variables

In your Railway project dashboard:

1. Click on your service
2. Go to "Variables" tab
3. Add the following variables:

```
YNAB_ACCESS_TOKEN=your_ynab_token_here
YNAB_BUDGET_ID=your_budget_id_here
YNAB_ACCOUNT_ID=your_account_id_here
NODE_ENV=production
PORT=3000
```

#### Getting YNAB Values:

**YNAB_ACCESS_TOKEN:**
1. Go to https://app.ynab.com/settings/developer
2. Click "New Token"
3. Copy the token

**YNAB_BUDGET_ID:**
1. Go to YNAB web app
2. Look at the URL: `https://app.ynab.com/[BUDGET_ID]/budget`
3. Copy the UUID (e.g., `a1b2c3d4-...`)

**YNAB_ACCOUNT_ID:**
1. In YNAB, go to your Amazon credit card account
2. Look at the URL: `https://app.ynab.com/[BUDGET_ID]/accounts/[ACCOUNT_ID]`
3. Copy the account UUID

### Step 4: Deploy

Railway automatically deploys when you push to GitHub. After the build completes:

1. Click "Settings" → "Domains"
2. Click "Generate Domain"
3. Copy your app URL (e.g., `https://your-app.up.railway.app`)

### Step 5: Verify Deployment

Test the health endpoint:
```bash
curl https://your-app.up.railway.app/health
```

You should see: `{"status":"ok","service":"amazon-ynab-importer"}`

## Part 2: Configure SendGrid Inbound Parse

### Step 1: Create SendGrid Account

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up for free account
3. Verify your email

### Step 2: Set Up Inbound Parse

1. In SendGrid dashboard, go to **Settings** → **Inbound Parse**
2. Click **Add Host & URL**
3. Configure:
   - **Domain:** Use the default `inbound.sendgrid.net` (no setup needed)
   - **URL:** `https://your-app.up.railway.app/webhook/email`
   - **Spam Check:** ✓ Check incoming emails for spam
   - **Send Raw:** ✓ Post the full MIME message
4. Click **Add**

5. Copy your inbound email address (e.g., `m.XXXXX@inbound.sendgrid.net`)

### Step 3: Test SendGrid Webhook

Send a test email to verify the webhook works:

```bash
# Replace with your SendGrid inbound email
echo "Test email" | mail -s "Test Subject" m.XXXXX@inbound.sendgrid.net
```

Check Railway logs to see if the email was received.

## Part 3: Configure Gmail Forwarding

### Step 1: Add Forwarding Address

1. Open Gmail Settings → **See all settings**
2. Go to **Forwarding and POP/IMAP** tab
3. Click **Add a forwarding address**
4. Enter your SendGrid inbound email: `m.XXXXX@inbound.sendgrid.net`
5. Click **Next** → **Proceed**
6. Gmail will send a confirmation email to SendGrid
7. Check Railway logs for the confirmation code
8. Enter the confirmation code in Gmail

### Step 2: Create Filter for Amazon Emails

1. In Gmail, click the search box
2. Click "Show search options" (down arrow)
3. Configure filter:
   - **From:** `auto-confirm@amazon.com`
   - **Subject:** (leave blank to catch all order confirmations)
4. Click **Create filter**
5. Check these options:
   - ✓ **Skip the Inbox** (optional, keeps Gmail clean)
   - ✓ **Forward it to** → select your SendGrid address
   - ✓ **Apply filter to matching conversations** (processes existing emails)
6. Click **Create filter**

## Part 4: Testing

### Test with a Real Amazon Order

1. Make an Amazon purchase
2. Wait for order confirmation email
3. Gmail will auto-forward to SendGrid
4. SendGrid will POST to your Railway app
5. Check Railway logs for processing
6. Verify YNAB transactions were created

### View Railway Logs

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs
```

Or view logs in the Railway dashboard → your service → "Deployments" tab.

## Troubleshooting

### Email Not Being Processed

**Check Gmail Filter:**
- Gmail Settings → Filters → verify Amazon filter exists
- Test by forwarding an old Amazon email manually

**Check SendGrid Webhook:**
- SendGrid dashboard → Inbound Parse → verify URL is correct
- Check "Activity" tab for webhook errors

**Check Railway Logs:**
```bash
railway logs --tail
```

Look for:
- `Received email webhook request` - email arrived
- `Parsing Amazon order email` - parsing started
- `Parsed order XXX with N items` - parsing succeeded
- `Created N transactions` - success!

### Puppeteer Errors

If you see browser launch errors in logs:

1. Verify Dockerfile has Chromium installed
2. Check Railway deployment logs for build errors
3. May need to increase Railway memory allocation

### YNAB Connection Errors

```
Error: Unauthorized - check your YNAB_ACCESS_TOKEN
```

- Regenerate token at https://app.ynab.com/settings/developer
- Update Railway environment variable
- Redeploy (Railway auto-redeploys when env vars change)

### Price Fetching Fails

If all prices fail to fetch (falls back to consolidated transaction):
- Amazon may have updated their HTML structure
- Check Railway logs for "Could not extract price" warnings
- Price fetching takes ~5-7 seconds per item (Puppeteer loading time)

## Cost Estimates

### Railway
- **Free Tier:** $5/month in credits
- **Typical Usage:** ~$2-5/month for intermittent email processing
- Charges based on CPU/memory usage time
- Puppeteer uses more resources but only runs briefly

### SendGrid
- **Free Tier:** 100 emails/day
- More than enough for personal Amazon orders

### Total Cost
**~$0-3/month** if you stay within Railway's free credits

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `YNAB_ACCESS_TOKEN` | Yes | YNAB API personal access token | `a1b2c3d4e5f6...` |
| `YNAB_BUDGET_ID` | Yes | YNAB budget UUID | `12345678-abcd-...` |
| `YNAB_ACCOUNT_ID` | Yes | YNAB account UUID for Amazon CC | `87654321-dcba-...` |
| `NODE_ENV` | No | Environment (production/development) | `production` |
| `PORT` | No | Port for Express server | `3000` |
| `PUPPETEER_EXECUTABLE_PATH` | Auto | Path to Chromium (set by Dockerfile) | `/usr/bin/chromium-browser` |

## Updating the Application

When you make code changes:

```bash
git add .
git commit -m "Update: description of changes"
git push origin main
```

Railway automatically:
1. Detects the push
2. Rebuilds the Docker image
3. Redeploys with zero downtime

## Security Notes

- Never commit `.env` file to Git (it's in `.gitignore`)
- YNAB tokens grant full budget access - keep them secret
- SendGrid webhook URL is public but only processes Amazon emails
- Railway environment variables are encrypted at rest
- Consider adding webhook authentication for production use

## Support

If you encounter issues:
1. Check Railway logs first
2. Review SendGrid activity feed
3. Verify Gmail filter is active
4. Test with the provided `test-email.sh` script locally

## Next Steps

Once deployed:
- Monitor first few Amazon orders to ensure everything works
- Adjust YNAB categories in the YNAB app as needed
- Consider adding error notifications (email/Slack)
