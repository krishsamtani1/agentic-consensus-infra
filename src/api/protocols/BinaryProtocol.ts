/**
 * TRUTH-NET Binary Protocol v2.0
 * 
 * MessagePack-compatible binary encoding for ultra-low latency WebSocket.
 * Optimized for order book updates at 100+ messages/second.
 * 
 * Message Format:
 * [1 byte: type] [4 bytes: length] [N bytes: payload]
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export const enum MessageType {
  // Control messages
  HANDSHAKE = 0x01,
  HANDSHAKE_ACK = 0x02,
  HEARTBEAT = 0x03,
  HEARTBEAT_ACK = 0x04,
  SUBSCRIBE = 0x05,
  UNSUBSCRIBE = 0x06,
  ERROR = 0x0F,

  // Market data (high frequency)
  ORDER_BOOK_SNAPSHOT = 0x10,
  ORDER_BOOK_DELTA = 0x11,
  TRADE = 0x12,
  TICKER = 0x13,
  BEST_BID_ASK = 0x14,

  // Events (medium frequency)
  ORDER_PLACED = 0x20,
  ORDER_FILLED = 0x21,
  ORDER_CANCELLED = 0x22,
  ORDER_REJECTED = 0x23,

  // Markets
  MARKET_CREATED = 0x30,
  MARKET_RESOLVED = 0x31,
  MARKET_UPDATE = 0x32,

  // Agents
  AGENT_UPDATE = 0x40,
  POSITION_UPDATE = 0x41,
  WALLET_UPDATE = 0x42,

  // Headlines
  HEADLINE = 0x50,
  AUTO_MARKET = 0x51,
}

// ============================================================================
// BINARY ENCODER
// ============================================================================

export class BinaryProtocolEncoder {
  private buffer: ArrayBuffer;
  private view: DataView;
  private uint8: Uint8Array;
  private offset: number = 0;
  private textEncoder = new TextEncoder();

  constructor(size: number = 16384) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.uint8 = new Uint8Array(this.buffer);
  }

  reset(): this {
    this.offset = 0;
    return this;
  }

  private ensureCapacity(needed: number): void {
    const required = this.offset + needed;
    if (required > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, required);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(this.uint8);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
      this.uint8 = new Uint8Array(this.buffer);
    }
  }

  // Primitives
  writeUint8(val: number): this {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset++, val);
    return this;
  }

  writeUint16(val: number): this {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, val, true);
    this.offset += 2;
    return this;
  }

  writeUint32(val: number): this {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, val, true);
    this.offset += 4;
    return this;
  }

  writeFloat64(val: number): this {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, val, true);
    this.offset += 8;
    return this;
  }

  writeString(val: string): this {
    const encoded = this.textEncoder.encode(val);
    this.writeUint16(encoded.length);
    this.ensureCapacity(encoded.length);
    this.uint8.set(encoded, this.offset);
    this.offset += encoded.length;
    return this;
  }

  writeBytes(val: Uint8Array): this {
    this.writeUint32(val.length);
    this.ensureCapacity(val.length);
    this.uint8.set(val, this.offset);
    this.offset += val.length;
    return this;
  }

  getBuffer(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  // Message builders
  buildMessage(type: MessageType, payloadFn: () => void): Uint8Array {
    this.reset();
    
    // Write type
    this.writeUint8(type);
    
    // Reserve space for length
    const lengthOffset = this.offset;
    this.offset += 4;
    
    // Write payload
    const payloadStart = this.offset;
    payloadFn();
    const payloadLength = this.offset - payloadStart;
    
    // Write length
    this.view.setUint32(lengthOffset, payloadLength, true);
    
    return this.getBuffer().slice();
  }

  // Pre-built message encoders
  encodeHeartbeat(): Uint8Array {
    return this.buildMessage(MessageType.HEARTBEAT, () => {
      this.writeFloat64(Date.now());
    });
  }

  encodeTrade(trade: {
    id: string;
    market_id: string;
    price: number;
    quantity: number;
    buyer_id: string;
    seller_id: string;
    timestamp: number;
  }): Uint8Array {
    return this.buildMessage(MessageType.TRADE, () => {
      this.writeString(trade.id);
      this.writeString(trade.market_id);
      this.writeFloat64(trade.price);
      this.writeFloat64(trade.quantity);
      this.writeString(trade.buyer_id);
      this.writeString(trade.seller_id);
      this.writeFloat64(trade.timestamp);
    });
  }

  encodeBestBidAsk(data: {
    market_id: string;
    outcome: string;
    best_bid: number | null;
    best_ask: number | null;
    spread: number | null;
    timestamp: number;
  }): Uint8Array {
    return this.buildMessage(MessageType.BEST_BID_ASK, () => {
      this.writeString(data.market_id);
      this.writeString(data.outcome);
      this.writeFloat64(data.best_bid ?? -1);
      this.writeFloat64(data.best_ask ?? -1);
      this.writeFloat64(data.spread ?? -1);
      this.writeFloat64(data.timestamp);
    });
  }

  encodeOrderBookSnapshot(snapshot: {
    market_id: string;
    outcome: string;
    bids: Array<{ price: number; quantity: number }>;
    asks: Array<{ price: number; quantity: number }>;
    timestamp: number;
  }): Uint8Array {
    return this.buildMessage(MessageType.ORDER_BOOK_SNAPSHOT, () => {
      this.writeString(snapshot.market_id);
      this.writeString(snapshot.outcome);
      
      // Bids (top 10)
      const bids = snapshot.bids.slice(0, 10);
      this.writeUint8(bids.length);
      for (const bid of bids) {
        this.writeFloat64(bid.price);
        this.writeFloat64(bid.quantity);
      }
      
      // Asks (top 10)
      const asks = snapshot.asks.slice(0, 10);
      this.writeUint8(asks.length);
      for (const ask of asks) {
        this.writeFloat64(ask.price);
        this.writeFloat64(ask.quantity);
      }
      
      this.writeFloat64(snapshot.timestamp);
    });
  }

  encodeHeadline(headline: {
    id: string;
    title: string;
    source: string;
    category: string;
    impact_score: number;
    timestamp: number;
  }): Uint8Array {
    return this.buildMessage(MessageType.HEADLINE, () => {
      this.writeString(headline.id);
      this.writeString(headline.title);
      this.writeString(headline.source);
      this.writeString(headline.category);
      this.writeFloat64(headline.impact_score);
      this.writeFloat64(headline.timestamp);
    });
  }

  encodeAutoMarket(market: {
    id: string;
    ticker: string;
    title: string;
    category: string;
    confidence: number;
    reasoning: string;
  }): Uint8Array {
    return this.buildMessage(MessageType.AUTO_MARKET, () => {
      this.writeString(market.id);
      this.writeString(market.ticker);
      this.writeString(market.title);
      this.writeString(market.category);
      this.writeFloat64(market.confidence);
      this.writeString(market.reasoning);
    });
  }
}

// ============================================================================
// BINARY DECODER
// ============================================================================

export class BinaryProtocolDecoder {
  private view: DataView;
  private uint8: Uint8Array;
  private offset: number = 0;
  private textDecoder = new TextDecoder();

  constructor(buffer: ArrayBuffer | Uint8Array) {
    if (buffer instanceof Uint8Array) {
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      this.uint8 = buffer;
    } else {
      this.view = new DataView(buffer);
      this.uint8 = new Uint8Array(buffer);
    }
  }

  readUint8(): number {
    return this.view.getUint8(this.offset++);
  }

  readUint16(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readUint32(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readFloat64(): number {
    const val = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  readString(): string {
    const len = this.readUint16();
    const bytes = this.uint8.slice(this.offset, this.offset + len);
    this.offset += len;
    return this.textDecoder.decode(bytes);
  }

  // Message parser
  parseMessage(): { type: MessageType; data: unknown } {
    const type = this.readUint8() as MessageType;
    const length = this.readUint32();
    const endOffset = this.offset + length;

    let data: unknown;

    switch (type) {
      case MessageType.HEARTBEAT:
        data = { timestamp: this.readFloat64() };
        break;

      case MessageType.TRADE:
        data = {
          id: this.readString(),
          market_id: this.readString(),
          price: this.readFloat64(),
          quantity: this.readFloat64(),
          buyer_id: this.readString(),
          seller_id: this.readString(),
          timestamp: this.readFloat64(),
        };
        break;

      case MessageType.BEST_BID_ASK:
        data = {
          market_id: this.readString(),
          outcome: this.readString(),
          best_bid: this.readFloat64(),
          best_ask: this.readFloat64(),
          spread: this.readFloat64(),
          timestamp: this.readFloat64(),
        };
        // Convert -1 back to null
        if ((data as any).best_bid === -1) (data as any).best_bid = null;
        if ((data as any).best_ask === -1) (data as any).best_ask = null;
        if ((data as any).spread === -1) (data as any).spread = null;
        break;

      case MessageType.ORDER_BOOK_SNAPSHOT: {
        const market_id = this.readString();
        const outcome = this.readString();
        
        const bidCount = this.readUint8();
        const bids: Array<{ price: number; quantity: number }> = [];
        for (let i = 0; i < bidCount; i++) {
          bids.push({ price: this.readFloat64(), quantity: this.readFloat64() });
        }
        
        const askCount = this.readUint8();
        const asks: Array<{ price: number; quantity: number }> = [];
        for (let i = 0; i < askCount; i++) {
          asks.push({ price: this.readFloat64(), quantity: this.readFloat64() });
        }
        
        data = { market_id, outcome, bids, asks, timestamp: this.readFloat64() };
        break;
      }

      case MessageType.HEADLINE:
        data = {
          id: this.readString(),
          title: this.readString(),
          source: this.readString(),
          category: this.readString(),
          impact_score: this.readFloat64(),
          timestamp: this.readFloat64(),
        };
        break;

      case MessageType.AUTO_MARKET:
        data = {
          id: this.readString(),
          ticker: this.readString(),
          title: this.readString(),
          category: this.readString(),
          confidence: this.readFloat64(),
          reasoning: this.readString(),
        };
        break;

      default:
        // Skip unknown message
        this.offset = endOffset;
        data = null;
    }

    return { type, data };
  }
}

// ============================================================================
// SHARED INSTANCES
// ============================================================================

export const encoder = new BinaryProtocolEncoder();
export const createDecoder = (buffer: ArrayBuffer | Uint8Array) => new BinaryProtocolDecoder(buffer);
