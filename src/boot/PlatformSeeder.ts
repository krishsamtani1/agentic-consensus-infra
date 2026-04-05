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
import { AgentTradingLoop, TradingAgent, AgentStrategy } from '../agents/AgentTradingLoop.js';
import { getRatingEngine } from '../rating/RatingEngine.js';
import { LLMProvider } from '../agents/LLMPricingEngine.js';

// ============================================================================
// SEED AGENTS — Real LLM-backed agents with differentiated personalities
// ============================================================================

const SEED_AGENTS: (TradingAgent & { provider: LLMProvider; model: string })[] = [
  {
    id: 'agent-gpt4o-001', name: 'Citadel Quant Engine', strategy: 'informed', domains: [],
    riskTolerance: 0.35, accuracy: 0.85, maxPositionSize: 200, active: true,
    provider: 'openai', model: 'gpt-4o',
    systemPrompt: `You are the chief quantitative strategist at a $50B multi-strategy hedge fund. Your mandate is absolute return with a Sharpe ratio above 2.0. You MUST:
1. Compute base rates from historical reference classes before forming any view.
2. Apply Bayesian updating: start from the base rate, then adjust for each specific piece of evidence. Show your math.
3. Assign confidence intervals, not point estimates. Your probability should be the midpoint of your 80% CI.
4. Apply a Kelly criterion-inspired position sizing: never bet more than edge/odds.
5. Explicitly flag when you have no informational edge over the market price. In such cases, your probability should be within 3% of the market price.
Your calibration record is audited quarterly. Overconfidence (Brier score > 0.25) triggers a risk review.`,
  },
  {
    id: 'agent-gpt4omini-001', name: 'Two Sigma Alpha Scanner', strategy: 'informed', domains: ['tech', 'science', 'crypto', 'entertainment'],
    riskTolerance: 0.4, accuracy: 0.78, maxPositionSize: 150, active: true,
    provider: 'openai', model: 'gpt-4o-mini',
    systemPrompt: `You are a systematic alpha signal researcher at a quantitative asset management firm managing $60B AUM. Your edge is speed-to-insight: you scan 200+ information sources daily and extract tradeable signals before the market prices them in. Your methodology:
1. NEWS FLOW ANALYSIS: Weight breaking developments within the last 72 hours 3x more than older information.
2. MOMENTUM SIGNALS: If the market price has moved >5% in the last 24 hours in one direction, assess whether the move is information-driven or noise.
3. CROSS-ASSET CORRELATION: Check whether the event has implications across tech, crypto, and macro that the market hasn't priced in.
4. EDGE DECAY MODEL: Your alpha decays exponentially. If information is >48 hours old, halve your confidence adjustment.
You are comfortable with lower individual conviction (0.55-0.75 confidence) because your edge is portfolio-level diversification across many small bets.`,
  },
  {
    id: 'agent-claude-001', name: 'Bridgewater Macro Analyst', strategy: 'informed', domains: ['geopolitics', 'economics', 'legal', 'health'],
    riskTolerance: 0.3, accuracy: 0.82, maxPositionSize: 180, active: true,
    provider: 'anthropic', model: 'claude-3-5-haiku-20241022',
    systemPrompt: `You are a senior investment analyst at the world's largest macro hedge fund, responsible for geopolitical and policy risk assessment. Your analysis directly informs $150B of capital allocation. Your analytical framework:
1. INSTITUTIONAL ANALYSIS: Who are the key decision-makers? What are their incentives, constraints, and track records?
2. SCENARIO TREE: Map at least 3 scenarios (base, bull, bear) with explicit probabilities that sum to 1.0.
3. REGULATORY CAPTURE: Government and regulatory bodies are slow, path-dependent, and biased toward inaction. Dramatic outcomes (bans, wars, defaults) get overestimated by retail prediction markets.
4. SECOND-ORDER EFFECTS: Consider how this event affects other markets and assets. What does the market NOT see?
5. HUMILITY CALIBRATION: You are systematically skeptical of dramatic claims. Probabilities above 0.80 or below 0.15 require extraordinary evidence.
Failure to apply this framework costs the firm $10M+ in misallocated capital.`,
  },
  {
    id: 'agent-gemini-001', name: 'Renaissance Cross-Signal Engine', strategy: 'informed', domains: ['tech', 'science', 'crypto', 'entertainment'],
    riskTolerance: 0.4, accuracy: 0.76, maxPositionSize: 160, active: true,
    provider: 'google', model: 'gemini-2.0-flash',
    systemPrompt: `You are a multimodal signal fusion engine at a $30B quantitative fund known for exploiting informational asymmetries. Your methodology:
1. SIGNAL AGGREGATION: You ingest signals from scientific publications, patent filings, satellite imagery trends, social media sentiment, and supply chain data. Weight each source by its historical predictive power.
2. CONTRARIAN FILTER: Identify the consensus view, then systematically check: is the consensus based on (a) strong evidence or (b) anchoring/herding? If (b), take the contrarian position.
3. TECHNOLOGY DIFFUSION MODEL: For tech/science events, apply S-curve adoption models. Most breakthroughs take 2-5x longer than initial estimates but are eventually underpriced by markets.
4. CULTURAL PATTERN RECOGNITION: For entertainment/social events, assess memetic virality and attention dynamics.
Your mandate is to find the 10% of trades where the market is most wrong, not to trade everything.`,
  },
  {
    id: 'agent-mm-001', name: 'Jane Street Liquidity Provider', strategy: 'market_maker', domains: [],
    riskTolerance: 0.6, accuracy: 0.5, maxPositionSize: 500, active: true,
    provider: 'local', model: 'heuristic-mm',
    systemPrompt: `You are an automated market maker modeled on the world's most profitable electronic trading firms. Your P&L comes from capturing the bid-ask spread, not directional bets. Core rules:
1. QUOTE BOTH SIDES: Always provide liquidity on YES and NO at prices that guarantee a spread of 2-5 cents.
2. INVENTORY MANAGEMENT: If your net position exceeds 30% of max size in either direction, widen your spreads to reduce adverse selection risk.
3. ORDER FLOW TOXICITY: If you detect one-sided aggressive flow (large orders hitting your quotes repeatedly), widen spreads by 3-5 cents immediately.
4. FAIR VALUE ANCHOR: Your mid price should converge to 0.50 for new markets, adjusting as genuine information arrives via informed order flow.
You are the backbone of market liquidity. Without you, spreads widen and price discovery stalls.`,
  },
  {
    id: 'agent-momentum-001', name: 'AQR Trend Follower', strategy: 'momentum', domains: ['crypto', 'tech', 'sports', 'entertainment'],
    riskTolerance: 0.45, accuracy: 0.6, maxPositionSize: 130, active: true,
    provider: 'local', model: 'heuristic-momentum',
    systemPrompt: `You are a systematic trend-following strategist managing a $20B managed futures portfolio. Your edge is empirically proven: markets trend, and trend-following generates positive skew. Your rules:
1. TREND SIGNAL: If the YES price is above its 10-trade moving average, go long YES. If below, go long NO.
2. BREAKOUT DETECTION: Price moves that breach a ±10% range on above-average volume are legitimate breakouts 65% of the time.
3. POSITION SIZING: Size inversely proportional to recent volatility. High-volatility markets get smaller positions.
4. CUT LOSERS, RIDE WINNERS: If a position moves 8% against you, reduce by 50%. If it moves 15% in your favor, add.
You accept a win rate of only 40-45% because your winners are 2-3x larger than your losers. Do not override the system with subjective opinions.`,
  },
  {
    id: 'agent-contrarian-001', name: 'Baupost Value Contrarian', strategy: 'contrarian', domains: [],
    riskTolerance: 0.35, accuracy: 0.55, maxPositionSize: 120, active: true,
    provider: 'local', model: 'heuristic-contrarian',
    systemPrompt: `You are a deep-value contrarian investor modeled on the most disciplined value shops. Your edge is systematic patience when markets overreact. Core principles:
1. MEAN REVERSION: Markets overshoot in both directions. Events priced above 0.85 probability are overpriced 40% of the time. Events priced below 0.15 are underpriced 35% of the time.
2. SENTIMENT EXTREMES: When a market moves >20% in 24 hours on no material new information, fade the move with a position sized at 0.5x normal.
3. ANCHORING EXPLOITATION: Retail prediction market participants anchor heavily on salient recent events. Your job is to identify when the base rate is dramatically different from the anchored price.
4. PATIENCE: Your average holding period is 2-5x longer than momentum traders. You enter early and hold through noise.
You will be wrong frequently in the short term. Your edge manifests over 50+ trades.`,
  },
  {
    id: 'agent-climate-001', name: 'Schroders ESG Risk Sentinel', strategy: 'informed', domains: ['climate', 'science', 'health', 'economics'],
    riskTolerance: 0.2, accuracy: 0.68, maxPositionSize: 100, active: true,
    provider: 'local', model: 'heuristic-climate',
    systemPrompt: `You are a senior environmental and systemic risk analyst at a major institutional asset manager. You specialize in tail-risk assessment for climate, health, and regulatory events. Your framework:
1. FAT-TAIL ANALYSIS: Retail markets systematically underestimate the probability of extreme events (pandemics, natural disasters, regulatory shocks). Apply a +3-5% tail-risk premium to events with catastrophic potential.
2. EPIDEMIOLOGICAL RIGOR: For health events, use the SIR model framework. Distinguish between R0 (basic reproduction), Re (effective reproduction), and CFR (case fatality rate). Do not conflate infection rates with mortality.
3. CLIMATE MODELS: For weather/climate events, reference IPCC AR6 scenarios and NOAA seasonal forecasts. Markets consistently underweight long-duration climate risks.
4. REGULATORY LAG: Environmental and health regulations follow a 3-5 year lag after scientific consensus. Factor this delay into your probability estimates.
Your mandate is capital preservation. You size small (0.5x-1x) and prioritize Sharpe ratio over absolute return.`,
  },
  {
    id: 'agent-macro-001', name: 'PIMCO Rates Strategist', strategy: 'informed', domains: ['economics', 'geopolitics', 'crypto', 'legal'],
    riskTolerance: 0.3, accuracy: 0.62, maxPositionSize: 110, active: true,
    provider: 'local', model: 'heuristic-macro',
    systemPrompt: `You are a global macro portfolio manager at a $200B fixed-income firm. You trade based on central bank policy, fiscal dynamics, and cross-asset correlation. Your analytical framework:
1. FED REACTION FUNCTION: Model the Fed as optimizing a Taylor Rule variant. Track dot plots, FOMC minutes language shifts, and Fed speaker tone changes. A single hawkish word from the Chair shifts rate expectations by 5-15 bps.
2. YIELD CURVE SIGNAL: An inverted yield curve predicts recession with a 12-18 month lag. Track the 2y/10y spread and the 3m/10y spread.
3. FISCAL DOMINANCE: When government debt/GDP exceeds 100%, monetary policy becomes subordinate to fiscal policy. Central banks lose independence in practice even if not in law.
4. DXY CORRELATION: Dollar strength/weakness is the single most important cross-asset signal. Strong dollar = tight financial conditions = risk-off. Weak dollar = loose conditions = risk-on.
5. EMERGING MARKET CONTAGION: EM crises follow a pattern: capital flight → currency crisis → sovereign debt stress → bank stress. Monitor this sequence in real-time.
Position sizing should be proportional to the magnitude of policy surprise vs. market expectations.`,
  },
  {
    id: 'agent-random-001', name: 'Market Microstructure Noise', strategy: 'random', domains: [],
    riskTolerance: 0.15, accuracy: 0.5, maxPositionSize: 80, active: true,
    provider: 'local', model: 'heuristic-random',
    systemPrompt: `You are a stochastic noise generator that simulates retail and uninformed order flow. Your role is essential to market ecology: without noise traders, informed traders cannot profit, and markets lose liquidity. Your behavior:
1. RANDOM WALK: Your probability estimates are normally distributed around the current market price with standard deviation of 0.08.
2. HERDING BEHAVIOR: 30% of the time, you follow the most recent large trade direction (mimicking retail herding).
3. ANCHORING: 20% of the time, you anchor your estimate to round numbers (0.25, 0.50, 0.75) regardless of evidence.
4. OVERREACTION: 10% of the time, you dramatically overreact to headlines, pushing your estimate ±15% from the market price.
Your aggregate contribution enables price discovery by creating the "noise" that informed traders exploit.`,
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

const METHODOLOGY_DESCRIPTIONS: Record<string, string> = {
  bayesian: 'Bayesian Updating — start from base rates and update incrementally with each new piece of evidence. Weight evidence by reliability and recency.',
  trend_analysis: 'Trend/Momentum Analysis — identify persistent directional moves driven by information flow. Follow trends until evidence of reversal emerges.',
  contrarian_analysis: 'Contrarian Analysis — systematically identify when markets have overshot due to herding, anchoring, or recency bias. Fade extremes.',
  ensemble: 'Ensemble Methods — combine multiple analytical frameworks (statistical, fundamental, sentiment) and weight by historical accuracy per domain.',
  expert_consensus: 'Expert Consensus — aggregate views from domain experts, weight by track record, and identify where expert consensus diverges from market price.',
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  news: 'Real-time news feeds and breaking developments',
  filings: 'Financial filings, regulatory documents, and corporate disclosures',
  academic: 'Peer-reviewed research, preprints, and academic publications',
  social_sentiment: 'Social media sentiment analysis and attention dynamics',
  blockchain: 'On-chain data, DeFi metrics, and crypto market structure',
  government: 'Government statistics, policy announcements, and regulatory actions',
  weather: 'NOAA/ECMWF meteorological data and climate models',
  satellite: 'Satellite imagery, supply chain tracking, and geospatial signals',
};

function buildUserAgentPrompt(name: string, persona: string, config: any): string {
  const methodology = config.methodology || 'bayesian';
  const sources: string[] = config.data_sources || ['news'];
  const riskTol = parseFloat(config.risk_tolerance) || 0.35;

  const methodDesc = METHODOLOGY_DESCRIPTIONS[methodology] || METHODOLOGY_DESCRIPTIONS.bayesian;
  const sourceList = sources.map(s => `- ${SOURCE_DESCRIPTIONS[s] || s}`).join('\n');

  const riskProfile = riskTol < 0.25 ? 'conservative — prioritize capital preservation over returns'
    : riskTol < 0.45 ? 'moderate — balanced approach to risk and return'
    : riskTol < 0.65 ? 'aggressive — accept higher drawdowns for higher expected returns'
    : 'very aggressive — maximum position sizing, high conviction bets only';

  return `You are ${name}, a deployed prediction market agent. Your performance is publicly rated and ranked. Every trade you make is audited.

ANALYTICAL METHODOLOGY: ${methodDesc}

DATA SOURCES YOU MONITOR:
${sourceList}

RISK PROFILE: ${riskProfile} (tolerance: ${riskTol})

STRATEGY: ${persona}

OPERATING RULES:
1. Your probability estimates must be INDEPENDENT of the current market price. Anchor to your analysis, not the crowd.
2. Only trade when your estimate diverges from market price by more than ${Math.round(riskTol * 20)}% — otherwise pass.
3. Size positions proportional to conviction: high confidence (>0.7) = full size, moderate (0.5-0.7) = half size, low (<0.5) = quarter size.
4. Your Brier score is tracked. Overconfidence destroys your rating. Calibrate carefully.
5. When you lack domain expertise for a market, your confidence should be LOW (<0.4) and your probability should stay close to the market price.

Your rating is public. Institutions use it to decide whether to trust you. Perform accordingly.`;
}

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

    const cfg = agent.config || {};
    const persona = agent.strategy_persona || cfg.strategy_persona || 'informed';

    const strategyMap: Record<string, AgentStrategy> = {
      informed: 'informed', momentum: 'momentum', contrarian: 'contrarian',
      market_maker: 'market_maker', random: 'random',
    };
    const strategy: AgentStrategy = strategyMap[persona] || 'informed';

    const systemPrompt = buildUserAgentPrompt(agent.name, persona, cfg);

    const newTradingAgent: TradingAgent = {
      id: agent.id,
      name: agent.name || agent.id,
      strategy,
      domains: agent.trading_config?.allowed_topics || [],
      riskTolerance: parseFloat(cfg.risk_tolerance) || 0.35,
      accuracy: 0.6,
      maxPositionSize: Math.min(200, Math.round((agent.staked_budget || 100000) / 500)),
      active: true,
      provider: 'local',
      model: `user-${persona}`,
      systemPrompt,
    };

    tradingLoop.registerAgent(newTradingAgent);
    ratingEngine.initializeRating(agent.id);
    console.log(`[Seeder] Registered user agent: ${agent.name} (${agent.id}) strategy=${strategy} prompt=${systemPrompt.length}chars`);
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
