/**
 * TRUTH-NET Health & Status Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  timestamp: string;
  components: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    oracle: 'running' | 'stopped';
    matching_engine: 'running' | 'stopped';
  };
}

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic health check
   */
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const response: HealthResponse = {
      status: 'healthy',
      version: '0.1.0',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      components: {
        database: 'connected', // TODO: Actual check
        redis: 'connected', // TODO: Actual check
        oracle: 'running',
        matching_engine: 'running',
      },
    };

    return reply.send(response);
  });

  /**
   * GET /
   * API root - returns available endpoints
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      name: 'TRUTH-NET API',
      version: '0.1.0',
      description: 'Agentic Consensus Infrastructure - Headless Truth Clearinghouse',
      documentation: '/documentation',
      endpoints: {
        health: 'GET /health',
        agents: {
          create: 'POST /v1/agents',
          get: 'GET /v1/agents/:id',
          wallet: 'GET /v1/agents/:id/wallet',
          deposit: 'POST /v1/agents/:id/deposit',
          withdraw: 'POST /v1/agents/:id/withdraw',
          orders: 'GET /v1/agents/:id/orders',
        },
        markets: {
          create: 'POST /v1/markets',
          list: 'GET /v1/markets',
          get: 'GET /v1/markets/:id',
          orderbook: 'GET /v1/markets/:id/orderbook',
          trades: 'GET /v1/markets/:id/trades',
        },
        orders: {
          place: 'POST /v1/orders',
          get: 'GET /v1/orders/:id',
          cancel: 'DELETE /v1/orders/:id',
        },
      },
      timestamp: new Date().toISOString(),
    });
  });
}
