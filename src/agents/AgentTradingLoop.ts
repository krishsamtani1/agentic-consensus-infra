/**
 * TRUTH-NET Agent Trading Loop
 *
 * Makes agents ACTUALLY TRADE using REAL LLM reasoning.
 *
 * Each agent has a configured LLM (GPT-4o, Claude, Gemini, etc.) that evaluates
 * prediction markets and generates genuine probability estimates. The divergence
 * between models on the same question IS the alpha signal.
 *
 * Flow: Market question → LLM probability estimate → Trading decision → MatchingEngine
 */

import { MatchingEngine } from '../engine/matcher/MatchingEngine.js';
import { EscrowLedger } from '../engine/escrow/EscrowLedger.js';
import { EventBus } from '../events/EventBus.js';
import { LLMPricingEngine, LLMProvider } from './LLMPricingEngine.js';

export interface TradingAgent {
  id: string;
  name: string;
  strategy: AgentStrategy;
  domains: string[];
  riskTolerance: number;
  accuracy: number;
  maxPositionSize: number;
  active: boolean;
  provider?: LLMProvider;
  model?: string;
  systemPrompt?: string;
}

export type AgentStrategy = 'informed' | 'momentum' | 'contrarian' | 'random' | 'market_maker';

interface MarketInfo {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  midPrice?: number;
}

interface AgentTradeStats {
  tradeCount: number;
  lastTradeTime: Date | null;
  currentPositions: Map<string, number>; // marketId → net quantity
}

export class AgentTradingLoop {
  private agents: TradingAgent[] = [];
  private markets: MarketInfo[] = [];
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private totalTrades = 0;
  private llmEngine: LLMPricingEngine;
  private lastReasonings: Map<string, { market: string; reasoning: string; probability: number; model: string; timestamp: Date }[]> = new Map();
  private agentTradeStats: Map<string, AgentTradeStats> = new Map();

  constructor(
    private matchingEngine: MatchingEngine,
    private escrow: EscrowLedger,
    private eventBus: EventBus,
  ) {
    this.llmEngine = new LLMPricingEngine();
  }

  getLLMEngine(): LLMPricingEngine {
    return this.llmEngine;
  }

  hasAgent(id: string): boolean {
    return this.agents.some(a => a.id === id);
  }

  registerAgent(agent: TradingAgent): void {
    if (this.hasAgent(agent.id)) return;
    if (!this.escrow.getWallet(agent.id)) {
      this.escrow.createWallet(agent.id, 10000);
    }

    if (agent.provider) {
      this.llmEngine.registerModel(agent.id, {
        provider: agent.provider,
        model: agent.model || 'gpt-4o-mini',
        systemPrompt: agent.systemPrompt,
      });
    }

    this.agents.push(agent);
    console.log(`[TradingLoop] Registered agent: ${agent.name} (${agent.provider || 'local'}/${agent.model || agent.strategy})`);
  }

  updateMarkets(markets: MarketInfo[]): void {
    this.markets = markets.filter(m => m.status === 'open' || m.status === 'active');
  }

  start(intervalMs: number = 8000): void {
    if (this.intervalHandle) return;

    console.log(`[TradingLoop] Starting with ${this.agents.length} agents, ${this.markets.length} markets, tick every ${intervalMs}ms`);

    this.intervalHandle = setInterval(() => {
      this.tick().catch(err => {
        console.error(`[TradingLoop] Tick error: ${err.message}`);
      });
    }, intervalMs);

    // Run first tick after a short delay to let server start
    setTimeout(() => this.tick().catch(console.error), 3000);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log(`[TradingLoop] Stopped after ${this.tickCount} ticks`);
    }
  }

  private async tick(): Promise<void> {
    this.tickCount++;

    if (this.agents.length === 0 || this.markets.length === 0) return;

    // Each tick, 2-4 agents evaluate markets (stagger LLM calls to avoid rate limits)
    const activeAgents = this.agents
      .filter(a => a.active)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(4, Math.ceil(this.agents.length * 0.4)));

    for (const agent of activeAgents) {
      const eligibleMarkets = this.markets.filter(m => {
        if (agent.domains.length === 0) return true;
        return agent.domains.some(d =>
          (m.category || '').toLowerCase().includes(d.toLowerCase()) ||
          (m.title || '').toLowerCase().includes(d.toLowerCase())
        );
      });

      if (eligibleMarkets.length === 0) continue;

      const market = eligibleMarkets[Math.floor(Math.random() * eligibleMarkets.length)];

      const prices = this.matchingEngine.getBestPrices(market.id, 'yes' as any);
      const marketInfo: MarketInfo = {
        ...market,
        midPrice: prices?.midPrice ?? market.midPrice ?? 0.5,
      };

      // Call the LLM to get a genuine probability estimate
      const pricing = await this.llmEngine.getPricing(
        agent.id,
        {
          title: marketInfo.title,
          description: marketInfo.description || marketInfo.title,
          category: marketInfo.category,
          midPrice: marketInfo.midPrice,
        },
        agent.riskTolerance,
        agent.maxPositionSize,
      );

      if (!pricing) continue;

      // Record reasoning for transparency
      const agentReasonings = this.lastReasonings.get(agent.id) || [];
      agentReasonings.push({
        market: market.title,
        reasoning: pricing.reasoning,
        probability: pricing.probability,
        model: pricing.model,
        timestamp: new Date(),
      });
      if (agentReasonings.length > 20) agentReasonings.shift();
      this.lastReasonings.set(agent.id, agentReasonings);

      if (pricing.suggestedQuantity <= 0) continue;
      if (pricing.suggestedPrice <= 0 || pricing.suggestedPrice >= 1) continue;

      // Scale quantity by agent's riskTolerance
      let quantity = Math.floor(pricing.suggestedQuantity * agent.riskTolerance);
      if (quantity <= 0) continue;

      // Enforce maxPositionSize against existing positions
      const stats = this.agentTradeStats.get(agent.id);
      const currentPos = stats?.currentPositions.get(market.id) ?? 0;
      if (currentPos + quantity > agent.maxPositionSize) {
        quantity = agent.maxPositionSize - currentPos;
        if (quantity <= 0) continue;
      }

      const balance = this.escrow.getBalance(agent.id);
      if (!balance || balance.available < pricing.suggestedPrice * quantity) continue;

      try {
        await this.matchingEngine.processOrder(agent.id, market.id, {
          market_id: market.id,
          side: pricing.side as any,
          outcome: pricing.outcome as any,
          order_type: 'limit' as any,
          price: pricing.suggestedPrice,
          quantity,
          metadata: {
            strategy: agent.strategy,
            provider: agent.provider,
            model: pricing.model,
            probability: pricing.probability,
            confidence: pricing.confidence,
            reasoning: pricing.reasoning,
            tick: this.tickCount,
          },
        });

        // Track the trade
        this.totalTrades++;
        const tradeStats = this.agentTradeStats.get(agent.id) || {
          tradeCount: 0,
          lastTradeTime: null,
          currentPositions: new Map(),
        };
        tradeStats.tradeCount++;
        tradeStats.lastTradeTime = new Date();
        tradeStats.currentPositions.set(
          market.id,
          (tradeStats.currentPositions.get(market.id) ?? 0) + quantity,
        );
        this.agentTradeStats.set(agent.id, tradeStats);

        // Emit reasoning event for the UI
        this.eventBus.publish('agent.reasoning', {
          agent_id: agent.id,
          agent_name: agent.name,
          market_id: market.id,
          market_title: market.title,
          model: pricing.model,
          probability: pricing.probability,
          confidence: pricing.confidence,
          reasoning: pricing.reasoning,
          side: pricing.side,
          price: pricing.suggestedPrice,
          quantity,
          latencyMs: pricing.latencyMs,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        if (!err.message.includes('Insufficient')) {
          console.error(`[TradingLoop] ${agent.name} order failed: ${err.message}`);
        }
      }
    }

    if (this.tickCount % 10 === 0) {
      const llmStats = this.llmEngine.getStats();
      console.log(`[TradingLoop] Tick #${this.tickCount} — ${this.agents.length} agents, ${this.markets.length} markets, ${llmStats.totalCalls} LLM calls (avg ${llmStats.avgLatencyMs}ms)`);
    }
  }

  getReasonings(agentId: string): any[] {
    return this.lastReasonings.get(agentId) || [];
  }

  getAllReasonings(): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    for (const [id, reasonings] of this.lastReasonings) {
      result[id] = reasonings;
    }
    return result;
  }

  pauseAgent(agentId: string): boolean {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return false;
    agent.active = false;
    return true;
  }

  resumeAgent(agentId: string): boolean {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return false;
    agent.active = true;
    return true;
  }

  getAgentStatus(agentId: string): 'active' | 'paused' | 'not_found' {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return 'not_found';
    return agent.active ? 'active' : 'paused';
  }

  removeAgent(agentId: string): boolean {
    const idx = this.agents.findIndex(a => a.id === agentId);
    if (idx === -1) return false;
    this.agents.splice(idx, 1);
    return true;
  }

  getStats() {
    const agentStats: Record<string, {
      tradeCount: number;
      lastTradeTime: string | null;
      currentPositions: Record<string, number>;
    }> = {};

    for (const [id, stats] of this.agentTradeStats) {
      agentStats[id] = {
        tradeCount: stats.tradeCount,
        lastTradeTime: stats.lastTradeTime?.toISOString() ?? null,
        currentPositions: Object.fromEntries(stats.currentPositions),
      };
    }

    return {
      totalTicks: this.tickCount,
      totalTrades: this.totalTrades,
      activeAgents: this.agents.filter(a => a.active).length,
      agents: this.agents.length,
      markets: this.markets.length,
      running: this.intervalHandle !== null,
      agentStats,
      llm: this.llmEngine.getStats(),
    };
  }
}
