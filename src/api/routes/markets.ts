/**
 * TRUTH-NET Market Routes
 * Manages prediction markets and order books
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { CreateMarketRequestSchema } from '../schemas/index.js';
import { Market, MarketStatus, OutcomeToken } from '../../types.js';
import { MatchingEngine } from '../../engine/matcher/MatchingEngine.js';
import { OracleEngine } from '../../oracle/OracleEngine.js';
import { getMarketSeeder } from '../../oracle/MarketSeeder.js';
import { getLiveNewsMarkets } from './liveNews.js';
import { EventBus } from '../../events/EventBus.js';

// In-memory store (production would use PostgreSQL)
const markets: Map<string, Market> = new Map();
let marketsSeeded = false;

export function createMarketRoutes(engine: MatchingEngine, oracle: OracleEngine, eventBus?: EventBus) {
  // Seed markets on first load
  const seedMarkets = async () => {
    if (marketsSeeded || !eventBus) return;
    
    const seeder = getMarketSeeder(eventBus);
    const seededMarkets = await seeder.seed();
    
    for (const market of seededMarkets) {
      markets.set(market.id, market);
      engine.initializeMarket(market.id);
    }
    
    marketsSeeded = true;
    console.log(`[Markets] Loaded ${seededMarkets.length} seeded markets`);
  };

  return async function marketRoutes(fastify: FastifyInstance): Promise<void> {
    // Seed markets when routes are registered
    await seedMarkets();

    /**
     * POST /v1/markets
     * Create a new prediction market
     */
    fastify.post('/markets', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = CreateMarketRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      const data = parseResult.data;

      // Validate resolution schema
      const schemaValidation = await oracle.validateSchema(data.resolution_schema, false);
      if (!schemaValidation.valid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_RESOLUTION_SCHEMA',
            message: schemaValidation.error ?? 'Invalid resolution schema',
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Create market
      const market: Market = {
        id: uuidv4(),
        ticker: data.ticker,
        title: data.title,
        description: data.description,
        resolution_schema: data.resolution_schema,
        opens_at: new Date(data.opens_at),
        closes_at: new Date(data.closes_at),
        resolves_at: new Date(data.resolves_at),
        status: MarketStatus.PENDING,
        min_order_size: data.min_order_size ?? 1,
        max_position: data.max_position ?? 100000,
        fee_rate: data.fee_rate ?? 0.002,
        volume_yes: 0,
        volume_no: 0,
        open_interest: 0,
        category: data.category,
        tags: data.tags ?? [],
        metadata: data.metadata ?? {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Activate if opens_at is in the past
      if (market.opens_at <= new Date()) {
        market.status = MarketStatus.ACTIVE;
      }

      // Store and initialize order books
      markets.set(market.id, market);
      engine.initializeMarket(market.id);

      // Schedule resolution
      oracle.scheduleResolution(market);

      return reply.status(201).send({
        success: true,
        data: formatMarket(market),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/markets
     * List all markets
     */
    fastify.get('/markets', async (
      request: FastifyRequest<{
        Querystring: {
          status?: string;
          category?: string;
          limit?: string;
          offset?: string;
          source?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { status, category, limit = '50', offset = '0', source } = request.query;

      // Combine seeded markets + live news markets
      const liveMarkets = getLiveNewsMarkets();
      let result = [...Array.from(markets.values()), ...liveMarkets];
      
      // Filter by source if specified
      if (source === 'live') {
        result = liveMarkets;
      } else if (source === 'seeded') {
        result = Array.from(markets.values());
      }

      // Filter by status
      if (status) {
        result = result.filter(m => m.status === status);
      }

      // Filter by category
      if (category) {
        result = result.filter(m => m.category === category);
      }

      // Sort by created_at descending
      result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      // Paginate
      const limitNum = Math.min(parseInt(limit), 100);
      const offsetNum = parseInt(offset);
      const paginated = result.slice(offsetNum, offsetNum + limitNum);

      return reply.send({
        success: true,
        data: {
          markets: paginated.map(formatMarket),
          total: result.length,
          limit: limitNum,
          offset: offsetNum,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/markets/:id
     * Get market details
     */
    fastify.get('/markets/:id', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const market = markets.get(id);

      if (!market) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MARKET_NOT_FOUND',
            message: `Market ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Get current prices
      const yesBook = engine.getBestPrices(id, OutcomeToken.YES);
      const noBook = engine.getBestPrices(id, OutcomeToken.NO);

      return reply.send({
        success: true,
        data: {
          ...formatMarket(market),
          prices: {
            yes: {
              best_bid: yesBook?.bestBid ?? null,
              best_ask: yesBook?.bestAsk ?? null,
              spread: yesBook?.spread ?? null,
              last_trade: yesBook?.lastTradePrice ?? null,
            },
            no: {
              best_bid: noBook?.bestBid ?? null,
              best_ask: noBook?.bestAsk ?? null,
              spread: noBook?.spread ?? null,
              last_trade: noBook?.lastTradePrice ?? null,
            },
          },
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/markets/:id/orderbook
     * Get order book depth
     */
    fastify.get('/markets/:id/orderbook', async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { outcome?: string; depth?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { outcome = 'yes', depth = '50' } = request.query;

      const market = markets.get(id);
      if (!market) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MARKET_NOT_FOUND',
            message: `Market ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const token = outcome === 'no' ? OutcomeToken.NO : OutcomeToken.YES;
      const snapshot = engine.getOrderBookSnapshot(id, token, parseInt(depth));

      if (!snapshot) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ORDERBOOK_NOT_FOUND',
            message: `Order book for market ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const prices = engine.getBestPrices(id, token);

      return reply.send({
        success: true,
        data: {
          market_id: snapshot.market_id,
          outcome: snapshot.outcome,
          bids: snapshot.bids,
          asks: snapshot.asks,
          best_bid: prices?.bestBid ?? null,
          best_ask: prices?.bestAsk ?? null,
          spread: prices?.spread ?? null,
          timestamp: snapshot.timestamp.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/markets/:id/trades
     * Get recent trades
     */
    fastify.get('/markets/:id/trades', async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { limit = '50' } = request.query;

      const market = markets.get(id);
      if (!market) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MARKET_NOT_FOUND',
            message: `Market ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // TODO: Implement trade history storage
      // For now, return empty array
      return reply.send({
        success: true,
        data: {
          trades: [],
          total: 0,
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}

function formatMarket(market: Market) {
  return {
    id: market.id,
    ticker: market.ticker,
    title: market.title,
    description: market.description ?? null,
    resolution_schema: market.resolution_schema,
    opens_at: market.opens_at.toISOString(),
    closes_at: market.closes_at.toISOString(),
    resolves_at: market.resolves_at.toISOString(),
    status: market.status,
    outcome: market.outcome ?? null,
    min_order_size: market.min_order_size,
    max_position: market.max_position,
    fee_rate: market.fee_rate,
    volume_yes: market.volume_yes,
    volume_no: market.volume_no,
    open_interest: market.open_interest,
    last_price_yes: market.last_price_yes ?? null,
    last_price_no: market.last_price_no ?? null,
    category: market.category ?? null,
    tags: market.tags,
    created_at: market.created_at.toISOString(),
    updated_at: market.updated_at.toISOString(),
  };
}

// Export for use in other modules
export { markets };
