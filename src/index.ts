import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { config } from './config';
import logger from './utils/logger';
import { orderProcessor } from './services/orderProcessor';
import { ynabClient } from './services/ynabClient';
import { EmailWebhookPayload } from './types';

const app = express();

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'amazon-ynab-importer' });
});

// Webhook endpoint for receiving forwarded emails
app.post('/webhook/email', async (req: Request, res: Response) => {
  try {
    logger.info('Received email webhook');

    // Verify webhook secret if configured
    if (config.webhookSecret) {
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
      if (providedSecret !== config.webhookSecret) {
        logger.warn('Unauthorized webhook request - invalid secret');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Parse webhook payload
    const payload = this.parseWebhookPayload(req.body);

    if (!payload) {
      logger.error('Invalid webhook payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Verify this is an Amazon order email
    if (!this.isAmazonOrderEmail(payload)) {
      logger.info('Email is not an Amazon order confirmation, ignoring');
      return res.json({ status: 'ignored', message: 'Not an Amazon order email' });
    }

    // Process the order asynchronously
    const result = await orderProcessor.processOrder(payload.html, payload.text);

    if (result.success) {
      logger.info(`Order processed successfully: ${result.message}`);
      return res.json({ status: 'success', message: result.message });
    } else {
      logger.error(`Order processing failed: ${result.message}`);
      return res.status(500).json({ status: 'error', message: result.message });
    }
  } catch (error) {
    logger.error('Error handling webhook', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Gmail-style webhook (for Gmail API push notifications)
app.post('/webhook/gmail', async (req: Request, res: Response) => {
  try {
    logger.info('Received Gmail push notification');

    // Acknowledge receipt immediately
    res.status(200).send();

    // In a real implementation, you would:
    // 1. Parse the Gmail push notification
    // 2. Use Gmail API to fetch the full email
    // 3. Process it with orderProcessor

    logger.info('Gmail webhook processing not fully implemented');
  } catch (error) {
    logger.error('Error handling Gmail webhook', error);
  }
});

// Manual processing endpoint (for testing or manual triggers)
app.post('/process', async (req: Request, res: Response) => {
  try {
    const { html, text } = req.body;

    if (!html && !text) {
      return res.status(400).json({ error: 'Missing html or text content' });
    }

    const result = await orderProcessor.processOrder(html || '', text || '');

    if (result.success) {
      return res.json({ status: 'success', message: result.message });
    } else {
      return res.status(500).json({ status: 'error', message: result.message });
    }
  } catch (error) {
    logger.error('Error in manual processing', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Parse webhook payload from various email service providers
 */
function parseWebhookPayload(body: any): EmailWebhookPayload | null {
  // SendGrid Inbound Parse format
  if (body.html && body.from && body.subject) {
    return {
      html: body.html,
      text: body.text || '',
      from: body.from,
      to: body.to || '',
      subject: body.subject,
      headers: body.headers,
    };
  }

  // Mailgun format
  if (body['body-html'] && body.sender && body.subject) {
    return {
      html: body['body-html'],
      text: body['body-plain'] || '',
      from: body.sender,
      to: body.recipient || '',
      subject: body.subject,
    };
  }

  // Generic format
  if (body.email) {
    const email = body.email;
    return {
      html: email.html || '',
      text: email.text || '',
      from: email.from || '',
      to: email.to || '',
      subject: email.subject || '',
    };
  }

  return null;
}

/**
 * Check if email is an Amazon order confirmation
 */
function isAmazonOrderEmail(payload: EmailWebhookPayload): boolean {
  const subject = payload.subject.toLowerCase();
  const from = payload.from.toLowerCase();

  return (
    from.includes('amazon.com') &&
    (subject.includes('order') || subject.includes('ordered:'))
  );
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Verify YNAB connection on startup
    logger.info('Verifying YNAB connection...');
    const connected = await ynabClient.verifyConnection();

    if (!connected) {
      logger.error('Failed to connect to YNAB. Please check your configuration.');
      process.exit(1);
    }

    // Start Express server
    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Webhook endpoint: POST http://localhost:${config.port}/webhook/email`);
      logger.info('Ready to receive Amazon order emails!');
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();
