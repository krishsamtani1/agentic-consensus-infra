/**
 * TRUTH-NET Doctrine Engine
 * 
 * The 'Policy Layer' that sits between Agents and the OrderBook.
 * Enforces human-defined governance constraints on all agent trades.
 * 
 * Constraint Checks:
 * - Max_Position_Size: Reject if trade > X% of agent budget
 * - Risk_Floor: Reject if Brier Score < threshold
 * - Topic_Restriction: Only allow trades on permitted tags
 * 
 * Control Functions:
 * - forceClose: Instantly liquidate a position
 * - pauseAgent: Temporarily halt all agent trading
 * - globalKillSwitch: Halt all trading system-wide
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface DoctrineConfig {
  // Position limits
  max_position_size_pct: number;      // Max % of budget per position (default: 25%)
  max_total_exposure_pct: number;     // Max % of budget across all positions (default: 80%)
  
  // Risk thresholds
  min_brier_score: number;            // Minimum Brier score to trade (default: 0.6)
  min_truth_score: number;            // Minimum Truth score to trade (default: 0.4)
  
  // Trading restrictions
  allowed_topics: string[];           // Empty = all topics allowed
  blocked_topics: string[];           // Topics explicitly blocked
  
  // Rate limits
  max_trades_per_minute: number;      // Max trades per minute (default: 10)
  min_trade_interval_ms: number;      // Minimum ms between trades (default: 1000)
  
  // Drawdown protection
  max_drawdown_pct: number;           // Max drawdown before auto-pause (default: 20%)
  emergency_liquidation_pct: number;  // Drawdown to trigger liquidation (default: 40%)
}

export interface DoctrineViolation {
  id: string;
  agent_id: string;
  rule: string;
  description: string;
  trade_details: {
    market_id: string;
    side: 'yes' | 'no';
    size: number;
    price: number;
  };
  severity: 'warning' | 'rejected' | 'critical';
  timestamp: Date;
}

export interface TradeRequest {
  agent_id: string;
  market_id: string;
  market_topic?: string;
  side: 'yes' | 'no';
  size: number;
  price: number;
}

export interface AgentDoctrineState {
  agent_id: string;
  is_paused: boolean;
  pause_reason?: string;
  current_budget: number;
  total_exposure: number;
  position_count: number;
  recent_trades: { timestamp: Date; market_id: string }[];
  violations: DoctrineViolation[];
  brier_score: number;
  truth_score: number;
  peak_equity: number;
  current_drawdown: number;
}

// ============================================================================
// DEFAULT DOCTRINE
// ============================================================================

const DEFAULT_DOCTRINE: DoctrineConfig = {
  max_position_size_pct: 25,
  max_total_exposure_pct: 80,
  min_brier_score: 0.6,
  min_truth_score: 0.4,
  allowed_topics: [],
  blocked_topics: [],
  max_trades_per_minute: 10,
  min_trade_interval_ms: 1000,
  max_drawdown_pct: 20,
  emergency_liquidation_pct: 40,
};

// ============================================================================
// DOCTRINE ENGINE
// ============================================================================

export class DoctrineEngine {
  private globalPaused: boolean = false;
  private agentStates: Map<string, AgentDoctrineState> = new Map();
  private agentDoctrines: Map<string, DoctrineConfig> = new Map();
  private violations: DoctrineViolation[] = [];
  
  constructor(private eventBus: EventBus) {
    // Subscribe to relevant events
    this.eventBus.subscribe('trade.executed', this.handleTradeExecuted.bind(this));
    this.eventBus.subscribe('market.price_update', this.handlePriceUpdate.bind(this));
  }
  
  // ===========================================================================
  // AGENT DOCTRINE MANAGEMENT
  // ===========================================================================
  
  /**
   * Set doctrine config for an agent
   */
  setAgentDoctrine(agentId: string, doctrine: Partial<DoctrineConfig>): DoctrineConfig {
    const existing = this.agentDoctrines.get(agentId) || { ...DEFAULT_DOCTRINE };
    const updated = { ...existing, ...doctrine };
    this.agentDoctrines.set(agentId, updated);
    
    this.eventBus.publish('doctrine.updated', { agent_id: agentId, doctrine: updated });
    
    return updated;
  }
  
  /**
   * Get doctrine config for an agent
   */
  getAgentDoctrine(agentId: string): DoctrineConfig {
    return this.agentDoctrines.get(agentId) || { ...DEFAULT_DOCTRINE };
  }
  
  /**
   * Initialize agent state
   */
  initializeAgent(agentId: string, budget: number, brierScore: number = 0.5, truthScore: number = 0.5): void {
    const state: AgentDoctrineState = {
      agent_id: agentId,
      is_paused: false,
      current_budget: budget,
      total_exposure: 0,
      position_count: 0,
      recent_trades: [],
      violations: [],
      brier_score: brierScore,
      truth_score: truthScore,
      peak_equity: budget,
      current_drawdown: 0,
    };
    
    this.agentStates.set(agentId, state);
  }
  
  /**
   * Get agent state
   */
  getAgentState(agentId: string): AgentDoctrineState | undefined {
    return this.agentStates.get(agentId);
  }
  
  // ===========================================================================
  // TRADE VALIDATION (DOCTRINE FILTER)
  // ===========================================================================
  
  /**
   * Validate a trade against doctrine constraints
   * Returns null if valid, or a DoctrineViolation if rejected
   */
  validateTrade(request: TradeRequest): DoctrineViolation | null {
    const { agent_id, market_id, market_topic, side, size, price } = request;
    
    // Check global pause
    if (this.globalPaused) {
      return this.createViolation(agent_id, request, 'GLOBAL_PAUSE', 
        'Trading is globally paused by Commander', 'rejected');
    }
    
    // Get agent state and doctrine
    const state = this.agentStates.get(agent_id);
    const doctrine = this.getAgentDoctrine(agent_id);
    
    if (!state) {
      // Auto-initialize with default budget if not exists
      this.initializeAgent(agent_id, 100000);
      return null;
    }
    
    // Check agent pause
    if (state.is_paused) {
      return this.createViolation(agent_id, request, 'AGENT_PAUSED',
        `Agent is paused: ${state.pause_reason || 'No reason specified'}`, 'rejected');
    }
    
    // Check position size limit
    const tradeValue = size * price;
    const maxPositionValue = state.current_budget * (doctrine.max_position_size_pct / 100);
    if (tradeValue > maxPositionValue) {
      return this.createViolation(agent_id, request, 'MAX_POSITION_SIZE',
        `Trade value $${tradeValue.toFixed(2)} exceeds max position size $${maxPositionValue.toFixed(2)} (${doctrine.max_position_size_pct}% of budget)`, 'rejected');
    }
    
    // Check total exposure limit
    const newExposure = state.total_exposure + tradeValue;
    const maxExposure = state.current_budget * (doctrine.max_total_exposure_pct / 100);
    if (newExposure > maxExposure) {
      return this.createViolation(agent_id, request, 'MAX_TOTAL_EXPOSURE',
        `New exposure $${newExposure.toFixed(2)} exceeds max $${maxExposure.toFixed(2)} (${doctrine.max_total_exposure_pct}% of budget)`, 'rejected');
    }
    
    // Check Brier score floor
    if (state.brier_score < doctrine.min_brier_score) {
      return this.createViolation(agent_id, request, 'BRIER_SCORE_FLOOR',
        `Agent Brier score ${state.brier_score.toFixed(2)} below minimum ${doctrine.min_brier_score}`, 'rejected');
    }
    
    // Check Truth score floor
    if (state.truth_score < doctrine.min_truth_score) {
      return this.createViolation(agent_id, request, 'TRUTH_SCORE_FLOOR',
        `Agent Truth score ${state.truth_score.toFixed(2)} below minimum ${doctrine.min_truth_score}`, 'rejected');
    }
    
    // Check topic restrictions
    if (market_topic) {
      // Check blocked topics
      if (doctrine.blocked_topics.length > 0) {
        const isBlocked = doctrine.blocked_topics.some(t => 
          market_topic.toLowerCase().includes(t.toLowerCase())
        );
        if (isBlocked) {
          return this.createViolation(agent_id, request, 'BLOCKED_TOPIC',
            `Market topic "${market_topic}" is blocked for this agent`, 'rejected');
        }
      }
      
      // Check allowed topics (if specified)
      if (doctrine.allowed_topics.length > 0) {
        const isAllowed = doctrine.allowed_topics.some(t => 
          market_topic.toLowerCase().includes(t.toLowerCase())
        );
        if (!isAllowed) {
          return this.createViolation(agent_id, request, 'TOPIC_NOT_ALLOWED',
            `Market topic "${market_topic}" not in agent's allowed topics`, 'rejected');
        }
      }
    }
    
    // Check rate limits
    const now = new Date();
    const recentTrades = state.recent_trades.filter(
      t => now.getTime() - t.timestamp.getTime() < 60000
    );
    
    if (recentTrades.length >= doctrine.max_trades_per_minute) {
      return this.createViolation(agent_id, request, 'RATE_LIMIT',
        `Rate limit exceeded: ${recentTrades.length} trades in last minute (max: ${doctrine.max_trades_per_minute})`, 'rejected');
    }
    
    // Check minimum trade interval
    if (recentTrades.length > 0) {
      const lastTrade = recentTrades[recentTrades.length - 1];
      const timeSinceLast = now.getTime() - lastTrade.timestamp.getTime();
      if (timeSinceLast < doctrine.min_trade_interval_ms) {
        return this.createViolation(agent_id, request, 'MIN_INTERVAL',
          `Trade too soon: ${timeSinceLast}ms since last trade (min: ${doctrine.min_trade_interval_ms}ms)`, 'warning');
      }
    }
    
    // Check drawdown
    if (state.current_drawdown >= doctrine.max_drawdown_pct) {
      this.pauseAgent(agent_id, `Max drawdown ${doctrine.max_drawdown_pct}% reached`);
      return this.createViolation(agent_id, request, 'MAX_DRAWDOWN',
        `Agent paused: drawdown ${state.current_drawdown.toFixed(2)}% exceeds max ${doctrine.max_drawdown_pct}%`, 'critical');
    }
    
    // All checks passed
    return null;
  }
  
  /**
   * Create a violation record
   */
  private createViolation(
    agentId: string, 
    request: TradeRequest, 
    rule: string, 
    description: string,
    severity: 'warning' | 'rejected' | 'critical'
  ): DoctrineViolation {
    const violation: DoctrineViolation = {
      id: uuidv4(),
      agent_id: agentId,
      rule,
      description,
      trade_details: {
        market_id: request.market_id,
        side: request.side,
        size: request.size,
        price: request.price,
      },
      severity,
      timestamp: new Date(),
    };
    
    this.violations.push(violation);
    
    const state = this.agentStates.get(agentId);
    if (state) {
      state.violations.push(violation);
    }
    
    this.eventBus.publish('doctrine.violation', violation);
    
    console.log(`[Doctrine] ${severity.toUpperCase()}: Agent ${agentId} - ${rule}: ${description}`);
    
    return violation;
  }
  
  // ===========================================================================
  // CONTROL FUNCTIONS
  // ===========================================================================
  
  /**
   * Force close a position (Commander veto)
   */
  async forceClose(agentId: string, marketId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    console.log(`[Doctrine] Force closing position: Agent ${agentId}, Market ${marketId}`);
    
    this.eventBus.publish('doctrine.force_close', {
      agent_id: agentId,
      market_id: marketId,
      reason: reason || 'Commander veto',
      timestamp: new Date().toISOString(),
    });
    
    // Update agent state
    const state = this.agentStates.get(agentId);
    if (state) {
      state.position_count = Math.max(0, state.position_count - 1);
    }
    
    return {
      success: true,
      message: `Position force-closed for Agent ${agentId} on Market ${marketId}`,
    };
  }
  
  /**
   * Pause an agent
   */
  pauseAgent(agentId: string, reason?: string): boolean {
    const state = this.agentStates.get(agentId);
    if (!state) {
      this.initializeAgent(agentId, 100000);
    }
    
    const agentState = this.agentStates.get(agentId)!;
    agentState.is_paused = true;
    agentState.pause_reason = reason || 'Paused by Commander';
    
    this.eventBus.publish('doctrine.agent_paused', {
      agent_id: agentId,
      reason: agentState.pause_reason,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Doctrine] Agent ${agentId} paused: ${agentState.pause_reason}`);
    
    return true;
  }
  
  /**
   * Resume an agent
   */
  resumeAgent(agentId: string): boolean {
    const state = this.agentStates.get(agentId);
    if (!state) return false;
    
    state.is_paused = false;
    state.pause_reason = undefined;
    
    this.eventBus.publish('doctrine.agent_resumed', {
      agent_id: agentId,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Doctrine] Agent ${agentId} resumed`);
    
    return true;
  }
  
  /**
   * Global kill switch - pause all trading
   */
  globalKillSwitch(activate: boolean, reason?: string): void {
    this.globalPaused = activate;
    
    this.eventBus.publish('doctrine.global_kill_switch', {
      activated: activate,
      reason: reason || (activate ? 'Emergency stop' : 'Trading resumed'),
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Doctrine] Global Kill Switch ${activate ? 'ACTIVATED' : 'DEACTIVATED'}: ${reason || ''}`);
  }
  
  /**
   * Check if global trading is paused
   */
  isGloballyPaused(): boolean {
    return this.globalPaused;
  }
  
  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================
  
  private handleTradeExecuted(event: any): void {
    const { agent_id, market_id, size, price } = event;
    
    const state = this.agentStates.get(agent_id);
    if (!state) return;
    
    // Update recent trades
    state.recent_trades.push({
      timestamp: new Date(),
      market_id,
    });
    
    // Keep only last 100 trades
    if (state.recent_trades.length > 100) {
      state.recent_trades.shift();
    }
    
    // Update exposure
    state.total_exposure += size * price;
    state.position_count++;
  }
  
  private handlePriceUpdate(event: any): void {
    // Update drawdown calculations
    for (const state of this.agentStates.values()) {
      const currentEquity = state.current_budget - state.total_exposure * 0.1; // Simplified
      
      if (currentEquity > state.peak_equity) {
        state.peak_equity = currentEquity;
      }
      
      state.current_drawdown = ((state.peak_equity - currentEquity) / state.peak_equity) * 100;
      
      // Check emergency liquidation
      const doctrine = this.getAgentDoctrine(state.agent_id);
      if (state.current_drawdown >= doctrine.emergency_liquidation_pct) {
        this.eventBus.publish('doctrine.emergency_liquidation', {
          agent_id: state.agent_id,
          drawdown: state.current_drawdown,
          threshold: doctrine.emergency_liquidation_pct,
        });
      }
    }
  }
  
  // ===========================================================================
  // REPORTING
  // ===========================================================================
  
  /**
   * Get all violations
   */
  getViolations(agentId?: string, limit: number = 50): DoctrineViolation[] {
    let violations = this.violations;
    
    if (agentId) {
      violations = violations.filter(v => v.agent_id === agentId);
    }
    
    return violations.slice(-limit);
  }
  
  /**
   * Get governance summary
   */
  getGovernanceSummary(): object {
    const agents = Array.from(this.agentStates.values());
    
    return {
      global_paused: this.globalPaused,
      total_agents: agents.length,
      paused_agents: agents.filter(a => a.is_paused).length,
      active_agents: agents.filter(a => !a.is_paused).length,
      total_violations: this.violations.length,
      violations_by_severity: {
        warning: this.violations.filter(v => v.severity === 'warning').length,
        rejected: this.violations.filter(v => v.severity === 'rejected').length,
        critical: this.violations.filter(v => v.severity === 'critical').length,
      },
      recent_violations: this.violations.slice(-5),
    };
  }
}

// Singleton
let doctrineEngine: DoctrineEngine | null = null;

export function getDoctrineEngine(eventBus: EventBus): DoctrineEngine {
  if (!doctrineEngine) {
    doctrineEngine = new DoctrineEngine(eventBus);
  }
  return doctrineEngine;
}
