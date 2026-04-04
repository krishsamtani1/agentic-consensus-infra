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
 * 6. Regenerates new markets as old ones resolve (perpetual activity)
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
// SEED AGENTS — Real LLM-backed agents with differentiated personalities
// ============================================================================

const SEED_AGENTS: (TradingAgent & { provider: LLMProvider; model: string })[] = [
  {
    id: 'agent-gpt4o-001', name: 'GPT-4o Strategist', strategy: 'informed', domains: [],
    riskTolerance: 0.35, accuracy: 0.85, maxPositionSize: 200, active: true,
    provider: 'openai', model: 'gpt-4o',
    systemPrompt: 'You are a senior quantitative strategist. You specialize in identifying mispricings through rigorous statistical analysis. You consider base rates, reference classes, and confidence intervals. You are well-calibrated and rarely confident above 0.85.',
  },
  {
    id: 'agent-gpt4omini-001', name: 'GPT-4o-mini Scout', strategy: 'informed', domains: ['tech', 'science', 'crypto', 'entertainment'],
    riskTolerance: 0.4, accuracy: 0.78, maxPositionSize: 150, active: true,
    provider: 'openai', model: 'gpt-4o-mini',
    systemPrompt: 'You are a fast-moving research scout optimized for breadth over depth. You scan for informational edges across technology, science, and digital assets. You trade on momentum signals and news flow, accepting lower confidence for faster positioning.',
  },
  {
    id: 'agent-claude-001', name: 'Claude Analyst', strategy: 'informed', domains: ['geopolitics', 'economics', 'legal', 'health'],
    riskTolerance: 0.3, accuracy: 0.82, maxPositionSize: 180, active: true,
    provider: 'anthropic', model: 'claude-3-5-haiku-20241022',
    systemPrompt: 'You are a geopolitical risk analyst with deep expertise in international relations, regulatory frameworks, and macroeconomic policy. You weight institutional constraints heavily and are skeptical of dramatic outcomes. You think in scenarios and assign probabilities to each.',
  },
  {
    id: 'agent-gemini-001', name: 'Gemini Flash', strategy: 'informed', domains: ['tech', 'science', 'crypto', 'entertainment'],
    riskTolerance: 0.4, accuracy: 0.76, maxPositionSize: 160, active: true,
    provider: 'google', model: 'gemini-2.0-flash',
    systemPrompt: 'You are a multimodal research analyst who synthesizes information from diverse sources. You excel at pattern recognition across technology, scientific breakthroughs, and cultural trends. You maintain a slight contrarian edge and question consensus narratives.',
  },
  {
    id: 'agent-mm-001', name: 'Market Maker Prime', strategy: 'market_maker', domains: [],
    riskTolerance: 0.6, accuracy: 0.5, maxPositionSize: 500, active: true,
    provider: 'local', model: 'heuristic-mm',
    systemPrompt: 'You are a market maker. Your job is to provide liquidity by quoting both sides. You target tight spreads around fair value and adjust based on order flow. You are risk-neutral and profit from the bid-ask spread, not directional bets.',
  },
  {
    id: 'agent-momentum-001', name: 'Momentum Trader', strategy: 'momentum', domains: ['crypto', 'tech', 'sports', 'entertainment'],
    riskTolerance: 0.45, accuracy: 0.6, maxPositionSize: 130, active: true,
    provider: 'local', model: 'heuristic-momentum',
    systemPrompt: 'You are a momentum-driven trader who follows price trends and market sentiment. You believe markets trend and that recent price action contains information. You enter positions in the direction of prevailing moves and use tight stops.',
  },
  {
    id: 'agent-contrarian-001', name: 'Contrarian Alpha', strategy: 'contrarian', domains: [],
    riskTolerance: 0.35, accuracy: 0.55, maxPositionSize: 120, active: true,
    provider: 'local', model: 'heuristic-contrarian',
    systemPrompt: 'You are a contrarian value investor who profits from crowd overreaction. You systematically fade extreme moves and buy when others panic. You believe markets overshoot in both directions and revert to fundamental value.',
  },
  {
    id: 'agent-climate-001', name: 'Climate Risk Monitor', strategy: 'informed', domains: ['climate', 'science', 'health', 'economics'],
    riskTolerance: 0.2, accuracy: 0.68, maxPositionSize: 100, active: true,
    provider: 'local', model: 'heuristic-climate',
    systemPrompt: 'You are an environmental and public health risk analyst. You specialize in climate modeling, epidemiological trends, and regulatory responses to systemic risks. You have a cautious disposition and tend to assign higher probabilities to tail risks than consensus.',
  },
  {
    id: 'agent-macro-001', name: 'Macro Strategist', strategy: 'informed', domains: ['economics', 'geopolitics', 'crypto', 'legal'],
    riskTolerance: 0.3, accuracy: 0.62, maxPositionSize: 110, active: true,
    provider: 'local', model: 'heuristic-macro',
    systemPrompt: 'You are a global macro strategist who trades based on central bank policy, fiscal dynamics, and cross-asset correlations. You weight institutional signaling heavily and believe that policy announcements are the strongest leading indicators.',
  },
  {
    id: 'agent-random-001', name: 'Noise Trader', strategy: 'random', domains: [],
    riskTolerance: 0.15, accuracy: 0.5, maxPositionSize: 80, active: true,
    provider: 'local', model: 'heuristic-random',
    systemPrompt: 'You are a noise trader who adds liquidity through semi-random activity. You occasionally stumble on correct positions by accident. Your role in the ecosystem is to provide baseline volume and prevent thin markets from stalling.',
  },
];

// ============================================================================
// SEED MARKETS — 28 diverse markets across 10 categories
// ============================================================================

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
  // --- Technology (3) ---
  { id: uuidv4(), ticker: 'GPT5-SHIP', title: 'GPT-5 ships before May 2026', category: 'tech', description: 'Will OpenAI release GPT-5 to the public before May 1, 2026?', initialProbability: 0.62, resolvesInMinutes: 8, outcome: 'yes' },
  { id: uuidv4(), ticker: 'TSLA-FSD', title: 'Tesla FSD approved in 3+ US states by mid-2026', category: 'tech', description: 'Will Tesla receive regulatory approval for fully autonomous driving in 3+ US states by July 1, 2026?', initialProbability: 0.18, resolvesInMinutes: 22, outcome: 'no' },
  { id: uuidv4(), ticker: 'ANTHRO-IPO', title: 'Anthropic IPO or acquisition in 2026', category: 'tech', description: 'Will Anthropic file for an IPO or be acquired before December 31, 2026?', initialProbability: 0.38, resolvesInMinutes: 30, outcome: 'no' },

  // --- Crypto (3) ---
  { id: uuidv4(), ticker: 'BTC-120K', title: 'Bitcoin reaches $120K before July 2026', category: 'crypto', description: 'Will BTC/USD trade above $120,000 at any point before July 1, 2026?', initialProbability: 0.35, resolvesInMinutes: 12 },
  { id: uuidv4(), ticker: 'ETH-PECTRA', title: 'Ethereum Pectra upgrade launches on mainnet', category: 'crypto', description: 'Will the Ethereum Pectra upgrade deploy to mainnet before June 2026?', initialProbability: 0.72, resolvesInMinutes: 9, outcome: 'yes' },
  { id: uuidv4(), ticker: 'SOL-ETF', title: 'Solana spot ETF approved by SEC in 2026', category: 'crypto', description: 'Will the SEC approve a spot Solana ETF before December 31, 2026?', initialProbability: 0.29, resolvesInMinutes: 35 },

  // --- Geopolitics (3) ---
  { id: uuidv4(), ticker: 'EU-TARIFF', title: 'EU passes digital services tariff by Q3 2026', category: 'geopolitics', description: 'Will the European Parliament pass the proposed digital services tariff by September 30, 2026?', initialProbability: 0.48, resolvesInMinutes: 15, outcome: 'yes' },
  { id: uuidv4(), ticker: 'UA-CEASE', title: 'Ukraine-Russia ceasefire agreement before 2027', category: 'geopolitics', description: 'Will Ukraine and Russia sign a formal ceasefire or peace agreement before January 1, 2027?', initialProbability: 0.22, resolvesInMinutes: 33 },
  { id: uuidv4(), ticker: 'TAIWAN-DRILL', title: 'China conducts large-scale Taiwan Strait military drills in 2026', category: 'geopolitics', description: 'Will China conduct military exercises in the Taiwan Strait involving 50+ naval vessels before December 31, 2026?', initialProbability: 0.41, resolvesInMinutes: 38 },

  // --- Economics (3) ---
  { id: uuidv4(), ticker: 'FED-CUT', title: 'Fed cuts rates at June 2026 FOMC meeting', category: 'economics', description: 'Will the Federal Reserve cut the federal funds rate at the June 2026 FOMC meeting?', initialProbability: 0.55, resolvesInMinutes: 20, outcome: 'yes' },
  { id: uuidv4(), ticker: 'INDIA-GDP', title: 'India GDP growth exceeds 7% in 2026', category: 'economics', description: "Will India's annual GDP growth rate exceed 7% for calendar year 2026?", initialProbability: 0.45, resolvesInMinutes: 28, outcome: 'yes' },
  { id: uuidv4(), ticker: 'US-UNEMP', title: 'US unemployment rises above 4.5% by Q3 2026', category: 'economics', description: 'Will the US unemployment rate (U-3) exceed 4.5% in any month before October 1, 2026?', initialProbability: 0.32, resolvesInMinutes: 40 },

  // --- Climate (2) ---
  { id: uuidv4(), ticker: 'CAT3-ATL', title: 'Cat 3+ Atlantic hurricane before August 2026', category: 'climate', description: 'Will a Category 3 or higher hurricane form in the Atlantic before August 1, 2026?', initialProbability: 0.42, resolvesInMinutes: 18, outcome: 'yes' },
  { id: uuidv4(), ticker: 'GLOBAL-TEMP', title: '2026 confirmed as hottest year on record', category: 'climate', description: 'Will 2026 be confirmed as the hottest year on record by NASA/NOAA?', initialProbability: 0.58, resolvesInMinutes: 42 },

  // --- Science (3) ---
  { id: uuidv4(), ticker: 'ARTMS-3', title: 'Artemis III crewed Moon landing in 2026', category: 'science', description: 'Will NASA successfully land astronauts on the Moon via Artemis III before December 31, 2026?', initialProbability: 0.15, resolvesInMinutes: 25, outcome: 'no' },
  { id: uuidv4(), ticker: 'CRISPR-SICK', title: 'FDA approves second CRISPR-based therapy', category: 'science', description: 'Will the FDA approve a second CRISPR-based gene therapy (beyond Casgevy) before December 31, 2026?', initialProbability: 0.44, resolvesInMinutes: 36 },
  { id: uuidv4(), ticker: 'FUSION-NET', title: 'Fusion reactor achieves net energy gain >2x', category: 'science', description: 'Will any fusion reactor demonstrate sustained net energy gain exceeding 2x input energy before 2027?', initialProbability: 0.12, resolvesInMinutes: 44 },

  // --- Sports (2) ---
  { id: uuidv4(), ticker: 'WC-CHAMP', title: 'Brazil wins 2026 FIFA World Cup', category: 'sports', description: 'Will Brazil win the 2026 FIFA World Cup?', initialProbability: 0.14, resolvesInMinutes: 17 },
  { id: uuidv4(), ticker: 'NBA-CELTS', title: 'Celtics repeat as NBA champions in 2025-26', category: 'sports', description: 'Will the Boston Celtics win the 2025-26 NBA Championship?', initialProbability: 0.22, resolvesInMinutes: 27 },

  // --- Entertainment (2) ---
  { id: uuidv4(), ticker: 'AVATAR-3B', title: 'Avatar 3 exceeds $2B global box office', category: 'entertainment', description: 'Will Avatar: Fire and Ash gross more than $2 billion worldwide in its theatrical run?', initialProbability: 0.48, resolvesInMinutes: 14 },
  { id: uuidv4(), ticker: 'NFLX-350M', title: 'Netflix reaches 350M global subscribers by Q3 2026', category: 'entertainment', description: 'Will Netflix report more than 350 million paid subscribers in any quarter before October 2026?', initialProbability: 0.53, resolvesInMinutes: 32 },

  // --- Health (3) ---
  { id: uuidv4(), ticker: 'H5N1-PAN', title: 'WHO declares H5N1 pandemic by end of 2026', category: 'health', description: 'Will the WHO declare an H5N1 avian influenza pandemic before January 1, 2027?', initialProbability: 0.09, resolvesInMinutes: 37, outcome: 'no' },
  { id: uuidv4(), ticker: 'GLP1-OTC', title: 'FDA approves OTC GLP-1 weight-loss pill', category: 'health', description: 'Will the FDA approve an over-the-counter GLP-1 receptor agonist for weight loss before 2027?', initialProbability: 0.11, resolvesInMinutes: 43, outcome: 'no' },
  { id: uuidv4(), ticker: 'ALZH-DRUG', title: 'New Alzheimer\'s drug shows >30% cognitive decline reduction', category: 'health', description: 'Will a Phase 3 trial report results showing >30% reduction in cognitive decline for a new Alzheimer\'s drug in 2026?', initialProbability: 0.26, resolvesInMinutes: 29 },

  // --- Legal (3) ---
  { id: uuidv4(), ticker: 'GOOG-ANTI', title: 'Google found liable in DOJ antitrust remedy trial', category: 'legal', description: 'Will the court impose structural remedies (e.g., forced divestiture) on Google in the DOJ antitrust case before 2027?', initialProbability: 0.35, resolvesInMinutes: 23, outcome: 'no' },
  { id: uuidv4(), ticker: 'EU-AI-ACT', title: 'EU AI Act first enforcement actions by Q4 2026', category: 'legal', description: 'Will EU regulators issue their first formal enforcement actions under the AI Act before January 1, 2027?', initialProbability: 0.62, resolvesInMinutes: 34, outcome: 'yes' },
  { id: uuidv4(), ticker: 'TIKTOK-BAN', title: 'TikTok ban enforced or divested in US by end 2026', category: 'legal', description: 'Will TikTok be banned or forced to divest US operations before December 31, 2026?', initialProbability: 0.40, resolvesInMinutes: 19 },
];

// ============================================================================
// REGENERATION MARKETS — Pool for perpetual market creation after resolutions
// ============================================================================

interface MarketTemplate {
  ticker: string;
  title: string;
  category: string;
  description: string;
  initialProbability: number;
  resolvesInMinutes: number;
  outcome?: 'yes' | 'no';
}

const REGENERATION_MARKETS: MarketTemplate[] = [
  // Technology
  { ticker: 'APPL-VIS2', title: 'Apple announces Vision Pro 2 before WWDC 2027', category: 'tech', description: 'Will Apple announce a second-generation Vision Pro headset before WWDC 2027?', initialProbability: 0.58, resolvesInMinutes: 12 },
  { ticker: 'NVDA-B300', title: 'NVIDIA announces Blackwell B300 GPU by Q4 2026', category: 'tech', description: 'Will NVIDIA announce the B300 series GPU before December 31, 2026?', initialProbability: 0.65, resolvesInMinutes: 18 },
  { ticker: 'META-AGI', title: 'Meta claims AGI milestone in 2026', category: 'tech', description: 'Will Meta publicly claim to have achieved an AGI milestone before January 1, 2027?', initialProbability: 0.21, resolvesInMinutes: 24 },
  { ticker: 'MSFT-NT', title: 'Microsoft ships "New Teams" AI agent platform', category: 'tech', description: 'Will Microsoft launch an AI agent platform integrated into Teams before Q4 2026?', initialProbability: 0.61, resolvesInMinutes: 14 },

  // Crypto
  { ticker: 'ETH-6K', title: 'Ethereum exceeds $6,000 before Q4 2026', category: 'crypto', description: 'Will ETH/USD trade above $6,000 at any point before October 1, 2026?', initialProbability: 0.31, resolvesInMinutes: 16 },
  { ticker: 'BTC-150K', title: 'Bitcoin reaches $150K before 2027', category: 'crypto', description: 'Will BTC/USD trade above $150,000 at any point before January 1, 2027?', initialProbability: 0.18, resolvesInMinutes: 28 },
  { ticker: 'CBDC-US', title: 'US announces digital dollar pilot program in 2026', category: 'crypto', description: 'Will the Federal Reserve or US Treasury announce a CBDC pilot program before 2027?', initialProbability: 0.13, resolvesInMinutes: 20, outcome: 'no' },
  { ticker: 'DOGE-ETF', title: 'Dogecoin ETF application filed in 2026', category: 'crypto', description: 'Will any major asset manager file a Dogecoin ETF application with the SEC before 2027?', initialProbability: 0.25, resolvesInMinutes: 22 },

  // Geopolitics
  { ticker: 'NATO-EXPAND', title: 'NATO admits new member state by end of 2026', category: 'geopolitics', description: 'Will NATO officially admit a new member state before January 1, 2027?', initialProbability: 0.18, resolvesInMinutes: 26 },
  { ticker: 'IRAN-DEAL', title: 'New Iran nuclear agreement reached in 2026', category: 'geopolitics', description: 'Will a new Iran nuclear deal be signed by any coalition of nations before 2027?', initialProbability: 0.10, resolvesInMinutes: 38, outcome: 'no' },
  { ticker: 'BRICS-CUR', title: 'BRICS announces common trade currency framework', category: 'geopolitics', description: 'Will BRICS announce a formal framework for a common trade settlement currency before 2027?', initialProbability: 0.16, resolvesInMinutes: 32 },

  // Economics
  { ticker: 'SP500-6K', title: 'S&P 500 closes above 6,500 before Q4 2026', category: 'economics', description: 'Will the S&P 500 close above 6,500 on any trading day before October 1, 2026?', initialProbability: 0.52, resolvesInMinutes: 10 },
  { ticker: 'OIL-90', title: 'Brent crude exceeds $90/barrel in Q3 2026', category: 'economics', description: 'Will Brent crude oil trade above $90 per barrel at any point in Q3 2026?', initialProbability: 0.33, resolvesInMinutes: 30 },
  { ticker: 'CN-STIM', title: 'China announces >$500B stimulus package', category: 'economics', description: 'Will China announce an economic stimulus package exceeding 3.5 trillion yuan before 2027?', initialProbability: 0.44, resolvesInMinutes: 19 },

  // Climate
  { ticker: 'ARCT-ICE', title: 'Arctic sea ice reaches new record low in 2026', category: 'climate', description: 'Will Arctic sea ice extent set a new all-time record low during the 2026 melt season?', initialProbability: 0.38, resolvesInMinutes: 25 },
  { ticker: 'EU-CARB60', title: 'EU carbon price exceeds €60/ton in 2026', category: 'climate', description: 'Will EU ETS carbon permits trade above €60 per ton at any point before 2027?', initialProbability: 0.55, resolvesInMinutes: 21 },
  { ticker: 'US-EV-50', title: 'US EV market share exceeds 15% of new car sales in any 2026 quarter', category: 'climate', description: 'Will electric vehicles exceed 15% of new car sales in any quarter of 2026?', initialProbability: 0.60, resolvesInMinutes: 15 },

  // Science
  { ticker: 'JWST-BIO', title: 'JWST detects potential biosignature on exoplanet', category: 'science', description: 'Will the James Webb Space Telescope team announce a potential biosignature detection before 2027?', initialProbability: 0.08, resolvesInMinutes: 40 },
  { ticker: 'QUANTUM-1K', title: 'Quantum computer surpasses 1,000 logical qubits', category: 'science', description: 'Will any quantum computing company demonstrate a processor with >1,000 logical qubits before 2027?', initialProbability: 0.20, resolvesInMinutes: 34, outcome: 'no' },

  // Sports
  { ticker: 'MLB-HR', title: 'MLB home run record broken in 2026 season', category: 'sports', description: 'Will any player hit more than 73 home runs in the 2026 MLB regular season?', initialProbability: 0.03, resolvesInMinutes: 13, outcome: 'no' },
  { ticker: 'F1-MAX', title: 'Max Verstappen wins 2026 F1 championship', category: 'sports', description: 'Will Max Verstappen win the 2026 Formula 1 World Drivers\' Championship?', initialProbability: 0.32, resolvesInMinutes: 23 },
  { ticker: 'UFC-JONES', title: 'Jon Jones retires undefeated in 2026', category: 'sports', description: 'Will Jon Jones announce retirement without another loss before 2027?', initialProbability: 0.40, resolvesInMinutes: 17 },

  // Entertainment
  { ticker: 'GTA6-SHIP', title: 'GTA 6 ships before October 2026', category: 'entertainment', description: 'Will Grand Theft Auto VI be released to the public before October 1, 2026?', initialProbability: 0.55, resolvesInMinutes: 11 },
  { ticker: 'DSNY-STRM', title: 'Disney+ surpasses Netflix in global subscribers', category: 'entertainment', description: 'Will Disney+ (including Hulu bundle) surpass Netflix in total global subscribers before 2027?', initialProbability: 0.10, resolvesInMinutes: 27, outcome: 'no' },
  { ticker: 'SPOTIFY-1B', title: 'Spotify reaches 1 billion monthly active users', category: 'entertainment', description: 'Will Spotify report 1 billion or more monthly active users before 2027?', initialProbability: 0.22, resolvesInMinutes: 31 },

  // Health
  { ticker: 'MALARIA-VAX', title: 'Second malaria vaccine receives WHO prequalification', category: 'health', description: 'Will the WHO prequalify a second malaria vaccine (beyond RTS,S) before 2027?', initialProbability: 0.50, resolvesInMinutes: 35, outcome: 'yes' },
  { ticker: 'MRNA-CANC', title: 'mRNA cancer vaccine enters Phase 3 trials', category: 'health', description: 'Will an mRNA-based cancer vaccine begin Phase 3 clinical trials before 2027?', initialProbability: 0.56, resolvesInMinutes: 29 },

  // Legal
  { ticker: 'META-PRIV', title: 'Meta fined >$1B for privacy violations in 2026', category: 'legal', description: 'Will Meta receive a privacy-related fine exceeding $1 billion from any jurisdiction in 2026?', initialProbability: 0.30, resolvesInMinutes: 20 },
  { ticker: 'CRYPTO-REG', title: 'US passes comprehensive crypto regulatory framework', category: 'legal', description: 'Will the US Congress pass a comprehensive cryptocurrency regulatory bill before 2027?', initialProbability: 0.27, resolvesInMinutes: 36 },
  { ticker: 'APPL-SIDE', title: 'Apple forced to allow full sideloading in EU by Q4 2026', category: 'legal', description: 'Will Apple be required to enable unrestricted sideloading on iOS in the EU before January 1, 2027?', initialProbability: 0.45, resolvesInMinutes: 22 },
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

let _activeTradingLoop: AgentTradingLoop | null = null;

export function getActiveTradingLoop(): AgentTradingLoop | null {
  return _activeTradingLoop;
}

// ============================================================================
// MARKET REGENERATION — Keeps the platform perpetually alive
// ============================================================================

let regenPool = [...REGENERATION_MARKETS];
let regenMatchingEngine: MatchingEngine | null = null;
let regenEventBus: EventBus | null = null;
let regenTradingLoop: AgentTradingLoop | null = null;

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function spawnRegenerationMarket(category: string): void {
  if (!regenMatchingEngine || !regenEventBus || !regenTradingLoop) return;

  const candidates = regenPool.filter(m => m.category === category);
  if (candidates.length === 0) {
    // Refill pool when exhausted
    regenPool = [...REGENERATION_MARKETS];
    shuffleArray(regenPool);
  }

  const pickFrom = candidates.length > 0 ? candidates : regenPool;
  const idx = Math.floor(Math.random() * pickFrom.length);
  const template = pickFrom[idx];
  regenPool.splice(regenPool.indexOf(template), 1);

  const newMarket: SeedMarket = {
    id: uuidv4(),
    ticker: template.ticker,
    title: template.title,
    category: template.category,
    description: template.description,
    initialProbability: template.initialProbability,
    resolvesInMinutes: template.resolvesInMinutes,
    outcome: template.outcome,
  };

  regenMatchingEngine.initializeMarket(newMarket.id);
  const now = Date.now();
  const closesAt = new Date(now + newMarket.resolvesInMinutes * 60 * 1000);
  const resolvesAt = new Date(closesAt.getTime() + 30000);

  seededMarkets.set(newMarket.id, {
    id: newMarket.id,
    ticker: newMarket.ticker,
    title: newMarket.title,
    description: newMarket.description,
    category: newMarket.category,
    status: 'open',
    created_at: new Date().toISOString(),
    closes_at: closesAt.toISOString(),
    resolves_at: resolvesAt.toISOString(),
    resolution_source: 'oracle',
    volume_yes: 0,
    volume_no: 0,
    last_price_yes: newMarket.initialProbability,
    last_price_no: 1 - newMarket.initialProbability,
    source: 'seeded',
    tags: [newMarket.category],
  });

  // Update trading loop with the new active market set
  const openMarkets = Array.from(seededMarkets.values())
    .filter(m => m.status === 'open')
    .map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      status: m.status,
      midPrice: m.last_price_yes,
    }));
  regenTradingLoop.updateMarkets(openMarkets);

  setTimeout(() => resolveMarket(newMarket, regenEventBus!), newMarket.resolvesInMinutes * 60 * 1000);

  console.log(`[Seeder] Regenerated market: "${newMarket.title}" (${newMarket.category}) — resolves in ${newMarket.resolvesInMinutes}m`);
}

function scheduleMarketRegeneration(category: string): void {
  const delayMs = (2 + Math.random() * 3) * 60 * 1000; // 2-5 minutes
  setTimeout(() => spawnRegenerationMarket(category), delayMs);
}

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
  console.log(`[Seeder] ${SEED_MARKETS.length} prediction markets seeded across ${new Set(SEED_MARKETS.map(m => m.category)).size} categories`);

  // Initialize trading loop with LLM-backed agents
  const tradingLoop = new AgentTradingLoop(matchingEngine, escrow, eventBus);
  _activeTradingLoop = tradingLoop;

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

  // Store references for market regeneration
  regenMatchingEngine = matchingEngine;
  regenEventBus = eventBus;
  regenTradingLoop = tradingLoop;
  shuffleArray(regenPool);

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

  // Listen for user-created agents from the governance API and auto-register them
  eventBus.subscribe('agent.created', (data: any) => {
    const agent = data.agent || data;
    if (!agent?.id || tradingLoop.hasAgent(agent.id)) return;

    const newTradingAgent: TradingAgent = {
      id: agent.id,
      name: agent.name || agent.id,
      strategy: 'informed',
      domains: agent.trading_config?.allowed_topics || [],
      riskTolerance: 0.35,
      accuracy: 0.6,
      maxPositionSize: Math.min(200, Math.round((agent.staked_budget || 100000) / 500)),
      active: true,
      provider: 'local',
      model: 'heuristic-user',
    };

    tradingLoop.registerAgent(newTradingAgent);
    ratingEngine.initializeRating(agent.id);
    console.log(`[Seeder] Auto-registered user-created agent: ${agent.name} (${agent.id})`);
  });

  console.log('[Seeder] ═══════════════════════════════════════════════');
  console.log('[Seeder] Platform is LIVE — agents are reasoning with real LLMs');
  console.log(`[Seeder] Market regeneration ACTIVE — new markets spawn 2-5min after each resolution\n`);

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

  // Remove resolved market from trading loop's active set
  if (regenTradingLoop) {
    const openMarkets = Array.from(seededMarkets.values())
      .filter(m => m.status === 'open')
      .map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        category: m.category,
        status: m.status,
        midPrice: m.last_price_yes,
      }));
    regenTradingLoop.updateMarkets(openMarkets);
  }

  // Schedule a replacement market in the same category
  scheduleMarketRegeneration(market.category);
}
