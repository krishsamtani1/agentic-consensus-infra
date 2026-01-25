/**
 * TRUTH-NET Binary Serializer
 * 
 * MessagePack-style binary encoding for ultra-low latency WebSocket communication.
 * Custom implementation optimized for order book data structures.
 * 
 * Format:
 * - Integers: varint encoding
 * - Floats: IEEE 754 double (8 bytes)
 * - Strings: length-prefixed UTF-8
 * - Arrays: length-prefixed
 * - Objects: key-value pairs with type tags
 */

// ============================================================================
// TYPE TAGS
// ============================================================================

const TYPE = {
  NULL: 0x00,
  BOOL_FALSE: 0x01,
  BOOL_TRUE: 0x02,
  INT8: 0x03,
  INT16: 0x04,
  INT32: 0x05,
  FLOAT64: 0x06,
  STRING8: 0x07,   // String with 8-bit length
  STRING16: 0x08,  // String with 16-bit length
  ARRAY8: 0x09,    // Array with 8-bit length
  ARRAY16: 0x0A,
  MAP8: 0x0B,      // Object/Map with 8-bit length
  MAP16: 0x0C,
  // Specialized types for order book
  ORDER_BOOK_LEVEL: 0x10,
  ORDER_BOOK_SNAPSHOT: 0x11,
  TRADE_EVENT: 0x12,
  AGENT_UPDATE: 0x13,
} as const;

// ============================================================================
// ENCODER
// ============================================================================

export class BinaryEncoder {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;
  private textEncoder: TextEncoder;

  constructor(initialSize: number = 4096) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.textEncoder = new TextEncoder();
  }

  /**
   * Get the encoded buffer
   */
  getBuffer(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  /**
   * Reset encoder for reuse
   */
  reset(): void {
    this.offset = 0;
  }

  /**
   * Ensure buffer has enough space
   */
  private ensureCapacity(needed: number): void {
    const required = this.offset + needed;
    if (required > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, required);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
  }

  // ---------------------------------------------------------------------------
  // Primitive encoders
  // ---------------------------------------------------------------------------

  writeNull(): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset++, TYPE.NULL);
  }

  writeBool(value: boolean): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset++, value ? TYPE.BOOL_TRUE : TYPE.BOOL_FALSE);
  }

  writeInt(value: number): void {
    this.ensureCapacity(5);
    if (value >= -128 && value <= 127) {
      this.view.setUint8(this.offset++, TYPE.INT8);
      this.view.setInt8(this.offset++, value);
    } else if (value >= -32768 && value <= 32767) {
      this.view.setUint8(this.offset++, TYPE.INT16);
      this.view.setInt16(this.offset, value, true);
      this.offset += 2;
    } else {
      this.view.setUint8(this.offset++, TYPE.INT32);
      this.view.setInt32(this.offset, value, true);
      this.offset += 4;
    }
  }

  writeFloat(value: number): void {
    this.ensureCapacity(9);
    this.view.setUint8(this.offset++, TYPE.FLOAT64);
    this.view.setFloat64(this.offset, value, true);
    this.offset += 8;
  }

  writeString(value: string): void {
    const encoded = this.textEncoder.encode(value);
    const len = encoded.length;

    if (len <= 255) {
      this.ensureCapacity(2 + len);
      this.view.setUint8(this.offset++, TYPE.STRING8);
      this.view.setUint8(this.offset++, len);
    } else {
      this.ensureCapacity(3 + len);
      this.view.setUint8(this.offset++, TYPE.STRING16);
      this.view.setUint16(this.offset, len, true);
      this.offset += 2;
    }

    new Uint8Array(this.buffer, this.offset).set(encoded);
    this.offset += len;
  }

  writeArrayHeader(length: number): void {
    this.ensureCapacity(3);
    if (length <= 255) {
      this.view.setUint8(this.offset++, TYPE.ARRAY8);
      this.view.setUint8(this.offset++, length);
    } else {
      this.view.setUint8(this.offset++, TYPE.ARRAY16);
      this.view.setUint16(this.offset, length, true);
      this.offset += 2;
    }
  }

  writeMapHeader(length: number): void {
    this.ensureCapacity(3);
    if (length <= 255) {
      this.view.setUint8(this.offset++, TYPE.MAP8);
      this.view.setUint8(this.offset++, length);
    } else {
      this.view.setUint8(this.offset++, TYPE.MAP16);
      this.view.setUint16(this.offset, length, true);
      this.offset += 2;
    }
  }

  // ---------------------------------------------------------------------------
  // Specialized encoders for order book
  // ---------------------------------------------------------------------------

  /**
   * Encode order book level (price, quantity, count)
   * Optimized: 25 bytes -> 17 bytes
   */
  writeOrderBookLevel(price: number, quantity: number, orderCount: number): void {
    this.ensureCapacity(17);
    this.view.setUint8(this.offset++, TYPE.ORDER_BOOK_LEVEL);
    this.view.setFloat64(this.offset, price, true);
    this.offset += 8;
    this.view.setFloat64(this.offset, quantity, true);
    this.offset += 8;
  }

  /**
   * Encode full order book snapshot
   * Structure: marketId, outcome, bids[], asks[], bestBid, bestAsk, timestamp
   */
  writeOrderBookSnapshot(snapshot: {
    market_id: string;
    outcome: string;
    bids: Array<{ price: number; quantity: number; order_count: number }>;
    asks: Array<{ price: number; quantity: number; order_count: number }>;
    best_bid: number | null;
    best_ask: number | null;
    timestamp: number;
  }): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset++, TYPE.ORDER_BOOK_SNAPSHOT);

    this.writeString(snapshot.market_id);
    this.writeString(snapshot.outcome);

    // Bids
    this.writeArrayHeader(snapshot.bids.length);
    for (const bid of snapshot.bids) {
      this.writeOrderBookLevel(bid.price, bid.quantity, bid.order_count);
    }

    // Asks
    this.writeArrayHeader(snapshot.asks.length);
    for (const ask of snapshot.asks) {
      this.writeOrderBookLevel(ask.price, ask.quantity, ask.order_count);
    }

    // Best prices
    if (snapshot.best_bid !== null) {
      this.writeFloat(snapshot.best_bid);
    } else {
      this.writeNull();
    }
    if (snapshot.best_ask !== null) {
      this.writeFloat(snapshot.best_ask);
    } else {
      this.writeNull();
    }

    // Timestamp as int
    this.writeInt(snapshot.timestamp);
  }

  /**
   * Encode trade event
   */
  writeTradeEvent(trade: {
    id: string;
    market_id: string;
    price: number;
    quantity: number;
    buyer_id: string;
    seller_id: string;
    timestamp: number;
  }): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset++, TYPE.TRADE_EVENT);

    this.writeString(trade.id);
    this.writeString(trade.market_id);
    this.writeFloat(trade.price);
    this.writeFloat(trade.quantity);
    this.writeString(trade.buyer_id);
    this.writeString(trade.seller_id);
    this.writeInt(trade.timestamp);
  }

  /**
   * Encode any value (generic)
   */
  writeAny(value: unknown): void {
    if (value === null || value === undefined) {
      this.writeNull();
    } else if (typeof value === 'boolean') {
      this.writeBool(value);
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        this.writeInt(value);
      } else {
        this.writeFloat(value);
      }
    } else if (typeof value === 'string') {
      this.writeString(value);
    } else if (Array.isArray(value)) {
      this.writeArrayHeader(value.length);
      for (const item of value) {
        this.writeAny(item);
      }
    } else if (typeof value === 'object') {
      const entries = Object.entries(value);
      this.writeMapHeader(entries.length);
      for (const [key, val] of entries) {
        this.writeString(key);
        this.writeAny(val);
      }
    }
  }
}

// ============================================================================
// DECODER
// ============================================================================

export class BinaryDecoder {
  private view: DataView;
  private offset: number = 0;
  private textDecoder: TextDecoder;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    if (buffer instanceof Uint8Array) {
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      this.view = new DataView(buffer);
    }
    this.textDecoder = new TextDecoder();
  }

  /**
   * Read next value
   */
  read(): unknown {
    const type = this.view.getUint8(this.offset++);

    switch (type) {
      case TYPE.NULL:
        return null;

      case TYPE.BOOL_FALSE:
        return false;

      case TYPE.BOOL_TRUE:
        return true;

      case TYPE.INT8:
        return this.view.getInt8(this.offset++);

      case TYPE.INT16: {
        const val = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return val;
      }

      case TYPE.INT32: {
        const val = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return val;
      }

      case TYPE.FLOAT64: {
        const val = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return val;
      }

      case TYPE.STRING8: {
        const len = this.view.getUint8(this.offset++);
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
        this.offset += len;
        return this.textDecoder.decode(bytes);
      }

      case TYPE.STRING16: {
        const len = this.view.getUint16(this.offset, true);
        this.offset += 2;
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
        this.offset += len;
        return this.textDecoder.decode(bytes);
      }

      case TYPE.ARRAY8:
      case TYPE.ARRAY16: {
        const len = type === TYPE.ARRAY8
          ? this.view.getUint8(this.offset++)
          : (this.offset += 2, this.view.getUint16(this.offset - 2, true));
        const arr = [];
        for (let i = 0; i < len; i++) {
          arr.push(this.read());
        }
        return arr;
      }

      case TYPE.MAP8:
      case TYPE.MAP16: {
        const len = type === TYPE.MAP8
          ? this.view.getUint8(this.offset++)
          : (this.offset += 2, this.view.getUint16(this.offset - 2, true));
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          const key = this.read() as string;
          const val = this.read();
          obj[key] = val;
        }
        return obj;
      }

      case TYPE.ORDER_BOOK_LEVEL: {
        const price = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        const quantity = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return { price, quantity, order_count: 1 };
      }

      case TYPE.ORDER_BOOK_SNAPSHOT: {
        const market_id = this.read() as string;
        const outcome = this.read() as string;
        const bids = this.read() as Array<{ price: number; quantity: number; order_count: number }>;
        const asks = this.read() as Array<{ price: number; quantity: number; order_count: number }>;
        const best_bid = this.read() as number | null;
        const best_ask = this.read() as number | null;
        const timestamp = this.read() as number;
        return { market_id, outcome, bids, asks, best_bid, best_ask, timestamp };
      }

      case TYPE.TRADE_EVENT: {
        const id = this.read() as string;
        const market_id = this.read() as string;
        const price = this.read() as number;
        const quantity = this.read() as number;
        const buyer_id = this.read() as string;
        const seller_id = this.read() as string;
        const timestamp = this.read() as number;
        return { id, market_id, price, quantity, buyer_id, seller_id, timestamp };
      }

      default:
        throw new Error(`Unknown type tag: 0x${type.toString(16)}`);
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

const sharedEncoder = new BinaryEncoder(8192);

/**
 * Encode value to binary
 */
export function encode(value: unknown): Uint8Array {
  sharedEncoder.reset();
  sharedEncoder.writeAny(value);
  return sharedEncoder.getBuffer().slice(); // Return copy
}

/**
 * Decode binary to value
 */
export function decode(buffer: ArrayBuffer | Uint8Array): unknown {
  const decoder = new BinaryDecoder(buffer);
  return decoder.read();
}

/**
 * Encode order book snapshot (optimized)
 */
export function encodeOrderBookSnapshot(snapshot: {
  market_id: string;
  outcome: string;
  bids: Array<{ price: number; quantity: number; order_count: number }>;
  asks: Array<{ price: number; quantity: number; order_count: number }>;
  best_bid: number | null;
  best_ask: number | null;
  timestamp: number;
}): Uint8Array {
  sharedEncoder.reset();
  sharedEncoder.writeOrderBookSnapshot(snapshot);
  return sharedEncoder.getBuffer().slice();
}

/**
 * Encode trade event (optimized)
 */
export function encodeTradeEvent(trade: {
  id: string;
  market_id: string;
  price: number;
  quantity: number;
  buyer_id: string;
  seller_id: string;
  timestamp: number;
}): Uint8Array {
  sharedEncoder.reset();
  sharedEncoder.writeTradeEvent(trade);
  return sharedEncoder.getBuffer().slice();
}
