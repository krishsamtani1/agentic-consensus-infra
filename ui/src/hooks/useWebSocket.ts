import { useEffect, useRef, useCallback, useMemo } from 'react';
import { create } from 'zustand';

export interface WSMessage {
  channel: string;
  event: string;
  data: unknown;
  timestamp: string;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBookData {
  market_id: string;
  outcome: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  best_bid: number | null;
  best_ask: number | null;
  timestamp: number;
}

interface WSStore {
  isConnected: boolean;
  messages: WSMessage[];
  orderBooks: Map<string, OrderBookData>;
  stats: { clients: number; messagesPerSec: number };
  setConnected: (connected: boolean) => void;
  addMessage: (message: WSMessage) => void;
  updateOrderBook: (data: OrderBookData) => void;
  setStats: (stats: { clients: number; messagesPerSec: number }) => void;
}

const useWSStore = create<WSStore>((set) => ({
  isConnected: false,
  messages: [],
  orderBooks: new Map(),
  stats: { clients: 0, messagesPerSec: 0 },

  setConnected: (connected) => set({ isConnected: connected }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message].slice(-100),
  })),

  updateOrderBook: (data) => set((state) => {
    const key = `${data.market_id}:${data.outcome}`;
    const newMap = new Map(state.orderBooks);
    newMap.set(key, data);
    return { orderBooks: newMap };
  }),

  setStats: (stats) => set({ stats }),
}));

let globalWs: WebSocket | null = null;
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectionCount = 0;

function ensureConnection() {
  if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) return;

  const store = useWSStore.getState();
  const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

  try {
    const ws = new WebSocket(wsBase);
    globalWs = ws;

    ws.onopen = () => {
      useWSStore.getState().setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', channels: ['*'] }));
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data !== 'string') return;
        const message = JSON.parse(event.data) as WSMessage;

        if (message.channel === 'system' && message.event === 'stats') {
          useWSStore.getState().setStats(message.data as any);
        } else if (message.channel === 'orderbook') {
          useWSStore.getState().updateOrderBook(message.data as OrderBookData);
        } else {
          useWSStore.getState().addMessage(message);
        }
      } catch {}
    };

    ws.onclose = () => {
      useWSStore.getState().setConnected(false);
      globalWs = null;
      if (connectionCount > 0) {
        globalReconnectTimer = setTimeout(ensureConnection, 3000);
      }
    };

    ws.onerror = () => {};
  } catch {
    useWSStore.getState().setConnected(false);
  }
}

export function useWebSocket(_options?: {
  binaryMode?: boolean;
  channels?: string[];
}) {
  useEffect(() => {
    connectionCount++;
    ensureConnection();

    return () => {
      connectionCount--;
      if (connectionCount <= 0) {
        connectionCount = 0;
        if (globalReconnectTimer) clearTimeout(globalReconnectTimer);
        if (globalWs) {
          globalWs.close();
          globalWs = null;
        }
      }
    };
  }, []);

  const { isConnected, messages, stats, orderBooks } = useWSStore();

  const send = useCallback((message: object) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    send({ type: 'subscribe', channels });
  }, [send]);

  const unsubscribe = useCallback((channels: string[]) => {
    send({ type: 'unsubscribe', channels });
  }, [send]);

  const getOrderBook = useCallback((marketId: string, outcome: string = 'yes'): OrderBookData | undefined => {
    return orderBooks.get(`${marketId}:${outcome}`);
  }, [orderBooks]);

  return {
    isConnected,
    isBinaryMode: false,
    messages,
    stats,
    send,
    subscribe,
    unsubscribe,
    toggleBinaryMode: () => {},
    getOrderBook,
    orderBooks: Array.from(orderBooks.values()),
  };
}

export function useOrderBook(marketId: string, outcome: string = 'yes') {
  const { getOrderBook, isConnected, subscribe } = useWebSocket();

  useEffect(() => {
    if (isConnected) {
      subscribe([`orderbook:${marketId}`]);
    }
  }, [isConnected, marketId, subscribe]);

  return getOrderBook(marketId, outcome);
}

export function useTradeFeed(limit: number = 50) {
  const { messages, isConnected } = useWebSocket();

  const trades = useMemo(() =>
    messages
      .filter(m => m.channel === 'trades')
      .slice(-limit)
      .reverse(),
    [messages, limit]
  );

  return { trades, isConnected };
}

export function useHeadlinesFeed() {
  const { messages, isConnected } = useWebSocket();

  const headlines = useMemo(() =>
    messages
      .filter(m => m.channel === 'headlines')
      .map(m => m.data)
      .slice(-20)
      .reverse(),
    [messages]
  );

  return { headlines, isConnected };
}
