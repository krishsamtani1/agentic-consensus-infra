/**
 * TRUTH-NET Central Limit Order Book (CLOB)
 * Pillar B: Hedging-First Order Book
 *
 * High-performance order book supporting:
 * - Price-time priority matching
 * - Limit and market orders
 * - Real-time best bid/ask tracking
 */

import { Order, OrderSide, OrderStatus, OutcomeToken, OrderBookLevel, OrderBookSnapshot } from '../../types.js';

/**
 * Price level in the order book
 * Groups all orders at the same price with FIFO ordering
 */
export class PriceLevel {
  public readonly price: number;
  private orders: Map<string, Order> = new Map();
  private orderQueue: string[] = []; // FIFO order IDs
  private _totalQuantity: number = 0;

  constructor(price: number) {
    this.price = price;
  }

  get totalQuantity(): number {
    return this._totalQuantity;
  }

  get orderCount(): number {
    return this.orders.size;
  }

  get isEmpty(): boolean {
    return this.orders.size === 0;
  }

  /**
   * Add order to this price level (FIFO)
   */
  add(order: Order): void {
    if (this.orders.has(order.id)) {
      throw new Error(`Order ${order.id} already exists at price level ${this.price}`);
    }
    this.orders.set(order.id, order);
    this.orderQueue.push(order.id);
    this._totalQuantity += order.remaining_qty;
  }

  /**
   * Remove order from this price level
   */
  remove(orderId: string): Order | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    this.orders.delete(orderId);
    this.orderQueue = this.orderQueue.filter(id => id !== orderId);
    this._totalQuantity -= order.remaining_qty;
    return order;
  }

  /**
   * Update order quantity (after partial fill)
   */
  updateQuantity(orderId: string, newRemainingQty: number): void {
    const order = this.orders.get(orderId);
    if (!order) return;

    const delta = newRemainingQty - order.remaining_qty;
    this._totalQuantity += delta;
    order.remaining_qty = newRemainingQty;
    order.filled_qty = order.quantity - newRemainingQty;
  }

  /**
   * Get the first order in queue (FIFO)
   */
  peek(): Order | undefined {
    if (this.orderQueue.length === 0) return undefined;
    return this.orders.get(this.orderQueue[0]);
  }

  /**
   * Get all orders at this price level
   */
  getOrders(): Order[] {
    return this.orderQueue.map(id => this.orders.get(id)!).filter(Boolean);
  }

  /**
   * Iterate through orders in FIFO order
   */
  *[Symbol.iterator](): Iterator<Order> {
    for (const id of this.orderQueue) {
      const order = this.orders.get(id);
      if (order) yield order;
    }
  }
}

/**
 * One side of the order book (bids or asks)
 * Uses a sorted map for O(log n) price level access
 */
export class OrderBookSide {
  public readonly side: OrderSide;
  private levels: Map<number, PriceLevel> = new Map();
  private sortedPrices: number[] = [];
  private orderIndex: Map<string, number> = new Map(); // orderId -> price

  constructor(side: OrderSide) {
    this.side = side;
  }

  /**
   * Get the best price (highest bid or lowest ask)
   */
  get bestPrice(): number | undefined {
    if (this.sortedPrices.length === 0) return undefined;
    return this.side === OrderSide.BUY
      ? this.sortedPrices[this.sortedPrices.length - 1] // Highest for bids
      : this.sortedPrices[0]; // Lowest for asks
  }

  /**
   * Get total quantity at best price
   */
  get bestQuantity(): number {
    const price = this.bestPrice;
    if (price === undefined) return 0;
    return this.levels.get(price)?.totalQuantity ?? 0;
  }

  /**
   * Check if this side is empty
   */
  get isEmpty(): boolean {
    return this.sortedPrices.length === 0;
  }

  /**
   * Add order to the book
   */
  add(order: Order): void {
    if (!order.price) {
      throw new Error('Cannot add market order to order book');
    }

    let level = this.levels.get(order.price);
    if (!level) {
      level = new PriceLevel(order.price);
      this.levels.set(order.price, level);
      this.insertSortedPrice(order.price);
    }

    level.add(order);
    this.orderIndex.set(order.id, order.price);
  }

  /**
   * Remove order from the book
   */
  remove(orderId: string): Order | undefined {
    const price = this.orderIndex.get(orderId);
    if (price === undefined) return undefined;

    const level = this.levels.get(price);
    if (!level) return undefined;

    const order = level.remove(orderId);
    this.orderIndex.delete(orderId);

    // Clean up empty price level
    if (level.isEmpty) {
      this.levels.delete(price);
      this.sortedPrices = this.sortedPrices.filter(p => p !== price);
    }

    return order;
  }

  /**
   * Update order after partial fill
   */
  updateOrder(orderId: string, newRemainingQty: number): void {
    const price = this.orderIndex.get(orderId);
    if (price === undefined) return;

    const level = this.levels.get(price);
    if (!level) return;

    if (newRemainingQty <= 0) {
      this.remove(orderId);
    } else {
      level.updateQuantity(orderId, newRemainingQty);
    }
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    const price = this.orderIndex.get(orderId);
    if (price === undefined) return undefined;
    const level = this.levels.get(price);
    return level?.getOrders().find(o => o.id === orderId);
  }

  /**
   * Get price levels for snapshot (sorted appropriately)
   */
  getLevels(maxLevels: number = 50): OrderBookLevel[] {
    const prices = this.side === OrderSide.BUY
      ? [...this.sortedPrices].reverse() // Highest first for bids
      : [...this.sortedPrices]; // Lowest first for asks

    return prices.slice(0, maxLevels).map(price => {
      const level = this.levels.get(price)!;
      return {
        price,
        quantity: level.totalQuantity,
        order_count: level.orderCount,
      };
    });
  }

  /**
   * Iterate through levels from best to worst price
   */
  *iterateLevels(): Generator<PriceLevel> {
    const prices = this.side === OrderSide.BUY
      ? [...this.sortedPrices].reverse()
      : [...this.sortedPrices];

    for (const price of prices) {
      const level = this.levels.get(price);
      if (level && !level.isEmpty) {
        yield level;
      }
    }
  }

  /**
   * Binary search insert for sorted prices
   */
  private insertSortedPrice(price: number): void {
    let left = 0;
    let right = this.sortedPrices.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.sortedPrices[mid] < price) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    this.sortedPrices.splice(left, 0, price);
  }
}

/**
 * Central Limit Order Book for a single outcome token (YES or NO)
 */
export class OrderBook {
  public readonly marketId: string;
  public readonly outcome: OutcomeToken;
  private bids: OrderBookSide;
  private asks: OrderBookSide;
  private _lastTradePrice?: number;
  private _lastTradeTime?: Date;

  constructor(marketId: string, outcome: OutcomeToken) {
    this.marketId = marketId;
    this.outcome = outcome;
    this.bids = new OrderBookSide(OrderSide.BUY);
    this.asks = new OrderBookSide(OrderSide.SELL);
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  get bestBid(): number | undefined {
    return this.bids.bestPrice;
  }

  get bestAsk(): number | undefined {
    return this.asks.bestPrice;
  }

  get spread(): number | undefined {
    if (this.bestBid === undefined || this.bestAsk === undefined) return undefined;
    return this.bestAsk - this.bestBid;
  }

  get midPrice(): number | undefined {
    if (this.bestBid === undefined || this.bestAsk === undefined) return undefined;
    return (this.bestBid + this.bestAsk) / 2;
  }

  get lastTradePrice(): number | undefined {
    return this._lastTradePrice;
  }

  get lastTradeTime(): Date | undefined {
    return this._lastTradeTime;
  }

  // -------------------------------------------------------------------------
  // Order Operations
  // -------------------------------------------------------------------------

  /**
   * Add a limit order to the book
   */
  addOrder(order: Order): void {
    if (order.order_type !== 'limit' || !order.price) {
      throw new Error('Only limit orders with a price can be added to the book');
    }

    if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PARTIAL) {
      throw new Error(`Cannot add order with status ${order.status} to book`);
    }

    const side = order.side === OrderSide.BUY ? this.bids : this.asks;
    side.add(order);
  }

  /**
   * Remove an order from the book
   */
  removeOrder(orderId: string): Order | undefined {
    // Try both sides
    let order = this.bids.remove(orderId);
    if (!order) {
      order = this.asks.remove(orderId);
    }
    return order;
  }

  /**
   * Update order after partial fill
   */
  updateOrderQuantity(orderId: string, side: OrderSide, newRemainingQty: number): void {
    const bookSide = side === OrderSide.BUY ? this.bids : this.asks;
    bookSide.updateOrder(orderId, newRemainingQty);
  }

  /**
   * Get an order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.bids.getOrder(orderId) ?? this.asks.getOrder(orderId);
  }

  /**
   * Record a trade (updates last trade info)
   */
  recordTrade(price: number): void {
    this._lastTradePrice = price;
    this._lastTradeTime = new Date();
  }

  // -------------------------------------------------------------------------
  // Matching Logic
  // -------------------------------------------------------------------------

  /**
   * Check if an incoming order can match
   */
  canMatch(side: OrderSide, price?: number): boolean {
    if (side === OrderSide.BUY) {
      // Buy can match if there's an ask at or below the price
      if (this.asks.isEmpty) return false;
      if (price === undefined) return true; // Market order
      return this.asks.bestPrice! <= price;
    } else {
      // Sell can match if there's a bid at or above the price
      if (this.bids.isEmpty) return false;
      if (price === undefined) return true; // Market order
      return this.bids.bestPrice! >= price;
    }
  }

  /**
   * Get matchable orders for an incoming order
   * Returns orders from best to worst price, FIFO within each level
   */
  *getMatchableOrders(side: OrderSide, price?: number): Generator<Order> {
    const oppositeSide = side === OrderSide.BUY ? this.asks : this.bids;

    for (const level of oppositeSide.iterateLevels()) {
      // Check if price is still matchable
      if (price !== undefined) {
        if (side === OrderSide.BUY && level.price > price) break;
        if (side === OrderSide.SELL && level.price < price) break;
      }

      for (const order of level) {
        yield order;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Snapshots
  // -------------------------------------------------------------------------

  /**
   * Get order book snapshot for API
   */
  getSnapshot(maxLevels: number = 50): OrderBookSnapshot {
    return {
      market_id: this.marketId,
      outcome: this.outcome,
      bids: this.bids.getLevels(maxLevels),
      asks: this.asks.getLevels(maxLevels),
      timestamp: new Date(),
    };
  }

  /**
   * Get total depth on each side
   */
  getDepth(): { bidDepth: number; askDepth: number } {
    const bidLevels = this.bids.getLevels(100);
    const askLevels = this.asks.getLevels(100);

    return {
      bidDepth: bidLevels.reduce((sum, l) => sum + l.quantity, 0),
      askDepth: askLevels.reduce((sum, l) => sum + l.quantity, 0),
    };
  }
}

/**
 * Market Order Book Manager
 * Manages both YES and NO order books for a market
 */
export class MarketOrderBooks {
  public readonly marketId: string;
  public readonly yes: OrderBook;
  public readonly no: OrderBook;

  constructor(marketId: string) {
    this.marketId = marketId;
    this.yes = new OrderBook(marketId, OutcomeToken.YES);
    this.no = new OrderBook(marketId, OutcomeToken.NO);
  }

  getBook(outcome: OutcomeToken): OrderBook {
    return outcome === OutcomeToken.YES ? this.yes : this.no;
  }

  /**
   * Get full market snapshot
   */
  getSnapshot(maxLevels: number = 50): { yes: OrderBookSnapshot; no: OrderBookSnapshot } {
    return {
      yes: this.yes.getSnapshot(maxLevels),
      no: this.no.getSnapshot(maxLevels),
    };
  }
}
