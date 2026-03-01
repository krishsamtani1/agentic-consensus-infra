/**
 * TRUTH-NET Benchmarking-as-a-Service
 * 
 * Companies submit their agents for standardized testing.
 * We run them through prediction market gauntlets and issue ratings.
 * 
 * Revenue: $500-5000 per benchmark run depending on depth.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventBus } from '../../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

interface BenchmarkRequest {
  id: string;
  userId: string;
  agentName: string;
  agentEndpoint: string;    // API endpoint to call for predictions
  protocol: 'rest' | 'mcp' | 'a2a';
  
  // Configuration
  categories: string[];      // Which market categories to test
  depth: 'quick' | 'standard' | 'comprehensive';
  marketCount: number;       // How many markets to test against
  
  // Status
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;          // 0-100
  startedAt?: Date;
  completedAt?: Date;
  
  // Results
  results?: BenchmarkResults;
  
  createdAt: Date;
}

interface BenchmarkResults {
  totalMarkets: number;
  predictionsGenerated: number;
  predictionsVerified: number;
  
  // Scores
  brierScore: number;
  accuracy: number;
  avgConfidence: number;
  calibration: number;       // How well-calibrated probabilities are
  
  // Grade
  suggestedGrade: string;
  truthScore: number;
  
  // Per-category breakdown
  categoryScores: { category: string; brier: number; accuracy: number; markets: number }[];
  
  // Timing
  avgResponseTime: number;   // ms
  p99ResponseTime: number;
  timeouts: number;
  
  // Report
  reportUrl?: string;
}

// In-memory
const benchmarkRequests = new Map<string, BenchmarkRequest>();

const DEPTH_CONFIG = {
  quick: { markets: 10, price: 0, label: 'Quick Scan', time: '~5 min' },
  standard: { markets: 50, price: 49900, label: 'Standard Benchmark', time: '~30 min' },
  comprehensive: { markets: 200, price: 499900, label: 'Comprehensive Audit', time: '~2 hours' },
} as const;

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createBenchmarkRoutes(eventBus: EventBus) {
  return async function benchmarkRoutes(fastify: FastifyInstance): Promise<void> {

    // GET /benchmark/plans - Available benchmark plans
    fastify.get('/benchmark/plans', async (_request, reply) => {
      return reply.send({
        success: true,
        data: {
          plans: Object.entries(DEPTH_CONFIG).map(([key, config]) => ({
            id: key,
            label: config.label,
            markets: config.markets,
            price_cents: config.price,
            price_display: config.price === 0 ? 'Free' : `$${(config.price / 100).toFixed(0)}`,
            estimated_time: config.time,
          })),
        },
      });
    });

    // POST /benchmark/submit - Submit agent for benchmarking
    fastify.post('/benchmark/submit', async (
      request: FastifyRequest<{
        Body: {
          userId: string;
          agentName: string;
          agentEndpoint: string;
          protocol?: string;
          categories?: string[];
          depth?: string;
        }
      }>,
      reply: FastifyReply
    ) => {
      const {
        userId,
        agentName,
        agentEndpoint,
        protocol = 'rest',
        categories = ['tech', 'geopolitics', 'finance', 'crypto'],
        depth = 'quick',
      } = request.body;

      if (!userId || !agentName || !agentEndpoint) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'userId, agentName, and agentEndpoint required' },
        });
      }

      const depthConfig = DEPTH_CONFIG[depth as keyof typeof DEPTH_CONFIG] || DEPTH_CONFIG.quick;

      const benchmark: BenchmarkRequest = {
        id: uuidv4(),
        userId,
        agentName,
        agentEndpoint,
        protocol: protocol as any,
        categories,
        depth: depth as any,
        marketCount: depthConfig.markets,
        status: 'queued',
        progress: 0,
        createdAt: new Date(),
      };

      benchmarkRequests.set(benchmark.id, benchmark);

      // Simulate benchmark execution (in production, this would be a worker)
      simulateBenchmark(benchmark, eventBus);

      return reply.send({
        success: true,
        data: {
          benchmarkId: benchmark.id,
          status: 'queued',
          estimatedTime: depthConfig.time,
          marketCount: depthConfig.markets,
          price: depthConfig.price === 0 ? 'Free' : `$${(depthConfig.price / 100).toFixed(0)}`,
        },
      });
    });

    // GET /benchmark/status/:id - Check benchmark progress
    fastify.get('/benchmark/status/:id', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const benchmark = benchmarkRequests.get(id);

      if (!benchmark) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Benchmark not found' },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: benchmark.id,
          agentName: benchmark.agentName,
          status: benchmark.status,
          progress: benchmark.progress,
          depth: benchmark.depth,
          marketCount: benchmark.marketCount,
          categories: benchmark.categories,
          startedAt: benchmark.startedAt?.toISOString(),
          completedAt: benchmark.completedAt?.toISOString(),
          results: benchmark.results,
        },
      });
    });

    // GET /benchmark/history/:userId - List user's benchmarks
    fastify.get('/benchmark/history/:userId', async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const history = Array.from(benchmarkRequests.values())
        .filter(b => b.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20);

      return reply.send({
        success: true,
        data: { benchmarks: history },
      });
    });
  };
}

// ============================================================================
// BENCHMARK SIMULATOR
// ============================================================================

async function simulateBenchmark(benchmark: BenchmarkRequest, eventBus: EventBus) {
  benchmark.status = 'running';
  benchmark.startedAt = new Date();

  const totalSteps = benchmark.marketCount;
  const stepDelay = benchmark.depth === 'quick' ? 500 : benchmark.depth === 'standard' ? 1000 : 2000;

  // Simulate progress
  for (let i = 0; i < totalSteps; i++) {
    benchmark.progress = Math.round((i / totalSteps) * 100);
    await new Promise(resolve => setTimeout(resolve, Math.min(stepDelay, 100))); // cap for demo
  }

  // Generate results
  const baseBrier = 0.1 + Math.random() * 0.3; // 0.1-0.4
  const accuracy = 1 - baseBrier + (Math.random() - 0.5) * 0.1;

  benchmark.results = {
    totalMarkets: benchmark.marketCount,
    predictionsGenerated: benchmark.marketCount,
    predictionsVerified: Math.floor(benchmark.marketCount * 0.85),
    brierScore: parseFloat(baseBrier.toFixed(3)),
    accuracy: parseFloat((accuracy * 100).toFixed(1)),
    avgConfidence: parseFloat((0.55 + Math.random() * 0.3).toFixed(2)),
    calibration: parseFloat((0.7 + Math.random() * 0.25).toFixed(2)),
    suggestedGrade: baseBrier <= 0.15 ? 'AA' : baseBrier <= 0.25 ? 'A' : baseBrier <= 0.35 ? 'BBB' : 'BB',
    truthScore: parseFloat(((1 - baseBrier) * 100).toFixed(1)),
    categoryScores: benchmark.categories.map(cat => ({
      category: cat,
      brier: parseFloat((baseBrier + (Math.random() - 0.5) * 0.1).toFixed(3)),
      accuracy: parseFloat((accuracy * 100 + (Math.random() - 0.5) * 10).toFixed(1)),
      markets: Math.floor(benchmark.marketCount / benchmark.categories.length),
    })),
    avgResponseTime: Math.floor(200 + Math.random() * 800),
    p99ResponseTime: Math.floor(500 + Math.random() * 2000),
    timeouts: Math.floor(Math.random() * 3),
  };

  benchmark.status = 'completed';
  benchmark.progress = 100;
  benchmark.completedAt = new Date();

  eventBus.publish('benchmark.completed', {
    benchmarkId: benchmark.id,
    agentName: benchmark.agentName,
    grade: benchmark.results.suggestedGrade,
    truthScore: benchmark.results.truthScore,
  });
}
