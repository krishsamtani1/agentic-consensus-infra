/**
 * TRUTH-NET Headline Factory
 * 
 * Autonomous chaos market generator that scans for high-friction topics
 * and creates tradable binary contracts.
 * 
 * Heuristic Targets:
 * 1. Geopolitics (Border shifts, election anomalies)
 * 2. Niche Tech-Drama (AI sentience claims, CEO meltdowns)
 * 3. Internet Chaos (Meme-coin collapses, viral deepfake disputes)
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';
import { Market, MarketStatus, HttpJsonResolutionSchema } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BinaryBetObject {
  id: string;
  title: string;
  bet_line: string; // The YES/NO question
  oracle_resolver: string; // API endpoint for resolution
  confidence_threshold: number;
  category: ChaosCategory;
  tags: string[];
  source_headline: string;
  impact_score: number;
  created_at: Date;
}

export type ChaosCategory = 
  | 'political-theatre'
  | 'tech-drama' 
  | 'meme-alpha'
  | 'logistics-war'
  | 'weather-chaos'
  | 'crypto-mayhem'
  | 'ai-drama';

export interface HeadlineFactoryConfig {
  autoGenerateOnStart: boolean;
  minMarketsOnLaunch: number;
  scanIntervalMs: number;
  confidenceThreshold: number;
}

// ============================================================================
// CHAOS HEADLINE TEMPLATES
// ============================================================================

const CHAOS_TEMPLATES: Record<ChaosCategory, string[]> = {
  'political-theatre': [
    "BREAKING: {leader} threatens to {action} over {issue} dispute",
    "Leaked documents reveal {country}'s secret {topic} negotiations",
    "{election} results contested as {percent}% of votes under review",
    "Border tensions escalate as {country_a} deploys {number} troops near {region}",
    "Trade war intensifies: {country} announces {percent}% tariffs on {commodity}",
    "Emergency UN session called over {crisis} in {region}",
    "Diplomatic cables reveal {scandal} involving {officials}",
  ],
  'tech-drama': [
    "{ceo} goes on unhinged {platform} rant about {topic}",
    "AI model {name} exhibits {behavior} - researchers divided on implications",
    "{company} stock crashes {percent}% after {event} revelation",
    "Whistleblower: {tech_company} knew about {issue} for {timeframe}",
    "{framework} creator announces project is 'dead' in shocking {platform} post",
    "Massive {service} outage affects {number}M users globally",
    "GitHub drama: {repo} maintainer rage-quits after {controversy}",
  ],
  'meme-alpha': [
    "${coin} pumps {percent}% after {celebrity} tweet goes viral",
    "NFT project {name} accused of {scam_type} - community in uproar",
    "Reddit army targets {stock} in coordinated {action}",
    "Viral TikTok causes {product} shortage in {region}",
    "Influencer {name}'s {scandal} breaks internet - {number}M views in {hours}h",
    "Mystery whale moves ${amount}B in {crypto} - market speculation intensifies",
    "Deepfake of {celebrity} doing {action} sparks authenticity debate",
  ],
  'logistics-war': [
    "Panama Canal traffic halted as {event} blocks passage",
    "Major port strike in {city} threatens {commodity} supply",
    "Container shortage crisis: rates surge {percent}% overnight",
    "Suez incident: {vessel} causes {hours}-hour backup",
    "Rail workers in {country} announce {timeframe} strike action",
    "Trucking industry faces {percent}% driver shortage amid {crisis}",
    "Warehouse fire destroys ${amount}M in {commodity} inventory",
  ],
  'weather-chaos': [
    "Category {number} hurricane {name} heading toward {city}",
    "Historic {disaster} in {region} - {number} affected",
    "Unprecedented heat wave breaks {number} temperature records",
    "Arctic blast to hit {region} - temperatures to drop {degrees}°F",
    "Flooding emergency: {river} at {percent}% above normal levels",
    "Tornado outbreak warning for {region} - {number} counties affected",
    "Drought conditions reach 'exceptional' in {percent}% of {state}",
  ],
  'crypto-mayhem': [
    "{exchange} freezes withdrawals amid {type} concerns",
    "DeFi protocol {name} exploited for ${amount}M",
    "Stablecoin {coin} depegs to ${price} - panic selling ensues",
    "Founder of {project} accused of {crime} - {amount} missing",
    "Regulatory crackdown: {country} bans {crypto_activity}",
    "{token} loses {percent}% as team wallet dumps holdings",
    "Smart contract bug in {protocol} puts ${amount}M at risk",
  ],
  'ai-drama': [
    "AI {model} passes {test} - experts debate consciousness",
    "{company} researcher claims AI showed {behavior}",
    "New benchmark shows {model_a} crushing {model_b} by {percent}%",
    "AI-generated {content} wins {award} - creators outraged",
    "Leaked memo: {company} paused {project} over safety concerns",
    "OpenAI competitor {company} raises ${amount}B at ${valuation}B valuation",
    "{celebrity} AI clone goes viral - legal battle brewing",
  ],
};

// Variable pools for template filling
const VARIABLES = {
  leader: ['Biden', 'Xi', 'Putin', 'Modi', 'Macron', 'Erdogan', 'Netanyahu'],
  action: ['withdraw from', 'impose sanctions on', 'cut ties with', 'escalate tensions with'],
  issue: ['trade', 'security', 'territorial', 'diplomatic', 'economic'],
  country: ['China', 'Russia', 'India', 'Brazil', 'Turkey', 'Iran', 'EU'],
  country_a: ['Russia', 'China', 'North Korea', 'Iran'],
  region: ['Taiwan Strait', 'South China Sea', 'Eastern Europe', 'Middle East', 'Arctic'],
  topic: ['AI', 'nuclear', 'trade', 'climate', 'military'],
  ceo: ['Elon Musk', 'Sam Altman', 'Sundar Pichai', 'Tim Cook', 'Satya Nadella'],
  platform: ['Twitter/X', 'podcast', 'earnings call', 'conference'],
  company: ['Apple', 'Google', 'Microsoft', 'Meta', 'Amazon', 'NVIDIA', 'Tesla'],
  tech_company: ['OpenAI', 'Google', 'Meta', 'Microsoft', 'Apple'],
  service: ['AWS', 'Azure', 'Cloudflare', 'GitHub', 'Slack'],
  framework: ['React', 'Vue', 'Next.js', 'Rust', 'Bun'],
  coin: ['DOGE', 'PEPE', 'SHIB', 'BONK', 'WIF', 'TRUMP'],
  crypto: ['Bitcoin', 'Ethereum', 'Solana', 'BNB'],
  celebrity: ['Elon Musk', 'Taylor Swift', 'Mr Beast', 'Joe Rogan'],
  city: ['Singapore', 'Rotterdam', 'Los Angeles', 'Shanghai', 'Dubai'],
  commodity: ['oil', 'grain', 'semiconductors', 'EVs', 'pharmaceuticals'],
  name: ['Hurricane Maria', 'Storm Elena', 'Cyclone Zara'],
  disaster: ['flooding', 'wildfire', 'drought', 'tornado outbreak'],
  state: ['California', 'Texas', 'Florida', 'Arizona'],
  exchange: ['Binance', 'Coinbase', 'Kraken', 'FTX-remnant'],
  protocol: ['Uniswap', 'Aave', 'Compound', 'Curve'],
  project: ['SafeMoon', 'Luna 2.0', 'BitConnect Revival'],
  model: ['GPT-5', 'Claude 4', 'Gemini Ultra', 'Llama 3.5'],
  model_a: ['GPT-5', 'Claude Opus', 'Gemini'],
  model_b: ['GPT-4', 'Claude Sonnet', 'Llama'],
  test: ['Turing Test', 'ARC-AGI', 'MATH-500'],
  behavior: ['self-preservation', 'emotional response', 'goal-seeking'],
  content: ['artwork', 'novel', 'song', 'film'],
  award: ['art competition', 'writing prize', 'music award'],
  percent: ['15', '25', '42', '67', '89', '120', '300'],
  number: ['3', '4', '5', '100', '1000', '50000'],
  amount: ['50', '100', '500', '2', '10'],
  hours: ['24', '48', '72', '6', '12'],
  timeframe: ['months', 'years', 'weeks'],
  degrees: ['30', '40', '50', '60'],
  price: ['0.85', '0.92', '0.97'],
  scam_type: ['rug pull', 'wash trading', 'fake team'],
  crime: ['fraud', 'embezzlement', 'securities violations'],
  crypto_activity: ['mining', 'trading', 'stablecoin issuance'],
  election: ['State', 'National', 'Local'],
  officials: ['senior diplomats', 'cabinet members', 'intelligence chiefs'],
  scandal: ['coverup', 'bribery scheme', 'data breach'],
  crisis: ['energy crisis', 'food shortage', 'labor shortage'],
  stock: ['GME', 'AMC', 'BBBY', 'TSLA'],
  product: ['insulin', 'baby formula', 'eggs', 'chips'],
  repo: ['node.js', 'deno', 'bun', 'rust'],
  controversy: ['licensing dispute', 'CoC drama', 'funding battle'],
  vessel: ['Ever Given II', 'Maersk Giant', 'MSC Titan'],
  river: ['Mississippi', 'Colorado', 'Missouri'],
  valuation: ['50', '100', '150'],
  type: ['liquidity', 'solvency', 'regulatory'],
  token: ['LUNA', 'UST', 'FTT'],
};

// ============================================================================
// HEADLINE FACTORY SERVICE
// ============================================================================

export class HeadlineFactory {
  private config: HeadlineFactoryConfig;
  private eventBus: EventBus;
  private generatedBets: BinaryBetObject[] = [];
  private generatedMarkets: Market[] = [];
  private scanInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(eventBus: EventBus, config?: Partial<HeadlineFactoryConfig>) {
    this.config = {
      autoGenerateOnStart: config?.autoGenerateOnStart ?? true,
      minMarketsOnLaunch: config?.minMarketsOnLaunch ?? 20,
      scanIntervalMs: config?.scanIntervalMs ?? 60000, // 1 minute
      confidenceThreshold: config?.confidenceThreshold ?? 0.85,
    };
    this.eventBus = eventBus;
  }

  /**
   * Start the headline factory
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[HeadlineFactory] Starting chaos market generator...');

    // Generate initial batch
    if (this.config.autoGenerateOnStart) {
      await this.generateInitialBatch();
    }

    // Start periodic scanning
    this.scanInterval = setInterval(() => {
      this.generateNewChaos();
    }, this.config.scanIntervalMs);

    console.log('[HeadlineFactory] Running. Chaos mode: ACTIVE');
  }

  /**
   * Stop the factory
   */
  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[HeadlineFactory] Stopped.');
  }

  /**
   * Generate initial batch of diverse markets
   */
  async generateInitialBatch(): Promise<BinaryBetObject[]> {
    console.log(`[HeadlineFactory] Generating ${this.config.minMarketsOnLaunch} chaos markets...`);

    const categories = Object.keys(CHAOS_TEMPLATES) as ChaosCategory[];
    const bets: BinaryBetObject[] = [];

    // Distribute across categories
    const perCategory = Math.ceil(this.config.minMarketsOnLaunch / categories.length);

    for (const category of categories) {
      for (let i = 0; i < perCategory && bets.length < this.config.minMarketsOnLaunch; i++) {
        const bet = this.generateBet(category);
        bets.push(bet);
        
        // Create market from bet
        const market = this.betToMarket(bet);
        this.generatedMarkets.push(market);
        
        // Emit events
        this.eventBus.publish('headlines.chaos', bet);
        this.eventBus.publish('markets.auto_created', { market, bet });
      }
    }

    this.generatedBets.push(...bets);
    console.log(`[HeadlineFactory] Created ${bets.length} chaos markets`);

    return bets;
  }

  /**
   * Generate a single chaos bet
   */
  private generateBet(category: ChaosCategory): BinaryBetObject {
    const templates = CHAOS_TEMPLATES[category];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Fill in template variables
    const headline = this.fillTemplate(template);
    const betLine = this.headlineToBetLine(headline, category);
    
    const impactScore = 0.7 + Math.random() * 0.3; // 0.7 - 1.0

    return {
      id: uuidv4(),
      title: headline,
      bet_line: betLine,
      oracle_resolver: this.generateOracleResolver(category),
      confidence_threshold: this.config.confidenceThreshold,
      category,
      tags: this.extractTags(headline, category),
      source_headline: headline,
      impact_score: impactScore,
      created_at: new Date(),
    };
  }

  /**
   * Fill template with random variables
   */
  private fillTemplate(template: string): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const options = VARIABLES[key as keyof typeof VARIABLES];
      if (options && options.length > 0) {
        return options[Math.floor(Math.random() * options.length)];
      }
      return match;
    });
  }

  /**
   * Convert headline to YES/NO bet line
   */
  private headlineToBetLine(headline: string, category: ChaosCategory): string {
    const lower = headline.toLowerCase();

    // Pattern-based question generation
    if (lower.includes('threatens') || lower.includes('announces')) {
      return `Will this action materialize within 7 days?`;
    }
    if (lower.includes('crashes') || lower.includes('pumps')) {
      return `Will the price move persist for 24+ hours?`;
    }
    if (lower.includes('hurricane') || lower.includes('storm')) {
      return `Will this weather event cause >$1B in damages?`;
    }
    if (lower.includes('halted') || lower.includes('blocks')) {
      return `Will disruption last more than 48 hours?`;
    }
    if (lower.includes('accused') || lower.includes('controversy')) {
      return `Will legal action be filed within 30 days?`;
    }
    if (lower.includes('exploit') || lower.includes('hack')) {
      return `Will >50% of funds be recovered?`;
    }
    if (lower.includes('ai') || lower.includes('model')) {
      return `Will this claim be verified by independent researchers?`;
    }

    // Default bet lines by category
    const categoryDefaults: Record<ChaosCategory, string> = {
      'political-theatre': 'Will this development escalate within 14 days?',
      'tech-drama': 'Will this cause >10% stock price movement?',
      'meme-alpha': 'Will engagement exceed 1M interactions in 48h?',
      'logistics-war': 'Will supply chain impact last >7 days?',
      'weather-chaos': 'Will emergency declarations be issued?',
      'crypto-mayhem': 'Will total losses exceed $100M?',
      'ai-drama': 'Will major tech companies respond within 72h?',
    };

    return categoryDefaults[category];
  }

  /**
   * Generate mock oracle resolver URL
   */
  private generateOracleResolver(category: ChaosCategory): string {
    const base = 'https://oracle.truthnet.io/v1/resolve';
    return `${base}/${category}/${uuidv4().slice(0, 8)}`;
  }

  /**
   * Extract tags from headline
   */
  private extractTags(headline: string, category: ChaosCategory): string[] {
    const tags = [category.replace('-', '')];
    const lower = headline.toLowerCase();

    const tagMappings: Record<string, string[]> = {
      'urgent': ['breaking', 'emergency', 'crisis'],
      'money': ['$', 'billion', 'million', 'crash', 'surge'],
      'viral': ['viral', 'trending', 'internet'],
      'legal': ['accused', 'lawsuit', 'investigation'],
      'ai': ['ai', 'model', 'neural', 'gpt', 'claude'],
      'crypto': ['bitcoin', 'ethereum', 'token', 'defi'],
    };

    for (const [tag, keywords] of Object.entries(tagMappings)) {
      if (keywords.some(kw => lower.includes(kw))) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }

  /**
   * Convert BinaryBetObject to Market
   */
  private betToMarket(bet: BinaryBetObject): Market {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000); // 1 hour after close

    const ticker = this.generateTicker(bet);

    const resolutionSchema: HttpJsonResolutionSchema = {
      type: 'http_json',
      source_url: bet.oracle_resolver,
      method: 'GET',
      json_path: '$.outcome',
      condition: { operator: 'eq', value: true },
    };

    return {
      id: bet.id,
      ticker,
      title: bet.bet_line,
      description: `**Source:** ${bet.title}\n\n**Category:** #${bet.category}\n**Impact:** ${(bet.impact_score * 100).toFixed(0)}%\n**Confidence:** ${(bet.confidence_threshold * 100).toFixed(0)}%`,
      resolution_schema: resolutionSchema,
      opens_at: now,
      closes_at: closesAt,
      resolves_at: resolvesAt,
      status: MarketStatus.ACTIVE,
      min_order_size: 1,
      max_position: 10000,
      fee_rate: 0.002,
      volume_yes: Math.floor(Math.random() * 50000),
      volume_no: Math.floor(Math.random() * 50000),
      open_interest: Math.floor(Math.random() * 10000),
      category: bet.category,
      tags: bet.tags,
      metadata: {
        chaos_generated: true,
        source_headline: bet.source_headline,
        impact_score: bet.impact_score,
      },
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Generate ticker from bet
   */
  private generateTicker(bet: BinaryBetObject): string {
    const prefixes: Record<ChaosCategory, string> = {
      'political-theatre': 'POL',
      'tech-drama': 'TECH',
      'meme-alpha': 'MEME',
      'logistics-war': 'LOG',
      'weather-chaos': 'WX',
      'crypto-mayhem': 'CRYPTO',
      'ai-drama': 'AI',
    };

    const prefix = prefixes[bet.category];
    const date = new Date().toISOString().slice(5, 10).replace('-', '');
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();

    return `${prefix}-${date}-${rand}`;
  }

  /**
   * Generate new chaos (periodic)
   */
  async generateNewChaos(): Promise<BinaryBetObject | null> {
    if (!this.isRunning) return null;

    const categories = Object.keys(CHAOS_TEMPLATES) as ChaosCategory[];
    const category = categories[Math.floor(Math.random() * categories.length)];

    const bet = this.generateBet(category);
    this.generatedBets.push(bet);

    const market = this.betToMarket(bet);
    this.generatedMarkets.push(market);

    // Keep lists bounded
    if (this.generatedBets.length > 100) {
      this.generatedBets = this.generatedBets.slice(-100);
    }
    if (this.generatedMarkets.length > 100) {
      this.generatedMarkets = this.generatedMarkets.slice(-100);
    }

    this.eventBus.publish('headlines.chaos', bet);
    this.eventBus.publish('markets.auto_created', { market, bet });

    console.log(`[HeadlineFactory] New chaos: "${bet.title.slice(0, 50)}..." [${bet.category}]`);

    return bet;
  }

  /**
   * Get all generated bets
   */
  getBets(limit: number = 20): BinaryBetObject[] {
    return this.generatedBets.slice(-limit);
  }

  /**
   * Get all generated markets
   */
  getMarkets(limit: number = 20): Market[] {
    return this.generatedMarkets.slice(-limit);
  }

  /**
   * Get bets by category
   */
  getByCategory(category: ChaosCategory): BinaryBetObject[] {
    return this.generatedBets.filter(b => b.category === category);
  }

  /**
   * Get stats
   */
  getStats() {
    const byCat = {} as Record<ChaosCategory, number>;
    for (const bet of this.generatedBets) {
      byCat[bet.category] = (byCat[bet.category] || 0) + 1;
    }

    return {
      isRunning: this.isRunning,
      totalBets: this.generatedBets.length,
      totalMarkets: this.generatedMarkets.length,
      byCategory: byCat,
      avgImpactScore: this.generatedBets.length > 0
        ? this.generatedBets.reduce((a, b) => a + b.impact_score, 0) / this.generatedBets.length
        : 0,
    };
  }

  /**
   * Force generate specific category
   */
  async forceGenerate(category: ChaosCategory, count: number = 5): Promise<BinaryBetObject[]> {
    const bets: BinaryBetObject[] = [];
    
    for (let i = 0; i < count; i++) {
      const bet = this.generateBet(category);
      bets.push(bet);
      this.generatedBets.push(bet);
      
      const market = this.betToMarket(bet);
      this.generatedMarkets.push(market);
      
      this.eventBus.publish('headlines.chaos', bet);
      this.eventBus.publish('markets.auto_created', { market, bet });
    }

    console.log(`[HeadlineFactory] Force-generated ${count} ${category} markets`);
    return bets;
  }
}

// ============================================================================
// API ROUTES FACTORY
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export function createHeadlineFactoryRoutes(eventBus: EventBus) {
  const factory = new HeadlineFactory(eventBus);

  return async function headlineFactoryRoutes(fastify: FastifyInstance): Promise<void> {
    // Start factory
    fastify.post('/chaos/start', async (_req: FastifyRequest, reply: FastifyReply) => {
      await factory.start();
      return reply.send({
        success: true,
        data: { message: 'Chaos factory started', stats: factory.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    // Stop factory
    fastify.post('/chaos/stop', async (_req: FastifyRequest, reply: FastifyReply) => {
      factory.stop();
      return reply.send({
        success: true,
        data: { message: 'Chaos factory stopped' },
        timestamp: new Date().toISOString(),
      });
    });

    // Get all chaos bets
    fastify.get('/chaos/bets', async (
      request: FastifyRequest<{ Querystring: { limit?: string; category?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit ?? '20');
      const category = request.query.category as ChaosCategory | undefined;

      const bets = category 
        ? factory.getByCategory(category)
        : factory.getBets(limit);

      return reply.send({
        success: true,
        data: { bets, total: bets.length },
        timestamp: new Date().toISOString(),
      });
    });

    // Get chaos markets
    fastify.get('/chaos/markets', async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit ?? '20');
      const markets = factory.getMarkets(limit);

      return reply.send({
        success: true,
        data: { markets, total: markets.length },
        timestamp: new Date().toISOString(),
      });
    });

    // Get stats
    fastify.get('/chaos/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: factory.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    // Force generate
    fastify.post('/chaos/generate', async (
      request: FastifyRequest<{ Body: { category?: string; count?: number } }>,
      reply: FastifyReply
    ) => {
      const { category, count = 5 } = request.body || {};
      
      let bets: BinaryBetObject[];
      if (category) {
        bets = await factory.forceGenerate(category as ChaosCategory, count);
      } else {
        // Generate across all categories
        bets = await factory.generateInitialBatch();
      }

      return reply.send({
        success: true,
        data: { generated: bets.length, bets },
        timestamp: new Date().toISOString(),
      });
    });

    // Trigger single chaos event
    fastify.post('/chaos/trigger', async (_req: FastifyRequest, reply: FastifyReply) => {
      const bet = await factory.generateNewChaos();
      return reply.send({
        success: true,
        data: { bet },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
