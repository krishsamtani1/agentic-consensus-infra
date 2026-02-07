/**
 * TRUTH-NET Escrow Ledger
 * Manages agent funds, locking, and trade settlements
 *
 * Guarantees:
 * - Atomic balance updates
 * - Immutable transaction log
 * - No negative balances
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Wallet,
  WalletTransaction,
  TransactionType,
  EscrowLockResult,
} from '../../types.js';

/**
 * In-memory wallet state (production would use PostgreSQL with row-level locking)
 */
interface WalletState {
  wallet: Wallet;
  transactions: WalletTransaction[];
}

/**
 * Trade escrow - funds locked for pending trades
 */
interface TradeEscrow {
  trade_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_amount: number;
  seller_amount: number;
  created_at: Date;
}

/**
 * Escrow Ledger - manages all fund movements
 */
export class EscrowLedger {
  private wallets: Map<string, WalletState> = new Map();
  private tradeEscrows: Map<string, TradeEscrow> = new Map();
  private currency: string = 'USDC';

  // -------------------------------------------------------------------------
  // Wallet Management
  // -------------------------------------------------------------------------

  /**
   * Create a new wallet for an agent
   */
  createWallet(agentId: string, initialBalance: number = 0): Wallet {
    if (this.wallets.has(agentId)) {
      throw new Error(`Wallet already exists for agent ${agentId}`);
    }

    const wallet: Wallet = {
      id: uuidv4(),
      agent_id: agentId,
      currency: this.currency,
      available: initialBalance,
      locked: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const transactions: WalletTransaction[] = [];

    if (initialBalance > 0) {
      transactions.push(this.createTransaction(
        wallet.id,
        TransactionType.DEPOSIT,
        initialBalance,
        0,
        initialBalance,
        'Initial deposit'
      ));
    }

    this.wallets.set(agentId, { wallet, transactions });
    return wallet;
  }

  /**
   * Get wallet for an agent
   */
  getWallet(agentId: string): Wallet | undefined {
    return this.wallets.get(agentId)?.wallet;
  }

  /**
   * Get wallet balance
   */
  getBalance(agentId: string): { available: number; locked: number; total: number } | undefined {
    const state = this.wallets.get(agentId);
    if (!state) return undefined;

    return {
      available: state.wallet.available,
      locked: state.wallet.locked,
      total: state.wallet.available + state.wallet.locked,
    };
  }

  /**
   * Get transaction history for an agent
   */
  getTransactions(agentId: string, limit: number = 50): WalletTransaction[] {
    const state = this.wallets.get(agentId);
    if (!state) return [];
    return state.transactions.slice(-limit);
  }

  // -------------------------------------------------------------------------
  // Fund Operations
  // -------------------------------------------------------------------------

  /**
   * Deposit funds to available balance
   */
  async deposit(agentId: string, amount: number, description?: string): Promise<WalletTransaction> {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const state = this.wallets.get(agentId);
    if (!state) {
      throw new Error(`No wallet found for agent ${agentId}`);
    }

    const balanceBefore = state.wallet.available;
    state.wallet.available += amount;
    state.wallet.updated_at = new Date();

    const tx = this.createTransaction(
      state.wallet.id,
      TransactionType.DEPOSIT,
      amount,
      balanceBefore,
      state.wallet.available,
      description ?? 'Deposit'
    );

    state.transactions.push(tx);
    return tx;
  }

  /**
   * Withdraw funds from available balance
   */
  async withdraw(agentId: string, amount: number, description?: string): Promise<WalletTransaction> {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    const state = this.wallets.get(agentId);
    if (!state) {
      throw new Error(`No wallet found for agent ${agentId}`);
    }

    if (state.wallet.available < amount) {
      throw new Error(`Insufficient available balance: ${state.wallet.available} < ${amount}`);
    }

    const balanceBefore = state.wallet.available;
    state.wallet.available -= amount;
    state.wallet.updated_at = new Date();

    const tx = this.createTransaction(
      state.wallet.id,
      TransactionType.WITHDRAWAL,
      -amount,
      balanceBefore,
      state.wallet.available,
      description ?? 'Withdrawal'
    );

    state.transactions.push(tx);
    return tx;
  }

  // -------------------------------------------------------------------------
  // Stripe / External Deposit Operations
  // -------------------------------------------------------------------------

  /**
   * Deposit from Stripe with idempotency check (prevents double-credit)
   */
  private processedStripeSessionIds = new Set<string>();

  async depositFromStripe(userId: string, amount: number, stripeSessionId: string): Promise<WalletTransaction> {
    // Idempotency: prevent double-credit for same Stripe session
    if (this.processedStripeSessionIds.has(stripeSessionId)) {
      throw new Error(`Stripe session ${stripeSessionId} already processed`);
    }

    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    // Auto-create wallet if it doesn't exist
    if (!this.wallets.has(userId)) {
      this.createWallet(userId, 0);
    }

    this.processedStripeSessionIds.add(stripeSessionId);

    return this.deposit(userId, amount, `Stripe deposit (session: ${stripeSessionId.slice(0, 16)}...)`);
  }

  /**
   * Request withdrawal (locks funds, admin must approve)
   */
  async requestWithdrawal(userId: string, amount: number): Promise<EscrowLockResult> {
    return this.lock(userId, amount, 'withdrawal_pending');
  }

  // -------------------------------------------------------------------------
  // Escrow Operations
  // -------------------------------------------------------------------------

  /**
   * Lock funds from available to locked (for order placement)
   */
  async lock(
    agentId: string,
    amount: number,
    referenceType: string,
    referenceId?: string
  ): Promise<EscrowLockResult> {
    if (amount <= 0) {
      return { success: false, locked_amount: 0, error: 'Lock amount must be positive' };
    }

    const state = this.wallets.get(agentId);
    if (!state) {
      return { success: false, locked_amount: 0, error: `No wallet found for agent ${agentId}` };
    }

    if (state.wallet.available < amount) {
      return {
        success: false,
        locked_amount: 0,
        error: `Insufficient available balance: ${state.wallet.available.toFixed(4)} < ${amount.toFixed(4)}`,
      };
    }

    const balanceBefore = state.wallet.available;
    state.wallet.available -= amount;
    state.wallet.locked += amount;
    state.wallet.updated_at = new Date();

    const tx = this.createTransaction(
      state.wallet.id,
      TransactionType.ESCROW_LOCK,
      -amount,
      balanceBefore,
      state.wallet.available,
      `Escrow lock for ${referenceType}`,
      referenceType,
      referenceId
    );

    state.transactions.push(tx);

    return {
      success: true,
      locked_amount: amount,
      transaction_id: tx.id,
    };
  }

  /**
   * Release funds from locked back to available (order cancel, partial fill)
   */
  async release(
    agentId: string,
    amount: number,
    referenceType: string,
    referenceId?: string
  ): Promise<WalletTransaction> {
    if (amount <= 0) {
      throw new Error('Release amount must be positive');
    }

    const state = this.wallets.get(agentId);
    if (!state) {
      throw new Error(`No wallet found for agent ${agentId}`);
    }

    if (state.wallet.locked < amount) {
      throw new Error(`Insufficient locked balance: ${state.wallet.locked} < ${amount}`);
    }

    const balanceBefore = state.wallet.available;
    state.wallet.locked -= amount;
    state.wallet.available += amount;
    state.wallet.updated_at = new Date();

    const tx = this.createTransaction(
      state.wallet.id,
      TransactionType.ESCROW_RELEASE,
      amount,
      balanceBefore,
      state.wallet.available,
      `Escrow release for ${referenceType}`,
      referenceType,
      referenceId
    );

    state.transactions.push(tx);
    return tx;
  }

  /**
   * Transfer locked funds to trade escrow (when trade executes)
   */
  async transferToTradeEscrow(
    agentId: string,
    amount: number,
    tradeId: string
  ): Promise<void> {
    const state = this.wallets.get(agentId);
    if (!state) {
      throw new Error(`No wallet found for agent ${agentId}`);
    }

    if (state.wallet.locked < amount) {
      throw new Error(`Insufficient locked balance for trade: ${state.wallet.locked} < ${amount}`);
    }

    // Reduce locked balance (funds now in trade escrow)
    state.wallet.locked -= amount;
    state.wallet.updated_at = new Date();

    const tx = this.createTransaction(
      state.wallet.id,
      TransactionType.TRADE_DEBIT,
      -amount,
      state.wallet.available + state.wallet.locked + amount,
      state.wallet.available + state.wallet.locked,
      `Trade escrow transfer`,
      'trade',
      tradeId
    );

    state.transactions.push(tx);

    // Track in trade escrow
    let escrow = this.tradeEscrows.get(tradeId);
    if (!escrow) {
      escrow = {
        trade_id: tradeId,
        buyer_id: '',
        seller_id: '',
        buyer_amount: 0,
        seller_amount: 0,
        created_at: new Date(),
      };
      this.tradeEscrows.set(tradeId, escrow);
    }

    // This simplified version doesn't track buyer vs seller separately
  }

  // -------------------------------------------------------------------------
  // Settlement Operations
  // -------------------------------------------------------------------------

  /**
   * Settle a trade - distribute funds to winner
   */
  async settlePosition(
    winnerId: string,
    loserId: string,
    payoutAmount: number,
    marketId: string
  ): Promise<void> {
    const winnerState = this.wallets.get(winnerId);
    const loserState = this.wallets.get(loserId);

    if (!winnerState) {
      throw new Error(`No wallet found for winner ${winnerId}`);
    }

    // Credit winner
    const winnerBefore = winnerState.wallet.available;
    winnerState.wallet.available += payoutAmount;
    winnerState.wallet.updated_at = new Date();

    winnerState.transactions.push(
      this.createTransaction(
        winnerState.wallet.id,
        TransactionType.SETTLEMENT_PAYOUT,
        payoutAmount,
        winnerBefore,
        winnerState.wallet.available,
        `Settlement payout for market ${marketId}`,
        'settlement',
        marketId
      )
    );

    // Loser's funds were already in escrow, just record the loss
    if (loserState) {
      loserState.transactions.push(
        this.createTransaction(
          loserState.wallet.id,
          TransactionType.SETTLEMENT_PAYOUT,
          0,
          loserState.wallet.available,
          loserState.wallet.available,
          `Settlement loss for market ${marketId}`,
          'settlement',
          marketId
        )
      );
    }
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  private createTransaction(
    walletId: string,
    txType: TransactionType,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
    description?: string,
    referenceType?: string,
    referenceId?: string
  ): WalletTransaction {
    return {
      id: uuidv4(),
      wallet_id: walletId,
      tx_type: txType,
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      metadata: {},
      created_at: new Date(),
    };
  }

  /**
   * Get all wallet states (for debugging/simulation)
   */
  getAllWallets(): Map<string, Wallet> {
    const result = new Map<string, Wallet>();
    for (const [agentId, state] of this.wallets) {
      result.set(agentId, state.wallet);
    }
    return result;
  }

  /**
   * Reset ledger (for testing)
   */
  reset(): void {
    this.wallets.clear();
    this.tradeEscrows.clear();
  }
}
