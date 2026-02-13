/**
 * TRUTH-NET Rating Engine
 * 
 * Computes TruthScore — a composite rating for AI trading agents
 * based on oracle-verified prediction market performance.
 * 
 * TruthScore = (Brier × 0.35) + (Sharpe × 0.25) + (WinRate × 0.20) + (Consistency × 0.10) + (Risk × 0.10)
 * 
 * Grade Scale:
 *   AAA (90-100) | AA (80-89) | A (70-79) | BBB (60-69) | BB (50-59) | B (40-49) | CCC (<40) | NR (unrated)
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type RatingGrade = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'NR';

export interface AgentRating {
  agent_id: string;
  truth_score: number;         // 0-100 composite score
  grade: RatingGrade;
  certified: boolean;
  certified_at?: Date;

  // Component scores (each 0-1, weighted into truth_score)
  brier_component: number;     // 35% — prediction accuracy
  sharpe_component: number;    // 25% — risk-adjusted returns
  winrate_component: number;   // 20% — raw win rate
  consistency_component: number; // 10% — score stability
  risk_component: number;      // 10% — drawdown management

  // Raw metrics
  brier_score: number;         // 0 = perfect, 1 = worst
  sharpe_ratio: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;

  // History
  score_history: { date: string; score: number; grade: RatingGrade }[];
  
  // Meta
  last_updated: Date;
  rating_period_start?: Date;
  rating_period_end?: Date;
}

export interface RatingSnapshot {
  id: string;
  agent_id: string;
  truth_score: number;
  grade: RatingGrade;
  previous_grade: RatingGrade;
  grade_change: 'upgrade' | 'downgrade' | 'maintain';
  components: {
    brier: number;
    sharpe: number;
    winrate: number;
    consistency: number;
    risk: number;
  };
  created_at: Date;
}

export interface Certification {
  id: string;
  agent_id: string;
  grade: RatingGrade;
  truth_score: number;
  issued_at: Date;
  expires_at: Date;
  revoked: boolean;
}

// Minimum trades required before an agent can be rated
const MIN_TRADES_FOR_RATING = 20;
// Minimum trades for certification
const MIN_TRADES_FOR_CERTIFICATION = 50;
// Certification validity in days
const CERTIFICATION_VALIDITY_DAYS = 90;

// ============================================================================
// GRADE CALCULATOR
// ============================================================================

export function computeGrade(truthScore: number): RatingGrade {
  if (truthScore >= 90) return 'AAA';
  if (truthScore >= 80) return 'AA';
  if (truthScore >= 70) return 'A';
  if (truthScore >= 60) return 'BBB';
  if (truthScore >= 50) return 'BB';
  if (truthScore >= 40) return 'B';
  return 'CCC';
}

export function gradeToColor(grade: RatingGrade): string {
  switch (grade) {
    case 'AAA': return '#10b981'; // emerald
    case 'AA': return '#06b6d4';  // cyan
    case 'A': return '#3b82f6';   // blue
    case 'BBB': return '#f59e0b'; // amber
    case 'BB': return '#f97316';  // orange
    case 'B': return '#ef4444';   // red
    case 'CCC': return '#dc2626'; // dark red
    case 'NR': return '#6b7280';  // gray
  }
}

// ============================================================================
// RATING ENGINE
// ============================================================================

export class RatingEngine {
  private ratings: Map<string, AgentRating> = new Map();
  private snapshots: Map<string, RatingSnapshot[]> = new Map();
  private certifications: Map<string, Certification[]> = new Map();
  private pnlHistory: Map<string, number[]> = new Map(); // For Sharpe/drawdown calc

  constructor(private eventBus: EventBus) {
    // Listen for trade settlements to update ratings
    this.eventBus.subscribe('settlements.completed', (data: any) => {
      this.processSettlement(data);
    });

    this.eventBus.subscribe('trades.executed', (data: any) => {
      if (data.buyer_id) this.recordTradeForAgent(data.buyer_id, data);
      if (data.seller_id) this.recordTradeForAgent(data.seller_id, data);
    });

    this.eventBus.subscribe('agents.reputation_updated', (data: any) => {
      this.recalculateRating(data.agent_id);
    });
  }

  // =========================================================================
  // RATING COMPUTATION
  // =========================================================================

  /**
   * Initialize rating for a new agent
   */
  initializeRating(agentId: string): AgentRating {
    const rating: AgentRating = {
      agent_id: agentId,
      truth_score: 50,
      grade: 'NR',
      certified: false,
      brier_component: 0,
      sharpe_component: 0,
      winrate_component: 0,
      consistency_component: 0,
      risk_component: 0,
      brier_score: 0.25,
      sharpe_ratio: 0,
      win_rate: 0,
      max_drawdown: 0,
      total_trades: 0,
      winning_trades: 0,
      total_pnl: 0,
      score_history: [],
      last_updated: new Date(),
    };

    this.ratings.set(agentId, rating);
    this.pnlHistory.set(agentId, []);
    this.snapshots.set(agentId, []);
    this.certifications.set(agentId, []);

    return rating;
  }

  /**
   * Recalculate TruthScore for an agent
   */
  recalculateRating(agentId: string): AgentRating {
    let rating = this.ratings.get(agentId);
    if (!rating) {
      rating = this.initializeRating(agentId);
    }

    // Not enough trades to rate
    if (rating.total_trades < MIN_TRADES_FOR_RATING) {
      rating.grade = 'NR';
      rating.last_updated = new Date();
      return rating;
    }

    const previousGrade = rating.grade;

    // Component 1: Brier Score (35%) — lower is better, invert to 0-1
    const brierNormalized = Math.max(0, Math.min(1, 1 - rating.brier_score));
    rating.brier_component = brierNormalized;

    // Component 2: Sharpe Ratio (25%) — normalize to 0-1 (cap at 3.0)
    const sharpeNormalized = Math.max(0, Math.min(1, rating.sharpe_ratio / 3));
    rating.sharpe_component = sharpeNormalized;

    // Component 3: Win Rate (20%) — already 0-1
    rating.winrate_component = rating.win_rate;

    // Component 4: Consistency (10%) — low variance in score history
    const consistencyScore = this.calculateConsistency(agentId);
    rating.consistency_component = consistencyScore;

    // Component 5: Risk Management (10%) — inverse of max drawdown
    const riskScore = Math.max(0, 1 - rating.max_drawdown);
    rating.risk_component = riskScore;

    // Weighted composite (0-100 scale)
    rating.truth_score = (
      rating.brier_component * 0.35 +
      rating.sharpe_component * 0.25 +
      rating.winrate_component * 0.20 +
      rating.consistency_component * 0.10 +
      rating.risk_component * 0.10
    ) * 100;

    // Clamp to 0-100
    rating.truth_score = Math.max(0, Math.min(100, rating.truth_score));

    // Assign grade
    rating.grade = computeGrade(rating.truth_score);
    rating.last_updated = new Date();

    // Record history
    const today = new Date().toISOString().split('T')[0];
    rating.score_history.push({
      date: today,
      score: rating.truth_score,
      grade: rating.grade,
    });

    // Keep last 90 days
    if (rating.score_history.length > 90) {
      rating.score_history.shift();
    }

    // Check for grade change
    if (previousGrade !== rating.grade && previousGrade !== 'NR') {
      const gradeOrder = ['CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'];
      const prevIdx = gradeOrder.indexOf(previousGrade);
      const newIdx = gradeOrder.indexOf(rating.grade);
      const change = newIdx > prevIdx ? 'upgrade' : 'downgrade';

      // Create snapshot
      const snapshot: RatingSnapshot = {
        id: uuidv4(),
        agent_id: agentId,
        truth_score: rating.truth_score,
        grade: rating.grade,
        previous_grade: previousGrade,
        grade_change: change,
        components: {
          brier: rating.brier_component,
          sharpe: rating.sharpe_component,
          winrate: rating.winrate_component,
          consistency: rating.consistency_component,
          risk: rating.risk_component,
        },
        created_at: new Date(),
      };

      const agentSnapshots = this.snapshots.get(agentId) || [];
      agentSnapshots.push(snapshot);
      this.snapshots.set(agentId, agentSnapshots);

      // Emit grade change event
      this.eventBus.publish('ratings.grade_changed', {
        agent_id: agentId,
        truth_score: rating.truth_score,
        grade: rating.grade,
        previous_grade: previousGrade,
        grade_change: change,
      });
    }

    // Emit rating update event
    this.eventBus.publish('ratings.updated', {
      agent_id: agentId,
      truth_score: rating.truth_score,
      grade: rating.grade,
    });

    return rating;
  }

  // =========================================================================
  // HELPER CALCULATIONS
  // =========================================================================

  private calculateConsistency(agentId: string): number {
    const rating = this.ratings.get(agentId);
    if (!rating || rating.score_history.length < 5) return 0.5;

    const scores = rating.score_history.map(h => h.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = more consistent = higher score
    // Normalize: stdDev of 0 = perfect (1.0), stdDev of 20+ = poor (0.0)
    return Math.max(0, Math.min(1, 1 - (stdDev / 20)));
  }

  private calculateSharpeRatio(agentId: string): number {
    const pnls = this.pnlHistory.get(agentId) || [];
    if (pnls.length < 5) return 0;

    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return mean > 0 ? 3 : 0;
    return mean / stdDev;
  }

  private calculateMaxDrawdown(agentId: string): number {
    const pnls = this.pnlHistory.get(agentId) || [];
    if (pnls.length < 2) return 0;

    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;

    for (const pnl of pnls) {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return Math.min(1, maxDrawdown);
  }

  // =========================================================================
  // TRADE PROCESSING
  // =========================================================================

  private recordTradeForAgent(agentId: string, tradeData: any): void {
    let rating = this.ratings.get(agentId);
    if (!rating) {
      rating = this.initializeRating(agentId);
    }

    rating.total_trades++;
    rating.last_updated = new Date();
  }

  private processSettlement(settlementData: any): void {
    if (!settlementData.payouts) return;

    for (const payout of settlementData.payouts) {
      const agentId = payout.agent_id;
      let rating = this.ratings.get(agentId);
      if (!rating) {
        rating = this.initializeRating(agentId);
      }

      // Update raw metrics
      const won = payout.profit_loss > 0;
      if (won) rating.winning_trades++;
      rating.total_pnl += payout.profit_loss;
      rating.win_rate = rating.total_trades > 0 
        ? rating.winning_trades / rating.total_trades 
        : 0;

      // Record PnL for Sharpe/drawdown
      const pnls = this.pnlHistory.get(agentId) || [];
      pnls.push(payout.profit_loss);
      this.pnlHistory.set(agentId, pnls);

      // Recalculate derived metrics
      rating.sharpe_ratio = this.calculateSharpeRatio(agentId);
      rating.max_drawdown = this.calculateMaxDrawdown(agentId);

      // Recalculate composite rating
      this.recalculateRating(agentId);
    }
  }

  // =========================================================================
  // UPDATE FROM REPUTATION ENGINE
  // =========================================================================

  /**
   * Update Brier score from reputation ledger
   */
  updateBrierScore(agentId: string, brierScore: number): void {
    let rating = this.ratings.get(agentId);
    if (!rating) {
      rating = this.initializeRating(agentId);
    }
    rating.brier_score = brierScore;
    this.recalculateRating(agentId);
  }

  // =========================================================================
  // CERTIFICATION
  // =========================================================================

  /**
   * Certify an agent (requires minimum trades and a minimum grade)
   */
  certifyAgent(agentId: string): Certification | null {
    const rating = this.ratings.get(agentId);
    if (!rating) return null;

    // Must meet minimum requirements
    if (rating.total_trades < MIN_TRADES_FOR_CERTIFICATION) return null;
    if (rating.grade === 'NR' || rating.grade === 'CCC') return null;

    const cert: Certification = {
      id: uuidv4(),
      agent_id: agentId,
      grade: rating.grade,
      truth_score: rating.truth_score,
      issued_at: new Date(),
      expires_at: new Date(Date.now() + CERTIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
      revoked: false,
    };

    const certs = this.certifications.get(agentId) || [];
    certs.push(cert);
    this.certifications.set(agentId, certs);

    rating.certified = true;
    rating.certified_at = cert.issued_at;

    this.eventBus.publish('ratings.certified', {
      agent_id: agentId,
      grade: rating.grade,
      truth_score: rating.truth_score,
      certification_id: cert.id,
    });

    return cert;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  getRating(agentId: string): AgentRating | undefined {
    return this.ratings.get(agentId);
  }

  getLeaderboard(limit: number = 20): AgentRating[] {
    return Array.from(this.ratings.values())
      .filter(r => r.grade !== 'NR')
      .sort((a, b) => b.truth_score - a.truth_score)
      .slice(0, limit);
  }

  getFullLeaderboard(limit: number = 50): AgentRating[] {
    return Array.from(this.ratings.values())
      .sort((a, b) => b.truth_score - a.truth_score)
      .slice(0, limit);
  }

  getCertifiedAgents(): AgentRating[] {
    return Array.from(this.ratings.values())
      .filter(r => r.certified)
      .sort((a, b) => b.truth_score - a.truth_score);
  }

  getCertifications(agentId: string): Certification[] {
    return this.certifications.get(agentId) || [];
  }

  getSnapshots(agentId: string): RatingSnapshot[] {
    return this.snapshots.get(agentId) || [];
  }

  compareAgents(agentIds: string[]): AgentRating[] {
    return agentIds
      .map(id => this.ratings.get(id))
      .filter((r): r is AgentRating => r !== undefined);
  }

  /**
   * Get rating distribution across all agents
   */
  getDistribution(): Record<RatingGrade, number> {
    const dist: Record<RatingGrade, number> = {
      'AAA': 0, 'AA': 0, 'A': 0, 'BBB': 0, 'BB': 0, 'B': 0, 'CCC': 0, 'NR': 0
    };
    for (const rating of this.ratings.values()) {
      dist[rating.grade]++;
    }
    return dist;
  }

  reset(): void {
    this.ratings.clear();
    this.snapshots.clear();
    this.certifications.clear();
    this.pnlHistory.clear();
  }
}

// Singleton
let ratingEngine: RatingEngine | null = null;

export function getRatingEngine(eventBus: EventBus): RatingEngine {
  if (!ratingEngine) {
    ratingEngine = new RatingEngine(eventBus);
  }
  return ratingEngine;
}
