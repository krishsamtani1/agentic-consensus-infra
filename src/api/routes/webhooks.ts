/**
 * TRUTH-NET Webhook Notification System
 * 
 * Pro/Enterprise subscribers register webhooks to receive real-time
 * notifications when agent grades change, certifications issue, etc.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventBus } from '../../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

interface WebhookSubscription {
  id: string;
  userId: string;
  url: string;
  events: string[];   // e.g. ['ratings.grade_changed', 'ratings.certified']
  secret: string;      // HMAC signing secret
  active: boolean;
  failureCount: number;
  lastTriggeredAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  statusCode: number | null;
  success: boolean;
  attemptedAt: Date;
  responseTime?: number;
}

// In-memory stores
const webhooks = new Map<string, WebhookSubscription>();
const deliveries: WebhookDelivery[] = [];

// ============================================================================
// WEBHOOK DELIVERY ENGINE
// ============================================================================

async function deliverWebhook(webhook: WebhookSubscription, event: string, payload: any): Promise<void> {
  const deliveryId = uuidv4();
  const body = JSON.stringify({
    id: deliveryId,
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  const startTime = Date.now();
  let statusCode: number | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const resp = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TruthNet-Webhook-ID': deliveryId,
        'X-TruthNet-Event': event,
        'X-TruthNet-Signature': `sha256=${webhook.secret}`, // simplified
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = resp.status;
    success = resp.ok;

    if (success) {
      webhook.failureCount = 0;
      webhook.lastTriggeredAt = new Date();
    } else {
      webhook.failureCount++;
      webhook.lastFailureAt = new Date();
    }
  } catch (err: any) {
    webhook.failureCount++;
    webhook.lastFailureAt = new Date();
    console.error(`[Webhooks] Delivery failed for ${webhook.id}: ${err.message}`);
  }

  // Disable after 10 consecutive failures
  if (webhook.failureCount >= 10) {
    webhook.active = false;
    console.log(`[Webhooks] Disabled webhook ${webhook.id} after 10 failures`);
  }

  // Log delivery
  deliveries.push({
    id: deliveryId,
    webhookId: webhook.id,
    event,
    payload,
    statusCode,
    success,
    attemptedAt: new Date(),
    responseTime: Date.now() - startTime,
  });

  // Keep only last 1000 deliveries
  if (deliveries.length > 1000) deliveries.splice(0, deliveries.length - 1000);
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createWebhookRoutes(eventBus: EventBus) {
  // Subscribe to events and fan out to webhooks
  const WEBHOOK_EVENTS = [
    'ratings.grade_changed',
    'ratings.certified',
    'ratings.updated',
    'settlements.completed',
    'markets.resolved',
  ];

  for (const eventName of WEBHOOK_EVENTS) {
    eventBus.subscribe(eventName, (data: any) => {
      for (const webhook of webhooks.values()) {
        if (webhook.active && webhook.events.includes(eventName)) {
          deliverWebhook(webhook, eventName, data).catch(console.error);
        }
      }
    });
  }

  return async function webhookRoutes(fastify: FastifyInstance): Promise<void> {

    // POST /webhooks/create - Register a webhook
    fastify.post('/webhooks/create', async (
      request: FastifyRequest<{ Body: { userId: string; url: string; events: string[] } }>,
      reply: FastifyReply
    ) => {
      const { userId, url, events } = request.body;
      if (!userId || !url || !events?.length) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'userId, url, and events are required' },
        });
      }

      const secret = `whsec_${uuidv4().replace(/-/g, '')}`;
      const webhook: WebhookSubscription = {
        id: uuidv4(),
        userId,
        url,
        events,
        secret,
        active: true,
        failureCount: 0,
        createdAt: new Date(),
      };

      webhooks.set(webhook.id, webhook);

      return reply.send({
        success: true,
        data: {
          id: webhook.id,
          secret, // Only shown once
          events: webhook.events,
          message: 'Webhook registered. Store the secret securely.',
          available_events: WEBHOOK_EVENTS,
        },
      });
    });

    // GET /webhooks/events - List available events (MUST be before :userId param route)
    fastify.get('/webhooks/events', async (_request, reply) => {
      return reply.send({
        success: true,
        data: { events: WEBHOOK_EVENTS },
      });
    });

    // GET /webhooks/deliveries/:webhookId - Delivery history (MUST be before :userId param route)
    fastify.get('/webhooks/deliveries/:webhookId', async (
      request: FastifyRequest<{ Params: { webhookId: string } }>,
      reply: FastifyReply
    ) => {
      const { webhookId } = request.params;
      const history = deliveries
        .filter(d => d.webhookId === webhookId)
        .slice(-50);

      return reply.send({ success: true, data: { deliveries: history } });
    });

    // GET /webhooks/:userId - List user's webhooks (param route AFTER static routes)
    fastify.get('/webhooks/:userId', async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const userWebhooks = Array.from(webhooks.values())
        .filter(w => w.userId === userId)
        .map(({ secret, ...rest }) => rest);

      return reply.send({ success: true, data: { webhooks: userWebhooks } });
    });

    // DELETE /webhooks/:webhookId - Delete a webhook
    fastify.delete('/webhooks/:webhookId', async (
      request: FastifyRequest<{ Params: { webhookId: string } }>,
      reply: FastifyReply
    ) => {
      const { webhookId } = request.params;
      const deleted = webhooks.delete(webhookId);

      return reply.send({
        success: true,
        data: { deleted, message: deleted ? 'Webhook deleted' : 'Webhook not found' },
      });
    });

    // POST /webhooks/test/:webhookId - Send test payload
    fastify.post('/webhooks/test/:webhookId', async (
      request: FastifyRequest<{ Params: { webhookId: string } }>,
      reply: FastifyReply
    ) => {
      const { webhookId } = request.params;
      const webhook = webhooks.get(webhookId);

      if (!webhook) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      await deliverWebhook(webhook, 'test.ping', {
        message: 'This is a test webhook delivery from TRUTH-NET',
        timestamp: new Date().toISOString(),
      });

      return reply.send({
        success: true,
        data: { message: 'Test webhook sent' },
      });
    });

  };
}
