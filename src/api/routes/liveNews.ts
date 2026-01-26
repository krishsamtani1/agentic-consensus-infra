/**
 * TRUTH-NET Live News API
 * Routes for real-time news fetching and market generation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LiveNewsFetcher, HeadlineCategory } from '../../oracle/LiveNewsFetcher.js';
import { EventBus } from '../../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';
import { Market, MarketStatus, HttpJsonResolutionSchema } from '../../types.js';

// Shared state for auto-generated markets (accessible across modules)
export const liveNewsMarkets: Market[] = [];
let fetcherInstance: LiveNewsFetcher | null = null;

export function getLiveNewsMarkets(): Market[] {
  return liveNewsMarkets;
}

export function getLiveNewsFetcher(): LiveNewsFetcher | null {
  return fetcherInstance;
}

export function createLiveNewsRoutes(eventBus: EventBus) {
  // Create live news fetcher
  const liveNewsFetcher = new LiveNewsFetcher(eventBus);
  fetcherInstance = liveNewsFetcher;

  // Subscribe to new headlines and auto-generate markets
  // Lower threshold to 0.5 to capture more headlines (RSS feeds are curated)
  eventBus.subscribe('headlines.new', (headline: any) => {
    if (headline.impact_score >= 0.5) {
      const market = generateMarketFromHeadline(headline);
      if (market) {
        liveNewsMarkets.unshift(market);
        if (liveNewsMarkets.length > 100) liveNewsMarkets.pop();
        eventBus.publish('markets.auto_created', { market, headline });
        console.log(`[LiveNews] Created market: ${market.ticker} - ${market.title.slice(0, 50)}...`);
      }
    }
  });

  // AUTO-START: Begin fetching immediately when routes are registered
  console.log('[LiveNews] Auto-starting news fetcher...');
  liveNewsFetcher.start().then(() => {
    console.log('[LiveNews] Fetcher started successfully');
  }).catch(err => {
    console.error('[LiveNews] Failed to start fetcher:', err);
  });

  return async function liveNewsRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /v1/live-news/headlines
     * Get live headlines from real sources
     */
    fastify.get('/live-news/headlines', async (
      request: FastifyRequest<{ Querystring: { limit?: string; category?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(parseInt(request.query.limit ?? '15'), 50);
      const category = request.query.category as HeadlineCategory | undefined;

      const headlines = category 
        ? liveNewsFetcher.getByCategory(category)
        : liveNewsFetcher.getHeadlines(limit);

      return reply.send({
        success: true,
        data: {
          headlines: headlines.slice(0, limit),
          total: headlines.length,
          source: 'live',
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/live-news/high-impact
     * Get high-impact headlines (score > 0.7)
     */
    fastify.get('/live-news/high-impact', async (_request: FastifyRequest, reply: FastifyReply) => {
      const headlines = liveNewsFetcher.getHighImpact();

      return reply.send({
        success: true,
        data: {
          headlines,
          total: headlines.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/live-news/markets
     * Get auto-generated markets from live headlines
     */
    fastify.get('/live-news/markets', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          markets: liveNewsMarkets,
          total: liveNewsMarkets.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/live-news/stats
     * Get fetcher stats
     */
    fastify.get('/live-news/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: liveNewsFetcher.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/live-news/start
     * Start live news fetching
     */
    fastify.post('/live-news/start', async (_request: FastifyRequest, reply: FastifyReply) => {
      await liveNewsFetcher.start();
      return reply.send({
        success: true,
        data: { 
          message: 'Live news fetcher started',
          stats: liveNewsFetcher.getStats(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/live-news/stop
     * Stop live news fetching
     */
    fastify.post('/live-news/stop', async (_request: FastifyRequest, reply: FastifyReply) => {
      liveNewsFetcher.stop();
      return reply.send({
        success: true,
        data: { 
          message: 'Live news fetcher stopped',
          stats: liveNewsFetcher.getStats(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/live-news/refresh
     * Manually trigger a fetch from all sources
     */
    fastify.post('/live-news/refresh', async (_request: FastifyRequest, reply: FastifyReply) => {
      const headlines = await liveNewsFetcher.refresh();
      return reply.send({
        success: true,
        data: {
          message: 'Refresh complete',
          newHeadlines: headlines.length,
          stats: liveNewsFetcher.getStats(),
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}

/**
 * Generate a tradable market from a headline
 */
function generateMarketFromHeadline(headline: any): Market | null {
  const now = new Date();
  const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000);

  // Generate question from headline
  const question = generateQuestion(headline.title, headline.category);
  if (!question) return null;

  const ticker = generateTicker(headline.category, headline.title);

  const resolutionSchema: HttpJsonResolutionSchema = {
    type: 'http_json',
    source_url: headline.source_url || 'https://api.truthnet.example.com/resolve',
    method: 'GET',
    json_path: '$.resolved',
    condition: { operator: 'eq', value: true },
  };

  // Simulate realistic initial volume based on impact score
  const baseVolume = Math.floor(10000 + headline.impact_score * 50000);
  const yesRatio = 0.35 + Math.random() * 0.3; // 35-65% initial YES
  const volumeYes = Math.floor(baseVolume * yesRatio);
  const volumeNo = Math.floor(baseVolume * (1 - yesRatio));

  return {
    id: uuidv4(),
    ticker,
    title: question,
    description: `**${headline.title}**\n\n${headline.summary || 'No summary available.'}\n\n**Source:** ${headline.source}\n**Category:** ${headline.category}`,
    resolution_schema: resolutionSchema,
    opens_at: now,
    closes_at: closesAt,
    resolves_at: resolvesAt,
    status: MarketStatus.ACTIVE,
    min_order_size: 1,
    max_position: 10000,
    fee_rate: 0.002,
    volume_yes: volumeYes,
    volume_no: volumeNo,
    open_interest: Math.floor((volumeYes + volumeNo) * 0.25),
    last_price_yes: yesRatio,
    last_price_no: 1 - yesRatio,
    category: headline.category,
    tags: headline.tags || [],
    metadata: {
      headline_id: headline.id,
      source: headline.source,
      source_url: headline.source_url,
      impact_score: headline.impact_score,
      auto_generated: true,
      live_sourced: true,
      fetched_at: headline.fetched_at,
    },
    created_at: now,
    updated_at: now,
  };
}

/**
 * Generate a binary question from headline
 */
function generateQuestion(title: string, category: string): string | null {
  const lower = title.toLowerCase();

  // Pattern matching for different headline types
  if (lower.includes('announce') || lower.includes('launch')) {
    return `Will "${title.slice(0, 80)}..." have significant market impact within 7 days?`;
  }

  if (lower.includes('delay') || lower.includes('disrupt')) {
    return `Will the disruption mentioned persist for more than 48 hours?`;
  }

  if (lower.includes('hurricane') || lower.includes('storm')) {
    return `Will this weather event cause major infrastructure damage?`;
  }

  if (lower.includes('strike') || lower.includes('protest')) {
    return `Will this labor action last more than 72 hours?`;
  }

  if (lower.includes('funding') || lower.includes('raises')) {
    return `Will this funding round close successfully?`;
  }

  if (lower.includes('record') || lower.includes('surge') || lower.includes('spike')) {
    return `Will this trend continue for the next 7 days?`;
  }

  // Default: general impact question
  return `Will "${title.slice(0, 60)}..." prove significant within 7 days?`;
}

/**
 * Generate ticker from category and title
 */
function generateTicker(category: string, title: string): string {
  const categoryPrefix: Record<string, string> = {
    'logistics': 'LOG',
    'tech-earnings': 'TECH',
    'weather': 'WX',
    'geopolitics': 'GEO',
    'niche-internet': 'NET',
  };

  const prefix = categoryPrefix[category] || 'GEN';
  const words = title.split(' ').filter(w => w.length > 3).slice(0, 2);
  const titlePart = words.map(w => w.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)).join('-');
  const datePart = new Date().toISOString().slice(5, 10).replace('-', '');
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();

  return `${prefix}-${titlePart}-${datePart}-${rand}`;
}
