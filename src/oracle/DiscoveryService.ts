/**
 * TRUTH-NET Discovery Service v1.0 (Production)
 * 
 * Real-time news discovery and market generation from live APIs:
 * - NewsAPI.org (primary)
 * - GNews API (backup)
 * - RSS Feeds (fallback)
 * 
 * Targets high-friction topics: Politics, Tech Drama, Logistics Crises
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';
import { Market, MarketStatus, HttpJsonResolutionSchema } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveredHeadline {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  category: TopicCategory;
  controversyScore: number;  // 0-1, how controversial/high-interest
  publishedAt: Date;
  discoveredAt: Date;
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export type TopicCategory = 
  | 'politics'
  | 'tech-drama'
  | 'ai-war'
  | 'logistics'
  | 'election-crisis'
  | 'crypto'
  | 'climate';

export interface TopicCluster {
  id: string;
  name: string;
  hashtag: string;
  keywords: string[];
  color: string;
}

// Topic clusters for grouping
export const TOPIC_CLUSTERS: TopicCluster[] = [
  { 
    id: 'ai-war', 
    name: 'AI War', 
    hashtag: '#AIWar',
    keywords: ['openai', 'anthropic', 'google ai', 'gpt', 'claude', 'gemini', 'llm', 'artificial intelligence', 'agi'],
    color: 'purple'
  },
  { 
    id: 'election-crisis', 
    name: 'Election Crisis', 
    hashtag: '#ElectionCrisis',
    keywords: ['election', 'vote', 'ballot', 'trump', 'biden', 'candidate', 'poll', 'campaign', 'recount'],
    color: 'red'
  },
  { 
    id: 'tech-drama', 
    name: 'Tech Drama', 
    hashtag: '#TechDrama',
    keywords: ['elon', 'musk', 'ceo', 'layoff', 'stock crash', 'ipo', 'acquisition', 'antitrust', 'lawsuit'],
    color: 'orange'
  },
  { 
    id: 'logistics', 
    name: 'Supply Chain', 
    hashtag: '#SupplyChain',
    keywords: ['port', 'shipping', 'container', 'strike', 'freight', 'canal', 'suez', 'panama', 'shortage'],
    color: 'blue'
  },
  { 
    id: 'crypto', 
    name: 'Crypto Chaos', 
    hashtag: '#CryptoChaos',
    keywords: ['bitcoin', 'ethereum', 'crypto', 'exchange', 'sec', 'binance', 'coinbase', 'defi', 'hack'],
    color: 'yellow'
  },
  { 
    id: 'climate', 
    name: 'Climate Crisis', 
    hashtag: '#ClimateCrisis',
    keywords: ['hurricane', 'flood', 'wildfire', 'drought', 'heat wave', 'tornado', 'climate', 'storm'],
    color: 'green'
  },
];

// ============================================================================
// NEWS API INTEGRATION
// ============================================================================

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: Array<{
    source: { id: string | null; name: string };
    author: string | null;
    title: string;
    description: string | null;
    url: string;
    publishedAt: string;
    content: string | null;
  }>;
}

async function fetchFromNewsAPI(
  apiKey: string,
  category: TopicCategory,
  cluster: TopicCluster
): Promise<DiscoveredHeadline[]> {
  if (!apiKey) return [];

  try {
    const query = cluster.keywords.slice(0, 5).join(' OR ');
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${apiKey}`;

    const response = await fetch(url);
    const data: NewsAPIResponse = await response.json();

    if (data.status !== 'ok' || !data.articles) {
      console.error('[Discovery] NewsAPI error:', data);
      return [];
    }

    return data.articles
      .filter(a => a.title && a.title !== '[Removed]')
      .map(article => ({
        id: uuidv4(),
        title: article.title,
        description: article.description || '',
        source: article.source.name,
        url: article.url,
        category,
        controversyScore: calculateControversyScore(article.title, article.description || ''),
        publishedAt: new Date(article.publishedAt),
        discoveredAt: new Date(),
        tags: extractTags(article.title, cluster),
        sentiment: analyzeSentiment(article.title),
      }));
  } catch (error) {
    console.error('[Discovery] NewsAPI fetch error:', error);
    return [];
  }
}

// ============================================================================
// GNEWS API INTEGRATION (Backup)
// ============================================================================

async function fetchFromGNews(
  apiKey: string,
  category: TopicCategory,
  cluster: TopicCluster
): Promise<DiscoveredHeadline[]> {
  if (!apiKey) return [];

  try {
    const query = cluster.keywords[0]; // GNews has stricter rate limits
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.articles) {
      console.error('[Discovery] GNews error:', data);
      return [];
    }

    return data.articles.map((article: any) => ({
      id: uuidv4(),
      title: article.title,
      description: article.description || '',
      source: article.source.name,
      url: article.url,
      category,
      controversyScore: calculateControversyScore(article.title, article.description || ''),
      publishedAt: new Date(article.publishedAt),
      discoveredAt: new Date(),
      tags: extractTags(article.title, cluster),
      sentiment: analyzeSentiment(article.title),
    }));
  } catch (error) {
    console.error('[Discovery] GNews fetch error:', error);
    return [];
  }
}

// ============================================================================
// CONTROVERSY SCORING
// ============================================================================

function calculateControversyScore(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0.5;

  // High controversy indicators
  const highControversy = [
    'breaking', 'urgent', 'crisis', 'scandal', 'controversy', 'outrage',
    'explosive', 'leaked', 'secret', 'bombshell', 'unprecedented',
    'crash', 'collapse', 'meltdown', 'chaos', 'panic'
  ];

  // Medium controversy indicators
  const mediumControversy = [
    'warns', 'threatens', 'accuses', 'denies', 'backlash', 'dispute',
    'concerns', 'questions', 'investigation', 'probe', 'lawsuit'
  ];

  // Controversy boosters (specific topics)
  const controversyBoosters = [
    'election', 'trump', 'biden', 'ai sentient', 'layoffs', 'bankruptcy',
    'hack', 'breach', 'fraud', 'sanctions', 'tariff', 'war'
  ];

  for (const word of highControversy) {
    if (text.includes(word)) score += 0.15;
  }
  for (const word of mediumControversy) {
    if (text.includes(word)) score += 0.08;
  }
  for (const word of controversyBoosters) {
    if (text.includes(word)) score += 0.1;
  }

  return Math.min(1, Math.max(0.3, score));
}

function analyzeSentiment(title: string): 'positive' | 'negative' | 'neutral' {
  const lower = title.toLowerCase();
  
  const negative = ['crash', 'crisis', 'fail', 'lose', 'drop', 'fall', 'decline', 'cut', 'layoff', 'scandal'];
  const positive = ['surge', 'soar', 'win', 'record', 'breakthrough', 'success', 'growth', 'rally'];

  const negCount = negative.filter(w => lower.includes(w)).length;
  const posCount = positive.filter(w => lower.includes(w)).length;

  if (negCount > posCount) return 'negative';
  if (posCount > negCount) return 'positive';
  return 'neutral';
}

function extractTags(title: string, cluster: TopicCluster): string[] {
  const tags = [cluster.hashtag];
  const lower = title.toLowerCase();

  // Add matching keywords as tags
  for (const keyword of cluster.keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      tags.push(`#${keyword.replace(/\s+/g, '')}`);
    }
  }

  return [...new Set(tags)].slice(0, 5);
}

// ============================================================================
// DISCOVERY SERVICE
// ============================================================================

export interface DiscoveryServiceConfig {
  newsApiKey?: string;
  gnewsApiKey?: string;
  discoveryIntervalMs: number;
  minHeadlinesPerCluster: number;
  controversyThreshold: number;
}

export class DiscoveryService {
  private config: DiscoveryServiceConfig;
  private eventBus: EventBus;
  private headlines: DiscoveredHeadline[] = [];
  private generatedMarkets: Market[] = [];
  private discoveryInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastDiscovery: Date | null = null;

  constructor(eventBus: EventBus, config?: Partial<DiscoveryServiceConfig>) {
    this.config = {
      newsApiKey: config?.newsApiKey || process.env.NEWS_API_KEY,
      gnewsApiKey: config?.gnewsApiKey || process.env.GNEWS_API_KEY,
      discoveryIntervalMs: config?.discoveryIntervalMs || 300000, // 5 min
      minHeadlinesPerCluster: config?.minHeadlinesPerCluster || 3,
      controversyThreshold: config?.controversyThreshold || 0.6,
    };
    this.eventBus = eventBus;
  }

  /**
   * Start discovery service
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Discovery] Starting production discovery service...');
    console.log(`[Discovery] NewsAPI: ${this.config.newsApiKey ? 'configured' : 'NOT CONFIGURED'}`);
    console.log(`[Discovery] GNews: ${this.config.gnewsApiKey ? 'configured' : 'NOT CONFIGURED'}`);

    // Initial discovery
    await this.discoverHeadlines();

    // Schedule periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.discoverHeadlines();
    }, this.config.discoveryIntervalMs);

    console.log('[Discovery] Service running.');
  }

  /**
   * Stop discovery
   */
  stop(): void {
    this.isRunning = false;
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    console.log('[Discovery] Stopped.');
  }

  /**
   * Discover headlines from all sources
   */
  async discoverHeadlines(): Promise<DiscoveredHeadline[]> {
    console.log('[Discovery] Discovering headlines across all clusters...');
    const newHeadlines: DiscoveredHeadline[] = [];

    // Fetch from each topic cluster
    for (const cluster of TOPIC_CLUSTERS) {
      const category = cluster.id as TopicCategory;

      // Try NewsAPI first
      if (this.config.newsApiKey) {
        const headlines = await fetchFromNewsAPI(
          this.config.newsApiKey,
          category,
          cluster
        );
        newHeadlines.push(...headlines);
      }

      // Fallback to GNews
      if (newHeadlines.filter(h => h.category === category).length < this.config.minHeadlinesPerCluster) {
        if (this.config.gnewsApiKey) {
          const headlines = await fetchFromGNews(
            this.config.gnewsApiKey,
            category,
            cluster
          );
          newHeadlines.push(...headlines);
        }
      }
    }

    // Deduplicate by title
    const uniqueHeadlines = this.deduplicateHeadlines(newHeadlines);

    // Filter by controversy threshold
    const controversialHeadlines = uniqueHeadlines.filter(
      h => h.controversyScore >= this.config.controversyThreshold
    );

    // Sort by controversy
    controversialHeadlines.sort((a, b) => b.controversyScore - a.controversyScore);

    // Add to headlines and generate markets
    for (const headline of controversialHeadlines) {
      if (!this.headlines.some(h => h.title === headline.title)) {
        this.headlines.unshift(headline);
        
        // Generate market
        const market = this.headlineToMarket(headline);
        if (market) {
          this.generatedMarkets.push(market);
          this.eventBus.publish('markets.discovered', { market, headline });
        }

        this.eventBus.publish('headlines.discovered', headline);
        console.log(`[Discovery] New: "${headline.title.slice(0, 50)}..." [${headline.category}] controversy=${headline.controversyScore.toFixed(2)}`);
      }
    }

    // Keep bounded
    this.headlines = this.headlines.slice(0, 100);
    this.generatedMarkets = this.generatedMarkets.slice(0, 50);
    this.lastDiscovery = new Date();

    console.log(`[Discovery] Found ${controversialHeadlines.length} controversial headlines. Total: ${this.headlines.length}`);

    return controversialHeadlines;
  }

  /**
   * Convert headline to tradeable market
   */
  private headlineToMarket(headline: DiscoveredHeadline): Market | null {
    const question = this.generateBetQuestion(headline);
    if (!question) return null;

    const now = new Date();
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000);

    const cluster = TOPIC_CLUSTERS.find(c => c.id === headline.category);
    const ticker = this.generateTicker(headline, cluster);

    const resolutionSchema: HttpJsonResolutionSchema = {
      type: 'http_json',
      source_url: `https://oracle.truthnet.io/v1/resolve/${headline.id}`,
      method: 'GET',
      json_path: '$.outcome',
      condition: { operator: 'eq', value: true },
    };

    return {
      id: uuidv4(),
      ticker,
      title: question,
      description: `**Source:** ${headline.source}\n**Original:** ${headline.title}\n\n${headline.description}\n\n**Topic:** ${cluster?.hashtag || headline.category}`,
      resolution_schema: resolutionSchema,
      opens_at: now,
      closes_at: closesAt,
      resolves_at: resolvesAt,
      status: MarketStatus.ACTIVE,
      min_order_size: 1,
      max_position: 10000,
      fee_rate: 0.002,
      volume_yes: 0,
      volume_no: 0,
      open_interest: 0,
      category: headline.category,
      tags: headline.tags,
      metadata: {
        headline_id: headline.id,
        source_url: headline.url,
        controversy_score: headline.controversyScore,
        sentiment: headline.sentiment,
        auto_generated: true,
        cluster: cluster?.id,
      },
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Generate bet question from headline
   */
  private generateBetQuestion(headline: DiscoveredHeadline): string {
    const title = headline.title.toLowerCase();

    // Pattern-based question generation
    if (title.includes('may') || title.includes('could') || title.includes('might')) {
      return headline.title.replace(/may|could|might/i, 'will') + '?';
    }

    if (title.includes('considering') || title.includes('plans to')) {
      return `Will this actually happen within 30 days?`;
    }

    if (headline.sentiment === 'negative') {
      return `Will the situation worsen within 7 days?`;
    }

    // Category-specific questions
    const categoryQuestions: Record<TopicCategory, string> = {
      'politics': 'Will this lead to policy change within 30 days?',
      'tech-drama': 'Will this impact stock price by >5% within 7 days?',
      'ai-war': 'Will there be an official response within 72 hours?',
      'logistics': 'Will disruption exceed 48 hours?',
      'election-crisis': 'Will this affect election outcome forecasts?',
      'crypto': 'Will price move >10% in response?',
      'climate': 'Will emergency declarations be issued?',
    };

    return categoryQuestions[headline.category] || 'Will this claim be verified?';
  }

  /**
   * Generate ticker
   */
  private generateTicker(headline: DiscoveredHeadline, cluster?: TopicCluster): string {
    const prefixes: Record<TopicCategory, string> = {
      'politics': 'POL',
      'tech-drama': 'TECH',
      'ai-war': 'AI',
      'logistics': 'LOG',
      'election-crisis': 'ELEC',
      'crypto': 'CRYPT',
      'climate': 'CLIM',
    };

    const prefix = prefixes[headline.category] || 'MKT';
    const date = new Date().toISOString().slice(5, 10).replace('-', '');
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();

    return `${prefix}-${date}-${rand}`;
  }

  /**
   * Deduplicate headlines
   */
  private deduplicateHeadlines(headlines: DiscoveredHeadline[]): DiscoveredHeadline[] {
    const seen = new Set<string>();
    const unique: DiscoveredHeadline[] = [];

    for (const h of headlines) {
      const key = h.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(h);
      }
    }

    return unique;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getHeadlines(limit: number = 20): DiscoveredHeadline[] {
    return this.headlines.slice(0, limit);
  }

  getByCluster(clusterId: string): DiscoveredHeadline[] {
    return this.headlines.filter(h => h.category === clusterId);
  }

  getControversial(threshold: number = 0.7): DiscoveredHeadline[] {
    return this.headlines.filter(h => h.controversyScore >= threshold);
  }

  getMarkets(limit: number = 20): Market[] {
    return this.generatedMarkets.slice(0, limit);
  }

  getClusters(): TopicCluster[] {
    return TOPIC_CLUSTERS;
  }

  getStats() {
    const byCluster: Record<string, number> = {};
    for (const cluster of TOPIC_CLUSTERS) {
      byCluster[cluster.id] = this.headlines.filter(h => h.category === cluster.id).length;
    }

    return {
      isRunning: this.isRunning,
      totalHeadlines: this.headlines.length,
      totalMarkets: this.generatedMarkets.length,
      lastDiscovery: this.lastDiscovery,
      byCluster,
      avgControversy: this.headlines.length > 0
        ? this.headlines.reduce((a, h) => a + h.controversyScore, 0) / this.headlines.length
        : 0,
      hasNewsApi: !!this.config.newsApiKey,
      hasGNews: !!this.config.gnewsApiKey,
    };
  }

  async refresh(): Promise<DiscoveredHeadline[]> {
    return this.discoverHeadlines();
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export function createDiscoveryRoutes(eventBus: EventBus) {
  const discovery = new DiscoveryService(eventBus);

  return async function discoveryRoutes(fastify: FastifyInstance): Promise<void> {
    // Start discovery
    fastify.post('/discovery/start', async (_req: FastifyRequest, reply: FastifyReply) => {
      await discovery.start();
      return reply.send({
        success: true,
        data: { message: 'Discovery service started', stats: discovery.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    // Stop discovery
    fastify.post('/discovery/stop', async (_req: FastifyRequest, reply: FastifyReply) => {
      discovery.stop();
      return reply.send({
        success: true,
        data: { message: 'Discovery service stopped' },
        timestamp: new Date().toISOString(),
      });
    });

    // Get headlines
    fastify.get('/discovery/headlines', async (
      request: FastifyRequest<{ Querystring: { limit?: string; cluster?: string; controversial?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit ?? '20');
      const cluster = request.query.cluster;
      const controversial = request.query.controversial === 'true';

      let headlines = cluster 
        ? discovery.getByCluster(cluster)
        : controversial
          ? discovery.getControversial()
          : discovery.getHeadlines(limit);

      return reply.send({
        success: true,
        data: { headlines, total: headlines.length },
        timestamp: new Date().toISOString(),
      });
    });

    // Get markets
    fastify.get('/discovery/markets', async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit ?? '20');
      const markets = discovery.getMarkets(limit);

      return reply.send({
        success: true,
        data: { markets, total: markets.length },
        timestamp: new Date().toISOString(),
      });
    });

    // Get topic clusters
    fastify.get('/discovery/clusters', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: { clusters: discovery.getClusters() },
        timestamp: new Date().toISOString(),
      });
    });

    // Get stats
    fastify.get('/discovery/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: discovery.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    // Refresh
    fastify.post('/discovery/refresh', async (_req: FastifyRequest, reply: FastifyReply) => {
      const headlines = await discovery.refresh();
      return reply.send({
        success: true,
        data: { discovered: headlines.length, headlines },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
