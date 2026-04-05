/**
 * TRUTH-NET Order Routes
 * Handles order placement, cancellation, and queries
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PlaceOrderRequestSchema } from '../schemas/index.js';
import { Order, OrderSide, OrderType, OutcomeToken, OrderStatus } from '../../types.js';
import { MatchingEngine } from '../../engine/matcher/MatchingEngine.js';
import { markets } from './markets.js';
import { seededMarkets } from '../../boot/PlatformSeeder.js';
import { getLiveNewsMarkets } from './liveNews.js';
import { getAgentManager } from '../../core/AgentManager.js';

// In-memory order store (production would use PostgreSQL)
const orders: Map<string, Order> = new Map();
const agentOrders: Map<string, Set<string>> = new Map();

export function createOrderRoutes(engine: MatchingEngine) {
  return async function orderRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /v1/orders
     * Place a new order
     */
    fastify.post('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      // Get agent from auth header
      const agentId = extractAgentId(request);
      if (!agentId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Valid API key required',
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Validate request
      const parseResult = PlaceOrderRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      const data = parseResult.data;

      // Verify market exists and is active (check all sources)
      let market = markets.get(data.market_id);
      if (!market) {
        const seeded = seededMarkets.get(data.market_id);
        if (seeded) {
          market = {
            id: seeded.id, title: seeded.title, description: seeded.description || '',
            ticker: seeded.id.slice(0, 8).toUpperCase(), category: seeded.category,
            status: 'active' as any, created_at: new Date(seeded.created_at),
            updated_at: new Date(seeded.created_at),
            opens_at: new Date(seeded.created_at), closes_at: new Date(seeded.closes_at),
            resolves_at: new Date(seeded.closes_at),
            resolution_schema: { type: 'binary' as const },
            min_order_size: 1, max_position: 10000, fee_rate: 0.001,
            volume_yes: 0, volume_no: 0, open_interest: 0, tags: [],
          };
        }
      }
      if (!market) {
        const live = getLiveNewsMarkets().find(m => m.id === data.market_id);
        if (live) {
          market = live as any;
        }
      }
      if (!market) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MARKET_NOT_FOUND',
            message: `Market ${data.market_id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      if (market.status !== 'active') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MARKET_NOT_ACTIVE',
            message: `Market ${data.market_id} is not active (status: ${market.status})`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        // Process order through matching engine
        const { order, result } = await engine.processOrder(agentId, data.market_id, {
          market_id: data.market_id,
          side: data.side as OrderSide,
          outcome: data.outcome as OutcomeToken,
          order_type: data.order_type as OrderType,
          price: data.price,
          quantity: data.quantity,
          client_order_id: data.client_order_id,
          metadata: data.metadata,
        });

        // Store order
        orders.set(order.id, order);
        if (!agentOrders.has(agentId)) {
          agentOrders.set(agentId, new Set());
        }
        agentOrders.get(agentId)!.add(order.id);

        // Store filled orders from matches
        for (const filledOrder of result.updated_orders) {
          orders.set(filledOrder.id, filledOrder);
        }

        return reply.status(201).send({
          success: true,
          data: {
            order: formatOrder(order),
            trades: result.trades.map(t => ({
              id: t.id,
              price: t.price,
              quantity: t.quantity,
              executed_at: t.executed_at.toISOString(),
            })),
            fills_count: result.trades.length,
            total_filled: order.filled_qty,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'ORDER_FAILED',
            message: String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    /**
     * GET /v1/orders/:id
     * Get order details
     */
    fastify.get('/orders/:id', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const order = orders.get(id);

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Order ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: formatOrder(order),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * DELETE /v1/orders/:id
     * Cancel an open order
     */
    fastify.delete('/orders/:id', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const agentId = extractAgentId(request);
      if (!agentId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Valid API key required',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const { id } = request.params;
      const order = orders.get(id);

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Order ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      if (order.agent_id !== agentId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot cancel another agent\'s order',
          },
          timestamp: new Date().toISOString(),
        });
      }

      if (!['open', 'partial'].includes(order.status)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'ORDER_NOT_CANCELLABLE',
            message: `Order ${id} cannot be cancelled (status: ${order.status})`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const cancelledOrder = await engine.cancelOrder(id, agentId);
        if (cancelledOrder) {
          orders.set(id, cancelledOrder);
        }

        return reply.send({
          success: true,
          data: {
            order_id: id,
            status: 'cancelled',
            released_amount: order.locked_amount,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CANCEL_FAILED',
            message: String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    /**
     * GET /v1/agents/:id/orders
     * Get agent's orders
     */
    fastify.get('/agents/:id/orders', async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { status?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { status, limit = '50' } = request.query;

      // Check if agent exists using AgentManager
      const agentManager = getAgentManager();
      const agent = agentManager.getAgent(id);
      if (!agent) {
        // Allow query even if agent not found - just return empty orders
        // This prevents issues when agent was created but not registered
      }

      const orderIds = agentOrders.get(id) ?? new Set();
      let result = Array.from(orderIds)
        .map(orderId => orders.get(orderId))
        .filter((o): o is Order => o !== undefined);

      // Filter by status
      if (status) {
        result = result.filter(o => o.status === status);
      }

      // Sort by created_at descending
      result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      // Limit
      const limitNum = Math.min(parseInt(limit || '50') || 50, 100);
      result = result.slice(0, limitNum);

      return reply.send({
        success: true,
        data: {
          orders: result.map(formatOrder),
          total: result.length,
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}

function formatOrder(order: Order) {
  return {
    id: order.id,
    agent_id: order.agent_id,
    market_id: order.market_id,
    side: order.side,
    outcome: order.outcome,
    order_type: order.order_type,
    price: order.price ?? null,
    quantity: order.quantity,
    filled_qty: order.filled_qty,
    remaining_qty: order.remaining_qty,
    locked_amount: order.locked_amount,
    avg_fill_price: order.avg_fill_price ?? null,
    status: order.status,
    expires_at: order.expires_at?.toISOString() ?? null,
    client_order_id: order.client_order_id ?? null,
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    filled_at: order.filled_at?.toISOString() ?? null,
  };
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'truthnet-dev-secret-change-in-production';

function extractAgentId(request: FastifyRequest): string | null {
  const agentIdHeader = request.headers['x-agent-id'];
  if (agentIdHeader && typeof agentIdHeader === 'string') {
    return agentIdHeader;
  }

  const authHeader = request.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      if (payload.userId) {
        const agentManager = getAgentManager();
        const agents = agentManager.getAllAgents();
        const userAgent = agents.find((a: any) => a.id.includes(payload.userId) || a.name?.includes(payload.userId));
        if (userAgent) return userAgent.id;
        return payload.userId;
      }
    } catch {
      // Token is not a JWT (could be an API key) — use as-is
    }
    return token;
  }

  return null;
}

export { orders, agentOrders };
