/**
 * TRUTH-NET News Aggregator v2.0
 * 
 * Continuous stream of high-impact headlines across categories:
 * - Logistics
 * - Tech-Earnings
 * - Weather  
 * - Geopolitics
 * - Niche-Internet-Trends
 * 
 * Converts headlines to tradable Binary Contracts via LLM.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventBus } from '../events/EventBus.js';
import { Market, MarketStatus, HttpJsonResolutionSchema } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface Headline {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: HeadlineCategory;
  impact_score: number; // 0-1, where 1 = highest impact
  url: string;
  published_at: Date;
  tags: string[];
}

export type HeadlineCategory = 
  | 'logistics'
  | 'tech-earnings'
  | 'weather'
  | 'geopolitics'
  | 'niche-internet';

export interface BinaryContract {
  ticker: string;
  title: string;
  question: string;
  resolution_criteria: string;
  oracle_api: string;
  json_path: string;
  condition: { operator: string; value: unknown };
  category: HeadlineCategory;
  confidence: number;
  reasoning: string;
  expires_in_days: number;
}

export interface NewsAggregatorConfig {
  headlinesPerDay: number;
  streamIntervalMs: number;
  minImpactScore: number;
  autoCreateMarkets: boolean;
}

const DEFAULT_CONFIG: NewsAggregatorConfig = {
  headlinesPerDay: 15,
  streamIntervalMs: 10000, // New headline every 10s in demo mode
  minImpactScore: 0.7,
  autoCreateMarkets: true,
};

// ============================================================================
// HEADLINE DATABASE (Simulated Feed)
// ============================================================================

const HEADLINE_TEMPLATES: Record<HeadlineCategory, Array<{
  title: string;
  summary: string;
  source: string;
  impact: number;
  oracle_api: string;
  json_path: string;
  condition: { operator: string; value: unknown };
  tags: string[];
}>> = {
  logistics: [
    {
      title: 'Panama Canal reduces daily transits to 24 due to drought',
      summary: 'Severe drought conditions force Panama Canal Authority to limit vessel transits, creating major shipping bottleneck.',
      source: 'Panama Canal Authority',
      impact: 0.95,
      oracle_api: 'https://api.pcanal.example.com/transit-count',
      json_path: '$.daily_transits',
      condition: { operator: 'lte', value: 24 },
      tags: ['shipping', 'supply-chain', 'drought'],
    },
    {
      title: 'Port of Rotterdam workers announce 72-hour strike',
      summary: "Europe's largest port faces major disruption as dockworkers vote for work stoppage over wage dispute.",
      source: 'Reuters Shipping',
      impact: 0.88,
      oracle_api: 'https://api.portofrotterdam.example.com/status',
      json_path: '$.operational',
      condition: { operator: 'eq', value: false },
      tags: ['strike', 'europe', 'containers'],
    },
    {
      title: 'Suez Canal reports 48-hour vessel backlog',
      summary: 'Equipment malfunction causes significant delays for container ships transiting the Suez Canal.',
      source: 'Suez Canal Authority',
      impact: 0.92,
      oracle_api: 'https://api.suezcanal.example.com/queue',
      json_path: '$.backlog_hours',
      condition: { operator: 'gte', value: 48 },
      tags: ['suez', 'bottleneck', 'delays'],
    },
    {
      title: 'LA Port congestion reaches 30+ vessels waiting',
      summary: 'West Coast port congestion worsens as container ships anchor offshore waiting for berth space.',
      source: 'Port of Los Angeles',
      impact: 0.85,
      oracle_api: 'https://api.portofla.example.com/queue',
      json_path: '$.vessels_waiting',
      condition: { operator: 'gte', value: 30 },
      tags: ['west-coast', 'congestion', 'containers'],
    },
  ],

  'tech-earnings': [
    {
      title: 'NVIDIA Q4 earnings expected to beat $20B revenue estimate',
      summary: 'AI chip demand continues to surge as analysts predict record-breaking quarter for NVIDIA.',
      source: 'Bloomberg Tech',
      impact: 0.90,
      oracle_api: 'https://api.financials.example.com/earnings/NVDA',
      json_path: '$.revenue_billions',
      condition: { operator: 'gt', value: 20 },
      tags: ['nvidia', 'ai-chips', 'earnings'],
    },
    {
      title: 'Tesla Cybertruck production ramps to 2,000 units/week',
      summary: 'Tesla confirms Cybertruck production milestone as factory efficiency improves.',
      source: 'Electrek',
      impact: 0.78,
      oracle_api: 'https://api.tesla.example.com/production',
      json_path: '$.cybertruck_weekly',
      condition: { operator: 'gte', value: 2000 },
      tags: ['tesla', 'ev', 'production'],
    },
    {
      title: 'OpenAI valued at $100B+ in new funding round',
      summary: 'ChatGPT maker closes largest private AI funding round in history.',
      source: 'TechCrunch',
      impact: 0.88,
      oracle_api: 'https://api.crunchbase.example.com/companies/openai',
      json_path: '$.valuation_billions',
      condition: { operator: 'gte', value: 100 },
      tags: ['openai', 'funding', 'ai'],
    },
  ],

  weather: [
    {
      title: 'Category 4 hurricane threatens Gulf Coast refineries',
      summary: 'Hurricane projected to make landfall near Houston, threatening major oil refinery operations.',
      source: 'NOAA National Hurricane Center',
      impact: 0.95,
      oracle_api: 'https://api.weather.gov/alerts/active',
      json_path: '$.features[0].properties.severity',
      condition: { operator: 'eq', value: 'Extreme' },
      tags: ['hurricane', 'oil', 'gulf'],
    },
    {
      title: 'European heat wave breaks 40°C in 5 countries',
      summary: 'Unprecedented summer heat wave causes power grid strain across Western Europe.',
      source: 'European Climate Service',
      impact: 0.82,
      oracle_api: 'https://api.ecmwf.example.com/temps',
      json_path: '$.max_temp_celsius',
      condition: { operator: 'gte', value: 40 },
      tags: ['heat-wave', 'europe', 'power-grid'],
    },
    {
      title: 'Arctic shipping route opens 3 weeks early',
      summary: 'Northern Sea Route becomes navigable earlier than expected due to ice melt.',
      source: 'Arctic Council',
      impact: 0.75,
      oracle_api: 'https://api.arctic.example.com/routes',
      json_path: '$.nsr_open',
      condition: { operator: 'eq', value: true },
      tags: ['arctic', 'shipping', 'climate'],
    },
  ],

  geopolitics: [
    {
      title: 'Taiwan Strait transit halted by military exercises',
      summary: 'Commercial shipping diverted as military activities close key strait to civilian vessels.',
      source: 'South China Morning Post',
      impact: 0.98,
      oracle_api: 'https://api.maritimetraffic.example.com/strait',
      json_path: '$.taiwan_strait_open',
      condition: { operator: 'eq', value: false },
      tags: ['taiwan', 'military', 'trade-war'],
    },
    {
      title: 'EU imposes emergency tariffs on Chinese EVs',
      summary: 'European Commission announces 25% import duties on Chinese electric vehicles.',
      source: 'Financial Times',
      impact: 0.88,
      oracle_api: 'https://api.ec.example.com/tariffs',
      json_path: '$.china_ev_tariff_percent',
      condition: { operator: 'gte', value: 25 },
      tags: ['tariffs', 'ev', 'china-eu'],
    },
    {
      title: 'Red Sea shipping insurance costs surge 300%',
      summary: 'Maritime insurers dramatically raise premiums for Red Sea transits amid regional tensions.',
      source: "Lloyd's of London",
      impact: 0.90,
      oracle_api: 'https://api.lloyds.example.com/rates',
      json_path: '$.red_sea_premium_multiplier',
      condition: { operator: 'gte', value: 3 },
      tags: ['red-sea', 'insurance', 'houthi'],
    },
  ],

  'niche-internet': [
    {
      title: 'rust-lang/rust repository hits 100K GitHub stars',
      summary: 'The Rust programming language reaches major milestone on GitHub.',
      source: 'GitHub Trending',
      impact: 0.72,
      oracle_api: 'https://api.github.com/repos/rust-lang/rust',
      json_path: '$.stargazers_count',
      condition: { operator: 'gte', value: 100000 },
      tags: ['rust', 'github', 'programming'],
    },
    {
      title: 'New AI model beats GPT-4 on HumanEval benchmark',
      summary: 'Unknown startup releases model scoring 95% on code generation benchmark.',
      source: 'Papers With Code',
      impact: 0.85,
      oracle_api: 'https://api.paperswithcode.example.com/humaneval',
      json_path: '$.top_score',
      condition: { operator: 'gt', value: 0.95 },
      tags: ['ai', 'benchmark', 'llm'],
    },
    {
      title: 'Viral TikTok causes run on specific Stanley cup color',
      summary: 'Limited edition Stanley cup sells out in minutes after viral TikTok video.',
      source: 'Social Media Tracker',
      impact: 0.65,
      oracle_api: 'https://api.stanley.example.com/inventory',
      json_path: '$.quencher_pink_stock',
      condition: { operator: 'eq', value: 0 },
      tags: ['tiktok', 'viral', 'consumer'],
    },
    {
      title: 'Elon Musk Twitter poll moves Dogecoin 15%',
      summary: 'Cryptocurrency surges after Musk polls followers about Doge integration.',
      source: 'CoinGecko',
      impact: 0.78,
      oracle_api: 'https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd',
      json_path: '$.dogecoin.usd_24h_change',
      condition: { operator: 'gte', value: 15 },
      tags: ['crypto', 'musk', 'meme'],
    },
  ],
};

// ============================================================================
// NEWS AGGREGATOR
// ============================================================================

export class NewsAggregator {
  private config: NewsAggregatorConfig;
  private eventBus: EventBus;
  private headlines: Headline[] = [];
  private generatedMarkets: Market[] = [];
  private streamInterval: NodeJS.Timeout | null = null;
  private headlineIndex = 0;
  private isRunning = false;

  // Callbacks
  public onHeadline?: (headline: Headline) => void;
  public onMarketGenerated?: (market: Market, headline: Headline) => void;

  constructor(eventBus: EventBus, config: Partial<NewsAggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = eventBus;
    this.initializeHeadlines();
  }

  /**
   * Initialize with 15 starter headlines
   */
  private initializeHeadlines(): void {
    const categories: HeadlineCategory[] = [
      'logistics', 'tech-earnings', 'weather', 'geopolitics', 'niche-internet'
    ];

    // Pick 3 from each category
    for (const category of categories) {
      const templates = HEADLINE_TEMPLATES[category];
      const shuffled = [...templates].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 3);

      for (const template of selected) {
        this.headlines.push({
          id: uuidv4(),
          title: template.title,
          summary: template.summary,
          source: template.source,
          category,
          impact_score: template.impact,
          url: `https://news.example.com/${uuidv4()}`,
          published_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          tags: template.tags,
        });
      }
    }

    // Sort by publish time
    this.headlines.sort((a, b) => b.published_at.getTime() - a.published_at.getTime());
  }

  /**
   * Get initial headlines
   */
  getHeadlines(limit: number = 15): Headline[] {
    return this.headlines.slice(0, limit);
  }

  /**
   * Get headlines by category
   */
  getHeadlinesByCategory(category: HeadlineCategory): Headline[] {
    return this.headlines.filter(h => h.category === category);
  }

  /**
   * Start streaming headlines
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[NewsAggregator] Starting headline stream...');

    this.streamInterval = setInterval(() => {
      this.emitNextHeadline();
    }, this.config.streamIntervalMs);
  }

  /**
   * Stop streaming
   */
  stop(): void {
    this.isRunning = false;
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    console.log('[NewsAggregator] Stopped.');
  }

  /**
   * Emit next headline from rotation
   */
  private emitNextHeadline(): void {
    // Get all templates
    const allTemplates: Array<{ category: HeadlineCategory; template: typeof HEADLINE_TEMPLATES['logistics'][0] }> = [];
    for (const [category, templates] of Object.entries(HEADLINE_TEMPLATES)) {
      for (const template of templates) {
        allTemplates.push({ category: category as HeadlineCategory, template });
      }
    }

    // Pick random headline
    const { category, template } = allTemplates[this.headlineIndex % allTemplates.length];
    this.headlineIndex++;

    const headline: Headline = {
      id: uuidv4(),
      title: template.title,
      summary: template.summary,
      source: template.source,
      category,
      impact_score: template.impact + (Math.random() - 0.5) * 0.1,
      url: `https://news.example.com/${uuidv4()}`,
      published_at: new Date(),
      tags: template.tags,
    };

    // Add to list
    this.headlines.unshift(headline);
    if (this.headlines.length > 100) {
      this.headlines.pop();
    }

    // Emit via event bus
    this.eventBus.publish('headlines.new', headline);
    this.onHeadline?.(headline);

    console.log(`[NewsAggregator] New headline: "${headline.title}" [${headline.category}]`);

    // Auto-generate market if high impact
    if (this.config.autoCreateMarkets && headline.impact_score >= this.config.minImpactScore) {
      const market = this.generateMarketFromHeadline(headline, template);
      if (market) {
        this.generatedMarkets.push(market);
        this.eventBus.publish('markets.auto_created', { market, headline });
        this.onMarketGenerated?.(market, headline);
      }
    }
  }

  /**
   * Generate market from headline
   */
  private generateMarketFromHeadline(
    headline: Headline,
    template: typeof HEADLINE_TEMPLATES['logistics'][0]
  ): Market | null {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000);

    const ticker = this.generateTicker(headline);

    const resolutionSchema: HttpJsonResolutionSchema = {
      type: 'http_json',
      source_url: template.oracle_api,
      method: 'GET',
      json_path: template.json_path,
      condition: template.condition as any,
    };

    const market: Market = {
      id: uuidv4(),
      ticker,
      title: headline.title,
      description: `${headline.summary}\n\nSource: ${headline.source}`,
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
        impact_score: headline.impact_score,
        auto_generated: true,
      },
      created_at: now,
      updated_at: now,
    };

    return market;
  }

  /**
   * Generate ticker from headline
   */
  private generateTicker(headline: Headline): string {
    const categoryMap: Record<HeadlineCategory, string> = {
      logistics: 'LOG',
      'tech-earnings': 'TECH',
      weather: 'WX',
      geopolitics: 'GEO',
      'niche-internet': 'NET',
    };

    const prefix = categoryMap[headline.category] || 'GEN';
    const words = headline.title.split(' ').filter(w => w.length > 3).slice(0, 2);
    const titlePart = words.map(w => w.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)).join('-');
    const datePart = new Date().toISOString().slice(5, 10).replace('-', '');

    return `${prefix}-${titlePart}-${datePart}`;
  }

  /**
   * Get generated markets
   */
  getGeneratedMarkets(): Market[] {
    return this.generatedMarkets;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      totalHeadlines: this.headlines.length,
      generatedMarkets: this.generatedMarkets.length,
      byCategory: {
        logistics: this.headlines.filter(h => h.category === 'logistics').length,
        'tech-earnings': this.headlines.filter(h => h.category === 'tech-earnings').length,
        weather: this.headlines.filter(h => h.category === 'weather').length,
        geopolitics: this.headlines.filter(h => h.category === 'geopolitics').length,
        'niche-internet': this.headlines.filter(h => h.category === 'niche-internet').length,
      },
    };
  }
}

// ============================================================================
// PANAMA CANAL DEMO SCENARIO
// ============================================================================

export function createPanamaCanalScenario(eventBus: EventBus): {
  headlines: Headline[];
  markets: Market[];
} {
  const now = new Date();
  
  const headlines: Headline[] = [
    {
      id: uuidv4(),
      title: 'Panama Canal reduces daily transits to 24 due to drought',
      summary: 'Severe drought conditions force Panama Canal Authority to limit vessel transits.',
      source: 'Panama Canal Authority',
      category: 'logistics',
      impact_score: 0.95,
      url: 'https://pancanal.com/alerts/drought-2026',
      published_at: now,
      tags: ['panama', 'drought', 'shipping'],
    },
    {
      id: uuidv4(),
      title: 'Maersk diverts 15 vessels to Suez amid Panama delays',
      summary: 'Major shipping line reroutes fleet as Panama transit times extend to 21 days.',
      source: 'Maersk Line',
      category: 'logistics',
      impact_score: 0.88,
      url: 'https://maersk.com/news/panama-diversion',
      published_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      tags: ['maersk', 'reroute', 'suez'],
    },
    {
      id: uuidv4(),
      title: 'Panama Canal toll prices surge 200% in emergency auction',
      summary: 'Shipping companies bid record $4M for guaranteed transit slots.',
      source: 'FreightWaves',
      category: 'logistics',
      impact_score: 0.92,
      url: 'https://freightwaves.com/panama-auction',
      published_at: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      tags: ['tolls', 'auction', 'costs'],
    },
  ];

  const markets: Market[] = headlines.map(h => {
    const closesAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return {
      id: uuidv4(),
      ticker: `PAN-${h.tags[0].toUpperCase()}-${now.toISOString().slice(5, 10).replace('-', '')}`,
      title: h.title,
      description: h.summary,
      resolution_schema: {
        type: 'http_json',
        source_url: 'https://api.pcanal.example.com/status',
        method: 'GET',
        json_path: '$.daily_transits',
        condition: { operator: 'lte', value: 24 },
      } as HttpJsonResolutionSchema,
      opens_at: now,
      closes_at: closesAt,
      resolves_at: new Date(closesAt.getTime() + 60 * 60 * 1000),
      status: MarketStatus.ACTIVE,
      min_order_size: 10,
      max_position: 50000,
      fee_rate: 0.001,
      volume_yes: Math.floor(Math.random() * 100000),
      volume_no: Math.floor(Math.random() * 50000),
      open_interest: Math.floor(Math.random() * 75000),
      category: 'logistics',
      tags: h.tags,
      metadata: { headline_id: h.id, scenario: 'panama-canal-bottleneck' },
      created_at: now,
      updated_at: now,
    };
  });

  return { headlines, markets };
}
