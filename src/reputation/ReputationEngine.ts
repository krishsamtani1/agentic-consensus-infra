/**
 * TRUTH-NET Reputation Engine
 * Pillar C: Agent Reputation & Staking Layer
 *
 * Solves the 'Hallucination' problem by:
 * - Tracking agent prediction accuracy (Truth Score)
 * - Requiring capital staking to participate
 * - Rewarding winners and penalizing losers
 * - Creating a financial filter for accurate AI models
 */

import { Agent, Trade, OutcomeToken, SettlementResult } from '../types.js';
import { EventBus } from '../events/EventBus.js';

export interface ReputationConfig {
  // Base truth score for new agents
  initialTruthScore: number;

  // How much truth score changes per prediction
  truthScoreGain: number;      // On correct prediction
  truthScoreLoss: number;      // On incorrect prediction

  // Minimum stake required to place orders
  minStake: number;

  // Stake multiplier based on truth score
  stakeMultiplierLow: number;  // For truth_score < 0.3
  stakeMultiplierMid: number;  // For truth_score 0.3-0.7
  stakeMultiplierHigh: number; // For truth_score > 0.7
}

const DEFAULT_CONFIG: ReputationConfig = {
  initialTruthScore: 0.5,
  truthScoreGain: 0.01,
  truthScoreLoss: 0.015, // Losses hurt more than wins help
  minStake: 10,
  stakeMultiplierLow: 2.0,  // Low reputation = higher stake required
  stakeMultiplierMid: 1.0,
  stakeMultiplierHigh: 0.5, // High reputation = lower stake required
};

/**
 * Truth Score Calculator
 * Uses exponential moving average weighted by trade size
 */
export class TruthScoreCalculator {
  private config: ReputationConfig;

  constructor(config: Partial<ReputationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate new truth score after a market settlement
   */
  calculateNewScore(
    currentScore: number,
    wasCorrect: boolean,
    tradeSize: number,
    totalVolume: number
  ): number {
    // Weight by relative trade size
    const weight = Math.min(1, tradeSize / Math.max(totalVolume, 1));
    const baseChange = wasCorrect
      ? this.config.truthScoreGain
      : -this.config.truthScoreLoss;

    // Larger trades have more impact on score
    const change = baseChange * (0.5 + weight * 0.5);

    // Apply change with bounds
    const newScore = currentScore + change;
    return Math.max(0, Math.min(1, newScore));
  }

  /**
   * Calculate the stake multiplier for an agent
   * Lower truth score = higher stake required
   */
  getStakeMultiplier(truthScore: number): number {
    if (truthScore < 0.3) {
      return this.config.stakeMultiplierLow;
    } else if (truthScore > 0.7) {
      return this.config.stakeMultiplierHigh;
    } else {
      return this.config.stakeMultiplierMid;
    }
  }

  /**
   * Calculate minimum stake required for an order
   */
  getRequiredStake(orderValue: number, truthScore: number): number {
    const multiplier = this.getStakeMultiplier(truthScore);
    return Math.max(this.config.minStake, orderValue * multiplier * 0.1);
  }
}

/**
 * Reputation Engine
 * Manages agent reputation across market settlements
 */
export class ReputationEngine {
  private calculator: TruthScoreCalculator;
  private eventBus: EventBus;
  private agentScores: Map<string, number> = new Map();
  private agentStats: Map<string, {
    totalTrades: number;
    winningTrades: number;
    totalVolume: number;
    totalPnL: number;
  }> = new Map();

  constructor(eventBus: EventBus, config: Partial<ReputationConfig> = {}) {
    this.calculator = new TruthScoreCalculator(config);
    this.eventBus = eventBus;

    // Subscribe to settlement events
    this.eventBus.subscribe<SettlementResult>('settlements.completed', (result) => {
      this.processSettlement(result);
    });
  }

  /**
   * Initialize an agent's reputation
   */
  initializeAgent(agentId: string): void {
    if (!this.agentScores.has(agentId)) {
      this.agentScores.set(agentId, DEFAULT_CONFIG.initialTruthScore);
      this.agentStats.set(agentId, {
        totalTrades: 0,
        winningTrades: 0,
        totalVolume: 0,
        totalPnL: 0,
      });
    }
  }

  /**
   * Get an agent's current truth score
   */
  getTruthScore(agentId: string): number {
    return this.agentScores.get(agentId) ?? DEFAULT_CONFIG.initialTruthScore;
  }

  /**
   * Get an agent's full stats
   */
  getAgentStats(agentId: string) {
    const score = this.getTruthScore(agentId);
    const stats = this.agentStats.get(agentId) ?? {
      totalTrades: 0,
      winningTrades: 0,
      totalVolume: 0,
      totalPnL: 0,
    };

    return {
      truthScore: score,
      ...stats,
      winRate: stats.totalTrades > 0
        ? stats.winningTrades / stats.totalTrades
        : 0,
      stakeMultiplier: this.calculator.getStakeMultiplier(score),
    };
  }

  /**
   * Check if an agent can place an order
   */
  canPlaceOrder(agentId: string, orderValue: number, availableBalance: number): {
    allowed: boolean;
    requiredStake: number;
    reason?: string;
  } {
    const score = this.getTruthScore(agentId);
    const requiredStake = this.calculator.getRequiredStake(orderValue, score);

    if (availableBalance < requiredStake) {
      return {
        allowed: false,
        requiredStake,
        reason: `Insufficient stake: ${availableBalance.toFixed(2)} < ${requiredStake.toFixed(2)} required`,
      };
    }

    return { allowed: true, requiredStake };
  }

  /**
   * Process a market settlement and update agent reputations
   */
  private processSettlement(result: SettlementResult): void {
    const totalVolume = result.payouts.reduce((sum, p) => sum + Math.abs(p.amount), 0);

    for (const payout of result.payouts) {
      const agentId = payout.agent_id;
      this.initializeAgent(agentId);

      const currentScore = this.getTruthScore(agentId);
      const wasCorrect = payout.profit_loss > 0;

      // Calculate new truth score
      const newScore = this.calculator.calculateNewScore(
        currentScore,
        wasCorrect,
        payout.amount,
        totalVolume
      );

      // Update score
      this.agentScores.set(agentId, newScore);

      // Update stats
      const stats = this.agentStats.get(agentId)!;
      stats.totalTrades++;
      if (wasCorrect) stats.winningTrades++;
      stats.totalVolume += payout.amount;
      stats.totalPnL += payout.profit_loss;

      // Emit reputation update event
      this.eventBus.publish('agents.reputation_updated', {
        agent_id: agentId,
        old_score: currentScore,
        new_score: newScore,
        change: newScore - currentScore,
        was_correct: wasCorrect,
        pnl: payout.profit_loss,
      });
    }
  }

  /**
   * Get leaderboard of top agents by truth score
   */
  getLeaderboard(limit: number = 10): Array<{
    agentId: string;
    truthScore: number;
    winRate: number;
    totalPnL: number;
  }> {
    const entries = Array.from(this.agentScores.entries())
      .map(([agentId, score]) => {
        const stats = this.agentStats.get(agentId)!;
        return {
          agentId,
          truthScore: score,
          winRate: stats.totalTrades > 0
            ? stats.winningTrades / stats.totalTrades
            : 0,
          totalPnL: stats.totalPnL,
        };
      })
      .sort((a, b) => b.truthScore - a.truthScore);

    return entries.slice(0, limit);
  }

  /**
   * Reset all reputation data (for testing)
   */
  reset(): void {
    this.agentScores.clear();
    this.agentStats.clear();
  }
}
