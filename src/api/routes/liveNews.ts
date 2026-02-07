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
/**
 * Clean HTML entities from text
 */
function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateMarketFromHeadline(headline: any): Market | null {
  const now = new Date();
  const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000);

  // Clean up the headline title first
  const cleanTitle = cleanHtmlEntities(headline.title);

  // Generate question from headline
  const question = generateQuestion(cleanTitle, headline.category);
  if (!question) return null;

  // Also clean the question output just in case
  const cleanQuestion = cleanHtmlEntities(question);

  const ticker = generateTicker(headline.category, cleanTitle);

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
    title: cleanQuestion,
    description: `**${cleanTitle}**\n\n${cleanHtmlEntities(headline.summary || 'No summary available.')}\n\n**Source:** ${headline.source}\n**Category:** ${headline.category}`,
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
 * Generate a SPECIFIC, BINARY question directly from the headline content.
 * Every question must reference the actual subject matter of the headline.
 * No generic templates - the question should make sense as a standalone market.
 */
function generateQuestion(title: string, category: string): string | null {
  // Clean up the title - remove HTML entities, trim
  const clean = title
    .replace(/&#\d+;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  // Skip garbage headlines - aggressive filtering for quality
  if (clean.length < 20 || clean.length > 200) return null;
  if (/^(show hn|ask hn|tell hn|daily|weekly|thread|update|moons? update|spc -)/i.test(clean)) return null;
  if (/best .+ (2024|2025|2026)|review|tested|our .+ would/i.test(clean)) return null;
  if (/^\d+ best|top \d+|^the \d+ best/i.test(clean)) return null;
  if (/\bAMA\b|ask me anything|daily discussion|live thread/i.test(clean)) return null;
  if (/^(hi!|hello|hey|welcome)\s/i.test(clean)) return null;
  if (/no watches are valid|no warnings|no advisories/i.test(clean)) return null;
  if (/discount|coupon|deal of|sale|promo|tested and reviewed/i.test(clean)) return null;
  if (/\b(giveaway|sweepstake|contest)\b/i.test(clean)) return null;
  if (/^opinion:|^editorial:|^letter:/i.test(clean)) return null;
  if (/would feel less gimmicky|scatterbrain/i.test(clean)) return null;

  // Extract key entities from headline
  const subject = extractSubject(clean);
  if (!subject) return null;

  const lower = clean.toLowerCase();

  // =========================================================================
  // Generate question based on the actual content
  // =========================================================================

  // Person/entity doing something
  if (lower.includes('announces') || lower.includes('announced')) {
    return `Will ${subject} follow through on this announcement within 30 days?`;
  }
  if (lower.includes('plans') || lower.includes('planning') || lower.includes('preparing') || lower.includes('preps')) {
    return `Will ${subject} execute on these plans within 60 days?`;
  }
  if (lower.includes('threatens') || lower.includes('threat')) {
    return `Will ${subject} act on this threat within 30 days?`;
  }
  if (lower.includes('launches') || lower.includes('launch') || lower.includes('releases') || lower.includes('drops')) {
    return `Will the ${subject} launch be commercially successful (positive reception)?`;
  }
  if (lower.includes('raises') || lower.includes('funding') || lower.includes('investment')) {
    return `Will ${subject} close this funding round within 60 days?`;
  }
  if (lower.includes('acquires') || lower.includes('acquisition') || lower.includes('merger') || lower.includes('buys')) {
    return `Will the ${subject} acquisition/deal close by Q2 2026?`;
  }
  if (lower.includes('files') || lower.includes('lawsuit') || lower.includes('sues') || lower.includes('legal')) {
    return `Will ${subject} win this legal challenge?`;
  }

  // Conflict / geopolitics
  if (lower.includes('war') || lower.includes('invasion') || lower.includes('strikes') || lower.includes('attack')) {
    return `Will the ${subject} conflict escalate further within 14 days?`;
  }
  if (lower.includes('ceasefire') || lower.includes('peace') || lower.includes('truce') || lower.includes('negotiate')) {
    return `Will ${subject} peace negotiations produce an agreement within 30 days?`;
  }
  if (lower.includes('sanction') || lower.includes('embargo') || lower.includes('ban')) {
    return `Will ${subject} sanctions be implemented within 30 days?`;
  }
  if (lower.includes('election') || lower.includes('vote') || lower.includes('poll')) {
    return `Will the leading candidate in ${subject} win the election?`;
  }
  if (lower.includes('tariff') || lower.includes('trade war') || lower.includes('duties')) {
    return `Will ${subject} tariffs take effect as announced?`;
  }

  // Tech / AI specific
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('claude') || lower.includes('anthropic') || lower.includes('gemini')) {
    return `Will ${subject} ship to general availability within 60 days?`;
  }
  if (lower.includes('hack') || lower.includes('breach') || lower.includes('vulnerability') || lower.includes('malicious')) {
    return `Will ${subject} affect more than 100,000 users?`;
  }
  if (lower.includes('ipo') || lower.includes('goes public') || lower.includes('listing')) {
    return `Will ${subject} IPO price above initial range?`;
  }

  // Crypto
  if (lower.includes('bitcoin') || lower.includes('btc')) {
    return `Will Bitcoin move >5% within 48 hours of ${subject}?`;
  }
  if (lower.includes('ethereum') || lower.includes('eth') || lower.includes('crypto') || lower.includes('defi')) {
    return `Will ${subject} cause crypto market cap to shift >3%?`;
  }
  if (lower.includes('liquidat') || lower.includes('whale')) {
    return `Will ${subject} trigger further cascading liquidations?`;
  }

  // Weather / climate
  if (lower.includes('hurricane') || lower.includes('tropical') || lower.includes('storm')) {
    return `Will ${subject} reach Category 3+ intensity?`;
  }
  if (lower.includes('earthquake') || lower.includes('tsunami')) {
    return `Will ${subject} cause >$1B in damage?`;
  }
  if (lower.includes('wildfire') || lower.includes('fire') || lower.includes('drought')) {
    return `Will ${subject} force evacuation of >10,000 people?`;
  }

  // Shipping / logistics
  if (lower.includes('port') || lower.includes('canal') || lower.includes('shipping') || lower.includes('freight')) {
    return `Will ${subject} cause shipping delays exceeding 72 hours?`;
  }
  if (lower.includes('supply chain') || lower.includes('shortage') || lower.includes('disruption')) {
    return `Will ${subject} impact consumer prices within 30 days?`;
  }

  // Sports / entertainment
  if (lower.includes('championship') || lower.includes('finals') || lower.includes('super bowl') || lower.includes('world cup')) {
    return `Will the favored team/player win ${subject}?`;
  }
  if (lower.includes('record') || lower.includes('milestone') || lower.includes('historic')) {
    return `Will ${subject} set a new record?`;
  }

  // Economy / markets
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('gdp')) {
    return `Will ${subject} cause S&P 500 to move >1% in a session?`;
  }
  if (lower.includes('layoff') || lower.includes('job cuts') || lower.includes('downsizing')) {
    return `Will ${subject} layoffs exceed initial reports?`;
  }
  if (lower.includes('profit') || lower.includes('revenue') || lower.includes('earnings')) {
    return `Will ${subject} beat analyst expectations?`;
  }

  // Generic but still specific to the headline
  if (subject.length > 10 && subject.length < 80) {
    const templates = [
      `Will "${subject}" resolve positively within 30 days?`,
      `Will ${subject} lead to major policy changes?`,
      `Will ${subject} still be in the news cycle in 7 days?`,
      `Will ${subject} have measurable economic impact (>0.1% GDP)?`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  return null; // Skip headlines we can't make a good question from
}

/**
 * Extract the core subject from a headline for use in questions.
 * Returns a clean, readable subject phrase.
 */
function extractSubject(title: string): string | null {
  // Remove common prefixes
  let clean = title
    .replace(/^(breaking:|update:|exclusive:|report:|watch:|opinion:|analysis:)\s*/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim();

  // If it's a quote-style headline ("X says Y"), extract the key part
  const saysMatch = clean.match(/^(.+?)\s+(says?|claims?|warns?|announces?|reveals?|declares?)\s+(.+)/i);
  if (saysMatch) {
    // Use the person/entity + what they said
    const who = saysMatch[1].trim();
    const what = saysMatch[3].trim().slice(0, 50);
    return `${who}: "${what}"`;
  }

  // If it's an action headline ("X does Y"), use first ~60 chars
  if (clean.length > 80) {
    // Try to cut at a natural break point
    const cutPoints = [' - ', ' — ', ' | ', ': ', ', '];
    for (const cut of cutPoints) {
      const idx = clean.indexOf(cut);
      if (idx > 15 && idx < 80) {
        clean = clean.slice(0, idx);
        break;
      }
    }
    if (clean.length > 80) clean = clean.slice(0, 75) + '...';
  }

  if (clean.length < 10) return null;
  return clean;
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
    'economics': 'ECON',
    'crypto': 'CRYPT',
    'sports': 'SPORT',
    'health': 'HLTH',
    'science': 'SCI',
  };

  const prefix = categoryPrefix[category] || 'GEN';
  const words = title.split(' ').filter(w => w.length > 3).slice(0, 2);
  const titlePart = words.map(w => w.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)).join('-');
  const datePart = new Date().toISOString().slice(5, 10).replace('-', '');
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();

  return `${prefix}-${titlePart}-${datePart}-${rand}`;
}
