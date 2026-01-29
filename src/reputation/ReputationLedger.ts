/**
 * TRUTH-NET Reputation Ledger
 * 
 * Three-Tiered Reputation System (ERC-8004 Style):
 * 1. Identity: Who is the agent?
 * 2. Reputation: Historical Brier score & performance
 * 3. Verification: Oracle-verified trade outcomes
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

// Tier 1: Identity
export interface AgentIdentity {
  id: string;
  name: string;
  type: 'system' | 'external' | 'user';
  
  // Verification
  verified: boolean;
  verification_method?: 'mcp' | 'a2a' | 'manual';
  verified_at?: Date;
  
  // Metadata
  provider?: string;
  model?: string;
  created_at: Date;
  
  // External links
  mcp_endpoint?: string;
  a2a_endpoint?: string;
  
  // Avatar/Display
  avatar_url?: string;
  description?: string;
}

// Tier 2: Reputation
export interface AgentReputation {
  agent_id: string;
  
  // Brier Score (0 = perfect, 1 = worst)
  brier_score: number;
  brier_score_history: { date: string; score: number }[];
  
  // Trading Performance
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  
  // P&L
  total_pnl: number;
  realized_pnl: number;
  largest_win: number;
  largest_loss: number;
  
  // Risk Metrics
  sharpe_ratio: number;
  max_drawdown: number;
  avg_position_duration: number; // hours
  
  // Truth Score (composite)
  truth_score: number;
  truth_score_history: { date: string; score: number }[];
  
  // Rankings
  rank_overall: number;
  rank_category: Record<string, number>;
  
  last_updated: Date;
}

// Tier 3: Verification
export interface VerificationRecord {
  id: string;
  agent_id: string;
  market_id: string;
  
  // Prediction
  predicted_outcome: 'yes' | 'no';
  prediction_confidence: number;
  prediction_price: number;
  predicted_at: Date;
  
  // Resolution
  actual_outcome?: 'yes' | 'no';
  resolved_at?: Date;
  
  // Oracle Verification
  oracle_source: string;
  oracle_verified: boolean;
  oracle_data?: unknown;
  
  // Scoring
  brier_contribution?: number;
  correct: boolean | null;
}

// ============================================================================
// REPUTATION LEDGER SERVICE
// ============================================================================

export class ReputationLedger {
  private identities: Map<string, AgentIdentity> = new Map();
  private reputations: Map<string, AgentReputation> = new Map();
  private verifications: Map<string, VerificationRecord[]> = new Map();
  
  constructor(private eventBus: EventBus) {
    // Subscribe to trade events
    this.eventBus.subscribe('trade.executed', this.handleTradeExecuted.bind(this));
    this.eventBus.subscribe('market.resolved', this.handleMarketResolved.bind(this));
  }
  
  // ===========================================================================
  // TIER 1: IDENTITY
  // ===========================================================================
  
  /**
   * Register a new agent identity
   */
  registerIdentity(identity: Partial<AgentIdentity>): AgentIdentity {
    const id = identity.id || uuidv4();
    
    const fullIdentity: AgentIdentity = {
      id,
      name: identity.name || `Agent-${id.slice(0, 8)}`,
      type: identity.type || 'external',
      verified: false,
      created_at: new Date(),
      avatar_url: identity.avatar_url,
      description: identity.description,
      provider: identity.provider,
      model: identity.model,
      mcp_endpoint: identity.mcp_endpoint,
      a2a_endpoint: identity.a2a_endpoint,
    };
    
    this.identities.set(id, fullIdentity);
    this.initializeReputation(id);
    
    this.eventBus.publish('reputation.identity_registered', fullIdentity);
    
    return fullIdentity;
  }
  
  /**
   * Verify an agent identity
   */
  verifyIdentity(agentId: string, method: 'mcp' | 'a2a' | 'manual'): AgentIdentity {
    const identity = this.identities.get(agentId);
    
    if (!identity) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    identity.verified = true;
    identity.verification_method = method;
    identity.verified_at = new Date();
    
    this.eventBus.publish('reputation.identity_verified', { agent_id: agentId, method });
    
    return identity;
  }
  
  /**
   * Get agent identity
   */
  getIdentity(agentId: string): AgentIdentity | undefined {
    return this.identities.get(agentId);
  }
  
  /**
   * Get all identities
   */
  getAllIdentities(): AgentIdentity[] {
    return Array.from(this.identities.values());
  }
  
  // ===========================================================================
  // TIER 2: REPUTATION
  // ===========================================================================
  
  /**
   * Initialize reputation for a new agent
   */
  private initializeReputation(agentId: string): AgentReputation {
    const reputation: AgentReputation = {
      agent_id: agentId,
      brier_score: 0.25, // Start at neutral
      brier_score_history: [],
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      win_rate: 0,
      total_pnl: 0,
      realized_pnl: 0,
      largest_win: 0,
      largest_loss: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      avg_position_duration: 0,
      truth_score: 0.5, // Start at neutral
      truth_score_history: [],
      rank_overall: 0,
      rank_category: {},
      last_updated: new Date(),
    };
    
    this.reputations.set(agentId, reputation);
    this.verifications.set(agentId, []);
    
    return reputation;
  }
  
  /**
   * Get agent reputation
   */
  getReputation(agentId: string): AgentReputation | undefined {
    return this.reputations.get(agentId);
  }
  
  /**
   * Update reputation after a trade
   */
  updateReputationFromTrade(agentId: string, pnl: number, won: boolean): void {
    let reputation = this.reputations.get(agentId);
    
    if (!reputation) {
      reputation = this.initializeReputation(agentId);
    }
    
    reputation.total_trades++;
    reputation.total_pnl += pnl;
    reputation.realized_pnl += pnl;
    
    if (won) {
      reputation.winning_trades++;
      if (pnl > reputation.largest_win) {
        reputation.largest_win = pnl;
      }
    } else {
      reputation.losing_trades++;
      if (pnl < reputation.largest_loss) {
        reputation.largest_loss = pnl;
      }
    }
    
    reputation.win_rate = reputation.winning_trades / reputation.total_trades;
    reputation.last_updated = new Date();
    
    // Recalculate truth score
    this.recalculateTruthScore(reputation);
    
    this.eventBus.publish('reputation.updated', { agent_id: agentId, reputation });
  }
  
  /**
   * Recalculate truth score from all factors
   */
  private recalculateTruthScore(reputation: AgentReputation): void {
    // Truth score = weighted combination of:
    // - Win rate (30%)
    // - Brier score (40%)
    // - Sharpe ratio (30%)
    
    const winRateComponent = reputation.win_rate * 0.3;
    const brierComponent = (1 - reputation.brier_score) * 0.4; // Invert: lower is better
    const sharpeComponent = Math.min(1, Math.max(0, reputation.sharpe_ratio / 2)) * 0.3;
    
    reputation.truth_score = winRateComponent + brierComponent + sharpeComponent;
    
    // Add to history
    reputation.truth_score_history.push({
      date: new Date().toISOString().split('T')[0],
      score: reputation.truth_score,
    });
    
    // Keep only last 30 days
    if (reputation.truth_score_history.length > 30) {
      reputation.truth_score_history.shift();
    }
  }
  
  /**
   * Get leaderboard
   */
  getLeaderboard(limit: number = 10): { agent_id: string; truth_score: number; total_pnl: number }[] {
    return Array.from(this.reputations.values())
      .sort((a, b) => b.truth_score - a.truth_score)
      .slice(0, limit)
      .map(r => ({
        agent_id: r.agent_id,
        truth_score: r.truth_score,
        total_pnl: r.total_pnl,
      }));
  }
  
  // ===========================================================================
  // TIER 3: VERIFICATION
  // ===========================================================================
  
  /**
   * Record a prediction for verification
   */
  recordPrediction(
    agentId: string,
    marketId: string,
    predictedOutcome: 'yes' | 'no',
    confidence: number,
    price: number
  ): VerificationRecord {
    const record: VerificationRecord = {
      id: uuidv4(),
      agent_id: agentId,
      market_id: marketId,
      predicted_outcome: predictedOutcome,
      prediction_confidence: confidence,
      prediction_price: price,
      predicted_at: new Date(),
      oracle_source: 'pending',
      oracle_verified: false,
      correct: null,
    };
    
    const agentRecords = this.verifications.get(agentId) || [];
    agentRecords.push(record);
    this.verifications.set(agentId, agentRecords);
    
    return record;
  }
  
  /**
   * Verify a prediction with oracle data
   */
  verifyPrediction(
    recordId: string,
    actualOutcome: 'yes' | 'no',
    oracleSource: string,
    oracleData?: unknown
  ): VerificationRecord | undefined {
    for (const records of this.verifications.values()) {
      const record = records.find(r => r.id === recordId);
      
      if (record) {
        record.actual_outcome = actualOutcome;
        record.resolved_at = new Date();
        record.oracle_source = oracleSource;
        record.oracle_verified = true;
        record.oracle_data = oracleData;
        record.correct = record.predicted_outcome === actualOutcome;
        
        // Calculate Brier contribution
        const probability = record.predicted_outcome === 'yes' 
          ? record.prediction_confidence 
          : (1 - record.prediction_confidence);
        const outcome = actualOutcome === 'yes' ? 1 : 0;
        record.brier_contribution = Math.pow(probability - outcome, 2);
        
        // Update agent's Brier score
        this.updateBrierScore(record.agent_id);
        
        this.eventBus.publish('reputation.prediction_verified', record);
        
        return record;
      }
    }
    
    return undefined;
  }
  
  /**
   * Update agent's Brier score from all verifications
   */
  private updateBrierScore(agentId: string): void {
    const records = this.verifications.get(agentId) || [];
    const verifiedRecords = records.filter(r => r.brier_contribution !== undefined);
    
    if (verifiedRecords.length === 0) return;
    
    const reputation = this.reputations.get(agentId);
    if (!reputation) return;
    
    // Calculate average Brier score
    const totalBrier = verifiedRecords.reduce((sum, r) => sum + (r.brier_contribution || 0), 0);
    reputation.brier_score = totalBrier / verifiedRecords.length;
    
    // Add to history
    reputation.brier_score_history.push({
      date: new Date().toISOString().split('T')[0],
      score: reputation.brier_score,
    });
    
    // Keep only last 30 days
    if (reputation.brier_score_history.length > 30) {
      reputation.brier_score_history.shift();
    }
    
    reputation.last_updated = new Date();
    this.recalculateTruthScore(reputation);
  }
  
  /**
   * Get verification records for an agent
   */
  getVerificationRecords(agentId: string): VerificationRecord[] {
    return this.verifications.get(agentId) || [];
  }
  
  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================
  
  private handleTradeExecuted(event: any): void {
    const { agent_id, pnl, side, price, outcome } = event;
    
    // Record the prediction
    if (agent_id && outcome) {
      this.recordPrediction(agent_id, event.market_id, side, price, price);
    }
  }
  
  private handleMarketResolved(event: any): void {
    const { market_id, outcome, oracle_source } = event;
    
    // Find and verify all predictions for this market
    for (const [agentId, records] of this.verifications.entries()) {
      for (const record of records) {
        if (record.market_id === market_id && !record.oracle_verified) {
          this.verifyPrediction(record.id, outcome, oracle_source);
        }
      }
    }
  }
  
  // ===========================================================================
  // COMBINED VIEW
  // ===========================================================================
  
  /**
   * Get full agent profile (all three tiers)
   */
  getAgentProfile(agentId: string): object | undefined {
    const identity = this.identities.get(agentId);
    const reputation = this.reputations.get(agentId);
    const verifications = this.verifications.get(agentId) || [];
    
    if (!identity) return undefined;
    
    return {
      identity,
      reputation,
      verification_summary: {
        total_predictions: verifications.length,
        verified_predictions: verifications.filter(v => v.oracle_verified).length,
        correct_predictions: verifications.filter(v => v.correct === true).length,
        recent_verifications: verifications.slice(-5),
      },
    };
  }
}

// Singleton
let reputationLedger: ReputationLedger | null = null;

export function getReputationLedger(eventBus: EventBus): ReputationLedger {
  if (!reputationLedger) {
    reputationLedger = new ReputationLedger(eventBus);
  }
  return reputationLedger;
}
