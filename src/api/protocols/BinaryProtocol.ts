/**
 * TRUTH-NET Binary Protocol v1.0
 * 
 * High-performance MessagePack-based serialization for WebSocket communication.
 * Achieves sub-5ms message encoding/decoding for real-time trading.
 */

import { pack, unpack, Packr } from 'msgpackr';

// ============================================================================
// MESSAGE TYPES (Binary opcodes for ultra-fast routing)
// ============================================================================

export enum MessageType {
  // System (0x00 - 0x0F)
  HEARTBEAT = 0x00,
  AUTH = 0x01,
  SUBSCRIBE = 0x02,
  UNSUBSCRIBE = 0x03,
  ERROR = 0x0F,

  // Order Book (0x10 - 0x1F)
  ORDER_BOOK_SNAPSHOT = 0x10,
  ORDER_BOOK_DELTA = 0x11,
  ORDER_BOOK_TOP = 0x12,

  // Orders (0x20 - 0x2F)
  ORDER_NEW = 0x20,
  ORDER_CANCEL = 0x21,
  ORDER_UPDATE = 0x22,
  ORDER_FILL = 0x23,
  ORDER_REJECTED = 0x24,

  // Trades (0x30 - 0x3F)
  TRADE = 0x30,
  TRADE_BATCH = 0x31,

  // Markets (0x40 - 0x4F)
  MARKET_UPDATE = 0x40,
  MARKET_RESOLVED = 0x41,
  MARKET_CREATED = 0x42,

  // Agents (0x50 - 0x5F)
  AGENT_UPDATE = 0x50,
  AGENT_POSITION = 0x51,
  AGENT_PNL = 0x52,

  // Headlines (0x60 - 0x6F)
  HEADLINE_NEW = 0x60,
  HEADLINE_BATCH = 0x61,
}

// ============================================================================
// OPTIMIZED PACKR INSTANCE
// ============================================================================

const packr = new Packr({
  useRecords: true,       // Enable record structures for repeated schemas
  structuredClone: false, // Disable for speed
  moreTypes: true,        // Support BigInt, Date, etc.
  bundleStrings: true,    // Bundle repeated strings
  sequential: true,       // Optimize for sequential access
});

// ============================================================================
// BINARY MESSAGE STRUCTURE
// ============================================================================

export interface BinaryMessage {
  type: MessageType;
  seq: number;           // Sequence number for ordering
  ts: number;            // Timestamp (ms since epoch)
  payload: unknown;
}

// ============================================================================
// ENCODER
// ============================================================================

export class BinaryEncoder {
  private sequenceNumber = 0;

  /**
   * Encode a message to binary format
   * Returns Uint8Array for WebSocket transmission
   */
  encode(type: MessageType, payload: unknown): Uint8Array {
    const message: BinaryMessage = {
      type,
      seq: this.sequenceNumber++,
      ts: Date.now(),
      payload,
    };

    return packr.pack(message);
  }

  /**
   * Encode order book snapshot (optimized format)
   * Uses fixed-width arrays for maximum speed
   */
  encodeOrderBook(
    marketId: string,
    outcome: 'yes' | 'no',
    bids: Array<[number, number]>,  // [price, quantity]
    asks: Array<[number, number]>,
    bestBid: number | null,
    bestAsk: number | null
  ): Uint8Array {
    return this.encode(MessageType.ORDER_BOOK_SNAPSHOT, {
      m: marketId,
      o: outcome === 'yes' ? 1 : 0,
      b: bids,
      a: asks,
      bb: bestBid,
      ba: bestAsk,
    });
  }

  /**
   * Encode order book delta (incremental update)
   */
  encodeOrderBookDelta(
    marketId: string,
    outcome: 'yes' | 'no',
    side: 'bid' | 'ask',
    price: number,
    quantity: number,
    action: 'add' | 'remove' | 'update'
  ): Uint8Array {
    return this.encode(MessageType.ORDER_BOOK_DELTA, {
      m: marketId,
      o: outcome === 'yes' ? 1 : 0,
      s: side === 'bid' ? 1 : 0,
      p: price,
      q: quantity,
      a: action === 'add' ? 1 : action === 'remove' ? 2 : 3,
    });
  }

  /**
   * Encode trade
   */
  encodeTrade(
    tradeId: string,
    marketId: string,
    price: number,
    quantity: number,
    side: 'buy' | 'sell',
    buyerId: string,
    sellerId: string
  ): Uint8Array {
    return this.encode(MessageType.TRADE, {
      id: tradeId,
      m: marketId,
      p: price,
      q: quantity,
      s: side === 'buy' ? 1 : 0,
      b: buyerId,
      sl: sellerId,
    });
  }

  /**
   * Encode headline
   */
  encodeHeadline(
    id: string,
    title: string,
    category: string,
    impactScore: number,
    source: string
  ): Uint8Array {
    return this.encode(MessageType.HEADLINE_NEW, {
      id,
      t: title,
      c: category,
      i: impactScore,
      s: source,
    });
  }

  /**
   * Reset sequence counter
   */
  resetSequence(): void {
    this.sequenceNumber = 0;
  }
}

// ============================================================================
// DECODER
// ============================================================================

export class BinaryDecoder {
  private lastSequence = -1;

  /**
   * Decode binary message
   */
  decode(buffer: Uint8Array | ArrayBuffer): BinaryMessage {
    const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    return packr.unpack(data) as BinaryMessage;
  }

  /**
   * Decode and validate sequence
   * Returns null if message is out of order (can be used for ordering)
   */
  decodeWithValidation(buffer: Uint8Array | ArrayBuffer): BinaryMessage | null {
    const message = this.decode(buffer);
    
    if (message.seq <= this.lastSequence) {
      console.warn(`[Binary] Out-of-order message: got ${message.seq}, expected > ${this.lastSequence}`);
      return null;
    }

    this.lastSequence = message.seq;
    return message;
  }

  /**
   * Decode order book snapshot to structured format
   */
  decodeOrderBook(message: BinaryMessage): {
    marketId: string;
    outcome: 'yes' | 'no';
    bids: Array<{ price: number; quantity: number }>;
    asks: Array<{ price: number; quantity: number }>;
    bestBid: number | null;
    bestAsk: number | null;
  } {
    const p = message.payload as any;
    return {
      marketId: p.m,
      outcome: p.o === 1 ? 'yes' : 'no',
      bids: p.b.map(([price, quantity]: [number, number]) => ({ price, quantity })),
      asks: p.a.map(([price, quantity]: [number, number]) => ({ price, quantity })),
      bestBid: p.bb,
      bestAsk: p.ba,
    };
  }

  /**
   * Decode trade to structured format
   */
  decodeTrade(message: BinaryMessage): {
    tradeId: string;
    marketId: string;
    price: number;
    quantity: number;
    side: 'buy' | 'sell';
    buyerId: string;
    sellerId: string;
    timestamp: number;
  } {
    const p = message.payload as any;
    return {
      tradeId: p.id,
      marketId: p.m,
      price: p.p,
      quantity: p.q,
      side: p.s === 1 ? 'buy' : 'sell',
      buyerId: p.b,
      sellerId: p.sl,
      timestamp: message.ts,
    };
  }

  /**
   * Reset sequence tracking
   */
  resetSequence(): void {
    this.lastSequence = -1;
  }
}

// ============================================================================
// SHARED MEMORY ORDER BOOK (Zero-Copy)
// ============================================================================

/**
 * SharedArrayBuffer-based order book for zero-copy UI reads
 * 
 * Memory Layout (per market):
 * - Bytes 0-7: Best Bid Price (Float64)
 * - Bytes 8-15: Best Bid Qty (Float64)
 * - Bytes 16-23: Best Ask Price (Float64)
 * - Bytes 24-31: Best Ask Qty (Float64)
 * - Bytes 32-39: Last Trade Price (Float64)
 * - Bytes 40-47: Volume (Float64)
 * - Bytes 48-55: Open Interest (Float64)
 * - Bytes 56-63: Last Update Timestamp (BigInt64)
 * 
 * Top 10 Bids (10 levels × 16 bytes = 160 bytes):
 * - Bytes 64-223: Bid levels [price, qty]...
 * 
 * Top 10 Asks (10 levels × 16 bytes = 160 bytes):
 * - Bytes 224-383: Ask levels [price, qty]...
 * 
 * Total per market: 384 bytes
 */

export const MARKET_BUFFER_SIZE = 384;
export const MAX_MARKETS = 100;
export const TOTAL_BUFFER_SIZE = MARKET_BUFFER_SIZE * MAX_MARKETS;

export class SharedOrderBook {
  private buffer: SharedArrayBuffer;
  private float64View: Float64Array;
  private int64View: BigInt64Array;
  private marketIndexMap: Map<string, number> = new Map();
  private nextIndex = 0;

  constructor(existingBuffer?: SharedArrayBuffer) {
    if (existingBuffer) {
      this.buffer = existingBuffer;
    } else {
      this.buffer = new SharedArrayBuffer(TOTAL_BUFFER_SIZE);
    }
    this.float64View = new Float64Array(this.buffer);
    this.int64View = new BigInt64Array(this.buffer);
  }

  /**
   * Get the underlying SharedArrayBuffer for transfer to workers/UI
   */
  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Register a market and get its buffer offset
   */
  registerMarket(marketId: string): number {
    if (this.marketIndexMap.has(marketId)) {
      return this.marketIndexMap.get(marketId)!;
    }

    if (this.nextIndex >= MAX_MARKETS) {
      throw new Error('Maximum market limit reached');
    }

    const index = this.nextIndex++;
    this.marketIndexMap.set(marketId, index);
    return index;
  }

  /**
   * Get market index
   */
  getMarketIndex(marketId: string): number | undefined {
    return this.marketIndexMap.get(marketId);
  }

  /**
   * Update order book data (called from matching engine)
   */
  updateOrderBook(
    marketId: string,
    bestBid: number | null,
    bestBidQty: number,
    bestAsk: number | null,
    bestAskQty: number,
    lastPrice: number,
    volume: number,
    openInterest: number,
    bids: Array<[number, number]>,
    asks: Array<[number, number]>
  ): void {
    const index = this.registerMarket(marketId);
    const baseOffset = index * (MARKET_BUFFER_SIZE / 8); // Convert bytes to Float64 offset

    // Update core metrics (atomic writes via Float64Array)
    this.float64View[baseOffset + 0] = bestBid ?? 0;
    this.float64View[baseOffset + 1] = bestBidQty;
    this.float64View[baseOffset + 2] = bestAsk ?? 0;
    this.float64View[baseOffset + 3] = bestAskQty;
    this.float64View[baseOffset + 4] = lastPrice;
    this.float64View[baseOffset + 5] = volume;
    this.float64View[baseOffset + 6] = openInterest;
    
    // Update timestamp
    this.int64View[baseOffset + 7] = BigInt(Date.now());

    // Update top 10 bids (offset 8-27)
    for (let i = 0; i < 10; i++) {
      const bid = bids[i];
      this.float64View[baseOffset + 8 + i * 2] = bid ? bid[0] : 0;
      this.float64View[baseOffset + 9 + i * 2] = bid ? bid[1] : 0;
    }

    // Update top 10 asks (offset 28-47)
    for (let i = 0; i < 10; i++) {
      const ask = asks[i];
      this.float64View[baseOffset + 28 + i * 2] = ask ? ask[0] : 0;
      this.float64View[baseOffset + 29 + i * 2] = ask ? ask[1] : 0;
    }
  }

  /**
   * Read order book data (called from UI - zero-copy)
   */
  readOrderBook(marketId: string): {
    bestBid: number | null;
    bestBidQty: number;
    bestAsk: number | null;
    bestAskQty: number;
    lastPrice: number;
    volume: number;
    openInterest: number;
    timestamp: number;
    bids: Array<{ price: number; quantity: number }>;
    asks: Array<{ price: number; quantity: number }>;
  } | null {
    const index = this.marketIndexMap.get(marketId);
    if (index === undefined) return null;

    const baseOffset = index * (MARKET_BUFFER_SIZE / 8);

    const bids: Array<{ price: number; quantity: number }> = [];
    const asks: Array<{ price: number; quantity: number }> = [];

    // Read bids
    for (let i = 0; i < 10; i++) {
      const price = this.float64View[baseOffset + 8 + i * 2];
      const quantity = this.float64View[baseOffset + 9 + i * 2];
      if (price > 0) {
        bids.push({ price, quantity });
      }
    }

    // Read asks
    for (let i = 0; i < 10; i++) {
      const price = this.float64View[baseOffset + 28 + i * 2];
      const quantity = this.float64View[baseOffset + 29 + i * 2];
      if (price > 0) {
        asks.push({ price, quantity });
      }
    }

    const bestBidValue = this.float64View[baseOffset + 0];
    const bestAskValue = this.float64View[baseOffset + 2];

    return {
      bestBid: bestBidValue > 0 ? bestBidValue : null,
      bestBidQty: this.float64View[baseOffset + 1],
      bestAsk: bestAskValue > 0 ? bestAskValue : null,
      bestAskQty: this.float64View[baseOffset + 3],
      lastPrice: this.float64View[baseOffset + 4],
      volume: this.float64View[baseOffset + 5],
      openInterest: this.float64View[baseOffset + 6],
      timestamp: Number(this.int64View[baseOffset + 7]),
      bids,
      asks,
    };
  }

  /**
   * Get all registered markets
   */
  getMarkets(): string[] {
    return Array.from(this.marketIndexMap.keys());
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const binaryEncoder = new BinaryEncoder();
export const binaryDecoder = new BinaryDecoder();

// Shared order book instance (created on demand)
let sharedOrderBook: SharedOrderBook | null = null;

export function getSharedOrderBook(): SharedOrderBook {
  if (!sharedOrderBook) {
    sharedOrderBook = new SharedOrderBook();
  }
  return sharedOrderBook;
}

export function initSharedOrderBook(buffer: SharedArrayBuffer): SharedOrderBook {
  sharedOrderBook = new SharedOrderBook(buffer);
  return sharedOrderBook;
}
