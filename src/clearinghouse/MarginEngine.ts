/**
 * TRUTH-NET Margin Engine & CCP Novation
 * 
 * Central Counterparty Clearinghouse Implementation:
 * - CCP Novation: Every trade bifurcated (Agent A <-> TRUTH-NET <-> Agent B)
 * - Initial Margin: 20%
 * - Maintenance Margin: 10%
 * - Auto-Liquidation when equity < 10%
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface MarginAccount {
  agent_id: string;
  
  // Balances
  cash_balance: number;
  margin_used: number;
  margin_available: number;
  
  // Positions
  positions: Position[];
  
  // Margin metrics
  equity: number;
  margin_ratio: number;
  maintenance_margin: number;
  
  // Status
  status: 'healthy' | 'warning' | 'margin_call' | 'liquidating';
  last_updated: Date;
}

export interface Position {
  id: string;
  market_id: string;
  ticker: string;
  side: 'yes' | 'no';
  size: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  margin_requirement: number;
  opened_at: Date;
}

export interface NovatedTrade {
  id: string;
  original_trade_id: string;
  
  // Leg A: Agent -> CCP
  leg_a: {
    counterparty: string; // Agent ID
    direction: 'buy' | 'sell';
    price: number;
    size: number;
  };
  
  // Leg B: CCP -> Agent
  leg_b: {
    counterparty: string; // Agent ID
    direction: 'buy' | 'sell';
    price: number;
    size: number;
  };
  
  // CCP is in the middle
  ccp_id: 'TRUTH-NET-CCP';
  
  market_id: string;
  outcome: 'yes' | 'no';
  executed_at: Date;
  status: 'pending' | 'cleared' | 'settled' | 'defaulted';
}

export interface LiquidationEvent {
  id: string;
  agent_id: string;
  positions_liquidated: string[];
  total_value: number;
  loss_absorbed: number;
  trigger_reason: 'margin_call' | 'maintenance_breach' | 'manual';
  executed_at: Date;
}

// ============================================================================
// MARGIN CONSTANTS
// ============================================================================

export const MARGIN_CONSTANTS = {
  INITIAL_MARGIN_RATE: 0.20,      // 20% initial margin
  MAINTENANCE_MARGIN_RATE: 0.10,  // 10% maintenance margin
  LIQUIDATION_THRESHOLD: 0.10,    // Liquidate when equity < 10%
  WARNING_THRESHOLD: 0.15,        // Warning when equity < 15%
  MAX_LEVERAGE: 5,                // 5x max leverage
} as const;

// ============================================================================
// MARGIN ENGINE
// ============================================================================

export class MarginEngine {
  private accounts: Map<string, MarginAccount> = new Map();
  private novatedTrades: Map<string, NovatedTrade> = new Map();
  private liquidationQueue: LiquidationEvent[] = [];
  
  constructor(private eventBus: EventBus) {
    // Start margin monitoring loop
    this.startMonitoringLoop();
  }
  
  // ===========================================================================
  // ACCOUNT MANAGEMENT
  // ===========================================================================
  
  /**
   * Get or create margin account for agent
   */
  getAccount(agentId: string): MarginAccount {
    let account = this.accounts.get(agentId);
    
    if (!account) {
      account = {
        agent_id: agentId,
        cash_balance: 100000, // Default starting balance
        margin_used: 0,
        margin_available: 100000,
        positions: [],
        equity: 100000,
        margin_ratio: 1,
        maintenance_margin: 0,
        status: 'healthy',
        last_updated: new Date(),
      };
      this.accounts.set(agentId, account);
    }
    
    return account;
  }
  
  /**
   * Deposit funds to margin account
   */
  deposit(agentId: string, amount: number): MarginAccount {
    const account = this.getAccount(agentId);
    account.cash_balance += amount;
    account.margin_available += amount;
    account.equity += amount;
    account.last_updated = new Date();
    
    this.recalculateMarginRatio(account);
    this.eventBus.publish('margin.deposit', { agent_id: agentId, amount });
    
    return account;
  }
  
  /**
   * Withdraw funds from margin account
   */
  withdraw(agentId: string, amount: number): MarginAccount {
    const account = this.getAccount(agentId);
    
    if (amount > account.margin_available) {
      throw new Error('Insufficient available margin for withdrawal');
    }
    
    account.cash_balance -= amount;
    account.margin_available -= amount;
    account.equity -= amount;
    account.last_updated = new Date();
    
    this.recalculateMarginRatio(account);
    this.eventBus.publish('margin.withdraw', { agent_id: agentId, amount });
    
    return account;
  }
  
  // ===========================================================================
  // CCP NOVATION
  // ===========================================================================
  
  /**
   * Novate a trade through the CCP
   * Every trade becomes: Agent A <-> TRUTH-NET-CCP <-> Agent B
   */
  novateTrade(
    buyerAgentId: string,
    sellerAgentId: string,
    marketId: string,
    outcome: 'yes' | 'no',
    price: number,
    size: number
  ): NovatedTrade {
    const tradeId = uuidv4();
    
    // Create novated trade with CCP in the middle
    const novatedTrade: NovatedTrade = {
      id: uuidv4(),
      original_trade_id: tradeId,
      leg_a: {
        counterparty: buyerAgentId,
        direction: 'buy',
        price,
        size,
      },
      leg_b: {
        counterparty: sellerAgentId,
        direction: 'sell',
        price,
        size,
      },
      ccp_id: 'TRUTH-NET-CCP',
      market_id: marketId,
      outcome,
      executed_at: new Date(),
      status: 'pending',
    };
    
    // Check margin requirements for both parties
    const buyerMarginOk = this.checkMarginRequirement(buyerAgentId, price * size);
    const sellerMarginOk = this.checkMarginRequirement(sellerAgentId, (1 - price) * size);
    
    if (!buyerMarginOk) {
      throw new Error(`Buyer ${buyerAgentId} has insufficient margin`);
    }
    
    if (!sellerMarginOk) {
      throw new Error(`Seller ${sellerAgentId} has insufficient margin`);
    }
    
    // Lock margin for both parties
    this.lockMargin(buyerAgentId, price * size * MARGIN_CONSTANTS.INITIAL_MARGIN_RATE);
    this.lockMargin(sellerAgentId, (1 - price) * size * MARGIN_CONSTANTS.INITIAL_MARGIN_RATE);
    
    // Create positions
    this.createPosition(buyerAgentId, marketId, outcome, 'yes', size, price);
    this.createPosition(sellerAgentId, marketId, outcome, 'no', size, 1 - price);
    
    // Mark trade as cleared
    novatedTrade.status = 'cleared';
    this.novatedTrades.set(novatedTrade.id, novatedTrade);
    
    this.eventBus.publish('ccp.trade_novated', novatedTrade);
    
    return novatedTrade;
  }
  
  // ===========================================================================
  // MARGIN CALCULATIONS
  // ===========================================================================
  
  /**
   * Check if agent has sufficient margin for a trade
   */
  checkMarginRequirement(agentId: string, notionalValue: number): boolean {
    const account = this.getAccount(agentId);
    const requiredMargin = notionalValue * MARGIN_CONSTANTS.INITIAL_MARGIN_RATE;
    return account.margin_available >= requiredMargin;
  }
  
  /**
   * Lock margin for a position
   */
  private lockMargin(agentId: string, amount: number): void {
    const account = this.getAccount(agentId);
    account.margin_used += amount;
    account.margin_available -= amount;
    account.last_updated = new Date();
    this.recalculateMarginRatio(account);
  }
  
  /**
   * Release margin when position closes
   */
  private releaseMargin(agentId: string, amount: number): void {
    const account = this.getAccount(agentId);
    account.margin_used -= amount;
    account.margin_available += amount;
    account.last_updated = new Date();
    this.recalculateMarginRatio(account);
  }
  
  /**
   * Create a position for an agent
   */
  private createPosition(
    agentId: string,
    marketId: string,
    outcome: 'yes' | 'no',
    side: 'yes' | 'no',
    size: number,
    entryPrice: number
  ): Position {
    const account = this.getAccount(agentId);
    
    const position: Position = {
      id: uuidv4(),
      market_id: marketId,
      ticker: `POS-${marketId.slice(0, 8)}`,
      side,
      size,
      entry_price: entryPrice,
      current_price: entryPrice,
      unrealized_pnl: 0,
      realized_pnl: 0,
      margin_requirement: size * entryPrice * MARGIN_CONSTANTS.INITIAL_MARGIN_RATE,
      opened_at: new Date(),
    };
    
    account.positions.push(position);
    account.maintenance_margin += size * MARGIN_CONSTANTS.MAINTENANCE_MARGIN_RATE;
    account.last_updated = new Date();
    
    return position;
  }
  
  /**
   * Recalculate margin ratio and update status
   */
  private recalculateMarginRatio(account: MarginAccount): void {
    // Calculate total equity
    const unrealizedPnl = account.positions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
    account.equity = account.cash_balance + unrealizedPnl;
    
    // Calculate margin ratio
    if (account.margin_used > 0) {
      account.margin_ratio = account.equity / account.margin_used;
    } else {
      account.margin_ratio = 1;
    }
    
    // Update status based on margin ratio
    if (account.margin_ratio < MARGIN_CONSTANTS.LIQUIDATION_THRESHOLD) {
      account.status = 'liquidating';
      this.triggerLiquidation(account);
    } else if (account.margin_ratio < MARGIN_CONSTANTS.MAINTENANCE_MARGIN_RATE) {
      account.status = 'margin_call';
      this.eventBus.publish('margin.margin_call', { agent_id: account.agent_id });
    } else if (account.margin_ratio < MARGIN_CONSTANTS.WARNING_THRESHOLD) {
      account.status = 'warning';
      this.eventBus.publish('margin.warning', { agent_id: account.agent_id });
    } else {
      account.status = 'healthy';
    }
  }
  
  // ===========================================================================
  // AUTO-LIQUIDATION
  // ===========================================================================
  
  /**
   * Trigger liquidation for an account
   */
  private triggerLiquidation(account: MarginAccount): void {
    if (account.positions.length === 0) return;
    
    const liquidation: LiquidationEvent = {
      id: uuidv4(),
      agent_id: account.agent_id,
      positions_liquidated: [],
      total_value: 0,
      loss_absorbed: 0,
      trigger_reason: 'maintenance_breach',
      executed_at: new Date(),
    };
    
    // Force-close all positions at mid-price
    for (const position of account.positions) {
      const midPrice = position.current_price;
      const closeValue = position.size * midPrice;
      const pnl = (midPrice - position.entry_price) * position.size * (position.side === 'yes' ? 1 : -1);
      
      liquidation.positions_liquidated.push(position.id);
      liquidation.total_value += closeValue;
      
      if (pnl < 0) {
        liquidation.loss_absorbed += Math.abs(pnl);
      }
      
      // Apply P&L to account
      account.cash_balance += pnl;
      
      // Release margin
      this.releaseMargin(account.agent_id, position.margin_requirement);
    }
    
    // Clear positions
    account.positions = [];
    account.maintenance_margin = 0;
    account.status = 'healthy';
    
    this.liquidationQueue.push(liquidation);
    this.eventBus.publish('liquidation.executed', liquidation);
    
    console.log(`[MarginEngine] Liquidated agent ${account.agent_id}: ${liquidation.positions_liquidated.length} positions`);
  }
  
  /**
   * Update position prices (called from market data feed)
   */
  updatePositionPrices(marketId: string, yesPrice: number): void {
    for (const account of this.accounts.values()) {
      for (const position of account.positions) {
        if (position.market_id === marketId) {
          const newPrice = position.side === 'yes' ? yesPrice : (1 - yesPrice);
          position.current_price = newPrice;
          position.unrealized_pnl = (newPrice - position.entry_price) * position.size;
        }
      }
      
      this.recalculateMarginRatio(account);
    }
  }
  
  // ===========================================================================
  // MONITORING
  // ===========================================================================
  
  /**
   * Start the margin monitoring loop
   */
  private startMonitoringLoop(): void {
    setInterval(() => {
      for (const account of this.accounts.values()) {
        this.recalculateMarginRatio(account);
      }
    }, 5000); // Check every 5 seconds
  }
  
  /**
   * Get all accounts summary
   */
  getAllAccountsSummary(): object {
    const accounts = Array.from(this.accounts.values());
    
    return {
      total_accounts: accounts.length,
      total_equity: accounts.reduce((sum, a) => sum + a.equity, 0),
      total_margin_used: accounts.reduce((sum, a) => sum + a.margin_used, 0),
      accounts_by_status: {
        healthy: accounts.filter(a => a.status === 'healthy').length,
        warning: accounts.filter(a => a.status === 'warning').length,
        margin_call: accounts.filter(a => a.status === 'margin_call').length,
        liquidating: accounts.filter(a => a.status === 'liquidating').length,
      },
      recent_liquidations: this.liquidationQueue.slice(-10),
    };
  }
  
  /**
   * Get all novated trades
   */
  getNovatedTrades(): NovatedTrade[] {
    return Array.from(this.novatedTrades.values());
  }
}

// Singleton instance
let marginEngine: MarginEngine | null = null;

export function getMarginEngine(eventBus: EventBus): MarginEngine {
  if (!marginEngine) {
    marginEngine = new MarginEngine(eventBus);
  }
  return marginEngine;
}
