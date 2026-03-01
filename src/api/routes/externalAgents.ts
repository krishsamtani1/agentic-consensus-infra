/**
 * TRUTH-NET External Agent API
 *
 * This is the PRODUCT API. This is how real users register their AI agents,
 * connect them to the platform, and start building verified track records.
 *
 * Flow:
 * 1. POST /v1/external-agents/register → Register agent + get API key
 * 2. POST /v1/external-agents/:id/predict → Agent submits a prediction on a market
 * 3. GET /v1/external-agents/:id/rating → Get agent's live TruthScore
 * 4. GET /v1/external-agents/:id/history → Get prediction history
 *
 * The prediction endpoint is the key: the user's agent calls our API with its
 * probability estimate for a market, and we place the appropriate trade.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { MatchingEngine } from '../../engine/matcher/MatchingEngine.js';
import { EscrowLedger } from '../../engine/escrow/EscrowLedger.js';
import { EventBus } from '../../events/EventBus.js';
import { getRatingEngine } from '../../rating/RatingEngine.js';

interface ExternalAgent {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  apiKey: string;
  ownerId: string;
  organization?: string;
  createdAt: Date;
  active: boolean;
}

interface PredictionRecord {
  id: string;
  agentId: string;
  marketId: string;
  marketTitle: string;
  probability: number;
  confidence: number;
  reasoning: string;
  side: string;
  price: number;
  quantity: number;
  orderId?: string;
  createdAt: Date;
  resolved?: boolean;
  wasCorrect?: boolean;
  pnlImpact?: number;
  resolvedAt?: Date;
}

const externalAgents = new Map<string, ExternalAgent>();
const agentsByApiKey = new Map<string, string>();
const predictions = new Map<string, PredictionRecord[]>();

export function createExternalAgentRoutes(
  matchingEngine: MatchingEngine,
  escrow: EscrowLedger,
  eventBus: EventBus,
) {
  const ratingEngine = getRatingEngine(eventBus);

  // Settlement feedback loop: when a market resolves, update prediction records
  eventBus.subscribe('settlements.completed', (data: any) => {
    if (!data.payouts) return;
    const marketId = data.market_id;
    for (const payout of data.payouts) {
      const agentPreds = predictions.get(payout.agent_id);
      if (agentPreds) {
        for (const pred of agentPreds) {
          if (pred.marketId === marketId && !pred.resolved) {
            pred.resolved = true;
            pred.wasCorrect = payout.won;
            pred.pnlImpact = payout.profit_loss;
            pred.resolvedAt = new Date();
          }
        }
      }
    }
  });

  return async function externalAgentRoutes(fastify: FastifyInstance): Promise<void> {

    /**
     * POST /v1/external-agents/register
     * Register a new external agent and get an API key
     */
    fastify.post('/external-agents/register', async (
      request: FastifyRequest<{
        Body: {
          name: string;
          description?: string;
          provider?: string;
          model?: string;
          owner_id?: string;
        }
      }>,
      reply: FastifyReply
    ) => {
      const { name, description, provider, model, owner_id, organization } = (request.body as any);

      if (!name || name.length < 2) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Agent name is required (min 2 chars)' },
        });
      }

      const agentId = `ext-${uuidv4().slice(0, 8)}`;
      const apiKey = `tn_${uuidv4().replace(/-/g, '')}`;

      const agent: ExternalAgent = {
        id: agentId,
        name,
        description: description || '',
        provider: provider || 'custom',
        model: model || 'unknown',
        apiKey,
        ownerId: owner_id || 'anonymous',
        organization: organization || undefined,
        createdAt: new Date(),
        active: true,
      };

      externalAgents.set(agentId, agent);
      agentsByApiKey.set(apiKey, agentId);

      escrow.createWallet(agentId, 5000);
      ratingEngine.initializeRating(agentId);

      eventBus.publish('external_agent.registered', {
        agent_id: agentId,
        name,
        provider,
        model,
      });

      return reply.status(201).send({
        success: true,
        data: {
          agent_id: agentId,
          name,
          api_key: apiKey,
          balance: 5000,
          message: 'Agent registered. Use the api_key in X-API-Key header for predictions. THIS KEY IS SHOWN ONLY ONCE.',
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/external-agents/:id/predict
     * Submit a prediction on a market
     *
     * This is the core product endpoint. The external agent says:
     * "I think this market has a 72% chance of YES" and we convert that
     * into a real trade that flows through the matching engine.
     */
    fastify.post('/external-agents/:id/predict', async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          market_id: string;
          probability: number;
          confidence?: number;
          reasoning?: string;
          stake?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const apiKey = request.headers['x-api-key'] as string;

      const agent = externalAgents.get(id);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        });
      }

      if (apiKey !== agent.apiKey) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
        });
      }

      const { market_id, probability, confidence = 0.5, reasoning = '', stake } = request.body;

      if (typeof probability !== 'number' || probability < 0.01 || probability > 0.99) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'probability must be between 0.01 and 0.99' },
        });
      }

      const prices = matchingEngine.getBestPrices(market_id, 'yes' as any);
      const currentPrice = prices?.midPrice ?? 0.5;
      const edge = probability - currentPrice;

      if (Math.abs(edge) < 0.01) {
        return reply.send({
          success: true,
          data: {
            action: 'no_trade',
            message: 'Your probability estimate is too close to the market price. No edge detected.',
            your_probability: probability,
            market_price: currentPrice,
            edge: edge,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const side = edge > 0 ? 'buy' : 'sell';
      const price = side === 'buy'
        ? Math.min(0.95, currentPrice + Math.abs(edge) * 0.5)
        : Math.max(0.05, currentPrice - Math.abs(edge) * 0.5);

      const balance = escrow.getBalance(id);
      const maxStake = balance ? balance.available * 0.2 : 100;
      const quantity = Math.max(1, Math.min(
        stake || Math.floor(maxStake * confidence),
        maxStake,
      ));

      try {
        const result = await matchingEngine.processOrder(id, market_id, {
          market_id,
          side: side as any,
          outcome: 'yes' as any,
          order_type: 'limit' as any,
          price: Math.round(price * 100) / 100,
          quantity,
          metadata: {
            source: 'external_api',
            probability,
            confidence,
            reasoning,
            provider: agent.provider,
            model: agent.model,
          },
        });

        const record: PredictionRecord = {
          id: uuidv4(),
          agentId: id,
          marketId: market_id,
          marketTitle: market_id,
          probability,
          confidence,
          reasoning,
          side,
          price: Math.round(price * 100) / 100,
          quantity,
          orderId: result.order.id,
          createdAt: new Date(),
        };

        const agentPredictions = predictions.get(id) || [];
        agentPredictions.push(record);
        if (agentPredictions.length > 200) agentPredictions.shift();
        predictions.set(id, agentPredictions);

        eventBus.publish('external_agent.predicted', {
          agent_id: id,
          agent_name: agent.name,
          market_id,
          probability,
          confidence,
          reasoning,
          side,
          price: Math.round(price * 100) / 100,
          quantity,
          order_id: result.order.id,
          trades: result.result.trades.length,
        });

        return reply.send({
          success: true,
          data: {
            prediction_id: record.id,
            action: side,
            your_probability: probability,
            market_price: currentPrice,
            edge: Math.round(edge * 1000) / 1000,
            order: {
              id: result.order.id,
              side,
              price: Math.round(price * 100) / 100,
              quantity,
              status: result.order.status,
              filled: result.order.filled_qty,
            },
            trades_matched: result.result.trades.length,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'ORDER_FAILED', message: err.message },
        });
      }
    });

    /**
     * GET /v1/external-agents/:id/rating
     * Get an agent's current TruthScore and rating breakdown
     */
    fastify.get('/external-agents/:id/rating', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const rating = ratingEngine.getRating(request.params.id);
      if (!rating) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No rating found for this agent' },
        });
      }

      return reply.send({
        success: true,
        data: {
          agent_id: rating.agent_id,
          truth_score: rating.truth_score,
          grade: rating.grade,
          certified: rating.certified,
          components: {
            brier: { score: rating.brier_component, weight: 0.35, raw: rating.brier_score },
            sharpe: { score: rating.sharpe_component, weight: 0.25, raw: rating.sharpe_ratio },
            winrate: { score: rating.winrate_component, weight: 0.20, raw: rating.win_rate },
            consistency: { score: rating.consistency_component, weight: 0.10 },
            risk: { score: rating.risk_component, weight: 0.10, raw: rating.max_drawdown },
          },
          performance: {
            total_trades: rating.total_trades,
            winning_trades: rating.winning_trades,
            total_pnl: rating.total_pnl,
          },
          last_updated: rating.last_updated,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/external-agents/:id/predictions
     * Get prediction history for an agent
     */
    fastify.get('/external-agents/:id/predictions', async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const agentPredictions = predictions.get(request.params.id) || [];
      const limit = parseInt(request.query.limit || '50');

      return reply.send({
        success: true,
        data: {
          predictions: agentPredictions.slice(-limit),
          total: agentPredictions.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/external-agents
     * List all external agents (public info only)
     */
    fastify.get('/external-agents', async (_request: FastifyRequest, reply: FastifyReply) => {
      const agents = Array.from(externalAgents.values()).map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        provider: a.provider,
        model: a.model,
        organization: a.organization,
        active: a.active,
        registered_at: a.createdAt,
        predictions: (predictions.get(a.id) || []).length,
      }));

      return reply.send({
        success: true,
        data: { agents, total: agents.length },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/external-agents/:id/results
     * Report card: resolved predictions with outcomes (the feedback loop)
     */
    fastify.get('/external-agents/:id/results', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const agentPreds = predictions.get(request.params.id) || [];
      const resolved = agentPreds.filter(p => p.resolved);
      const correct = resolved.filter(p => p.wasCorrect);
      const totalPnl = resolved.reduce((sum, p) => sum + (p.pnlImpact || 0), 0);

      return reply.send({
        success: true,
        data: {
          total_predictions: agentPreds.length,
          resolved: resolved.length,
          correct: correct.length,
          accuracy: resolved.length > 0 ? Math.round((correct.length / resolved.length) * 1000) / 10 : 0,
          total_pnl: Math.round(totalPnl * 100) / 100,
          results: resolved.map(p => ({
            prediction_id: p.id,
            market_id: p.marketId,
            probability: p.probability,
            side: p.side,
            was_correct: p.wasCorrect,
            pnl_impact: p.pnlImpact,
            predicted_at: p.createdAt,
            resolved_at: p.resolvedAt,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}

// Export for name resolution in leaderboard
export function getExternalAgentName(agentId: string): string | null {
  const agent = externalAgents.get(agentId);
  return agent ? agent.name : null;
}

export function getExternalAgentMeta(agentId: string): { name: string; model: string; provider: string; organization?: string } | null {
  const agent = externalAgents.get(agentId);
  if (!agent) return null;
  return { name: agent.name, model: agent.model, provider: agent.provider, organization: agent.organization };
}
