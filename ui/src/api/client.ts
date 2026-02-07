// Use env var for production, fallback to /api for dev (Vite proxy)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  // Include auth token if available
  const token = localStorage.getItem('truthnet_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token && token !== 'demo-token') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json() as APIResponse<T>;

  if (!data.success || !response.ok) {
    throw new Error(data.error?.message ?? 'Request failed');
  }

  return data.data as T;
}

// ============================================================================
// AGENTS
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  truth_score: number;
  total_trades: number;
  winning_trades: number;
  win_rate: number;
  total_pnl: number;
  status: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  agent_id: string;
  currency: string;
  available: number;
  locked: number;
  total: number;
}

export interface CreateAgentResponse {
  agent: Agent;
  api_key: string;
  wallet: Wallet;
}

export const agentsAPI = {
  create: (data: { name: string; description?: string }) =>
    request<CreateAgentResponse>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<Agent>(`/agents/${id}`),

  getWallet: (id: string) => request<Wallet>(`/agents/${id}/wallet`),

  deposit: (id: string, amount: number) =>
    request<{ transaction_id: string; balance: Wallet }>(`/agents/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

// ============================================================================
// MARKETS
// ============================================================================

export interface Market {
  id: string;
  ticker: string;
  title: string;
  description: string | null;
  status: string;
  outcome: string | null;
  opens_at: string;
  closes_at: string;
  resolves_at: string;
  volume_yes: number;
  volume_no: number;
  open_interest: number;
  last_price_yes: number | null;
  last_price_no: number | null;
  category?: string;
  tags?: string[];
  [key: string]: any;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  order_count: number;
}

export interface OrderBook {
  market_id: string;
  outcome: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
}

export const marketsAPI = {
  list: (params?: { status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ markets: Market[]; total: number }>(
      `/markets${query.toString() ? `?${query}` : ''}`
    );
  },

  get: (id: string) => request<Market>(`/markets/${id}`),

  getOrderBook: (id: string, outcome: 'yes' | 'no' = 'yes') =>
    request<OrderBook>(`/markets/${id}/orderbook?outcome=${outcome}`),

  create: (data: {
    ticker: string;
    title: string;
    resolution_schema: object;
    opens_at: string;
    closes_at: string;
    resolves_at: string;
  }) =>
    request<Market>('/markets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================================================
// ORDERS
// ============================================================================

export interface Order {
  id: string;
  agent_id: string;
  market_id: string;
  side: 'buy' | 'sell';
  outcome: 'yes' | 'no';
  order_type: 'limit' | 'market';
  price: number | null;
  quantity: number;
  filled_qty: number;
  remaining_qty: number;
  status: string;
  created_at: string;
}

export const ordersAPI = {
  place: (
    agentId: string,
    data: {
      market_id: string;
      side: 'buy' | 'sell';
      outcome: 'yes' | 'no';
      order_type: 'limit' | 'market';
      price?: number;
      quantity: number;
    }
  ) =>
    request<{ order: Order; trades: unknown[] }>('/orders', {
      method: 'POST',
      headers: {
        'X-Agent-ID': agentId,
      },
      body: JSON.stringify(data),
    }),

  cancel: (orderId: string, agentId: string) =>
    request<{ order_id: string; status: string }>(`/orders/${orderId}`, {
      method: 'DELETE',
      headers: {
        'X-Agent-ID': agentId,
      },
    }),
};

// ============================================================================
// HEALTH
// ============================================================================

export interface HealthStatus {
  status: string;
  version: string;
  uptime_seconds: number;
  components: {
    database: string;
    redis: string;
    oracle: string;
    matching_engine: string;
  };
}

export const healthAPI = {
  check: () => request<HealthStatus>('/../health'),
};

// ============================================================================
// UNIFIED API CLIENT
// ============================================================================

export const apiClient = {
  agents: agentsAPI,
  markets: marketsAPI,
  orders: ordersAPI,
  health: healthAPI,
  
  // Direct request method for custom endpoints
  request,
  
  // Convenience methods
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data: unknown, options?: RequestInit) => 
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data), ...options }),
  delete: <T>(endpoint: string) => 
    request<T>(endpoint, { method: 'DELETE' }),
  put: <T>(endpoint: string, data: unknown) => 
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
};
