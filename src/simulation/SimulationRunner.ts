/**
 * TRUTH-NET Simulation Mode
 * Spawns mock AI agents that trade against each other
 * Tests engine stability under concurrent load
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  AgentStatus,
  Market,
  MarketStatus,
  Order,
  OrderSide,
  OrderType,
  OutcomeToken,
  Trade,
  SimulationConfig,
  MockAgentConfig,
  SimulationState,
  PlaceOrderRequest,
  HttpJsonResolutionSchema,
} from '../types.js';
import { MatchingEngine } from '../engine/matcher/MatchingEngine.js';
import { EscrowLedger } from '../engine/escrow/EscrowLedger.js';
import { EventBus } from '../events/EventBus.js';

// ============================================================================
// MOCK AGENT STRATEGIES
// ============================================================================

type StrategyFunction = (
  agent: MockAgentConfig,
  market: Market,
  state: SimulationState,
  engine: MatchingEngine
) => PlaceOrderRequest | null;

/**
 * Random trading strategy - places random orders
 */
const randomStrategy: StrategyFunction = (agent, market) => {
  const side = Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL;
  const outcome = Math.random() > 0.5 ? OutcomeToken.YES : OutcomeToken.NO;

  // Random price biased by agent's confidence
  let basePrice = 0.5 + (Math.random() - 0.5) * 0.4;
  basePrice = Math.max(0.01, Math.min(0.99, basePrice + agent.confidence_bias));

  const price = Math.round(basePrice * 100) / 100;
  const quantity = Math.floor(10 + Math.random() * 90 * agent.aggression);

  return {
    market_id: market.id,
    side,
    outcome,
    order_type: OrderType.LIMIT,
    price,
    quantity,
  };
};

/**
 * Momentum strategy - follows recent price direction
 */
const momentumStrategy: StrategyFunction = (agent, market, _state, engine) => {
  const outcome = Math.random() > 0.5 ? OutcomeToken.YES : OutcomeToken.NO;
  const prices = engine.getBestPrices(market.id, outcome);

  if (!prices?.lastTradePrice) {
    return randomStrategy(agent, market, _state, engine);
  }

  // Follow momentum
  const lastPrice = prices.lastTradePrice;
  const midPrice = prices.midPrice ?? 0.5;

  const side = lastPrice > midPrice ? OrderSide.BUY : OrderSide.SELL;
  const price = side === OrderSide.BUY
    ? Math.min(0.99, lastPrice + 0.02)
    : Math.max(0.01, lastPrice - 0.02);

  return {
    market_id: market.id,
    side,
    outcome,
    order_type: OrderType.LIMIT,
    price: Math.round(price * 100) / 100,
    quantity: Math.floor(20 + Math.random() * 50 * agent.aggression),
  };
};

/**
 * Mean reversion strategy - bets on price returning to 0.50
 */
const meanReversionStrategy: StrategyFunction = (agent, market, _state, engine) => {
  const outcome = Math.random() > 0.5 ? OutcomeToken.YES : OutcomeToken.NO;
  const prices = engine.getBestPrices(market.id, outcome);

  const currentPrice = prices?.midPrice ?? prices?.lastTradePrice ?? 0.5;

  // Bet against extremes
  const side = currentPrice > 0.5 ? OrderSide.SELL : OrderSide.BUY;
  const distance = Math.abs(currentPrice - 0.5);

  // More aggressive when price is further from 0.5
  const quantity = Math.floor(10 + distance * 200 * agent.aggression);

  // Price towards 0.5
  const price = side === OrderSide.BUY
    ? Math.max(0.01, currentPrice - 0.01)
    : Math.min(0.99, currentPrice + 0.01);

  return {
    market_id: market.id,
    side,
    outcome,
    order_type: OrderType.LIMIT,
    price: Math.round(price * 100) / 100,
    quantity,
  };
};

/**
 * Informed strategy - knows the "true" probability
 */
const informedStrategy: StrategyFunction = (agent, market, _state, engine) => {
  // Simulated true probability (in reality, this would come from agent's model)
  const trueProbability = 0.5 + agent.confidence_bias;
  const outcome = OutcomeToken.YES;

  const prices = engine.getBestPrices(market.id, outcome);
  const marketPrice = prices?.midPrice ?? 0.5;

  // If market undervalues YES, buy; if overvalues, sell
  if (Math.abs(trueProbability - marketPrice) < 0.05) {
    return null; // No edge, skip
  }

  const side = trueProbability > marketPrice ? OrderSide.BUY : OrderSide.SELL;
  const edge = Math.abs(trueProbability - marketPrice);

  // Size position by edge
  const quantity = Math.floor(edge * 500 * agent.aggression);

  const price = side === OrderSide.BUY
    ? Math.min(trueProbability - 0.01, prices?.bestAsk ?? trueProbability)
    : Math.max(trueProbability + 0.01, prices?.bestBid ?? trueProbability);

  return {
    market_id: market.id,
    side,
    outcome,
    order_type: OrderType.LIMIT,
    price: Math.round(Math.max(0.01, Math.min(0.99, price)) * 100) / 100,
    quantity: Math.max(1, quantity),
  };
};

const STRATEGIES: Record<string, StrategyFunction> = {
  random: randomStrategy,
  momentum: momentumStrategy,
  mean_reversion: meanReversionStrategy,
  informed: informedStrategy,
};

// ============================================================================
// SIMULATION RUNNER
// ============================================================================

export class SimulationRunner {
  private escrow: EscrowLedger;
  private eventBus: EventBus;
  private engine: MatchingEngine;
  private agents: MockAgentConfig[] = [];
  private markets: Market[] = [];
  private state: SimulationState;
  private isRunning: boolean = false;

  constructor() {
    this.escrow = new EscrowLedger();
    this.eventBus = new EventBus();
    this.engine = new MatchingEngine(this.escrow, this.eventBus);

    this.state = {
      tick: 0,
      agents: [],
      markets: [],
      total_trades: 0,
      total_volume: 0,
    };

    // Subscribe to trade events
    this.eventBus.subscribe<{ trade: Trade }>('trades.executed', (data) => {
      this.state.total_trades++;
      this.state.total_volume += data.trade.price * data.trade.quantity;
    });
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  /**
   * Initialize simulation with config
   */
  async initialize(config: SimulationConfig): Promise<void> {
    console.log('Initializing simulation...');

    // Create mock agents
    for (let i = 0; i < config.agent_count; i++) {
      const agentConfig = this.createMockAgent(i, config.initial_balance);
      this.agents.push(agentConfig);
    }

    // Create test markets
    for (let i = 0; i < config.market_count; i++) {
      const market = this.createTestMarket(i);
      this.markets.push(market);
      this.engine.initializeMarket(market.id);
    }

    console.log(`Created ${this.agents.length} agents and ${this.markets.length} markets`);
  }

  /**
   * Create a mock agent
   */
  private createMockAgent(index: number, initialBalance: number): MockAgentConfig {
    const strategies = ['random', 'momentum', 'mean_reversion', 'informed'] as const;
    const strategy = strategies[index % strategies.length];

    const agentId = uuidv4();
    const config: MockAgentConfig = {
      id: agentId,
      name: `MockAgent-${String(index).padStart(3, '0')}`,
      strategy,
      confidence_bias: (Math.random() - 0.5) * 0.4, // -0.2 to 0.2
      aggression: 0.3 + Math.random() * 0.7, // 0.3 to 1.0
    };

    // Create wallet
    this.escrow.createWallet(agentId, initialBalance);

    return config;
  }

  /**
   * Create a test market
   */
  private createTestMarket(index: number): Market {
    const now = new Date();
    const opensAt = new Date(now.getTime() - 1000);
    const closesAt = new Date(now.getTime() + 3600000); // 1 hour
    const resolvesAt = new Date(now.getTime() + 3600000 + 60000); // 1 hour + 1 min

    const schema: HttpJsonResolutionSchema = {
      type: 'http_json',
      source_url: `https://api.example.com/market/${index}`,
      method: 'GET',
      json_path: '$.outcome',
      condition: {
        operator: 'eq',
        value: 'yes',
      },
    };

    return {
      id: uuidv4(),
      ticker: `TEST-MKT-${String(index).padStart(3, '0')}`,
      title: `Test Market ${index}`,
      description: `Simulation test market #${index}`,
      resolution_schema: schema,
      opens_at: opensAt,
      closes_at: closesAt,
      resolves_at: resolvesAt,
      status: MarketStatus.ACTIVE,
      min_order_size: 1,
      max_position: 10000,
      fee_rate: 0.002,
      volume_yes: 0,
      volume_no: 0,
      open_interest: 0,
      tags: ['simulation', 'test'],
      metadata: {},
      created_at: now,
      updated_at: now,
    };
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Run simulation for specified duration
   */
  async run(config: SimulationConfig): Promise<SimulationState> {
    console.log(`Starting simulation: ${config.duration_ticks} ticks @ ${config.tick_interval_ms}ms`);

    this.isRunning = true;

    for (let tick = 0; tick < config.duration_ticks && this.isRunning; tick++) {
      this.state.tick = tick;
      await this.executeTick();

      // Log progress every 100 ticks
      if (tick % 100 === 0) {
        this.logProgress();
      }

      // Wait for next tick
      await this.delay(config.tick_interval_ms);
    }

    this.isRunning = false;
    console.log('\nSimulation complete!');
    this.logFinalStats();

    return this.state;
  }

  /**
   * Stop running simulation
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Execute a single simulation tick
   */
  private async executeTick(): Promise<void> {
    // Each agent may or may not trade on each tick
    const shuffledAgents = [...this.agents].sort(() => Math.random() - 0.5);

    for (const agentConfig of shuffledAgents) {
      // 30% chance to trade on each tick
      if (Math.random() > 0.3) continue;

      // Pick a random market
      const market = this.markets[Math.floor(Math.random() * this.markets.length)];

      // Generate order based on strategy
      const strategyFn = STRATEGIES[agentConfig.strategy] ?? randomStrategy;
      const orderRequest = strategyFn(agentConfig, market, this.state, this.engine);

      if (!orderRequest) continue;

      try {
        await this.engine.processOrder(agentConfig.id, market.id, orderRequest);
      } catch (error) {
        // Expected: insufficient funds, etc.
        // console.debug(`Order failed for ${agentConfig.name}: ${error}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  private logProgress(): void {
    const totalBalance = this.calculateTotalBalance();
    console.log(
      `Tick ${this.state.tick} | ` +
      `Trades: ${this.state.total_trades} | ` +
      `Volume: ${this.state.total_volume.toFixed(2)} | ` +
      `Total Balance: ${totalBalance.toFixed(2)}`
    );
  }

  private logFinalStats(): void {
    console.log('\n========== SIMULATION RESULTS ==========');
    console.log(`Total Ticks: ${this.state.tick}`);
    console.log(`Total Trades: ${this.state.total_trades}`);
    console.log(`Total Volume: ${this.state.total_volume.toFixed(2)}`);

    // Agent P&L
    console.log('\n--- Agent Balances ---');
    const wallets = this.escrow.getAllWallets();
    const sortedAgents = this.agents
      .map(a => ({
        ...a,
        balance: wallets.get(a.id)?.available ?? 0 + (wallets.get(a.id)?.locked ?? 0),
      }))
      .sort((a, b) => b.balance - a.balance);

    for (const agent of sortedAgents.slice(0, 10)) {
      const wallet = wallets.get(agent.id);
      const total = (wallet?.available ?? 0) + (wallet?.locked ?? 0);
      const pnl = total - 10000; // Assuming 10k initial
      const pnlSign = pnl >= 0 ? '+' : '';
      console.log(
        `${agent.name} (${agent.strategy}): ` +
        `${total.toFixed(2)} (${pnlSign}${pnl.toFixed(2)})`
      );
    }

    // Market stats
    console.log('\n--- Order Book Depths ---');
    for (const market of this.markets) {
      const yesSnapshot = this.engine.getOrderBookSnapshot(market.id, OutcomeToken.YES);
      const noSnapshot = this.engine.getOrderBookSnapshot(market.id, OutcomeToken.NO);

      if (yesSnapshot && noSnapshot) {
        const yesBids = yesSnapshot.bids.reduce((s, l) => s + l.quantity, 0);
        const yesAsks = yesSnapshot.asks.reduce((s, l) => s + l.quantity, 0);
        console.log(
          `${market.ticker}: YES bids=${yesBids.toFixed(0)}, asks=${yesAsks.toFixed(0)}`
        );
      }
    }

    console.log('==========================================\n');
  }

  private calculateTotalBalance(): number {
    let total = 0;
    for (const agent of this.agents) {
      const balance = this.escrow.getBalance(agent.id);
      if (balance) {
        total += balance.total;
      }
    }
    return total;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CLI RUNNER
// ============================================================================

async function main() {
  const config: SimulationConfig = {
    agent_count: 10,
    initial_balance: 10000,
    tick_interval_ms: 50,
    market_count: 3,
    duration_ticks: 500,
  };

  const runner = new SimulationRunner();
  await runner.initialize(config);
  await runner.run(config);
}

// Run if executed directly
main().catch(console.error);
