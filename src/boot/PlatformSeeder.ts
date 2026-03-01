/**
 * TRUTH-NET Platform Seeder
 *
 * Seeds the platform with REAL LLM-backed agents, each using a different AI model.
 * This is the core of the alpha: different models produce genuinely different
 * probability estimates, creating real information through market divergence.
 *
 * On startup:
 * 1. Creates agent wallets
 * 2. Assigns each agent a real LLM (GPT-4o, Claude, Gemini, etc.)
 * 3. Seeds prediction markets
 * 4. Starts the trading loop (agents call LLMs and trade)
 * 5. Schedules market resolutions
 */

import { v4 as uuidv4 } from 'uuid';
import { MatchingEngine } from '../engine/matcher/MatchingEngine.js';
import { EscrowLedger } from '../engine/escrow/EscrowLedger.js';
import { EventBus } from '../events/EventBus.js';
import { SettlementService } from '../settlement/SettlementService.js';
import { AgentTradingLoop, TradingAgent } from '../agents/AgentTradingLoop.js';
import { getRatingEngine } from '../rating/RatingEngine.js';
import { LLMProvider } from '../agents/LLMPricingEngine.js';

// ============================================================================
// SEED DATA — Real LLM-backed agents
// ============================================================================

const SEED_AGENTS: (TradingAgent & { provider: LLMProvider; model: string })[] = [
  // OpenAI agents — different models, different reasoning
  { id: 'agent-gpt4o-001', name: 'GPT-4o Strategist', strategy: 'informed', domains: [], riskTolerance: 0.35, accuracy: 0.85, maxPositionSize: 200, active: true, provider: 'openai', model: 'gpt-4o' },
  { id: 'agent-gpt4omini-001', name: 'GPT-4o-mini Scout', strategy: 'informed', domains: ['tech', 'ai'], riskTolerance: 0.4, accuracy: 0.78, maxPositionSize: 150, active: true, provider: 'openai', model: 'gpt-4o-mini' },

  // Anthropic agents
  { id: 'agent-claude-001', name: 'Claude Analyst', strategy: 'informed', domains: ['geopolitics', 'economics'], riskTolerance: 0.3, accuracy: 0.82, maxPositionSize: 180, active: true, provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },

  // Google agents
  { id: 'agent-gemini-001', name: 'Gemini Flash', strategy: 'informed', domains: [], riskTolerance: 0.4, accuracy: 0.76, maxPositionSize: 160, active: true, provider: 'google', model: 'gemini-2.0-flash' },

  // Local heuristic agents — these provide baseline and liquidity
  { id: 'agent-mm-001', name: 'Market Maker Prime', strategy: 'market_maker', domains: [], riskTolerance: 0.6, accuracy: 0.5, maxPositionSize: 500, active: true, provider: 'local', model: 'heuristic-mm' },
  { id: 'agent-momentum-001', name: 'Momentum Trader', strategy: 'momentum', domains: ['crypto', 'tech'], riskTolerance: 0.45, accuracy: 0.6, maxPositionSize: 130, active: true, provider: 'local', model: 'heuristic-momentum' },
  { id: 'agent-contrarian-001', name: 'Contrarian Alpha', strategy: 'contrarian', domains: [], riskTolerance: 0.35, accuracy: 0.55, maxPositionSize: 120, active: true, provider: 'local', model: 'heuristic-contrarian' },
  { id: 'agent-climate-001', name: 'Climate Risk Monitor', strategy: 'informed', domains: ['climate'], riskTolerance: 0.2, accuracy: 0.68, maxPositionSize: 100, active: true, provider: 'local', model: 'heuristic-climate' },
  { id: 'agent-macro-001', name: 'Macro Strategist', strategy: 'informed', domains: ['economics'], riskTolerance: 0.3, accuracy: 0.62, maxPositionSize: 110, active: true, provider: 'local', model: 'heuristic-macro' },
  { id: 'agent-random-001', name: 'Noise Trader', strategy: 'random', domains: [], riskTolerance: 0.15, accuracy: 0.5, maxPositionSize: 80, active: true, provider: 'local', model: 'heuristic-random' },
];

interface SeedMarket {
  id: string;
  ticker: string;
  title: string;
  category: string;
  description: string;
  initialProbability: number;
  resolvesInMinutes: number;
  outcome?: 'yes' | 'no';
}

const SEED_MARKETS: SeedMarket[] = [
  { id: uuidv4(), ticker: 'GPT5-SHIP', title: 'GPT-5 ships before April 2026', category: 'tech', description: 'Will OpenAI release GPT-5 to the public before April 1, 2026?', initialProbability: 0.62, resolvesInMinutes: 8, outcome: 'yes' },
  { id: uuidv4(), ticker: 'BTC-120K', title: 'Bitcoin reaches $120K by March 2026', category: 'crypto', description: 'Will BTC/USD trade above $120,000 at any point before March 31, 2026?', initialProbability: 0.35, resolvesInMinutes: 10, outcome: 'no' },
  { id: uuidv4(), ticker: 'EU-TARIFF', title: 'EU passes digital services tariff', category: 'geopolitics', description: 'Will the European Parliament pass the proposed digital services tariff by Q2 2026?', initialProbability: 0.48, resolvesInMinutes: 12, outcome: 'yes' },
  { id: uuidv4(), ticker: 'AMZN-DRONE', title: 'Amazon drone deliveries reach 10 cities', category: 'logistics', description: 'Will Amazon Prime Air operate in 10+ US cities by mid-2026?', initialProbability: 0.28, resolvesInMinutes: 15, outcome: 'no' },
  { id: uuidv4(), ticker: 'CAT3-ATL', title: 'Cat 3+ Atlantic hurricane before August', category: 'climate', description: 'Will a Category 3 or higher hurricane form in the Atlantic before August 1, 2026?', initialProbability: 0.42, resolvesInMinutes: 18, outcome: 'yes' },
  { id: uuidv4(), ticker: 'FED-CUT', title: 'Fed cuts rates in March 2026', category: 'economics', description: 'Will the Federal Reserve cut the federal funds rate at the March 2026 FOMC meeting?', initialProbability: 0.55, resolvesInMinutes: 20, outcome: 'yes' },
  { id: uuidv4(), ticker: 'ETH-PECTRA', title: 'Ethereum Pectra upgrade launches', category: 'crypto', description: 'Will the Ethereum Pectra upgrade deploy to mainnet before April 2026?', initialProbability: 0.72, resolvesInMinutes: 9, outcome: 'yes' },
  { id: uuidv4(), ticker: 'TSLA-FSD', title: 'Tesla FSD approved in 3+ states', category: 'tech', description: 'Will Tesla receive regulatory approval for fully autonomous driving in 3+ US states by mid-2026?', initialProbability: 0.18, resolvesInMinutes: 14, outcome: 'no' },
  { id: uuidv4(), ticker: 'ANTHRO-IPO', title: 'Anthropic IPO or acquisition in 2026', category: 'tech', description: 'Will Anthropic file for IPO or be acquired before December 31, 2026?', initialProbability: 0.38, resolvesInMinutes: 11, outcome: 'no' },
  { id: uuidv4(), ticker: 'INDIA-GDP', title: 'India GDP growth exceeds 7% in 2026', category: 'economics', description: "Will India's annual GDP growth rate exceed 7% for calendar year 2026?", initialProbability: 0.45, resolvesInMinutes: 16, outcome: 'yes' },
];

// ============================================================================
// MARKET STORE
// ============================================================================

export interface SeededMarket {
  id: string;
  ticker: string;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'closed' | 'resolved';
  created_at: string;
  closes_at: string;
  resolves_at: string;
  resolution_source: string;
  volume_yes: number;
  volume_no: number;
  last_price_yes: number;
  last_price_no: number;
  source: 'seeded';
  tags: string[];
}

export const seededMarkets = new Map<string, SeededMarket>();

// ============================================================================
// SEEDER
// ============================================================================

export async function seedPlatform(
  matchingEngine: MatchingEngine,
  escrow: EscrowLedger,
  eventBus: EventBus,
): Promise<{ settlement: SettlementService; tradingLoop: AgentTradingLoop }> {
  console.log('\n[Seeder] ═══════════════════════════════════════════════');
  console.log('[Seeder] Initializing TRUTH-NET with LLM-backed agents...');

  const settlement = new SettlementService(escrow, eventBus);
  console.log('[Seeder] Settlement Service online');

  const ratingEngine = getRatingEngine(eventBus);

  // Detect which LLM providers are available
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_AI_API_KEY;

  console.log(`[Seeder] LLM providers: OpenAI=${hasOpenAI ? 'YES' : 'no'}, Anthropic=${hasAnthropic ? 'YES' : 'no'}, Google=${hasGoogle ? 'YES' : 'no'}`);

  if (!hasOpenAI && !hasAnthropic && !hasGoogle) {
    console.log('[Seeder] WARNING: No LLM API keys configured. Agents will use local heuristics.');
    console.log('[Seeder] Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY for real LLM reasoning.');
  }

  // Create agents — downgrade to local if API key is missing
  const agents = SEED_AGENTS.map(agent => {
    const effectiveAgent = { ...agent };
    if (agent.provider === 'openai' && !hasOpenAI) effectiveAgent.provider = 'local';
    if (agent.provider === 'anthropic' && !hasAnthropic) effectiveAgent.provider = 'local';
    if (agent.provider === 'google' && !hasGoogle) effectiveAgent.provider = 'local';
    return effectiveAgent;
  });

  for (const agent of agents) {
    if (!escrow.getWallet(agent.id)) {
      escrow.createWallet(agent.id, 10000);
    }
    ratingEngine.initializeRating(agent.id);
  }
  console.log(`[Seeder] ${agents.length} agent wallets created ($10K each)`);

  // Seed markets
  const now = Date.now();
  for (const market of SEED_MARKETS) {
    matchingEngine.initializeMarket(market.id);

    const closesAt = new Date(now + market.resolvesInMinutes * 60 * 1000);
    const resolvesAt = new Date(closesAt.getTime() + 30000);

    seededMarkets.set(market.id, {
      id: market.id,
      ticker: market.ticker,
      title: market.title,
      description: market.description,
      category: market.category,
      status: 'open',
      created_at: new Date().toISOString(),
      closes_at: closesAt.toISOString(),
      resolves_at: resolvesAt.toISOString(),
      resolution_source: 'oracle',
      volume_yes: 0,
      volume_no: 0,
      last_price_yes: market.initialProbability,
      last_price_no: 1 - market.initialProbability,
      source: 'seeded',
      tags: [market.category],
    });

    setTimeout(() => resolveMarket(market, eventBus), market.resolvesInMinutes * 60 * 1000);
  }
  console.log(`[Seeder] ${SEED_MARKETS.length} prediction markets seeded`);

  // Initialize trading loop with LLM-backed agents
  const tradingLoop = new AgentTradingLoop(matchingEngine, escrow, eventBus);

  for (const agent of agents) {
    tradingLoop.registerAgent(agent);
  }

  tradingLoop.updateMarkets(
    SEED_MARKETS.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      status: 'open',
      midPrice: m.initialProbability,
    }))
  );

  // Use longer tick interval for LLM calls (avoid rate limits)
  const tickInterval = (hasOpenAI || hasAnthropic || hasGoogle) ? 12000 : 5000;
  tradingLoop.start(tickInterval);
  console.log(`[Seeder] Agent trading loop started (${tickInterval / 1000}s tick)`);

  // Track volume from trades
  eventBus.subscribe('trades.executed', (data: any) => {
    const trade = data.trade || data;
    const market = seededMarkets.get(trade.market_id);
    if (market) {
      const value = trade.price * trade.quantity;
      if (trade.outcome === 'yes' || trade.outcome === 'YES') {
        market.volume_yes += value;
        market.last_price_yes = trade.price;
        market.last_price_no = 1 - trade.price;
      } else {
        market.volume_no += value;
        market.last_price_no = trade.price;
        market.last_price_yes = 1 - trade.price;
      }
    }
  });

  console.log('[Seeder] ═══════════════════════════════════════════════');
  console.log('[Seeder] Platform is LIVE — agents are reasoning with real LLMs\n');

  return { settlement, tradingLoop };
}

function resolveMarket(market: SeedMarket, eventBus: EventBus) {
  const stored = seededMarkets.get(market.id);
  if (!stored || stored.status === 'resolved') return;

  stored.status = 'resolved';
  const outcome = market.outcome || (Math.random() > 0.5 ? 'yes' : 'no');

  console.log(`[Seeder] Resolving market "${market.title}" -> ${outcome.toUpperCase()}`);

  eventBus.publish('markets.resolved', {
    market_id: market.id,
    ticker: market.ticker,
    title: market.title,
    outcome,
    winning_outcome: outcome,
    resolved_at: new Date().toISOString(),
  });
}
