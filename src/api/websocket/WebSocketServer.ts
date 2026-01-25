/**
 * TRUTH-NET WebSocket Server v2.0
 * 
 * Real-time event streaming with BINARY PROTOCOL support for:
 * - Order book updates (100+ msgs/sec)
 * - Trade executions
 * - Market status changes
 * - Agent notifications
 * - Headline feed
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { EventBus } from '../../events/EventBus.js';
import { 
  BinaryProtocolEncoder, 
  BinaryProtocolDecoder, 
  MessageType,
  encoder as sharedEncoder,
  createDecoder
} from '../protocols/BinaryProtocol.js';

export interface WSClientInfo {
  id: string;
  subscriptions: Set<string>;
  agentId?: string;
  connectedAt: Date;
  lastPing: Date;
  messageCount: number;
  binaryMode: boolean; // Whether client prefers binary
}

export interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'set_binary';
  channels?: string[];
  binary?: boolean;
}

export interface WSEvent {
  channel: string;
  event: string;
  data: unknown;
  timestamp: string;
}

/**
 * WebSocket server for real-time updates
 * Supports both JSON and Binary modes
 */
export class TruthNetWebSocket {
  private wss: WSServer | null = null;
  private clients: Map<string, { ws: WebSocket; info: WSClientInfo }> = new Map();
  private eventBus: EventBus;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private clientIdCounter = 0;
  private binaryEncoder: BinaryProtocolEncoder;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.binaryEncoder = new BinaryProtocolEncoder();
    this.subscribeToEvents();
  }

  /**
   * Start WebSocket server
   */
  start(port: number): void {
    this.wss = new WSServer({ port });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000);

    console.log(`[WebSocket] Server started on port ${port}`);
  }

  /**
   * Stop WebSocket server
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const { ws } of this.clients.values()) {
      ws.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = `ws_${++this.clientIdCounter}_${Date.now()}`;

    // Extract params from query string
    const url = new URL(request.url ?? '', 'ws://localhost');
    const agentId = url.searchParams.get('agent_id');
    const binaryMode = url.searchParams.get('binary') === 'true';

    const info: WSClientInfo = {
      id: clientId,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPing: new Date(),
      messageCount: 0,
      binaryMode,
    };

    if (agentId) {
      info.agentId = agentId;
    }

    this.clients.set(clientId, { ws, info });

    console.log(`[WebSocket] Client connected: ${clientId} (binary: ${binaryMode})`);

    // Send welcome message
    this.sendToClient(clientId, {
      channel: 'system',
      event: 'connected',
      data: { client_id: clientId, binary_mode: binaryMode },
      timestamp: new Date().toISOString(),
    });

    // Handle messages (both JSON and binary)
    ws.on('message', (data, isBinary) => {
      try {
        info.messageCount++;
        
        if (isBinary && data instanceof Buffer) {
          // Handle binary message
          const decoder = createDecoder(data);
          const { type, data: msgData } = decoder.parseMessage();
          this.handleBinaryMessage(clientId, type, msgData);
        } else {
          // Handle JSON message
          const message = JSON.parse(data.toString()) as WSMessage;
          this.handleMessage(clientId, message);
        }
      } catch (error) {
        this.sendToClient(clientId, {
          channel: 'system',
          event: 'error',
          data: { message: 'Invalid message format' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle close
    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WebSocket] Client error ${clientId}:`, error);
    });
  }

  /**
   * Handle binary message
   */
  private handleBinaryMessage(clientId: string, type: MessageType, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (type) {
      case MessageType.HEARTBEAT:
        client.info.lastPing = new Date();
        // Send binary heartbeat ack
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(this.binaryEncoder.encodeHeartbeat());
        }
        break;

      case MessageType.SUBSCRIBE:
        // Binary subscribe format: { channels: string[] }
        const subData = data as { channels?: string[] };
        if (subData.channels) {
          for (const channel of subData.channels) {
            client.info.subscriptions.add(channel);
          }
        }
        break;

      case MessageType.UNSUBSCRIBE:
        const unsubData = data as { channels?: string[] };
        if (unsubData.channels) {
          for (const channel of unsubData.channels) {
            client.info.subscriptions.delete(channel);
          }
        }
        break;
    }
  }

  /**
   * Handle incoming JSON message
   */
  private handleMessage(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channels) {
          for (const channel of message.channels) {
            client.info.subscriptions.add(channel);
          }
          this.sendToClient(clientId, {
            channel: 'system',
            event: 'subscribed',
            data: { channels: message.channels },
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case 'unsubscribe':
        if (message.channels) {
          for (const channel of message.channels) {
            client.info.subscriptions.delete(channel);
          }
          this.sendToClient(clientId, {
            channel: 'system',
            event: 'unsubscribed',
            data: { channels: message.channels },
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case 'ping':
        client.info.lastPing = new Date();
        this.sendToClient(clientId, {
          channel: 'system',
          event: 'pong',
          data: {},
          timestamp: new Date().toISOString(),
        });
        break;

      case 'set_binary':
        client.info.binaryMode = message.binary ?? false;
        this.sendToClient(clientId, {
          channel: 'system',
          event: 'binary_mode_set',
          data: { binary: client.info.binaryMode },
          timestamp: new Date().toISOString(),
        });
        break;
    }
  }

  /**
   * Subscribe to EventBus events and broadcast
   */
  private subscribeToEvents(): void {
    // Trade events
    this.eventBus.subscribe('trades.executed', (data) => {
      this.broadcast('trades', 'executed', data);
    });

    // Order events
    this.eventBus.subscribe('orders.created', (data) => {
      this.broadcast('orders', 'created', data);
    });

    this.eventBus.subscribe('orders.cancelled', (data) => {
      this.broadcast('orders', 'cancelled', data);
    });

    // Market events
    this.eventBus.subscribe('markets.resolving', (data) => {
      this.broadcast('markets', 'resolving', data);
    });

    this.eventBus.subscribe('markets.resolved', (data) => {
      this.broadcast('markets', 'resolved', data);
    });

    // Agent events
    this.eventBus.subscribe('agents.reputation_updated', (data) => {
      this.broadcast('agents', 'reputation_updated', data);
    });
  }

  /**
   * Broadcast event to subscribed clients
   * Automatically uses binary encoding for binary-mode clients
   */
  broadcast(channel: string, event: string, data: unknown): void {
    const message: WSEvent = {
      channel,
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    // Pre-encode binary message for efficiency
    let binaryMessage: Uint8Array | null = null;
    
    for (const [clientId, { ws, info }] of this.clients) {
      // Check if client is subscribed to this channel
      if (info.subscriptions.has(channel) || info.subscriptions.has('*')) {
        if (info.binaryMode) {
          // Send binary - encode once, reuse for all binary clients
          if (!binaryMessage) {
            binaryMessage = this.encodeToBinary(channel, event, data);
          }
          if (binaryMessage && ws.readyState === WebSocket.OPEN) {
            ws.send(binaryMessage);
          }
        } else {
          // Send JSON
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
          }
        }
      }
    }
  }

  /**
   * Send message to specific client by ID
   */
  sendToClient(clientId: string, message: WSEvent): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    if (client.info.binaryMode) {
      const binary = this.encodeToBinary(message.channel, message.event, message.data);
      if (binary) {
        client.ws.send(binary);
      }
    } else {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Encode message to binary format
   */
  private encodeToBinary(channel: string, event: string, data: unknown): Uint8Array | null {
    try {
      // Map channel+event to binary message type
      if (channel === 'trades' && event === 'executed') {
        const trade = data as any;
        return this.binaryEncoder.encodeTrade({
          id: trade.id ?? '',
          market_id: trade.market_id ?? '',
          price: trade.price ?? 0,
          quantity: trade.quantity ?? 0,
          buyer_id: trade.buyer_id ?? '',
          seller_id: trade.seller_id ?? '',
          timestamp: Date.now(),
        });
      }
      
      if (channel === 'orderbook' && event === 'snapshot') {
        return this.binaryEncoder.encodeOrderBookSnapshot(data as any);
      }

      if (channel === 'orderbook' && event === 'best') {
        return this.binaryEncoder.encodeBestBidAsk(data as any);
      }

      if (channel === 'headlines' && event === 'new') {
        return this.binaryEncoder.encodeHeadline(data as any);
      }

      if (channel === 'markets' && event === 'auto_created') {
        return this.binaryEncoder.encodeAutoMarket(data as any);
      }

      // Fallback: for unknown events, don't send binary (client should use JSON mode)
      return null;
    } catch (e) {
      console.error('[WebSocket] Binary encoding error:', e);
      return null;
    }
  }

  /**
   * Broadcast high-frequency order book update
   * Optimized for binary clients
   */
  broadcastOrderBookUpdate(marketId: string, outcome: string, bids: Array<{ price: number; quantity: number }>, asks: Array<{ price: number; quantity: number }>): void {
    const timestamp = Date.now();
    
    const binaryData = this.binaryEncoder.encodeOrderBookSnapshot({
      market_id: marketId,
      outcome,
      bids: bids.slice(0, 10),
      asks: asks.slice(0, 10),
      timestamp,
    });

    const jsonMessage: WSEvent = {
      channel: 'orderbook',
      event: 'snapshot',
      data: { market_id: marketId, outcome, bids, asks, timestamp },
      timestamp: new Date(timestamp).toISOString(),
    };

    for (const { ws, info } of this.clients.values()) {
      if (info.subscriptions.has('orderbook') || info.subscriptions.has('*')) {
        if (ws.readyState === WebSocket.OPEN) {
          if (info.binaryMode) {
            ws.send(binaryData);
          } else {
            ws.send(JSON.stringify(jsonMessage));
          }
        }
      }
    }
  }

  /**
   * Heartbeat to detect dead connections
   */
  private heartbeat(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    for (const [clientId, { ws, info }] of this.clients) {
      if (now - info.lastPing.getTime() > timeout) {
        console.log(`[WebSocket] Terminating stale connection: ${clientId}`);
        ws.terminate();
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client stats
   */
  getStats(): {
    clients: number;
    subscriptions: Record<string, number>;
  } {
    const subscriptions: Record<string, number> = {};

    for (const { info } of this.clients.values()) {
      for (const channel of info.subscriptions) {
        subscriptions[channel] = (subscriptions[channel] ?? 0) + 1;
      }
    }

    return {
      clients: this.clients.size,
      subscriptions,
    };
  }
}
