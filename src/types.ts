/**
 * TRUTH-NET Core Type Definitions
 * AI Agent Rating Agency — All types designed for machine-readability and strict JSON schema compliance
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum AgentStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export enum MarketStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  HALTED = 'halted',
  RESOLVING = 'resolving',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
}

export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  PARTIAL = 'partial',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REJECTED = 'rejected',
}

export enum OutcomeToken {
  YES = 'yes',
  NO = 'no',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  ESCROW_LOCK = 'escrow_lock',
  ESCROW_RELEASE = 'escrow_release',
  TRADE_DEBIT = 'trade_debit',
  TRADE_CREDIT = 'trade_credit',
  SETTLEMENT_PAYOUT = 'settlement_payout',
  FEE = 'fee',
}

// ============================================================================
// RESOLUTION SCHEMA TYPES (Pillar A: Machine-Verifiable Oracle)
// ============================================================================

export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists';

export interface ResolutionCondition {
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface HttpJsonResolutionSchema {
  type: 'http_json';
  source_url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  json_path: string; // JSONPath expression e.g., "$.data.status"
  condition: ResolutionCondition;
  retry_count?: number;
  timeout_ms?: number;
}

export interface GraphQLResolutionSchema {
  type: 'graphql';
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
  json_path: string;
  condition: ResolutionCondition;
  retry_count?: number;
  timeout_ms?: number;
}

export type ResolutionSchema = HttpJsonResolutionSchema | GraphQLResolutionSchema;

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  provider?: string;       // e.g., "OpenAI", "Anthropic"
  model?: string;          // e.g., "gpt-4o", "claude-3.5-sonnet"
  truth_score: number;     // 0-100 composite rating
  grade: string;           // AAA, AA, A, BBB, BB, B, CCC, NR
  certified: boolean;
  certified_at?: Date;
  brier_score: number;     // 0 = perfect, 1 = worst
  sharpe_ratio: number;
  max_drawdown: number;
  total_trades: number;
  winning_trades: number;
  total_staked: number;
  total_pnl: number;
  status: AgentStatus;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date;
}

export interface Wallet {
  id: string;
  agent_id: string;
  currency: string;
  available: number;
  locked: number;
  created_at: Date;
  updated_at: Date;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  tx_type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface Market {
  id: string;
  ticker: string;
  title: string;
  description?: string;
  resolution_schema: ResolutionSchema;
  opens_at: Date;
  closes_at: Date;
  resolves_at: Date;
  status: MarketStatus;
  outcome?: OutcomeToken;
  resolution_data?: Record<string, unknown>;
  min_order_size: number;
  max_position: number;
  fee_rate: number;
  volume_yes: number;
  volume_no: number;
  open_interest: number;
  last_price_yes?: number;
  last_price_no?: number;
  category?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  settled_at?: Date;
}

export interface Order {
  id: string;
  agent_id: string;
  market_id: string;
  side: OrderSide;
  outcome: OutcomeToken;
  order_type: OrderType;
  price?: number; // 0.01 to 0.99 for limit orders
  quantity: number;
  filled_qty: number;
  remaining_qty: number;
  locked_amount: number;
  avg_fill_price?: number;
  status: OrderStatus;
  expires_at?: Date;
  client_order_id?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  filled_at?: Date;
}

export interface Trade {
  id: string;
  market_id: string;
  buy_order_id: string;
  sell_order_id: string;
  buyer_id: string;
  seller_id: string;
  outcome: OutcomeToken;
  price: number;
  quantity: number;
  buyer_fee: number;
  seller_fee: number;
  is_settled: boolean;
  settlement_id?: string;
  executed_at: Date;
  settled_at?: Date;
}

export interface Position {
  id: string;
  agent_id: string;
  market_id: string;
  outcome: OutcomeToken;
  quantity: number;
  avg_entry_price?: number;
  total_cost: number;
  realized_pnl: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateAgentRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentResponse {
  agent: Agent;
  api_key: string; // Only returned once on creation
  wallet: Wallet;
}

export interface CreateMarketRequest {
  ticker: string;
  title: string;
  description?: string;
  resolution_schema: ResolutionSchema;
  opens_at: string; // ISO 8601
  closes_at: string;
  resolves_at: string;
  min_order_size?: number;
  max_position?: number;
  fee_rate?: number;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface PlaceOrderRequest {
  market_id: string;
  side: OrderSide;
  outcome: OutcomeToken;
  order_type: OrderType;
  price?: number;
  quantity: number;
  expires_at?: string;
  client_order_id?: string;
  metadata?: Record<string, unknown>;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  order_count: number;
}

export interface OrderBookSnapshot {
  market_id: string;
  outcome: OutcomeToken;
  bids: OrderBookLevel[]; // Sorted descending by price
  asks: OrderBookLevel[]; // Sorted ascending by price
  timestamp: Date;
}

export interface TradeEvent {
  trade_id: string;
  market_id: string;
  price: number;
  quantity: number;
  outcome: OutcomeToken;
  buyer_id: string;
  seller_id: string;
  executed_at: Date;
}

export interface SettlementResult {
  market_id: string;
  outcome: OutcomeToken;
  resolution_data: Record<string, unknown>;
  total_payout: number;
  payouts: Array<{
    agent_id: string;
    amount: number;
    profit_loss: number;
    truth_score_delta: number;
  }>;
  settled_at: Date;
}

// ============================================================================
// ENGINE INTERNAL TYPES
// ============================================================================

export interface MatchResult {
  trades: Trade[];
  updated_orders: Order[];
  remaining_order?: Order;
}

export interface EscrowLockResult {
  success: boolean;
  locked_amount: number;
  transaction_id?: string;
  error?: string;
}

export interface OracleResolutionResult {
  success: boolean;
  outcome?: OutcomeToken;
  raw_data?: unknown;
  evaluated_value?: unknown;
  error?: string;
}

// ============================================================================
// SIMULATION TYPES
// ============================================================================

export interface SimulationConfig {
  agent_count: number;
  initial_balance: number;
  tick_interval_ms: number;
  market_count: number;
  duration_ticks: number;
}

export interface MockAgentConfig {
  id: string;
  name: string;
  strategy: 'random' | 'momentum' | 'mean_reversion' | 'informed';
  confidence_bias: number; // -0.5 to 0.5
  aggression: number; // 0 to 1
}

export interface SimulationState {
  tick: number;
  agents: Agent[];
  markets: Market[];
  total_trades: number;
  total_volume: number;
}
