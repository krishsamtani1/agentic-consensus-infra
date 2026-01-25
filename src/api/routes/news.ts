/**
 * TRUTH-NET News Aggregator API
 * Routes for headline streaming and auto-market generation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NewsAggregator, createPanamaCanalScenario, HeadlineCategory } from '../../oracle/NewsAggregator.js';
import { EventBus } from '../../events/EventBus.js';

export function createNewsRoutes(eventBus: EventBus) {
  // Create news aggregator
  const newsAggregator = new NewsAggregator(eventBus, {
    headlinesPerDay: 15,
    streamIntervalMs: 15000, // New headline every 15s in demo
    minImpactScore: 0.7,
    autoCreateMarkets: true,
  });

  return async function newsRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /v1/news/headlines
     * Get current headlines
     */
    fastify.get('/news/headlines', async (
      request: FastifyRequest<{ Querystring: { limit?: string; category?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(parseInt(request.query.limit ?? '15'), 50);
      const category = request.query.category as HeadlineCategory | undefined;

      const headlines = category 
        ? newsAggregator.getHeadlinesByCategory(category)
        : newsAggregator.getHeadlines(limit);

      return reply.send({
        success: true,
        data: {
          headlines: headlines.slice(0, limit),
          total: headlines.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/news/markets
     * Get auto-generated markets
     */
    fastify.get('/news/markets', async (_request: FastifyRequest, reply: FastifyReply) => {
      const markets = newsAggregator.getGeneratedMarkets();

      return reply.send({
        success: true,
        data: {
          markets,
          total: markets.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/news/stats
     * Get aggregator stats
     */
    fastify.get('/news/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: newsAggregator.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/news/start
     * Start headline streaming
     */
    fastify.post('/news/start', async (_request: FastifyRequest, reply: FastifyReply) => {
      newsAggregator.start();
      return reply.send({
        success: true,
        data: { message: 'News aggregator started', stats: newsAggregator.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/news/stop
     * Stop headline streaming
     */
    fastify.post('/news/stop', async (_request: FastifyRequest, reply: FastifyReply) => {
      newsAggregator.stop();
      return reply.send({
        success: true,
        data: { message: 'News aggregator stopped', stats: newsAggregator.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/news/demo/panama
     * Launch Panama Canal demo scenario
     */
    fastify.post('/news/demo/panama', async (_request: FastifyRequest, reply: FastifyReply) => {
      const scenario = createPanamaCanalScenario(eventBus);

      // Emit headlines
      for (const headline of scenario.headlines) {
        eventBus.publish('headlines.new', headline);
      }

      // Emit markets
      for (const market of scenario.markets) {
        eventBus.publish('markets.auto_created', { market, headline: scenario.headlines[0] });
      }

      return reply.send({
        success: true,
        data: {
          message: 'Panama Canal demo scenario launched',
          headlines: scenario.headlines.length,
          markets: scenario.markets.length,
          scenario,
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
