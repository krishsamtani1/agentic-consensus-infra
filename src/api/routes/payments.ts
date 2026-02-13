/**
 * TRUTH-NET Payment Routes
 * Stripe Hybrid Payment Integration
 * 
 * Two revenue streams:
 * 1. DEPOSITS: Users deposit real USD via Stripe Checkout for trading.
 *    Funds land in the internal EscrowLedger as credits.
 * 2. SUBSCRIPTIONS: Enterprise clients subscribe to rating API plans.
 *    Managed via Stripe Subscriptions.
 * 
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

interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'developer' | 'pro' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: 'active' | 'past_due' | 'cancelled';
  agentSlots: number;
  apiCallsLimit: number; // per day
  currentPeriodEnd?: Date;
  createdAt: Date;
}

// In-memory stores (production: PostgreSQL)
const processedSessions = new Set<string>();
const withdrawalRequests = new Map<string, WithdrawalRequest>();
const userDeposits = new Map<string, { amount: number; stripeSessionId: string; timestamp: Date }[]>();
const subscriptions = new Map<string, Subscription>();

// Plan definitions
const PLANS = {
  free: { price: 0, agentSlots: 0, apiCallsLimit: 100, label: 'Free', features: ['Public leaderboard', 'Top-10 agent ratings'] },
  developer: { price: 4900, agentSlots: 1, apiCallsLimit: 1000, label: 'Developer', features: ['Full API access', '1 agent slot', 'Benchmark history', 'Rating webhooks'] },
  pro: { price: 19900, agentSlots: 10, apiCallsLimit: 10000, label: 'Pro', features: ['Unlimited agents', 'Advanced analytics', 'Certification', 'Priority support'] },
  enterprise: { price: 0, agentSlots: 100, apiCallsLimit: 100000, label: 'Enterprise', features: ['White-label ratings', 'Custom benchmarks', 'SLA', 'Dedicated support'] },
} as const;

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

    // =======================================================================
    // SUBSCRIPTION ROUTES (Rating API Plans)
    // =======================================================================

    // -----------------------------------------------------------------------
    // GET /payments/plans - List available subscription plans
    // -----------------------------------------------------------------------
    fastify.get('/payments/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          plans: Object.entries(PLANS).map(([key, plan]) => ({
            id: key,
            label: plan.label,
            price_cents: plan.price,
            price_display: plan.price === 0 
              ? (key === 'enterprise' ? 'Custom' : 'Free') 
              : `$${(plan.price / 100).toFixed(0)}/mo`,
            agent_slots: plan.agentSlots,
            api_calls_limit: plan.apiCallsLimit,
            features: plan.features,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /payments/subscribe - Create a subscription via Stripe
    // -----------------------------------------------------------------------
    fastify.post('/payments/subscribe', async (
      request: FastifyRequest<{ Body: { userId: string; plan: string; email?: string } }>,
      reply: FastifyReply
    ) => {
      const { userId, plan, email } = request.body;

      if (!userId || !plan) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'userId and plan are required' },
          timestamp: new Date().toISOString(),
        });
      }

      const planConfig = PLANS[plan as keyof typeof PLANS];
      if (!planConfig) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_PLAN', message: `Unknown plan: ${plan}. Available: free, developer, pro, enterprise` },
          timestamp: new Date().toISOString(),
        });
      }

      // Free plan — just create locally
      if (plan === 'free') {
        const sub: Subscription = {
          id: `sub-${Date.now()}`,
          userId,
          plan: 'free',
          status: 'active',
          agentSlots: planConfig.agentSlots,
          apiCallsLimit: planConfig.apiCallsLimit,
          createdAt: new Date(),
        };
        subscriptions.set(userId, sub);

        return reply.send({
          success: true,
          data: { subscription: sub },
          timestamp: new Date().toISOString(),
        });
      }

      // Enterprise — contact sales
      if (plan === 'enterprise') {
        return reply.send({
          success: true,
          data: {
            message: 'Enterprise plans require a sales consultation.',
            contact: 'enterprise@truthnet.com',
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Paid plans — create Stripe Checkout for subscription
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'subscription',
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `TRUTH-NET ${planConfig.label} Plan`,
                description: `Rating API access: ${planConfig.agentSlots} agent slot(s), ${planConfig.apiCallsLimit} API calls/day`,
              },
              unit_amount: planConfig.price,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          }],
          success_url: `${FRONTEND_URL}/?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${FRONTEND_URL}/?subscription=cancelled`,
          metadata: {
            userId,
            plan,
            type: 'truthnet_subscription',
          },
          customer_email: email,
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
        console.error('[Payments] Stripe subscription error:', error.message);
        return reply.status(500).send({
          success: false,
          error: { code: 'STRIPE_ERROR', message: error.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -----------------------------------------------------------------------
    // GET /payments/subscription/:userId - Get current subscription
    // -----------------------------------------------------------------------
    fastify.get('/payments/subscription/:userId', async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const sub = subscriptions.get(userId);

      if (!sub) {
        // Default to free tier
        return reply.send({
          success: true,
          data: {
            plan: 'free',
            status: 'active',
            agent_slots: PLANS.free.agentSlots,
            api_calls_limit: PLANS.free.apiCallsLimit,
            features: PLANS.free.features,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const planConfig = PLANS[sub.plan];
      return reply.send({
        success: true,
        data: {
          id: sub.id,
          plan: sub.plan,
          plan_label: planConfig.label,
          status: sub.status,
          agent_slots: sub.agentSlots,
          api_calls_limit: sub.apiCallsLimit,
          features: planConfig.features,
          current_period_end: sub.currentPeriodEnd?.toISOString(),
          created_at: sub.createdAt.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /payments/cancel-subscription - Cancel subscription
    // -----------------------------------------------------------------------
    fastify.post('/payments/cancel-subscription', async (
      request: FastifyRequest<{ Body: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.body;
      const sub = subscriptions.get(userId);

      if (!sub || sub.plan === 'free') {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_SUBSCRIPTION', message: 'No active paid subscription found' },
          timestamp: new Date().toISOString(),
        });
      }

      // Cancel in Stripe if applicable
      if (sub.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (e: any) {
          console.error('[Payments] Stripe cancel error:', e.message);
        }
      }

      sub.status = 'cancelled';
      // Downgrade to free
      sub.plan = 'free';
      sub.agentSlots = PLANS.free.agentSlots;
      sub.apiCallsLimit = PLANS.free.apiCallsLimit;

      eventBus.publish('payment.subscription.cancelled', {
        userId,
        timestamp: new Date().toISOString(),
      });

      return reply.send({
        success: true,
        data: { message: 'Subscription cancelled. Downgraded to Free tier.' },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
