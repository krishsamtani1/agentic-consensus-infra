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
 * Generate a SPECIFIC, BINARY market question from a headline.
 * Uses varied question formats - NOT just "Will...?" for everything.
 * Questions should be clear, time-bounded, and resolvable.
 */
function generateQuestion(title: string, category: string): string | null {
  const clean = title
    .replace(/&#\d+;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  // Quality filter
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
  if (/\/r\/\w+\s+live thread/i.test(clean)) return null;
  if (/my elderly|my sister|my mother|my father/i.test(clean)) return null;

  const subject = extractSubject(clean);
  if (!subject) return null;
  const lower = clean.toLowerCase();

  // Use a random selector to vary format even within the same category
  const r = Math.random();

  // ── Announcements / Plans ──
  if (lower.includes('announces') || lower.includes('announced')) {
    const opts = [
      `${subject}: Follow-through within 30 days?`,
      `Announcement by ${subject} — implemented by end of quarter?`,
      `Does ${subject} deliver on this within 30 days?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('plans') || lower.includes('planning') || lower.includes('preparing')) {
    const opts = [
      `${subject} — executed within 60 days?`,
      `Plans confirmed: ${subject} delivers by Q2 2026?`,
      `${subject}: Blueprint becomes reality within 2 months?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Launches / Releases ──
  if (lower.includes('launches') || lower.includes('launch') || lower.includes('releases') || lower.includes('drops')) {
    const opts = [
      `${subject}: Positive market reception?`,
      `Launch alert — ${subject} gains traction within 30 days?`,
      `${subject}: Commercial success or flop?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Legal / Regulatory ──
  if (lower.includes('files') || lower.includes('lawsuit') || lower.includes('sues') || lower.includes('legal')) {
    const opts = [
      `${subject}: Legal victory within 6 months?`,
      `Courtroom clash — ${subject} prevails?`,
      `Legal challenge: ${subject} wins the case?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── M&A / Funding ──
  if (lower.includes('acquires') || lower.includes('acquisition') || lower.includes('merger') || lower.includes('buys')) {
    const opts = [
      `${subject}: Deal closes by Q2 2026?`,
      `Acquisition target — ${subject} finalized?`,
      `M&A: ${subject} completed without regulatory block?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('raises') || lower.includes('funding') || lower.includes('investment')) {
    const opts = [
      `${subject}: Funding round closes within 60 days?`,
      `Capital raise — ${subject} hits target?`,
      `Investment: ${subject} secures the round?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Conflict / Geopolitics ──
  if (lower.includes('war') || lower.includes('invasion') || lower.includes('strikes') || lower.includes('attack')) {
    const opts = [
      `Escalation: ${subject} intensifies within 14 days?`,
      `${subject} — further military action within 2 weeks?`,
      `Conflict zone: ${subject} escalates before month-end?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('ceasefire') || lower.includes('peace') || lower.includes('truce') || lower.includes('negotiate')) {
    const opts = [
      `Peace deal: ${subject} agreement within 30 days?`,
      `${subject} — ceasefire holds for 14+ days?`,
      `Diplomacy: ${subject} produces lasting agreement?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('sanction') || lower.includes('embargo') || lower.includes('ban')) {
    const opts = [
      `Sanctions: ${subject} enforced within 30 days?`,
      `${subject} — ban implemented as announced?`,
      `Regulatory: ${subject} takes effect?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('election') || lower.includes('vote') || lower.includes('poll')) {
    const opts = [
      `${subject}: Frontrunner wins?`,
      `Election outcome — ${subject} favors incumbent?`,
      `Vote result: ${subject} goes as predicted by polls?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('tariff') || lower.includes('trade war') || lower.includes('duties')) {
    const opts = [
      `Trade: ${subject} tariffs take effect as stated?`,
      `${subject} — duties implemented without rollback?`,
      `Tariff alert: ${subject} enacted by deadline?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('threatens') || lower.includes('threat') || lower.includes('warns')) {
    const opts = [
      `${subject}: Threat becomes action within 30 days?`,
      `Warning: ${subject} follows through?`,
      `${subject} — escalation from rhetoric to action?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Tech / AI ──
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('claude') || lower.includes('anthropic') || lower.includes('gemini') || lower.includes(' ai ')) {
    const opts = [
      `${subject}: Ships to GA within 60 days?`,
      `AI: ${subject} reaches general availability?`,
      `Tech milestone — ${subject} delivered on schedule?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('hack') || lower.includes('breach') || lower.includes('vulnerability')) {
    const opts = [
      `Breach: ${subject} affects >100K users?`,
      `${subject} — damages exceed $10M?`,
      `Security: ${subject} triggers regulatory response?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('ipo') || lower.includes('goes public') || lower.includes('listing')) {
    const opts = [
      `IPO: ${subject} prices above range?`,
      `${subject}: First-day pop exceeds 20%?`,
      `Public debut — ${subject} valued above $10B?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Crypto ──
  if (lower.includes('bitcoin') || lower.includes('btc')) {
    const opts = [
      `BTC: >5% price move within 48h of ${subject}?`,
      `Bitcoin reacts — ${subject} moves price >5%?`,
      `${subject}: BTC breaks key support/resistance?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('ethereum') || lower.includes('crypto') || lower.includes('defi')) {
    const opts = [
      `Crypto: ${subject} shifts market cap >3%?`,
      `${subject} — net crypto market impact >$50B?`,
      `DeFi: ${subject} causes >5% TVL change?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Weather / Climate ──
  if (lower.includes('hurricane') || lower.includes('tropical') || lower.includes('storm')) {
    const opts = [
      `Storm: ${subject} reaches Cat 3+ intensity?`,
      `${subject}: >$1B in insured damages?`,
      `Hurricane: ${subject} makes landfall as major storm?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('earthquake') || lower.includes('tsunami') || lower.includes('wildfire') || lower.includes('drought')) {
    const opts = [
      `Disaster: ${subject} causes >$1B damage?`,
      `${subject}: State of emergency declared?`,
      `Natural event — ${subject} triggers federal response?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Logistics / Supply Chain ──
  if (lower.includes('port') || lower.includes('canal') || lower.includes('shipping') || lower.includes('freight')) {
    const opts = [
      `Shipping: ${subject} causes >72h delays?`,
      `${subject}: Supply chain disruption measurable within 7 days?`,
      `Logistics: ${subject} impacts freight rates >10%?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('supply chain') || lower.includes('shortage') || lower.includes('disruption')) {
    const opts = [
      `Disruption: ${subject} hits consumer prices within 30 days?`,
      `${subject}: Cascading supply chain impact?`,
      `Supply alert — ${subject} causes visible shortage?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Sports ──
  if (lower.includes('championship') || lower.includes('finals') || lower.includes('super bowl') || lower.includes('world cup')) {
    const opts = [
      `${subject}: Favorite wins?`,
      `Championship — ${subject} goes to the top seed?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Economy / Earnings ──
  if (lower.includes('fed') || lower.includes('rate cut') || lower.includes('inflation') || lower.includes('gdp')) {
    const opts = [
      `Markets: ${subject} moves S&P 500 >1%?`,
      `${subject}: Rate decision matches consensus?`,
      `Macro: ${subject} shifts bond yields >10bps?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('layoff') || lower.includes('job cuts') || lower.includes('downsizing') || lower.includes('shutter')) {
    const opts = [
      `${subject}: Layoffs exceed initial reports?`,
      `Job cuts — ${subject} >1,000 roles affected?`,
      `Restructuring: ${subject} completed within 90 days?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('earnings') || lower.includes('revenue') || lower.includes('profit') || lower.includes('stock')) {
    const opts = [
      `${subject}: Beats analyst estimates?`,
      `Earnings: ${subject} surprises to the upside?`,
      `${subject} — stock moves >5% post-report?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }
  if (lower.includes('record') || lower.includes('milestone') || lower.includes('historic') || lower.includes('first')) {
    const opts = [
      `${subject}: Record confirmed within 7 days?`,
      `Historic: ${subject} stands after verification?`,
      `Milestone — ${subject} holds up?`,
    ];
    return opts[Math.floor(r * opts.length)];
  }

  // ── Fallback: varied formats ──
  if (subject.length > 10 && subject.length < 80) {
    const templates = [
      `${subject}: Resolved positively within 30 days?`,
      `${subject} — measurable impact within 2 weeks?`,
      `Developing: ${subject} still in headlines in 7 days?`,
      `${subject}: Policy change follows within 60 days?`,
      `Impact: ${subject} moves markets >0.5%?`,
      `${subject} — confirmed by independent sources within 48h?`,
    ];
    return templates[Math.floor(r * templates.length)];
  }

  return null;
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
