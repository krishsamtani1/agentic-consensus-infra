/**
 * TRUTH-NET Headline Factory (Sourcing Agent)
 * 
 * Autonomous event sourcing using LLM to:
 * 1. Fetch headlines from news APIs/RSS feeds
 * 2. Generate binary market schemas from headlines
 * 3. Auto-create markets when resolvability confidence > 0.85
 * 
 * Targets "super random" headlines:
 * - Specific repo stars milestones
 * - Obscure weather events
 * - Niche logistics delays
 * - API uptime events
 */

import { v4 as uuidv4 } from 'uuid';
import { EventBus } from '../events/EventBus.js';
import { Market, MarketStatus, HttpJsonResolutionSchema } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface Headline {
  id: string;
  source: string;
  title: string;
  summary: string;
  category: string;
  url: string;
  timestamp: Date;
}

export interface MarketSchema {
  title: string;
  question: string;
  resolution_criteria: string;
  oracle_api_link: string;
  json_path: string;
  condition: {
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
    value: string | number | boolean;
  };
  category: string;
  resolvability_score: number;
  reasoning: string;
}

export interface LLMResponse {
  schema: MarketSchema | null;
  confidence: number;
  reasoning: string;
}

export interface SourcingAgentConfig {
  llmProvider: 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  model?: string;
  minResolvabilityScore: number;
  pollIntervalMs: number;
  maxMarketsPerHour: number;
}

const DEFAULT_CONFIG: SourcingAgentConfig = {
  llmProvider: 'mock',
  minResolvabilityScore: 0.85,
  pollIntervalMs: 60000,
  maxMarketsPerHour: 10,
};

// ============================================================================
// MOCK HEADLINE SOURCES
// ============================================================================

const MOCK_HEADLINES: Headline[] = [
  {
    id: 'h1',
    source: 'GitHub Trending',
    title: 'rust-lang/rust reaches 100K stars',
    summary: 'The Rust programming language repository is approaching a major milestone on GitHub.',
    category: 'tech',
    url: 'https://github.com/rust-lang/rust',
    timestamp: new Date(),
  },
  {
    id: 'h2',
    source: 'NOAA Weather',
    title: 'Tropical Storm forming in Gulf of Mexico',
    summary: 'Meteorologists tracking potential Category 2 hurricane development within 72 hours.',
    category: 'weather',
    url: 'https://www.nhc.noaa.gov/',
    timestamp: new Date(),
  },
  {
    id: 'h3',
    source: 'FreightWaves',
    title: 'Suez Canal reports 48-hour delay backlog',
    summary: 'Container ships experiencing significant delays due to equipment malfunction.',
    category: 'logistics',
    url: 'https://www.freightwaves.com/',
    timestamp: new Date(),
  },
  {
    id: 'h4',
    source: 'AWS Status',
    title: 'us-east-1 experiencing elevated error rates',
    summary: 'Amazon Web Services investigating increased API errors in primary US region.',
    category: 'cloud',
    url: 'https://status.aws.amazon.com/',
    timestamp: new Date(),
  },
  {
    id: 'h5',
    source: 'CoinDesk',
    title: 'Bitcoin volatility index hits 3-month high',
    summary: 'Crypto markets showing increased uncertainty ahead of regulatory announcements.',
    category: 'crypto',
    url: 'https://www.coindesk.com/',
    timestamp: new Date(),
  },
  {
    id: 'h6',
    source: 'Port Authority',
    title: 'Los Angeles port labor negotiations stall',
    summary: 'Dockworkers union and terminal operators fail to reach agreement, strike possible.',
    category: 'logistics',
    url: 'https://www.portoflosangeles.org/',
    timestamp: new Date(),
  },
  {
    id: 'h7',
    source: 'NPM Registry',
    title: 'Popular package lodash publishes breaking change',
    summary: 'Version 5.0 removes legacy APIs, affecting thousands of projects.',
    category: 'tech',
    url: 'https://www.npmjs.com/package/lodash',
    timestamp: new Date(),
  },
  {
    id: 'h8',
    source: 'SpaceX Updates',
    title: 'Starship test flight scheduled for next week',
    summary: 'Fourth integrated flight test targeting Wednesday launch window.',
    category: 'aerospace',
    url: 'https://www.spacex.com/',
    timestamp: new Date(),
  },
];

// ============================================================================
// LLM MARKET GENERATOR
// ============================================================================

/**
 * Mock LLM that generates market schemas from headlines
 * In production, this would call Claude/GPT-4o
 */
async function generateMarketSchemaWithLLM(
  headline: Headline,
  config: SourcingAgentConfig
): Promise<LLMResponse> {
  // Simulate LLM thinking time
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  // Mock LLM responses based on headline category
  const templates: Record<string, () => MarketSchema> = {
    tech: () => ({
      title: headline.title,
      question: `Will ${extractSubject(headline.title)} happen by end of week?`,
      resolution_criteria: 'Check GitHub API for current star count',
      oracle_api_link: 'https://api.github.com/repos/rust-lang/rust',
      json_path: '$.stargazers_count',
      condition: { operator: 'gte', value: 100000 },
      category: 'tech',
      resolvability_score: 0.92,
      reasoning: 'GitHub API provides reliable, real-time star counts. Easy to verify programmatically.',
    }),

    weather: () => ({
      title: headline.title,
      question: 'Will a Category 2+ hurricane make landfall in the Gulf within 7 days?',
      resolution_criteria: 'Check NOAA hurricane data for landfall events',
      oracle_api_link: 'https://api.weather.gov/alerts/active',
      json_path: '$.features[0].properties.severity',
      condition: { operator: 'eq', value: 'Extreme' },
      category: 'weather',
      resolvability_score: 0.88,
      reasoning: 'NOAA provides official hurricane tracking. Landfall is a binary, verifiable event.',
    }),

    logistics: () => ({
      title: headline.title,
      question: 'Will major port experience >24hr operational stoppage this week?',
      resolution_criteria: 'Check port authority API for operational status',
      oracle_api_link: 'https://api.portauthority.example.com/status',
      json_path: '$.operational_status',
      condition: { operator: 'eq', value: 'CLOSED' },
      category: 'logistics',
      resolvability_score: 0.86,
      reasoning: 'Port status is publicly reported. Closure events are clearly defined.',
    }),

    cloud: () => ({
      title: headline.title,
      question: 'Will AWS us-east-1 experience >1hr outage in next 48 hours?',
      resolution_criteria: 'Check AWS status page for incident duration',
      oracle_api_link: 'https://status.aws.amazon.com/data.json',
      json_path: '$.archive[0].service_status',
      condition: { operator: 'eq', value: 'Service disruption' },
      category: 'cloud',
      resolvability_score: 0.91,
      reasoning: 'AWS publishes real-time status. Outage duration is logged precisely.',
    }),

    crypto: () => ({
      title: headline.title,
      question: 'Will Bitcoin price move >5% in either direction within 24 hours?',
      resolution_criteria: 'Check price API for 24h change percentage',
      oracle_api_link: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
      json_path: '$.bitcoin.usd_24h_change',
      condition: { operator: 'gt', value: 5 },
      category: 'crypto',
      resolvability_score: 0.95,
      reasoning: 'Price data from CoinGecko is highly reliable. Percentage change is exact.',
    }),

    aerospace: () => ({
      title: headline.title,
      question: 'Will the scheduled launch occur within the announced window?',
      resolution_criteria: 'Check SpaceX API for launch status',
      oracle_api_link: 'https://api.spacexdata.com/v5/launches/next',
      json_path: '$.success',
      condition: { operator: 'eq', value: true },
      category: 'aerospace',
      resolvability_score: 0.89,
      reasoning: 'SpaceX publishes launch outcomes. Success/failure is binary.',
    }),
  };

  const generator = templates[headline.category] || templates['tech'];
  const schema = generator();

  // Add some randomness to simulate LLM variability
  schema.resolvability_score = Math.min(1, schema.resolvability_score + (Math.random() - 0.5) * 0.1);

  return {
    schema,
    confidence: schema.resolvability_score,
    reasoning: schema.reasoning,
  };
}

function extractSubject(title: string): string {
  // Simple extraction - in production, LLM would do this
  const words = title.split(' ').slice(0, 5);
  return words.join(' ');
}

// ============================================================================
// SOURCING AGENT
// ============================================================================

export class SourcingAgent {
  private config: SourcingAgentConfig;
  private eventBus: EventBus;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private marketsCreatedThisHour: number = 0;
  private lastHourReset: number = Date.now();
  private processedHeadlines: Set<string> = new Set();

  // Callbacks for integration
  public onMarketGenerated?: (market: Market, reasoning: string) => void;
  public onHeadlineProcessed?: (headline: Headline, result: LLMResponse) => void;

  constructor(eventBus: EventBus, config: Partial<SourcingAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = eventBus;
  }

  /**
   * Start autonomous headline sourcing
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[SourcingAgent] Starting headline factory...');
    this.poll();

    this.pollInterval = setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop sourcing
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[SourcingAgent] Stopped.');
  }

  /**
   * Poll for new headlines
   */
  private async poll(): Promise<void> {
    // Reset hourly counter
    if (Date.now() - this.lastHourReset > 3600000) {
      this.marketsCreatedThisHour = 0;
      this.lastHourReset = Date.now();
    }

    // Check rate limit
    if (this.marketsCreatedThisHour >= this.config.maxMarketsPerHour) {
      console.log('[SourcingAgent] Rate limit reached, skipping poll.');
      return;
    }

    try {
      const headlines = await this.fetchHeadlines();
      
      for (const headline of headlines) {
        if (this.processedHeadlines.has(headline.id)) continue;
        this.processedHeadlines.add(headline.id);

        await this.processHeadline(headline);
      }
    } catch (error) {
      console.error('[SourcingAgent] Poll error:', error);
    }
  }

  /**
   * Fetch headlines from sources
   */
  private async fetchHeadlines(): Promise<Headline[]> {
    // In production, this would fetch from real RSS/APIs
    // For now, return random mock headlines
    const shuffled = [...MOCK_HEADLINES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(h => ({
      ...h,
      id: `${h.id}-${Date.now()}`,
      timestamp: new Date(),
    }));
  }

  /**
   * Process a single headline
   */
  private async processHeadline(headline: Headline): Promise<void> {
    console.log(`[SourcingAgent] Processing: "${headline.title}"`);

    // Generate market schema using LLM
    const result = await generateMarketSchemaWithLLM(headline, this.config);

    // Notify listeners
    this.onHeadlineProcessed?.(headline, result);

    // Check resolvability threshold
    if (!result.schema || result.confidence < this.config.minResolvabilityScore) {
      console.log(`[SourcingAgent] Rejected (score: ${result.confidence.toFixed(2)}): ${headline.title}`);
      return;
    }

    // Create market
    const market = this.createMarketFromSchema(headline, result.schema);
    
    console.log(`[SourcingAgent] Created market: ${market.ticker} (score: ${result.confidence.toFixed(2)})`);
    this.marketsCreatedThisHour++;

    // Emit event
    this.eventBus.publish('markets.auto_created', {
      market,
      headline,
      reasoning: result.reasoning,
    });

    // Notify callback
    this.onMarketGenerated?.(market, result.reasoning);
  }

  /**
   * Create market object from schema
   */
  private createMarketFromSchema(headline: Headline, schema: MarketSchema): Market {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000); // +1 hour

    const ticker = this.generateTicker(schema.category, headline.title);

    const resolutionSchema: HttpJsonResolutionSchema = {
      type: 'http_json',
      source_url: schema.oracle_api_link,
      method: 'GET',
      json_path: schema.json_path,
      condition: schema.condition,
    };

    return {
      id: uuidv4(),
      ticker,
      title: schema.question,
      description: `${schema.resolution_criteria}\n\nSource: ${headline.source}\nOriginal: ${headline.title}`,
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
      category: schema.category,
      tags: [schema.category, 'auto-generated', headline.source.toLowerCase().replace(/\s+/g, '-')],
      metadata: {
        headline_id: headline.id,
        resolvability_score: schema.resolvability_score,
        llm_reasoning: schema.reasoning,
      },
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Generate unique ticker
   */
  private generateTicker(category: string, title: string): string {
    const categoryPrefix = category.toUpperCase().slice(0, 4);
    const words = title.split(' ').filter(w => w.length > 3).slice(0, 2);
    const titlePart = words.map(w => w.toUpperCase().slice(0, 3)).join('-');
    const datePart = new Date().toISOString().slice(5, 10).replace('-', '');
    return `${categoryPrefix}-${titlePart}-${datePart}`;
  }

  /**
   * Manually trigger headline processing
   */
  async processManualHeadline(text: string, source: string = 'Manual'): Promise<LLMResponse> {
    const headline: Headline = {
      id: `manual-${Date.now()}`,
      source,
      title: text,
      summary: text,
      category: this.detectCategory(text),
      url: '',
      timestamp: new Date(),
    };

    const result = await generateMarketSchemaWithLLM(headline, this.config);
    
    if (result.schema && result.confidence >= this.config.minResolvabilityScore) {
      const market = this.createMarketFromSchema(headline, result.schema);
      this.eventBus.publish('markets.auto_created', { market, headline, reasoning: result.reasoning });
      this.onMarketGenerated?.(market, result.reasoning);
    }

    return result;
  }

  /**
   * Simple category detection
   */
  private detectCategory(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('github') || lower.includes('npm') || lower.includes('code')) return 'tech';
    if (lower.includes('weather') || lower.includes('storm') || lower.includes('hurricane')) return 'weather';
    if (lower.includes('port') || lower.includes('ship') || lower.includes('freight')) return 'logistics';
    if (lower.includes('aws') || lower.includes('cloud') || lower.includes('azure')) return 'cloud';
    if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('eth')) return 'crypto';
    if (lower.includes('spacex') || lower.includes('launch') || lower.includes('rocket')) return 'aerospace';
    return 'general';
  }

  /**
   * Get agent stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      marketsCreatedThisHour: this.marketsCreatedThisHour,
      processedHeadlines: this.processedHeadlines.size,
      config: this.config,
    };
  }
}
