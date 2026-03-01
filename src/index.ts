/**
 * TRUTH-NET: The AI Agent Rating Agency
 * Main Application Entry Point
 *
 * The first machine-native rating agency for autonomous AI trading agents.
 * We run real-stakes prediction markets as standardized benchmarks, and
 * every agent gets a live, oracle-verified performance rating (TruthScore).
 * 
 * Performance Optimizations:
 * - Red-Black Tree order book: O(log n) insert/delete
 * - Circular buffer order queues: O(1) enqueue/dequeue
 * - Circuit breakers for fault tolerance
 * - WebSocket for real-time streaming
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import 'dotenv/config';

import { healthRoutes } from './api/routes/health.js';
import { createAgentRoutes } from './api/routes/agents.js';
import { createMarketRoutes } from './api/routes/markets.js';
import { createOrderRoutes } from './api/routes/orders.js';
import { createHeadlinesRoutes } from './api/routes/headlines.js';
import { createNewsRoutes } from './api/routes/news.js';
import { createLiveNewsRoutes } from './api/routes/liveNews.js';
import { createHeadlineFactoryRoutes } from './oracle/HeadlineFactory.js';
import { createDiscoveryRoutes } from './oracle/DiscoveryService.js';
import { createResolverRoutes } from './oracle/ProductionResolver.js';
import { createLedgerRoutes } from './persistence/PostgresLedger.js';
import { washTradingDetector } from './core/CircuitBreaker.js';
import { createA2ARoutes } from './a2a/AgentDiscovery.js';
import { createMCPRoutes } from './mcp/MCPToolset.js';
import { getMarginEngine } from './clearinghouse/MarginEngine.js';
import { getReputationLedger } from './reputation/ReputationLedger.js';
import { getDoctrineEngine } from './core/DoctrineEngine.js';
import { getAgentManager } from './core/AgentManager.js';
import { createGovernanceRoutes } from './api/routes/governance.js';
import { createPaymentRoutes } from './api/routes/payments.js';
import { createAuthRoutes } from './api/routes/auth.js';
import { createRatingRoutes } from './api/routes/ratings.js';
import { createApiKeyRoutes } from './api/routes/apiKeys.js';
import { createWebhookRoutes } from './api/routes/webhooks.js';
import { createBenchmarkRoutes } from './api/routes/benchmark.js';
import { getRatingEngine } from './rating/RatingEngine.js';
import { createExternalAgentRoutes } from './api/routes/externalAgents.js';

import { EscrowLedger } from './engine/escrow/EscrowLedger.js';
import { MatchingEngine } from './engine/matcher/MatchingEngine.js';
import { OracleEngine } from './oracle/OracleEngine.js';
import { EventBus } from './events/EventBus.js';
import { TruthNetWebSocket } from './api/websocket/WebSocketServer.js';
import { circuitBreakers } from './core/CircuitBreaker.js';
import { seedPlatform } from './boot/PlatformSeeder.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  port: parseInt(process.env.PORT ?? '3000'),
  wsPort: parseInt(process.env.WS_PORT ?? '3001'),
  host: process.env.HOST ?? '0.0.0.0',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
  },
};

// ============================================================================
// INITIALIZE CORE SYSTEMS
// ============================================================================

// Event Bus - Pub/Sub for all system events
const eventBus = new EventBus();

// Escrow Ledger - Manages agent wallets and fund locking
const escrow = new EscrowLedger();

// Matching Engine - CLOB and order matching
const matchingEngine = new MatchingEngine(escrow, eventBus);

// Oracle Engine - External data fetching and market resolution
const oracleEngine = new OracleEngine(eventBus);

// WebSocket Server - Real-time event streaming
const wsServer = new TruthNetWebSocket(eventBus);

// Initialize circuit breakers for critical services
const dbCircuit = circuitBreakers.get('database', { failureThreshold: 5, timeout: 30000 });
const oracleCircuit = circuitBreakers.get('oracle', { failureThreshold: 3, timeout: 60000 });

// Subscribe to key events for logging
eventBus.subscribe('trades.executed', (data: any) => {
  const trade = data.trade || data;
  console.log(`[TRADE] ${trade.buyer_id} bought ${trade.quantity} ${trade.outcome} @ ${trade.price} on ${trade.market_id?.substring(0,8)}`);
});

eventBus.subscribe('markets.resolved', (data) => {
  console.log(`[ORACLE] Market resolved: ${JSON.stringify(data)}`);
});

// ============================================================================
// CREATE FASTIFY SERVER
// ============================================================================

const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// ============================================================================
// REGISTER PLUGINS
// ============================================================================

async function registerPlugins() {
  // CORS - Allow cross-origin requests
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  await fastify.register(cors, {
    origin: [
      frontendUrl,
      'https://truthnet.com',
      'https://www.truthnet.com',
      'https://truthnet.io',
      'https://www.truthnet.io',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-ID', 'X-API-Key'],
    credentials: true,
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    keyGenerator: (request) => {
      // Rate limit by API key or IP
      const apiKey = request.headers['authorization'];
      return apiKey ?? request.ip;
    },
  });
}

// ============================================================================
// REGISTER ROUTES
// ============================================================================

async function registerRoutes() {
  // Health & status routes
  await fastify.register(healthRoutes);

  // V1 API routes
  await fastify.register(async (app) => {
    // Agent management
    await app.register(createAgentRoutes(escrow));

    // Market operations
    await app.register(createMarketRoutes(matchingEngine, oracleEngine, eventBus));

    // Order management
    await app.register(createOrderRoutes(matchingEngine));

    // Headline factory (Sourcing Agent)
    await app.register(createHeadlinesRoutes(eventBus));

    // News aggregator (mock)
    await app.register(createNewsRoutes(eventBus));

    // Live news from real RSS/API sources
    await app.register(createLiveNewsRoutes(eventBus));

    // Chaos headline factory (spontaneous market generation)
    await app.register(createHeadlineFactoryRoutes(eventBus));

    // Production discovery service (real news APIs)
    await app.register(createDiscoveryRoutes(eventBus));

    // Production resolver (automated oracle resolution)
    await app.register(createResolverRoutes(eventBus));

    // PostgreSQL persistence ledger
    await app.register(createLedgerRoutes());

    // A2A Discovery & Agent Cards (2026 Standard)
    await app.register(createA2ARoutes(eventBus));

    // MCP Toolset for external LLM integration
    await app.register(createMCPRoutes(eventBus));

    // Initialize Margin Engine, Reputation Ledger, and Rating Engine
    const marginEngine = getMarginEngine(eventBus);
    const reputationLedger = getReputationLedger(eventBus);
    const ratingEngine = getRatingEngine(eventBus);
    console.log('[TRUTH-NET] Margin Engine, Reputation Ledger, and Rating Engine initialized');

    // Wire ReputationLedger → RatingEngine: Brier score updates flow into TruthScore
    eventBus.subscribe('reputation.prediction_verified', (data: any) => {
      if (data.agent_id) {
        const rep = reputationLedger.getReputation(data.agent_id);
        if (rep) {
          ratingEngine.updateBrierScore(data.agent_id, rep.brier_score);
        }
      }
    });

    // Wire reputation updates → RatingEngine
    eventBus.subscribe('reputation.updated', (data: any) => {
      if (data.agent_id && data.reputation) {
        const rep = data.reputation;
        // Initialize rating if needed, then update raw metrics
        let rating = ratingEngine.getRating(data.agent_id);
        if (!rating) {
          rating = ratingEngine.initializeRating(data.agent_id);
        }
        // Keep rating metrics in sync with reputation metrics
        rating.win_rate = rep.win_rate || 0;
        rating.total_pnl = rep.total_pnl || 0;
        rating.total_trades = rep.total_trades || 0;
        rating.winning_trades = rep.winning_trades || 0;
      }
    });

    // Rating API (primary product)
    await app.register(createRatingRoutes(ratingEngine, eventBus));

    // Governance & Agent Management
    await app.register(createGovernanceRoutes(eventBus));

    // Stripe Payments
    await app.register(createPaymentRoutes(escrow, eventBus));

    // Authentication
    await app.register(createAuthRoutes(escrow, eventBus));

    // API Key Management
    await app.register(createApiKeyRoutes());

    // Webhook Notifications (Pro/Enterprise)
    await app.register(createWebhookRoutes(eventBus));

    // Benchmarking-as-a-Service
    await app.register(createBenchmarkRoutes(eventBus));

    // External Agent API (the core product API for real users)
    await app.register(createExternalAgentRoutes(matchingEngine, escrow, eventBus));
    
    // Initialize Doctrine Engine and Agent Manager
    const doctrineEngine = getDoctrineEngine(eventBus);
    const agentManager = getAgentManager(eventBus);
    console.log('[TRUTH-NET] Doctrine Engine and Agent Manager initialized');

    // Wash trading status endpoint
    app.get('/wash-trading/status', async () => {
      return {
        success: true,
        data: {
          paused_agents: washTradingDetector.getPausedAgents(),
          all_stats: Object.fromEntries(washTradingDetector.getAllStats()),
        },
        timestamp: new Date().toISOString(),
      };
    });

    app.post('/wash-trading/unpause/:agentId', async (request) => {
      const { agentId } = request.params as { agentId: string };
      washTradingDetector.unpauseAgent(agentId);
      return {
        success: true,
        data: { message: `Agent ${agentId} unpaused` },
        timestamp: new Date().toISOString(),
      };
    });
  }, { prefix: '/v1' });

  // Hook wash trading detector into trade events
  eventBus.subscribe('trades.executed', (data: any) => {
    const trade = data.trade || data;
    if (trade.buyer_id && trade.seller_id) {
      washTradingDetector.recordTrade(
        trade.buyer_id,
        trade.seller_id,
        trade.market_id,
        trade.quantity
      );
    }
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  // Handle validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Generic error response
  return reply.status(error.statusCode ?? 500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'An internal error occurred',
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  return reply.status(404).send({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    // Start WebSocket server
    wsServer.start(config.wsPort);

    // Seed the platform: agents, markets, trading loop, settlement
    const seedResult = await seedPlatform(matchingEngine, escrow, eventBus);
    console.log(`[TRUTH-NET] Platform seeded — settlement: ${seedResult.settlement ? 'online' : 'off'}, trading: ${seedResult.tradingLoop ? 'active' : 'off'}`);

    // Add LLM reasoning and trading stats endpoints (requires trading loop reference)
    fastify.get('/v1/reasoning', async () => ({
      success: true,
      data: seedResult.tradingLoop.getAllReasonings(),
      timestamp: new Date().toISOString(),
    }));

    fastify.get('/v1/reasoning/:agentId', async (request: any) => ({
      success: true,
      data: seedResult.tradingLoop.getReasonings(request.params.agentId),
      timestamp: new Date().toISOString(),
    }));

    fastify.get('/v1/trading/stats', async () => ({
      success: true,
      data: {
        ...seedResult.tradingLoop.getStats(),
        settlement: seedResult.settlement.getStats(),
      },
      timestamp: new Date().toISOString(),
    }));

    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   ████████╗██████╗ ██╗   ██╗████████╗██╗  ██╗                  ║
║   ╚══██╔══╝██╔══██╗██║   ██║╚══██╔══╝██║  ██║                  ║
║      ██║   ██████╔╝██║   ██║   ██║   ███████║                  ║
║      ██║   ██╔══██╗██║   ██║   ██║   ██╔══██║                  ║
║      ██║   ██║  ██║╚██████╔╝   ██║   ██║  ██║                  ║
║      ╚═╝   ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝                  ║
║                                                                ║
║            ███╗   ██╗███████╗████████╗                         ║
║            ████╗  ██║██╔════╝╚══██╔══╝                         ║
║            ██╔██╗ ██║█████╗     ██║                            ║
║            ██║╚██╗██║██╔══╝     ██║                            ║
║            ██║ ╚████║███████╗   ██║                            ║
║            ╚═╝  ╚═══╝╚══════╝   ╚═╝                            ║
║                                                                ║
║   The AI Agent Rating Agency                                  ║
║   https://truthnet.com | v3.0 Production                      ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║   HTTP API:    http://${config.host}:${config.port}                             ║
║   WebSocket:   ws://${config.host}:${config.wsPort}                              ║
║   Dashboard:   http://localhost:5173                           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  wsServer.stop();
  oracleEngine.clearAll();
  await fastify.close();
  console.log('Shutdown complete.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  wsServer.stop();
  oracleEngine.clearAll();
  await fastify.close();
  console.log('Shutdown complete.');
  process.exit(0);
});

// Start the server
start();

// Export for testing
export { fastify, escrow, matchingEngine, oracleEngine, eventBus, wsServer, circuitBreakers };
