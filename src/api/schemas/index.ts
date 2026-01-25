/**
 * TRUTH-NET API Schemas
 * Strict JSON Schema definitions for machine-readable API
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const UUIDSchema = z.string().uuid();

export const TimestampSchema = z.string().datetime();

export const PriceSchema = z.number().min(0.01).max(0.99);

export const QuantitySchema = z.number().positive();

// ============================================================================
// AGENT SCHEMAS
// ============================================================================

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  description: z.string().nullable(),
  truth_score: z.number().min(0).max(1),
  total_trades: z.number().int().nonnegative(),
  winning_trades: z.number().int().nonnegative(),
  total_staked: z.number(),
  total_pnl: z.number(),
  status: z.enum(['active', 'suspended', 'banned']),
  metadata: z.record(z.unknown()),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  last_active_at: TimestampSchema,
});

export const WalletResponseSchema = z.object({
  id: UUIDSchema,
  agent_id: UUIDSchema,
  currency: z.string(),
  available: z.number(),
  locked: z.number(),
  total: z.number(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

// ============================================================================
// MARKET SCHEMAS
// ============================================================================

export const ResolutionConditionSchema = z.object({
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const HttpJsonResolutionSchemaSchema = z.object({
  type: z.literal('http_json'),
  source_url: z.string().url(),
  method: z.enum(['GET', 'POST']),
  headers: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  json_path: z.string().startsWith('$'),
  condition: ResolutionConditionSchema,
  retry_count: z.number().int().positive().max(10).optional(),
  timeout_ms: z.number().int().positive().max(60000).optional(),
});

export const ResolutionSchemaSchema = z.discriminatedUnion('type', [
  HttpJsonResolutionSchemaSchema,
  // Add more schema types here as needed
]);

export const CreateMarketRequestSchema = z.object({
  ticker: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  resolution_schema: HttpJsonResolutionSchemaSchema,
  opens_at: TimestampSchema,
  closes_at: TimestampSchema,
  resolves_at: TimestampSchema,
  min_order_size: QuantitySchema.optional(),
  max_position: QuantitySchema.optional(),
  fee_rate: z.number().min(0).max(0.1).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const MarketResponseSchema = z.object({
  id: UUIDSchema,
  ticker: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  resolution_schema: HttpJsonResolutionSchemaSchema,
  opens_at: TimestampSchema,
  closes_at: TimestampSchema,
  resolves_at: TimestampSchema,
  status: z.enum(['pending', 'active', 'halted', 'resolving', 'settled', 'cancelled']),
  outcome: z.enum(['yes', 'no']).nullable(),
  min_order_size: z.number(),
  max_position: z.number(),
  fee_rate: z.number(),
  volume_yes: z.number(),
  volume_no: z.number(),
  open_interest: z.number(),
  last_price_yes: z.number().nullable(),
  last_price_no: z.number().nullable(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const PlaceOrderRequestSchema = z.object({
  market_id: UUIDSchema,
  side: z.enum(['buy', 'sell']),
  outcome: z.enum(['yes', 'no']),
  order_type: z.enum(['limit', 'market']),
  price: PriceSchema.optional(),
  quantity: QuantitySchema,
  expires_at: TimestampSchema.optional(),
  client_order_id: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  data => data.order_type === 'market' || data.price !== undefined,
  { message: 'Limit orders require a price' }
);

export const OrderResponseSchema = z.object({
  id: UUIDSchema,
  agent_id: UUIDSchema,
  market_id: UUIDSchema,
  side: z.enum(['buy', 'sell']),
  outcome: z.enum(['yes', 'no']),
  order_type: z.enum(['limit', 'market']),
  price: z.number().nullable(),
  quantity: z.number(),
  filled_qty: z.number(),
  remaining_qty: z.number(),
  locked_amount: z.number(),
  avg_fill_price: z.number().nullable(),
  status: z.enum(['pending', 'open', 'partial', 'filled', 'cancelled', 'expired', 'rejected']),
  expires_at: TimestampSchema.nullable(),
  client_order_id: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  filled_at: TimestampSchema.nullable(),
});

// ============================================================================
// ORDER BOOK SCHEMAS
// ============================================================================

export const OrderBookLevelSchema = z.object({
  price: z.number(),
  quantity: z.number(),
  order_count: z.number().int(),
});

export const OrderBookSnapshotSchema = z.object({
  market_id: UUIDSchema,
  outcome: z.enum(['yes', 'no']),
  bids: z.array(OrderBookLevelSchema),
  asks: z.array(OrderBookLevelSchema),
  best_bid: z.number().nullable(),
  best_ask: z.number().nullable(),
  spread: z.number().nullable(),
  timestamp: TimestampSchema,
});

// ============================================================================
// TRADE SCHEMAS
// ============================================================================

export const TradeResponseSchema = z.object({
  id: UUIDSchema,
  market_id: UUIDSchema,
  buyer_id: UUIDSchema,
  seller_id: UUIDSchema,
  outcome: z.enum(['yes', 'no']),
  price: z.number(),
  quantity: z.number(),
  buyer_fee: z.number(),
  seller_fee: z.number(),
  executed_at: TimestampSchema,
});

// ============================================================================
// API RESPONSE WRAPPER
// ============================================================================

export const APIResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: TimestampSchema,
  });

export const APIErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  timestamp: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type WalletResponse = z.infer<typeof WalletResponseSchema>;
export type CreateMarketRequest = z.infer<typeof CreateMarketRequestSchema>;
export type MarketResponse = z.infer<typeof MarketResponseSchema>;
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type OrderBookSnapshot = z.infer<typeof OrderBookSnapshotSchema>;
export type TradeResponse = z.infer<typeof TradeResponseSchema>;
