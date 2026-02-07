/**
 * TRUTH-NET Market Seeder
 * 
 * Auto-generates 20+ diverse markets on startup based on:
 * 1. Real-world trending topics
 * 2. Prediction market archetypes
 * 3. High-interest controversy themes
 */

import { v4 as uuidv4 } from 'uuid';
import { Market, MarketStatus, HttpJsonResolutionSchema } from '../types.js';
import { EventBus } from '../events/EventBus.js';

// ============================================================================
// MARKET TEMPLATES
// ============================================================================

interface MarketTemplate {
  category: string;
  ticker_prefix: string;
  title: string;
  description: string;
  bet_question: string;
  tags: string[];
  initial_yes_odds: number;  // 0-1
  volatility: 'low' | 'medium' | 'high';
}

const MARKET_TEMPLATES: MarketTemplate[] = [
  // AI & Tech
  {
    category: 'ai-war',
    ticker_prefix: 'AI',
    title: 'GPT-5 Released Before July 2026',
    description: 'OpenAI announces and releases GPT-5 to the public before July 1, 2026.',
    bet_question: 'Will GPT-5 be publicly available before July 2026?',
    tags: ['#AIWar', '#OpenAI', '#GPT5'],
    initial_yes_odds: 0.45,
    volatility: 'high',
  },
  {
    category: 'ai-war',
    ticker_prefix: 'AI',
    title: 'Anthropic Raises $5B+ Round',
    description: 'Anthropic announces a funding round of $5 billion or more.',
    bet_question: 'Will Anthropic raise $5B+ in a single round?',
    tags: ['#AIWar', '#Anthropic', '#Funding'],
    initial_yes_odds: 0.35,
    volatility: 'medium',
  },
  {
    category: 'tech-drama',
    ticker_prefix: 'TECH',
    title: 'Elon Musk Tweets Cause 10%+ Stock Move',
    description: 'Any Elon Musk tweet causes Tesla, SpaceX, or X stock to move 10%+ in 24h.',
    bet_question: 'Will Musk tweet cause 10%+ stock move this month?',
    tags: ['#TechDrama', '#Musk', '#Tesla'],
    initial_yes_odds: 0.62,
    volatility: 'high',
  },
  {
    category: 'tech-drama',
    ticker_prefix: 'TECH',
    title: 'Major Tech CEO Fired/Resigns',
    description: 'CEO of a Fortune 500 tech company is fired or resigns unexpectedly.',
    bet_question: 'Will a major tech CEO depart unexpectedly?',
    tags: ['#TechDrama', '#CEO', '#Corporate'],
    initial_yes_odds: 0.28,
    volatility: 'medium',
  },

  // Politics & Elections
  {
    category: 'election-crisis',
    ticker_prefix: 'POL',
    title: '2026 Election Results Contested',
    description: 'Major 2026 US election results are formally contested or challenged in court.',
    bet_question: 'Will 2026 election results be formally contested?',
    tags: ['#ElectionCrisis', '#Politics', '#Legal'],
    initial_yes_odds: 0.55,
    volatility: 'high',
  },
  {
    category: 'election-crisis',
    ticker_prefix: 'POL',
    title: 'New Tariffs Announced on China',
    description: 'US announces new tariffs of 10%+ on Chinese goods.',
    bet_question: 'Will new China tariffs be announced?',
    tags: ['#Politics', '#Trade', '#China'],
    initial_yes_odds: 0.72,
    volatility: 'medium',
  },
  {
    category: 'election-crisis',
    ticker_prefix: 'POL',
    title: 'Major Sanctions on Russia Extended',
    description: 'US/EU extend or expand sanctions on Russia before March 2026.',
    bet_question: 'Will Russia sanctions be expanded?',
    tags: ['#Politics', '#Sanctions', '#Russia'],
    initial_yes_odds: 0.81,
    volatility: 'low',
  },

  // Crypto
  {
    category: 'crypto',
    ticker_prefix: 'CRYPT',
    title: 'Bitcoin Breaks $150K',
    description: 'Bitcoin price exceeds $150,000 at any point in 2026.',
    bet_question: 'Will BTC hit $150K in 2026?',
    tags: ['#CryptoChaos', '#Bitcoin', '#Price'],
    initial_yes_odds: 0.38,
    volatility: 'high',
  },
  {
    category: 'crypto',
    ticker_prefix: 'CRYPT',
    title: 'Major Exchange Hack ($100M+)',
    description: 'A top-10 crypto exchange is hacked for $100M or more.',
    bet_question: 'Will a major exchange be hacked for $100M+?',
    tags: ['#CryptoChaos', '#Hack', '#Exchange'],
    initial_yes_odds: 0.25,
    volatility: 'medium',
  },
  {
    category: 'crypto',
    ticker_prefix: 'CRYPT',
    title: 'SEC Approves Ethereum Staking ETF',
    description: 'SEC approves an Ethereum ETF with staking rewards.',
    bet_question: 'Will SEC approve ETH staking ETF?',
    tags: ['#CryptoChaos', '#ETH', '#SEC'],
    initial_yes_odds: 0.42,
    volatility: 'medium',
  },

  // Supply Chain & Logistics
  {
    category: 'logistics',
    ticker_prefix: 'LOG',
    title: 'Panama Canal Daily Transits < 24',
    description: 'Panama Canal average daily transits drop below 24 due to drought.',
    bet_question: 'Will Panama Canal transits drop below 24/day?',
    tags: ['#SupplyChain', '#Panama', '#Shipping'],
    initial_yes_odds: 0.35,
    volatility: 'medium',
  },
  {
    category: 'logistics',
    ticker_prefix: 'LOG',
    title: 'Major US Port Strike (5+ Days)',
    description: 'A major US port (LA, Long Beach, NY/NJ) experiences 5+ day strike.',
    bet_question: 'Will a major US port strike last 5+ days?',
    tags: ['#SupplyChain', '#Strike', '#Port'],
    initial_yes_odds: 0.22,
    volatility: 'low',
  },
  {
    category: 'logistics',
    ticker_prefix: 'LOG',
    title: 'Suez Canal Blockage (24h+)',
    description: 'Suez Canal experiences a blockage lasting 24+ hours.',
    bet_question: 'Will Suez Canal be blocked for 24+ hours?',
    tags: ['#SupplyChain', '#Suez', '#Shipping'],
    initial_yes_odds: 0.15,
    volatility: 'low',
  },
  {
    category: 'logistics',
    ticker_prefix: 'LOG',
    title: 'Global Chip Shortage Returns',
    description: 'Major chip shortage declared affecting auto/tech production.',
    bet_question: 'Will chip shortage return in 2026?',
    tags: ['#SupplyChain', '#Chips', '#Shortage'],
    initial_yes_odds: 0.31,
    volatility: 'medium',
  },

  // Weather & Climate
  {
    category: 'climate',
    ticker_prefix: 'WX',
    title: 'Category 5 Hurricane Hits US',
    description: 'A Category 5 hurricane makes landfall in the continental US.',
    bet_question: 'Will Cat 5 hurricane hit US mainland?',
    tags: ['#ClimateCrisis', '#Hurricane', '#Weather'],
    initial_yes_odds: 0.28,
    volatility: 'high',
  },
  {
    category: 'climate',
    ticker_prefix: 'WX',
    title: 'Record Heat Wave (120°F+)',
    description: 'US records temperature of 120°F or higher in 2026.',
    bet_question: 'Will US hit 120°F in 2026?',
    tags: ['#ClimateCrisis', '#HeatWave', '#Record'],
    initial_yes_odds: 0.45,
    volatility: 'medium',
  },
  {
    category: 'climate',
    ticker_prefix: 'WX',
    title: 'California Mega-Fire (500K+ Acres)',
    description: 'Single California wildfire burns 500,000+ acres.',
    bet_question: 'Will CA see a 500K+ acre fire?',
    tags: ['#ClimateCrisis', '#Wildfire', '#California'],
    initial_yes_odds: 0.52,
    volatility: 'high',
  },

  // Internet & Viral
  {
    category: 'meme-alpha',
    ticker_prefix: 'MEME',
    title: 'Viral Deepfake Scandal',
    description: 'A deepfake video causes major political or celebrity scandal.',
    bet_question: 'Will deepfake cause major scandal?',
    tags: ['#MemeAlpha', '#Deepfake', '#Viral'],
    initial_yes_odds: 0.68,
    volatility: 'high',
  },
  {
    category: 'meme-alpha',
    ticker_prefix: 'MEME',
    title: 'Meme Coin Pumps 1000%+ Then Crashes',
    description: 'A new meme coin pumps 1000%+ then crashes 90%+ within a week.',
    bet_question: 'Will meme coin pump & dump 1000%?',
    tags: ['#MemeAlpha', '#MemeCoin', '#PumpDump'],
    initial_yes_odds: 0.85,
    volatility: 'high',
  },
  {
    category: 'meme-alpha',
    ticker_prefix: 'MEME',
    title: 'Major Platform Outage (1M+ Users)',
    description: 'Twitter/X, Instagram, or TikTok experiences 4+ hour outage.',
    bet_question: 'Will major social platform have 4h+ outage?',
    tags: ['#MemeAlpha', '#Outage', '#SocialMedia'],
    initial_yes_odds: 0.58,
    volatility: 'medium',
  },

  // Sports & Entertainment
  {
    category: 'entertainment',
    ticker_prefix: 'ENT',
    title: 'Taylor Swift Announces Surprise Album',
    description: 'Taylor Swift announces or releases a surprise album in 2026.',
    bet_question: 'Will Taylor Swift drop a surprise album?',
    tags: ['#Entertainment', '#TaylorSwift', '#Music'],
    initial_yes_odds: 0.42,
    volatility: 'low',
  },
  {
    category: 'entertainment',
    ticker_prefix: 'ENT',
    title: 'Major Streaming Service Merger',
    description: 'Two major streaming services (Netflix, Disney+, HBO, etc.) announce merger.',
    bet_question: 'Will major streaming merger be announced?',
    tags: ['#Entertainment', '#Streaming', '#Merger'],
    initial_yes_odds: 0.18,
    volatility: 'low',
  },

  // Sports
  {
    category: 'sports',
    ticker_prefix: 'SPORT',
    title: 'FIFA Club World Cup 2025 Attendance Record',
    description: 'FIFA Club World Cup sets new attendance record for the tournament.',
    bet_question: 'Will FIFA CWC set attendance record?',
    tags: ['#Sports', '#FIFA', '#Soccer'],
    initial_yes_odds: 0.55,
    volatility: 'low',
  },
  {
    category: 'sports',
    ticker_prefix: 'SPORT',
    title: 'NBA 2026 Finals Goes to Game 7',
    description: 'The 2026 NBA Finals goes to a deciding Game 7.',
    bet_question: 'Will NBA Finals go to Game 7?',
    tags: ['#Sports', '#NBA', '#Basketball'],
    initial_yes_odds: 0.30,
    volatility: 'medium',
  },
  {
    category: 'sports',
    ticker_prefix: 'SPORT',
    title: 'F1 Team Change Wins Constructor Championship',
    description: 'A team that changed constructors wins the 2026 F1 championship.',
    bet_question: 'Will a constructor-change team win F1?',
    tags: ['#Sports', '#F1', '#Racing'],
    initial_yes_odds: 0.35,
    volatility: 'medium',
  },

  // Economics
  {
    category: 'economics',
    ticker_prefix: 'ECON',
    title: 'Fed Cuts Rates Below 3% by Q3 2026',
    description: 'Federal Reserve cuts federal funds rate below 3% before October 2026.',
    bet_question: 'Will Fed rate fall below 3% by Q3?',
    tags: ['#Economics', '#Fed', '#Rates'],
    initial_yes_odds: 0.40,
    volatility: 'medium',
  },
  {
    category: 'economics',
    ticker_prefix: 'ECON',
    title: 'US Recession Officially Declared in 2026',
    description: 'NBER officially declares a US recession beginning in 2026.',
    bet_question: 'Will US enter recession in 2026?',
    tags: ['#Economics', '#Recession', '#GDP'],
    initial_yes_odds: 0.25,
    volatility: 'high',
  },
  {
    category: 'economics',
    ticker_prefix: 'ECON',
    title: 'S&P 500 Closes Above 7000',
    description: 'S&P 500 index closes above 7,000 at any point in 2026.',
    bet_question: 'Will S&P 500 break 7000?',
    tags: ['#Economics', '#SP500', '#Markets'],
    initial_yes_odds: 0.48,
    volatility: 'medium',
  },
  {
    category: 'economics',
    ticker_prefix: 'ECON',
    title: 'Oil Price Drops Below $50/barrel',
    description: 'WTI crude oil falls below $50 per barrel at any point in 2026.',
    bet_question: 'Will oil drop below $50?',
    tags: ['#Economics', '#Oil', '#Commodities'],
    initial_yes_odds: 0.20,
    volatility: 'medium',
  },

  // Health & Science
  {
    category: 'health',
    ticker_prefix: 'HLTH',
    title: 'WHO Declares New Health Emergency',
    description: 'WHO declares a Public Health Emergency of International Concern in 2026.',
    bet_question: 'Will WHO declare a PHEIC in 2026?',
    tags: ['#Health', '#WHO', '#Pandemic'],
    initial_yes_odds: 0.22,
    volatility: 'high',
  },
  {
    category: 'health',
    ticker_prefix: 'HLTH',
    title: 'FDA Approves GLP-1 for New Indication',
    description: 'FDA approves a GLP-1 drug (Ozempic-class) for a new non-diabetes indication.',
    bet_question: 'Will GLP-1 get new FDA approval?',
    tags: ['#Health', '#FDA', '#Pharma'],
    initial_yes_odds: 0.65,
    volatility: 'low',
  },
  {
    category: 'science',
    ticker_prefix: 'SCI',
    title: 'SpaceX Starship Reaches Orbit',
    description: 'SpaceX Starship successfully completes full orbital flight and controlled reentry.',
    bet_question: 'Will Starship complete orbital flight?',
    tags: ['#Science', '#SpaceX', '#Space'],
    initial_yes_odds: 0.72,
    volatility: 'medium',
  },
];

// ============================================================================
// SEEDER SERVICE
// ============================================================================

export class MarketSeeder {
  private eventBus: EventBus;
  private seededMarkets: Market[] = [];
  private hasSeeded = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Seed markets on startup
   */
  async seed(): Promise<Market[]> {
    if (this.hasSeeded) {
      console.log('[MarketSeeder] Already seeded, returning cached markets');
      return this.seededMarkets;
    }

    console.log(`[MarketSeeder] Seeding ${MARKET_TEMPLATES.length} markets...`);

    for (const template of MARKET_TEMPLATES) {
      const market = this.createMarketFromTemplate(template);
      this.seededMarkets.push(market);
      
      // Emit event for other systems to pick up
      this.eventBus.publish('markets.seeded', market);
    }

    this.hasSeeded = true;
    console.log(`[MarketSeeder] Seeded ${this.seededMarkets.length} markets`);

    return this.seededMarkets;
  }

  /**
   * Create market from template
   */
  private createMarketFromTemplate(template: MarketTemplate): Market {
    const now = new Date();
    const daysToClose = template.volatility === 'high' ? 7 : 
                        template.volatility === 'medium' ? 14 : 30;
    const closesAt = new Date(now.getTime() + daysToClose * 24 * 60 * 60 * 1000);
    const resolvesAt = new Date(closesAt.getTime() + 60 * 60 * 1000);

    const ticker = this.generateTicker(template);

    // Generate realistic volume based on odds
    const baseVolume = template.volatility === 'high' ? 100000 :
                       template.volatility === 'medium' ? 50000 : 25000;
    const volumeYes = Math.floor(baseVolume * template.initial_yes_odds * (0.8 + Math.random() * 0.4));
    const volumeNo = Math.floor(baseVolume * (1 - template.initial_yes_odds) * (0.8 + Math.random() * 0.4));

    const resolutionSchema: HttpJsonResolutionSchema = {
      type: 'http_json',
      source_url: `https://oracle.truthnet.io/v1/resolve/${ticker.toLowerCase()}`,
      method: 'GET',
      json_path: '$.outcome',
      condition: { operator: 'eq', value: true },
    };

    return {
      id: uuidv4(),
      ticker,
      title: template.bet_question,
      description: `**${template.title}**\n\n${template.description}\n\n**Category:** ${template.category}\n**Volatility:** ${template.volatility}`,
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
      open_interest: Math.floor((volumeYes + volumeNo) * 0.3),
      category: template.category,
      tags: template.tags,
      metadata: {
        seeded: true,
        initial_yes_odds: template.initial_yes_odds,
        volatility: template.volatility,
        template_title: template.title,
      },
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Generate ticker
   */
  private generateTicker(template: MarketTemplate): string {
    const date = new Date().toISOString().slice(5, 10).replace('-', '');
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${template.ticker_prefix}-${date}-${rand}`;
  }

  /**
   * Get seeded markets
   */
  getMarkets(): Market[] {
    return this.seededMarkets;
  }

  /**
   * Get market by ID
   */
  getMarket(id: string): Market | undefined {
    return this.seededMarkets.find(m => m.id === id);
  }

  /**
   * Get markets by category
   */
  getByCategory(category: string): Market[] {
    return this.seededMarkets.filter(m => m.category === category);
  }

  /**
   * Check if seeded
   */
  isSeeded(): boolean {
    return this.hasSeeded;
  }

  /**
   * Get stats
   */
  getStats() {
    const byCategory: Record<string, number> = {};
    for (const m of this.seededMarkets) {
      byCategory[m.category || 'unknown'] = (byCategory[m.category || 'unknown'] || 0) + 1;
    }

    return {
      total: this.seededMarkets.length,
      byCategory,
      totalVolume: this.seededMarkets.reduce((a, m) => a + (m.volume_yes || 0) + (m.volume_no || 0), 0),
    };
  }
}

// Singleton instance
let seederInstance: MarketSeeder | null = null;

export function getMarketSeeder(eventBus: EventBus): MarketSeeder {
  if (!seederInstance) {
    seederInstance = new MarketSeeder(eventBus);
  }
  return seederInstance;
}
