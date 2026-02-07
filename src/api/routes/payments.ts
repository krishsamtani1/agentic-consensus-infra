/**
 * TRUTH-NET Payment Routes
 * Stripe Hybrid Payment Integration
 * 
 * Model: Users deposit real USD via Stripe Checkout.
 * Funds land in the internal EscrowLedger as credits.
 * All trading happens on the internal ledger.
 * Withdrawals are queued for admin approval.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { EscrowLedger } from '../../engine/escrow/EscrowLedger.js';
import { EventBus } from '../../events/EventBus.js';

// ============================================================================
// TYPES
// ============================================================================

interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  createdAt: Date;
  processedAt?: Date;
  reason?: string;
}

// In-memory stores (production: PostgreSQL)
const processedSessions = new Set<string>();
const withdrawalRequests = new Map<string, WithdrawalRequest>();
const userDeposits = new Map<string, { amount: number; stripeSessionId: string; timestamp: Date }[]>();

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createPaymentRoutes(escrow: EscrowLedger, eventBus: EventBus) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-18.acacia' as any,
  });

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const DEPOSIT_PRESETS = [10, 50, 100, 500];

  return async function paymentRoutes(fastify: FastifyInstance): Promise<void> {

    // -----------------------------------------------------------------------
    // POST /payments/create-checkout - Create Stripe Checkout Session
    // -----------------------------------------------------------------------
    fastify.post('/payments/create-checkout', async (
      request: FastifyRequest<{ Body: { amount: number; userId: string } }>,
      reply: FastifyReply
    ) => {
      const { amount, userId } = request.body;

      if (!amount || amount < 1 || amount > 10000) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Amount must be between $1 and $10,000' },
          timestamp: new Date().toISOString(),
        });
      }

      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_USER', message: 'userId is required' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'TRUTH-NET Credits',
                description: `Deposit $${amount} to your TRUTH-NET trading account`,
              },
              unit_amount: Math.round(amount * 100), // Stripe uses cents
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${FRONTEND_URL}/?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${FRONTEND_URL}/?deposit=cancelled`,
          metadata: {
            userId,
            amount: String(amount),
            type: 'truthnet_deposit',
          },
        });

        return reply.send({
          success: true,
          data: {
            sessionId: session.id,
            url: session.url,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error('[Payments] Stripe checkout error:', error.message);
        return reply.status(500).send({
          success: false,
          error: { code: 'STRIPE_ERROR', message: error.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -----------------------------------------------------------------------
    // POST /payments/webhook - Stripe Webhook Handler
    // -----------------------------------------------------------------------
    fastify.post('/payments/webhook', {
      config: { rawBody: true },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const sig = request.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;

      try {
        if (webhookSecret && sig) {
          event = stripe.webhooks.constructEvent(
            request.body as string,
            sig,
            webhookSecret
          );
        } else {
          // Dev mode - parse directly
          event = request.body as Stripe.Event;
        }
      } catch (err: any) {
        console.error('[Payments] Webhook signature verification failed:', err.message);
        return reply.status(400).send({ error: 'Webhook signature verification failed' });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;
        const userId = session.metadata?.userId;
        const amount = parseFloat(session.metadata?.amount || '0');

        // Idempotency check - prevent double-credit
        if (processedSessions.has(sessionId)) {
          console.log('[Payments] Duplicate webhook, session already processed:', sessionId);
          return reply.send({ received: true });
        }

        if (userId && amount > 0) {
          try {
            // Credit the user's wallet via EscrowLedger
            await escrow.depositFromStripe(userId, amount, sessionId);
            processedSessions.add(sessionId);

            // Track deposit history
            if (!userDeposits.has(userId)) {
              userDeposits.set(userId, []);
            }
            userDeposits.get(userId)!.push({
              amount,
              stripeSessionId: sessionId,
              timestamp: new Date(),
            });

            eventBus.publish('payment.deposit.completed', {
              userId,
              amount,
              sessionId,
              timestamp: new Date().toISOString(),
            });

            console.log(`[Payments] Credited $${amount} to user ${userId} (session: ${sessionId})`);
          } catch (error: any) {
            console.error('[Payments] Failed to credit wallet:', error.message);
          }
        }
      }

      return reply.send({ received: true });
    });

    // -----------------------------------------------------------------------
    // GET /payments/history/:userId - Transaction History
    // -----------------------------------------------------------------------
    fastify.get('/payments/history/:userId', async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const deposits = userDeposits.get(userId) || [];
      const withdrawals = Array.from(withdrawalRequests.values())
        .filter(w => w.userId === userId);

      return reply.send({
        success: true,
        data: {
          deposits,
          withdrawals,
          totalDeposited: deposits.reduce((sum, d) => sum + d.amount, 0),
          totalWithdrawn: withdrawals
            .filter(w => w.status === 'processed')
            .reduce((sum, w) => sum + w.amount, 0),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /payments/withdraw-request - Request Withdrawal
    // -----------------------------------------------------------------------
    fastify.post('/payments/withdraw-request', async (
      request: FastifyRequest<{ Body: { userId: string; amount: number } }>,
      reply: FastifyReply
    ) => {
      const { userId, amount } = request.body;

      if (!userId || !amount || amount <= 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'userId and positive amount required' },
          timestamp: new Date().toISOString(),
        });
      }

      // Check balance
      const balance = escrow.getBalance(userId);
      if (!balance || balance.available < amount) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INSUFFICIENT_BALANCE', message: `Available: $${balance?.available || 0}` },
          timestamp: new Date().toISOString(),
        });
      }

      const id = `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const withdrawal: WithdrawalRequest = {
        id,
        userId,
        amount,
        status: 'pending',
        createdAt: new Date(),
      };

      withdrawalRequests.set(id, withdrawal);

      // Lock funds for pending withdrawal
      await escrow.lock(userId, amount, 'withdrawal', id);

      eventBus.publish('payment.withdrawal.requested', {
        id,
        userId,
        amount,
        timestamp: new Date().toISOString(),
      });

      return reply.send({
        success: true,
        data: withdrawal,
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /payments/presets - Get deposit amount presets
    // -----------------------------------------------------------------------
    fastify.get('/payments/presets', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          presets: DEPOSIT_PRESETS,
          min: 1,
          max: 10000,
          currency: 'USD',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /payments/demo-credit - Demo mode: add free credits
    // -----------------------------------------------------------------------
    fastify.post('/payments/demo-credit', async (
      request: FastifyRequest<{ Body: { userId: string; amount?: number } }>,
      reply: FastifyReply
    ) => {
      const { userId, amount = 10000 } = request.body;

      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_USER', message: 'userId is required' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        await escrow.depositFromStripe(userId, amount, `demo-${Date.now()}`);

        return reply.send({
          success: true,
          data: {
            credited: amount,
            balance: escrow.getBalance(userId),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'CREDIT_FAILED', message: error.message },
          timestamp: new Date().toISOString(),
        });
      }
    });
  };
}
