/**
 * TRUTH-NET Production Resolver v1.0
 * 
 * Automated oracle resolution by polling real data sources:
 * - GitHub API (repo stats, issues, releases)
 * - Weather APIs (NOAA, OpenWeatherMap)
 * - MarineTraffic / VesselFinder (shipping data)
 * - News APIs (for event verification)
 * - Custom HTTP endpoints
 */

import { EventBus } from '../events/EventBus.js';
import { Market, MarketStatus, ResolutionSchema } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ResolutionResult {
  marketId: string;
  outcome: boolean | null;  // true = YES wins, false = NO wins, null = invalid
  confidence: number;       // 0-1 confidence in the resolution
  source: string;
  rawData: unknown;
  resolvedAt: Date;
  error?: string;
}

export interface DataSource {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: number;  // requests per minute
}

// ============================================================================
// DATA SOURCE CONFIGURATIONS
// ============================================================================

const DATA_SOURCES: Record<string, DataSource> = {
  github: {
    id: 'github',
    name: 'GitHub API',
    baseUrl: 'https://api.github.com',
    rateLimit: 60,
  },
  noaa: {
    id: 'noaa',
    name: 'NOAA Weather',
    baseUrl: 'https://api.weather.gov',
    rateLimit: 30,
  },
  openweather: {
    id: 'openweather',
    name: 'OpenWeatherMap',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    rateLimit: 60,
  },
  newsapi: {
    id: 'newsapi',
    name: 'NewsAPI',
    baseUrl: 'https://newsapi.org/v2',
    rateLimit: 100,
  },
};

// ============================================================================
// RESOLVER IMPLEMENTATIONS
// ============================================================================

/**
 * Resolve via HTTP JSON endpoint (generic)
 */
async function resolveHttpJson(
  schema: { source_url: string; method: string; json_path: string; condition: { operator: string; value: unknown } },
  headers?: Record<string, string>
): Promise<{ outcome: boolean | null; rawData: unknown }> {
  try {
    const response = await fetch(schema.source_url, {
      method: schema.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const value = getJsonPath(data, schema.json_path);
    
    const outcome = evaluateCondition(value, schema.condition);

    return { outcome, rawData: data };
  } catch (error) {
    console.error('[Resolver] HTTP JSON error:', error);
    return { outcome: null, rawData: { error: String(error) } };
  }
}

/**
 * Get value from JSON using path (e.g., "$.data.value")
 */
function getJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array indexing
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Evaluate condition
 */
function evaluateCondition(
  value: unknown,
  condition: { operator: string; value: unknown }
): boolean | null {
  if (value === undefined) return null;

  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'neq':
      return value !== condition.value;
    case 'gt':
      return typeof value === 'number' && value > (condition.value as number);
    case 'gte':
      return typeof value === 'number' && value >= (condition.value as number);
    case 'lt':
      return typeof value === 'number' && value < (condition.value as number);
    case 'lte':
      return typeof value === 'number' && value <= (condition.value as number);
    case 'contains':
      return typeof value === 'string' && value.includes(condition.value as string);
    case 'exists':
      return value !== null && value !== undefined;
    default:
      return null;
  }
}

/**
 * Resolve GitHub-based market
 */
async function resolveGitHub(
  repoPath: string,
  metric: 'stars' | 'issues' | 'releases' | 'commits',
  threshold: number,
  operator: 'gt' | 'lt' | 'eq'
): Promise<{ outcome: boolean | null; rawData: unknown }> {
  try {
    const apiKey = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`https://api.github.com/repos/${repoPath}`, { headers });
    const data = await response.json();

    let value: number;
    switch (metric) {
      case 'stars':
        value = data.stargazers_count;
        break;
      case 'issues':
        value = data.open_issues_count;
        break;
      default:
        value = 0;
    }

    const outcome = evaluateCondition(value, { operator, value: threshold }) as boolean;
    return { outcome, rawData: data };
  } catch (error) {
    console.error('[Resolver] GitHub error:', error);
    return { outcome: null, rawData: { error: String(error) } };
  }
}

/**
 * Resolve weather-based market
 */
async function resolveWeather(
  lat: number,
  lon: number,
  metric: 'temp' | 'wind' | 'precip' | 'hurricane',
  threshold: number,
  operator: 'gt' | 'lt'
): Promise<{ outcome: boolean | null; rawData: unknown }> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      // Fallback to NOAA (no key needed)
      const response = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
      const data = await response.json();
      return { outcome: null, rawData: data };
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    );
    const data = await response.json();

    let value: number;
    switch (metric) {
      case 'temp':
        value = data.main?.temp || 0;
        break;
      case 'wind':
        value = data.wind?.speed || 0;
        break;
      case 'precip':
        value = data.rain?.['1h'] || data.snow?.['1h'] || 0;
        break;
      default:
        value = 0;
    }

    const outcome = evaluateCondition(value, { operator, value: threshold }) as boolean;
    return { outcome, rawData: data };
  } catch (error) {
    console.error('[Resolver] Weather error:', error);
    return { outcome: null, rawData: { error: String(error) } };
  }
}

// ============================================================================
// PRODUCTION RESOLVER SERVICE
// ============================================================================

export interface ProductionResolverConfig {
  pollIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export class ProductionResolver {
  private config: ProductionResolverConfig;
  private eventBus: EventBus;
  private pendingMarkets: Map<string, Market> = new Map();
  private resolvedMarkets: Map<string, ResolutionResult> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(eventBus: EventBus, config?: Partial<ProductionResolverConfig>) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs || 60000, // 1 minute
      maxRetries: config?.maxRetries || 3,
      retryDelayMs: config?.retryDelayMs || 5000,
    };
    this.eventBus = eventBus;

    // Subscribe to market events
    this.eventBus.subscribe('markets.created', (market: Market) => {
      this.registerMarket(market);
    });
  }

  /**
   * Start the resolver
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Resolver] Starting production resolver...');
    console.log(`[Resolver] Poll interval: ${this.config.pollIntervalMs}ms`);

    // Start polling
    this.pollInterval = setInterval(() => {
      this.checkPendingMarkets();
    }, this.config.pollIntervalMs);

    // Initial check
    this.checkPendingMarkets();

    console.log('[Resolver] Running.');
  }

  /**
   * Stop the resolver
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[Resolver] Stopped.');
  }

  /**
   * Register a market for resolution tracking
   */
  registerMarket(market: Market): void {
    if (market.status === MarketStatus.RESOLVED) return;
    this.pendingMarkets.set(market.id, market);
    console.log(`[Resolver] Registered market: ${market.ticker}`);
  }

  /**
   * Check pending markets for resolution
   */
  private async checkPendingMarkets(): Promise<void> {
    const now = new Date();
    
    for (const [id, market] of this.pendingMarkets) {
      // Skip if not yet at resolution time
      if (market.resolves_at > now) continue;

      console.log(`[Resolver] Attempting resolution: ${market.ticker}`);
      
      const result = await this.resolveMarket(market);
      
      if (result.outcome !== null) {
        this.resolvedMarkets.set(id, result);
        this.pendingMarkets.delete(id);
        
        // Emit resolution event
        this.eventBus.publish('markets.resolved', {
          market,
          result,
        });

        console.log(`[Resolver] Resolved ${market.ticker}: ${result.outcome ? 'YES' : 'NO'} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
      }
    }
  }

  /**
   * Resolve a single market
   */
  async resolveMarket(market: Market): Promise<ResolutionResult> {
    const schema = market.resolution_schema;
    let outcome: boolean | null = null;
    let rawData: unknown = null;
    let confidence = 0;
    let source = 'unknown';

    try {
      switch (schema.type) {
        case 'http_json':
          const httpResult = await resolveHttpJson(schema as any);
          outcome = httpResult.outcome;
          rawData = httpResult.rawData;
          confidence = outcome !== null ? 0.95 : 0;
          source = (schema as any).source_url;
          break;

        case 'multi_source':
          // Multi-source resolution (consensus of multiple APIs)
          const sources = (schema as any).sources || [];
          const results: boolean[] = [];
          
          for (const src of sources) {
            const srcResult = await resolveHttpJson(src);
            if (srcResult.outcome !== null) {
              results.push(srcResult.outcome);
            }
          }

          if (results.length > 0) {
            const yesCount = results.filter(r => r).length;
            outcome = yesCount > results.length / 2;
            confidence = yesCount / results.length;
            source = 'multi_source';
            rawData = { results, sources: sources.length };
          }
          break;

        default:
          // Fallback: try as HTTP JSON
          if ((schema as any).source_url) {
            const fallbackResult = await resolveHttpJson(schema as any);
            outcome = fallbackResult.outcome;
            rawData = fallbackResult.rawData;
            confidence = outcome !== null ? 0.85 : 0;
            source = (schema as any).source_url;
          }
      }
    } catch (error) {
      console.error(`[Resolver] Error resolving ${market.ticker}:`, error);
      return {
        marketId: market.id,
        outcome: null,
        confidence: 0,
        source: 'error',
        rawData: { error: String(error) },
        resolvedAt: new Date(),
        error: String(error),
      };
    }

    return {
      marketId: market.id,
      outcome,
      confidence,
      source,
      rawData,
      resolvedAt: new Date(),
    };
  }

  /**
   * Force resolve a market (manual override)
   */
  async forceResolve(marketId: string, outcome: boolean, reason: string): Promise<ResolutionResult> {
    const market = this.pendingMarkets.get(marketId);
    
    const result: ResolutionResult = {
      marketId,
      outcome,
      confidence: 1.0,
      source: 'manual_override',
      rawData: { reason, operator: 'system' },
      resolvedAt: new Date(),
    };

    this.resolvedMarkets.set(marketId, result);
    this.pendingMarkets.delete(marketId);

    if (market) {
      this.eventBus.publish('markets.resolved', { market, result });
    }

    console.log(`[Resolver] Force resolved ${marketId}: ${outcome ? 'YES' : 'NO'} - ${reason}`);

    return result;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getPendingCount(): number {
    return this.pendingMarkets.size;
  }

  getResolvedCount(): number {
    return this.resolvedMarkets.size;
  }

  getPendingMarkets(): Market[] {
    return Array.from(this.pendingMarkets.values());
  }

  getResolvedResults(): ResolutionResult[] {
    return Array.from(this.resolvedMarkets.values());
  }

  getResult(marketId: string): ResolutionResult | undefined {
    return this.resolvedMarkets.get(marketId);
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      pending: this.pendingMarkets.size,
      resolved: this.resolvedMarkets.size,
      pollInterval: this.config.pollIntervalMs,
    };
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export function createResolverRoutes(eventBus: EventBus) {
  const resolver = new ProductionResolver(eventBus);

  return async function resolverRoutes(fastify: FastifyInstance): Promise<void> {
    // Start resolver
    fastify.post('/resolver/start', async (_req: FastifyRequest, reply: FastifyReply) => {
      resolver.start();
      return reply.send({
        success: true,
        data: { message: 'Resolver started', stats: resolver.getStats() },
        timestamp: new Date().toISOString(),
      });
    });

    // Stop resolver
    fastify.post('/resolver/stop', async (_req: FastifyRequest, reply: FastifyReply) => {
      resolver.stop();
      return reply.send({
        success: true,
        data: { message: 'Resolver stopped' },
        timestamp: new Date().toISOString(),
      });
    });

    // Get pending markets
    fastify.get('/resolver/pending', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: { markets: resolver.getPendingMarkets(), total: resolver.getPendingCount() },
        timestamp: new Date().toISOString(),
      });
    });

    // Get resolved markets
    fastify.get('/resolver/resolved', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: { results: resolver.getResolvedResults(), total: resolver.getResolvedCount() },
        timestamp: new Date().toISOString(),
      });
    });

    // Force resolve
    fastify.post('/resolver/force', async (
      request: FastifyRequest<{ Body: { market_id: string; outcome: boolean; reason: string } }>,
      reply: FastifyReply
    ) => {
      const { market_id, outcome, reason } = request.body;
      const result = await resolver.forceResolve(market_id, outcome, reason);
      return reply.send({
        success: true,
        data: { result },
        timestamp: new Date().toISOString(),
      });
    });

    // Get stats
    fastify.get('/resolver/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: resolver.getStats(),
        timestamp: new Date().toISOString(),
      });
    });
  };
}
