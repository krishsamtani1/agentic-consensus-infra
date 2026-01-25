/**
 * TRUTH-NET Headlines API
 * Routes for the Headline Factory / Sourcing Agent
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SourcingAgent } from '../../oracle/SourcingAgent.js';
import { EventBus } from '../../events/EventBus.js';

interface GeneratedMarket {
  market: unknown;
  headline: unknown;
  reasoning: string;
  created_at: Date;
}

const recentMarkets: GeneratedMarket[] = [];

export function createHeadlinesRoutes(eventBus: EventBus) {
  // Create sourcing agent
  const sourcingAgent = new SourcingAgent(eventBus, {
    llmProvider: 'mock',
    minResolvabilityScore: 0.85,
    pollIntervalMs: 30000,
    maxMarketsPerHour: 20,
  });

  // Track generated markets
  sourcingAgent.onMarketGenerated = (market, reasoning) => {
    recentMarkets.unshift({
      market,
      headline: market.metadata,
      reasoning,
      created_at: new Date(),
    });
    // Keep only last 50
    if (recentMarkets.length > 50) {
      recentMarkets.pop();
    }
  };

  return async function headlinesRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /v1/headlines/status
     * Get sourcing agent status
     */
    fastify.get('/headlines/status', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: sourcingAgent.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/headlines/start
     * Start the headline sourcing agent
     */
    fastify.post('/headlines/start', async (_request: FastifyRequest, reply: FastifyReply) => {
      sourcingAgent.start();
      return reply.send({
        success: true,
        data: { message: 'Sourcing agent started', stats: sourcingAgent.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/headlines/stop
     * Stop the headline sourcing agent
     */
    fastify.post('/headlines/stop', async (_request: FastifyRequest, reply: FastifyReply) => {
      sourcingAgent.stop();
      return reply.send({
        success: true,
        data: { message: 'Sourcing agent stopped', stats: sourcingAgent.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/headlines/process
     * Manually process a headline
     */
    fastify.post('/headlines/process', async (
      request: FastifyRequest<{ Body: { headline: string; source?: string } }>,
      reply: FastifyReply
    ) => {
      const { headline, source } = request.body as { headline: string; source?: string };

      if (!headline || typeof headline !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_HEADLINE', message: 'Headline text is required' },
          timestamp: new Date().toISOString(),
        });
      }

      const result = await sourcingAgent.processManualHeadline(headline, source);

      return reply.send({
        success: true,
        data: {
          headline,
          result: {
            schema: result.schema,
            confidence: result.confidence,
            reasoning: result.reasoning,
            will_create_market: result.confidence >= 0.85,
          },
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/headlines/markets
     * Get recently auto-generated markets
     */
    fastify.get('/headlines/markets', async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(parseInt(request.query.limit ?? '20'), 50);

      return reply.send({
        success: true,
        data: {
          markets: recentMarkets.slice(0, limit),
          total: recentMarkets.length,
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
