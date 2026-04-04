/**
 * TRUTH-NET Settlement Service
 *
 * THE CRITICAL MISSING PIECE.
 *
 * This bridges the gap between oracle resolution and rating updates:
 *   markets.resolved → SettlementService → settlements.completed → RatingEngine
 *
 * When a market resolves:
 * 1. Collect all trades for that market
 * 2. Determine winners (held correct outcome) and losers
 * 3. Calculate payouts (winners get 1.0 per share, losers get 0)
 * 4. Move funds via EscrowLedger
 * 5. Publish settlements.completed for RatingEngine
 */

import { EventBus } from '../events/EventBus.js';
import { EscrowLedger } from '../engine/escrow/EscrowLedger.js';

// ============================================================================
// TYPES
// ============================================================================

interface TradeRecord {
  id: string;
  market_id: string;
  buyer_id: string;
  seller_id: string;
  outcome: string; // 'yes' | 'no'
  price: number;
  quantity: number;
  executed_at: Date;
}

interface Position {
  agent_id: string;
  outcome: string;
  quantity: number;       // Net shares held
  avg_price: number;      // Weighted average entry price
  total_cost: number;     // Total capital deployed
}

interface SettlementPayout {
  agent_id: string;
  market_id: string;
  outcome: string;
  quantity: number;
  entry_price: number;
  payout: number;
  profit_loss: number;
  won: boolean;
}

interface AgentSettlementRecord {
  market_id: string;
  outcome: 'yes' | 'no';
  payout: number;
  profit_loss: number;
  settled_at: string;
  won: boolean;
}

// ============================================================================
// SETTLEMENT SERVICE
// ============================================================================

export class SettlementService {
  private trades: Map<string, TradeRecord[]> = new Map(); // marketId → trades
  private settledMarkets: Set<string> = new Set();
  private agentSettlements: Map<string, AgentSettlementRecord[]> = new Map(); // agentId → records
  private totalPayoutValue = 0;

  constructor(
    private escrow: EscrowLedger,
    private eventBus: EventBus,
  ) {
    // Track all trades as they happen
    this.eventBus.subscribe('trades.executed', (data: any) => {
      this.recordTrade(data.trade || data);
    });

    // When a market resolves, settle it
    this.eventBus.subscribe('markets.resolved', (data: any) => {
      this.settleMarket(data).catch(err => {
        console.error(`[Settlement] Failed to settle market: ${err.message}`);
      });
    });

    console.log('[Settlement] Service initialized — listening for trades and resolutions');
  }

  // =========================================================================
  // TRADE RECORDING
  // =========================================================================

  private recordTrade(trade: any): void {
    const record: TradeRecord = {
      id: trade.id,
      market_id: trade.market_id,
      buyer_id: trade.buyer_id,
      seller_id: trade.seller_id,
      outcome: trade.outcome?.toLowerCase() || 'yes',
      price: trade.price,
      quantity: trade.quantity,
      executed_at: new Date(trade.executed_at || Date.now()),
    };

    const marketTrades = this.trades.get(record.market_id) || [];
    marketTrades.push(record);
    this.trades.set(record.market_id, marketTrades);
  }

  /**
   * Manually add a trade record (used by seeder)
   */
  addTrade(trade: TradeRecord): void {
    this.recordTrade(trade);
  }

  // =========================================================================
  // POSITION AGGREGATION
  // =========================================================================

  private aggregatePositions(marketId: string): Map<string, Position> {
    const trades = this.trades.get(marketId) || [];
    const positions = new Map<string, Position>();

    for (const trade of trades) {
      // Buyer gets shares of the outcome
      const buyerKey = `${trade.buyer_id}:${trade.outcome}`;
      const buyerPos = positions.get(buyerKey) || {
        agent_id: trade.buyer_id,
        outcome: trade.outcome,
        quantity: 0,
        avg_price: 0,
        total_cost: 0,
      };
      const newBuyerQty = buyerPos.quantity + trade.quantity;
      buyerPos.total_cost += trade.price * trade.quantity;
      buyerPos.avg_price = buyerPos.total_cost / newBuyerQty;
      buyerPos.quantity = newBuyerQty;
      positions.set(buyerKey, buyerPos);

      // Seller gets shares of the OPPOSITE outcome (in prediction markets,
      // selling YES = buying NO, effectively)
      const sellerOutcome = trade.outcome === 'yes' ? 'no' : 'yes';
      const sellerKey = `${trade.seller_id}:${sellerOutcome}`;
      const sellerPos = positions.get(sellerKey) || {
        agent_id: trade.seller_id,
        outcome: sellerOutcome,
        quantity: 0,
        avg_price: 0,
        total_cost: 0,
      };
      const newSellerQty = sellerPos.quantity + trade.quantity;
      sellerPos.total_cost += (1 - trade.price) * trade.quantity;
      sellerPos.avg_price = sellerPos.total_cost / newSellerQty;
      sellerPos.quantity = newSellerQty;
      positions.set(sellerKey, sellerPos);
    }

    return positions;
  }

  // =========================================================================
  // SETTLEMENT
  // =========================================================================

  async settleMarket(resolutionData: any): Promise<SettlementPayout[]> {
    const marketId = resolutionData.market_id || resolutionData.marketId;
    if (!marketId) {
      console.error('[Settlement] No market_id in resolution data');
      return [];
    }

    // Prevent double settlement
    if (this.settledMarkets.has(marketId)) {
      console.log(`[Settlement] Market ${marketId} already settled, skipping`);
      return [];
    }

    const trades = this.trades.get(marketId);
    if (!trades || trades.length === 0) {
      console.log(`[Settlement] No trades for market ${marketId}`);
      this.settledMarkets.add(marketId);
      return [];
    }

    // Determine winning outcome
    const winningOutcome = this.determineWinningOutcome(resolutionData);
    console.log(`[Settlement] Settling market ${marketId} — outcome: ${winningOutcome} — ${trades.length} trades`);

    // Aggregate positions
    const positions = this.aggregatePositions(marketId);

    // Calculate payouts
    const payouts: SettlementPayout[] = [];

    for (const [_key, position] of positions) {
      const won = position.outcome === winningOutcome;
      const payout = won ? position.quantity * 1.0 : 0; // Winners get $1/share
      const profitLoss = payout - position.total_cost;

      payouts.push({
        agent_id: position.agent_id,
        market_id: marketId,
        outcome: position.outcome,
        quantity: position.quantity,
        entry_price: position.avg_price,
        payout,
        profit_loss: profitLoss,
        won,
      });

      // Process fund movements
      try {
        if (won && payout > 0) {
          // Credit winner
          await this.escrow.deposit(position.agent_id, payout, `Settlement win: market ${marketId}`);
        }
        // Losers already had funds locked/transferred during trade execution
      } catch (err: any) {
        console.error(`[Settlement] Failed to process payout for ${position.agent_id}: ${err.message}`);
      }
    }

    // Store per-agent settlement records
    const settledAt = new Date().toISOString();
    for (const p of payouts) {
      const records = this.agentSettlements.get(p.agent_id) || [];
      records.push({
        market_id: p.market_id,
        outcome: p.outcome as 'yes' | 'no',
        payout: p.payout,
        profit_loss: p.profit_loss,
        settled_at: settledAt,
        won: p.won,
      });
      this.agentSettlements.set(p.agent_id, records);
      this.totalPayoutValue += p.payout;
    }

    // Mark as settled
    this.settledMarkets.add(marketId);

    // Publish settlement event — this is what RatingEngine is waiting for
    this.eventBus.publish('settlements.completed', {
      market_id: marketId,
      winning_outcome: winningOutcome,
      total_trades: trades.length,
      total_positions: positions.size,
      payouts: payouts.map(p => ({
        agent_id: p.agent_id,
        market_id: p.market_id,
        outcome: p.outcome,
        quantity: p.quantity,
        payout: p.payout,
        profit_loss: p.profit_loss,
        won: p.won,
      })),
      settled_at: new Date().toISOString(),
    });

    console.log(`[Settlement] Market ${marketId} settled — ${payouts.length} positions, ` +
      `${payouts.filter(p => p.won).length} winners, ${payouts.filter(p => !p.won).length} losers`);

    // Clean up trade history for this market (save memory)
    if (this.settledMarkets.size > 100) {
      let removed = 0;
      for (const id of this.settledMarkets) {
        if (removed >= 20) break;
        this.trades.delete(id);
        this.settledMarkets.delete(id);
        removed++;
      }
    }

    return payouts;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private determineWinningOutcome(resolutionData: any): string {
    // The oracle resolution can come in several formats
    if (resolutionData.outcome) return resolutionData.outcome.toLowerCase();
    if (resolutionData.winning_outcome) return resolutionData.winning_outcome.toLowerCase();
    if (resolutionData.result === true || resolutionData.result === 'yes') return 'yes';
    if (resolutionData.result === false || resolutionData.result === 'no') return 'no';
    // Default
    return 'yes';
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  getTradesForMarket(marketId: string): TradeRecord[] {
    return this.trades.get(marketId) || [];
  }

  getTradeCount(): number {
    let total = 0;
    for (const trades of this.trades.values()) {
      total += trades.length;
    }
    return total;
  }

  getSettledMarketCount(): number {
    return this.settledMarkets.size;
  }

  getAgentPnL(agentId: string) {
    const settlements = this.agentSettlements.get(agentId) || [];
    let totalPnl = 0;
    let won = 0;
    let lost = 0;
    for (const s of settlements) {
      totalPnl += s.profit_loss;
      if (s.won) won++;
      else lost++;
    }
    return {
      total_pnl: totalPnl,
      markets_participated: settlements.length,
      markets_won: won,
      markets_lost: lost,
      settlements: settlements.map(s => ({
        market_id: s.market_id,
        outcome: s.outcome,
        payout: s.payout,
        profit_loss: s.profit_loss,
        settled_at: s.settled_at,
      })),
    };
  }

  getStats() {
    return {
      totalSettlements: this.agentSettlements.size,
      totalMarketsResolved: this.settledMarkets.size,
      totalPayoutValue: this.totalPayoutValue,
      active_markets: this.trades.size - this.settledMarkets.size,
      settled_markets: this.settledMarkets.size,
      total_trades_tracked: this.getTradeCount(),
    };
  }
}
