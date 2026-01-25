/**
 * TRUTH-NET Matching Engine
 * Pillar B: Hedging-First Order Book
 *
 * Asynchronous, low-latency order matching with:
 * - Price-time priority
 * - Atomic escrow management
 * - Trade event emission
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  OrderSide,
  OrderStatus,
  OrderType,
  OutcomeToken,
  Trade,
  MatchResult,
  PlaceOrderRequest,
} from '../../types.js';
import { OrderBook, MarketOrderBooks } from '../orderbook/OrderBook.js';
import { EscrowLedger } from '../escrow/EscrowLedger.js';
import { EventBus } from '../../events/EventBus.js';

export interface MatchingEngineConfig {
  maxOrdersPerMatch: number; // Limit iterations per match cycle
  minPriceIncrement: number; // Tick size (e.g., 0.01)
}

const DEFAULT_CONFIG: MatchingEngineConfig = {
  maxOrdersPerMatch: 100,
  minPriceIncrement: 0.01,
};

/**
 * Core matching engine for TRUTH-NET
 */
export class MatchingEngine {
  private markets: Map<string, MarketOrderBooks> = new Map();
  private config: MatchingEngineConfig;
  private escrow: EscrowLedger;
  private eventBus: EventBus;

  constructor(
    escrow: EscrowLedger,
    eventBus: EventBus,
    config: Partial<MatchingEngineConfig> = {}
  ) {
    this.escrow = escrow;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Market Management
  // -------------------------------------------------------------------------

  /**
   * Initialize order books for a new market
   */
  initializeMarket(marketId: string): void {
    if (!this.markets.has(marketId)) {
      this.markets.set(marketId, new MarketOrderBooks(marketId));
    }
  }

  /**
   * Get order books for a market
   */
  getMarketBooks(marketId: string): MarketOrderBooks | undefined {
    return this.markets.get(marketId);
  }

  /**
   * Clear all orders for a market (on settlement or cancellation)
   */
  clearMarket(marketId: string): Order[] {
    const books = this.markets.get(marketId);
    if (!books) return [];

    const clearedOrders: Order[] = [];

    // Collect all orders from both books
    for (const outcome of [OutcomeToken.YES, OutcomeToken.NO]) {
      const book = books.getBook(outcome);
      const snapshot = book.getSnapshot(1000);

      for (const level of [...snapshot.bids, ...snapshot.asks]) {
        // We'd need to extract individual orders - this is simplified
        // In production, we'd iterate through order IDs
      }
    }

    this.markets.delete(marketId);
    return clearedOrders;
  }

  // -------------------------------------------------------------------------
  // Order Processing
  // -------------------------------------------------------------------------

  /**
   * Process a new order
   * Handles escrow locking, matching, and book insertion
   */
  async processOrder(
    agentId: string,
    marketId: string,
    request: PlaceOrderRequest
  ): Promise<{ order: Order; result: MatchResult }> {
    // Validate market exists
    let books = this.markets.get(marketId);
    if (!books) {
      this.initializeMarket(marketId);
      books = this.markets.get(marketId)!;
    }

    const book = books.getBook(request.outcome);

    // Calculate required escrow
    const escrowRequired = this.calculateEscrowRequired(
      request.side,
      request.order_type,
      request.price,
      request.quantity,
      book
    );

    // Lock escrow
    const lockResult = await this.escrow.lock(agentId, escrowRequired, 'order');
    if (!lockResult.success) {
      throw new Error(`Insufficient funds: ${lockResult.error}`);
    }

    // Create order object
    const order: Order = {
      id: uuidv4(),
      agent_id: agentId,
      market_id: marketId,
      side: request.side,
      outcome: request.outcome,
      order_type: request.order_type,
      price: request.price,
      quantity: request.quantity,
      filled_qty: 0,
      remaining_qty: request.quantity,
      locked_amount: escrowRequired,
      status: OrderStatus.OPEN,
      client_order_id: request.client_order_id,
      metadata: request.metadata ?? {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Attempt matching
    const matchResult = await this.matchOrder(order, book);

    // Update order status based on fill
    if (order.remaining_qty === 0) {
      order.status = OrderStatus.FILLED;
      order.filled_at = new Date();
    } else if (order.filled_qty > 0) {
      order.status = OrderStatus.PARTIAL;
    }

    // If limit order with remaining quantity, add to book
    if (
      order.order_type === OrderType.LIMIT &&
      order.remaining_qty > 0 &&
      order.price !== undefined
    ) {
      book.addOrder(order);
    } else if (order.order_type === OrderType.MARKET && order.remaining_qty > 0) {
      // Market order didn't fully fill - cancel remaining
      order.status = order.filled_qty > 0 ? OrderStatus.PARTIAL : OrderStatus.CANCELLED;

      // Release unused escrow
      const usedEscrow = this.calculateUsedEscrow(order);
      const unusedEscrow = order.locked_amount - usedEscrow;
      if (unusedEscrow > 0) {
        await this.escrow.release(agentId, unusedEscrow, 'order', order.id);
      }
    }

    // Emit order event
    await this.eventBus.publish('orders.created', {
      order,
      trades: matchResult.trades,
    });

    return { order, result: matchResult };
  }

  /**
   * Cancel an open order
   */
  async cancelOrder(orderId: string, agentId: string): Promise<Order | undefined> {
    // Find the order across all markets
    for (const [marketId, books] of this.markets) {
      for (const outcome of [OutcomeToken.YES, OutcomeToken.NO]) {
        const book = books.getBook(outcome);
        const order = book.getOrder(orderId);

        if (order && order.agent_id === agentId) {
          // Remove from book
          book.removeOrder(orderId);

          // Release locked funds
          await this.escrow.release(agentId, order.locked_amount, 'order', orderId);

          // Update status
          order.status = OrderStatus.CANCELLED;
          order.updated_at = new Date();

          // Emit cancellation event
          await this.eventBus.publish('orders.cancelled', { order });

          return order;
        }
      }
    }

    return undefined;
  }

  // -------------------------------------------------------------------------
  // Matching Logic
  // -------------------------------------------------------------------------

  /**
   * Match an incoming order against the book
   */
  private async matchOrder(order: Order, book: OrderBook): Promise<MatchResult> {
    const trades: Trade[] = [];
    const updatedOrders: Order[] = [];
    let iterations = 0;

    // Iterate through matchable orders
    for (const restingOrder of book.getMatchableOrders(order.side, order.price)) {
      if (order.remaining_qty <= 0) break;
      if (iterations >= this.config.maxOrdersPerMatch) break;
      iterations++;

      // Calculate fill quantity
      const fillQty = Math.min(order.remaining_qty, restingOrder.remaining_qty);
      const fillPrice = restingOrder.price!; // Resting order always has price

      // Create trade
      const trade = await this.executeTrade(order, restingOrder, fillQty, fillPrice);
      trades.push(trade);

      // Update quantities
      order.filled_qty += fillQty;
      order.remaining_qty -= fillQty;
      restingOrder.filled_qty += fillQty;
      restingOrder.remaining_qty -= fillQty;

      // Update resting order in book
      if (restingOrder.remaining_qty <= 0) {
        book.removeOrder(restingOrder.id);
        restingOrder.status = OrderStatus.FILLED;
        restingOrder.filled_at = new Date();
      } else {
        book.updateOrderQuantity(restingOrder.id, restingOrder.side, restingOrder.remaining_qty);
        restingOrder.status = OrderStatus.PARTIAL;
      }

      updatedOrders.push(restingOrder);

      // Update avg fill price
      order.avg_fill_price = this.calculateAvgFillPrice(order, trades);

      // Record trade in book
      book.recordTrade(fillPrice);
    }

    return {
      trades,
      updated_orders: updatedOrders,
      remaining_order: order.remaining_qty > 0 ? order : undefined,
    };
  }

  /**
   * Execute a trade between two orders
   */
  private async executeTrade(
    incomingOrder: Order,
    restingOrder: Order,
    quantity: number,
    price: number
  ): Promise<Trade> {
    // Determine buyer/seller
    const isBuyer = incomingOrder.side === OrderSide.BUY;
    const buyOrder = isBuyer ? incomingOrder : restingOrder;
    const sellOrder = isBuyer ? restingOrder : incomingOrder;

    // Calculate fees (simplified - could be tiered)
    const tradeValue = price * quantity;
    const feeRate = 0.002; // 0.2%
    const buyerFee = tradeValue * feeRate;
    const sellerFee = tradeValue * feeRate;

    // Create trade record
    const trade: Trade = {
      id: uuidv4(),
      market_id: incomingOrder.market_id,
      buy_order_id: buyOrder.id,
      sell_order_id: sellOrder.id,
      buyer_id: buyOrder.agent_id,
      seller_id: sellOrder.agent_id,
      outcome: incomingOrder.outcome,
      price,
      quantity,
      buyer_fee: buyerFee,
      seller_fee: sellerFee,
      is_settled: false,
      executed_at: new Date(),
    };

    // Process escrow movements
    await this.processTradeEscrow(trade, buyOrder, sellOrder);

    // Emit trade event
    await this.eventBus.publish('trades.executed', { trade });

    return trade;
  }

  /**
   * Process escrow for a trade
   */
  private async processTradeEscrow(
    trade: Trade,
    buyOrder: Order,
    sellOrder: Order
  ): Promise<void> {
    // For prediction markets:
    // - Buyer pays: price * quantity (e.g., 0.60 * 1000 = 600)
    // - Seller risk: (1 - price) * quantity (e.g., 0.40 * 1000 = 400)
    // - On resolution: winner gets 1.00 * quantity

    const buyerCost = trade.price * trade.quantity;
    const sellerRisk = (1 - trade.price) * trade.quantity;

    // Transfer from buyer's locked to trade escrow
    await this.escrow.transferToTradeEscrow(
      buyOrder.agent_id,
      buyerCost + trade.buyer_fee,
      trade.id
    );

    // Transfer from seller's locked to trade escrow
    await this.escrow.transferToTradeEscrow(
      sellOrder.agent_id,
      sellerRisk + trade.seller_fee,
      trade.id
    );
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  /**
   * Calculate escrow required for an order
   */
  private calculateEscrowRequired(
    side: OrderSide,
    orderType: OrderType,
    price: number | undefined,
    quantity: number,
    book: OrderBook
  ): number {
    if (side === OrderSide.BUY) {
      // Buyer needs: price * quantity
      if (orderType === OrderType.MARKET) {
        // Use worst-case price (0.99) or best ask + buffer
        const estimatedPrice = book.bestAsk ?? 0.99;
        return estimatedPrice * quantity * 1.05; // 5% buffer
      }
      return price! * quantity;
    } else {
      // Seller needs: (1 - price) * quantity (their potential loss)
      if (orderType === OrderType.MARKET) {
        const estimatedPrice = book.bestBid ?? 0.01;
        return (1 - estimatedPrice) * quantity * 1.05;
      }
      return (1 - price!) * quantity;
    }
  }

  /**
   * Calculate escrow actually used after fills
   */
  private calculateUsedEscrow(order: Order): number {
    if (!order.avg_fill_price) return 0;

    if (order.side === OrderSide.BUY) {
      return order.avg_fill_price * order.filled_qty;
    } else {
      return (1 - order.avg_fill_price) * order.filled_qty;
    }
  }

  /**
   * Calculate weighted average fill price
   */
  private calculateAvgFillPrice(order: Order, trades: Trade[]): number {
    if (trades.length === 0) return 0;

    let totalValue = 0;
    let totalQty = 0;

    for (const trade of trades) {
      totalValue += trade.price * trade.quantity;
      totalQty += trade.quantity;
    }

    return totalQty > 0 ? totalValue / totalQty : 0;
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  /**
   * Get order book snapshot for a market
   */
  getOrderBookSnapshot(marketId: string, outcome: OutcomeToken, maxLevels: number = 50) {
    const books = this.markets.get(marketId);
    if (!books) return null;
    return books.getBook(outcome).getSnapshot(maxLevels);
  }

  /**
   * Get best bid/ask for a market
   */
  getBestPrices(marketId: string, outcome: OutcomeToken) {
    const books = this.markets.get(marketId);
    if (!books) return null;

    const book = books.getBook(outcome);
    return {
      bestBid: book.bestBid,
      bestAsk: book.bestAsk,
      spread: book.spread,
      midPrice: book.midPrice,
      lastTradePrice: book.lastTradePrice,
    };
  }
}
