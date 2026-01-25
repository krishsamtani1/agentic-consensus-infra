/**
 * TRUTH-NET Oracle Engine
 * Pillar A: Machine-Verifiable Oracle Protocol
 *
 * Responsibilities:
 * - Validate resolution schemas at market creation
 * - Poll external APIs at expiry
 * - Evaluate conditions and determine outcomes
 * - Trigger settlement process
 */

import { JSONPath } from 'jsonpath-plus';
import {
  Market,
  MarketStatus,
  OutcomeToken,
  ResolutionSchema,
  HttpJsonResolutionSchema,
  ConditionOperator,
  OracleResolutionResult,
} from '../types.js';
import { EventBus } from '../events/EventBus.js';

export interface OracleEngineConfig {
  defaultTimeout: number;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: OracleEngineConfig = {
  defaultTimeout: 10000,
  maxRetries: 3,
  retryDelayMs: 2000,
};

/**
 * Oracle Engine - resolves markets using external data sources
 */
export class OracleEngine {
  private config: OracleEngineConfig;
  private eventBus: EventBus;
  private pendingResolutions: Map<string, NodeJS.Timeout> = new Map();

  constructor(eventBus: EventBus, config: Partial<OracleEngineConfig> = {}) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Schema Validation
  // -------------------------------------------------------------------------

  /**
   * Validate a resolution schema before market creation
   * Optionally test the API endpoint
   */
  async validateSchema(
    schema: ResolutionSchema,
    testConnection: boolean = false
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Validate required fields
      if (!schema.type) {
        return { valid: false, error: 'Missing schema type' };
      }

      if (schema.type === 'http_json') {
        return this.validateHttpJsonSchema(schema as HttpJsonResolutionSchema, testConnection);
      }

      if (schema.type === 'graphql') {
        return { valid: false, error: 'GraphQL schemas not yet implemented' };
      }

      return { valid: false, error: `Unknown schema type: ${schema.type}` };
    } catch (error) {
      return { valid: false, error: `Schema validation error: ${error}` };
    }
  }

  /**
   * Validate HTTP JSON resolution schema
   */
  private async validateHttpJsonSchema(
    schema: HttpJsonResolutionSchema,
    testConnection: boolean
  ): Promise<{ valid: boolean; error?: string }> {
    // Validate URL
    try {
      new URL(schema.source_url);
    } catch {
      return { valid: false, error: 'Invalid source_url' };
    }

    // Validate method
    if (!['GET', 'POST'].includes(schema.method)) {
      return { valid: false, error: 'Method must be GET or POST' };
    }

    // Validate json_path
    if (!schema.json_path || !schema.json_path.startsWith('$')) {
      return { valid: false, error: 'Invalid json_path - must start with $' };
    }

    // Validate condition
    if (!schema.condition || !schema.condition.operator) {
      return { valid: false, error: 'Missing resolution condition' };
    }

    const validOperators: ConditionOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists'];
    if (!validOperators.includes(schema.condition.operator)) {
      return { valid: false, error: `Invalid condition operator: ${schema.condition.operator}` };
    }

    // Test connection if requested
    if (testConnection) {
      try {
        const result = await this.fetchData(schema);
        if (result.error) {
          return { valid: false, error: `Connection test failed: ${result.error}` };
        }
      } catch (error) {
        return { valid: false, error: `Connection test failed: ${error}` };
      }
    }

    return { valid: true };
  }

  // -------------------------------------------------------------------------
  // Resolution Scheduling
  // -------------------------------------------------------------------------

  /**
   * Schedule a market for resolution at its expiry time
   */
  scheduleResolution(market: Market): void {
    const now = Date.now();
    const resolveTime = new Date(market.resolves_at).getTime();
    const delay = Math.max(0, resolveTime - now);

    // Clear any existing schedule
    this.cancelScheduledResolution(market.id);

    // Schedule new resolution
    const timeout = setTimeout(async () => {
      await this.resolveMarket(market);
    }, delay);

    this.pendingResolutions.set(market.id, timeout);

    console.log(`Scheduled resolution for market ${market.ticker} in ${delay}ms`);
  }

  /**
   * Cancel a scheduled resolution
   */
  cancelScheduledResolution(marketId: string): void {
    const timeout = this.pendingResolutions.get(marketId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingResolutions.delete(marketId);
    }
  }

  // -------------------------------------------------------------------------
  // Market Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve a market by fetching data and evaluating the condition
   */
  async resolveMarket(market: Market): Promise<OracleResolutionResult> {
    console.log(`Resolving market ${market.ticker}...`);

    // Emit resolving event
    await this.eventBus.publish('markets.resolving', { market_id: market.id });

    let lastError: string | undefined;
    let attempts = 0;

    // Retry loop
    while (attempts < this.config.maxRetries) {
      attempts++;

      try {
        const result = await this.executeResolution(market.resolution_schema);

        if (result.success && result.outcome !== undefined) {
          // Emit success event
          await this.eventBus.publish('markets.resolved', {
            market_id: market.id,
            outcome: result.outcome,
            raw_data: result.raw_data,
            evaluated_value: result.evaluated_value,
          });

          return result;
        }

        lastError = result.error ?? 'Unknown resolution error';
      } catch (error) {
        lastError = `Exception: ${error}`;
      }

      // Wait before retry
      if (attempts < this.config.maxRetries) {
        await this.delay(this.config.retryDelayMs);
      }
    }

    // All retries failed
    const failureResult: OracleResolutionResult = {
      success: false,
      error: `Resolution failed after ${attempts} attempts: ${lastError}`,
    };

    await this.eventBus.publish('markets.resolution_failed', {
      market_id: market.id,
      error: failureResult.error,
    });

    return failureResult;
  }

  /**
   * Execute resolution for a schema
   */
  private async executeResolution(schema: ResolutionSchema): Promise<OracleResolutionResult> {
    if (schema.type === 'http_json') {
      return this.resolveHttpJson(schema as HttpJsonResolutionSchema);
    }

    return { success: false, error: `Unsupported schema type: ${schema.type}` };
  }

  /**
   * Resolve using HTTP JSON schema
   */
  private async resolveHttpJson(schema: HttpJsonResolutionSchema): Promise<OracleResolutionResult> {
    // Fetch data
    const fetchResult = await this.fetchData(schema);
    if (fetchResult.error) {
      return { success: false, error: fetchResult.error };
    }

    const rawData = fetchResult.data;

    // Extract value using JSONPath
    let extractedValue: unknown;
    try {
      const result = JSONPath({ path: schema.json_path, json: rawData });
      extractedValue = result.length > 0 ? result[0] : undefined;

      if (extractedValue === undefined) {
        return { success: false, error: `JSONPath ${schema.json_path} returned no results` };
      }
    } catch (error) {
      return { success: false, error: `JSONPath evaluation error: ${error}` };
    }

    // Evaluate condition
    const conditionResult = this.evaluateCondition(
      extractedValue,
      schema.condition.operator,
      schema.condition.value
    );

    return {
      success: true,
      outcome: conditionResult ? OutcomeToken.YES : OutcomeToken.NO,
      raw_data: rawData,
      evaluated_value: extractedValue,
    };
  }

  // -------------------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------------------

  /**
   * Fetch data from HTTP endpoint
   */
  private async fetchData(schema: HttpJsonResolutionSchema): Promise<{ data?: unknown; error?: string }> {
    const timeout = schema.timeout_ms ?? this.config.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'TRUTH-NET/1.0',
        ...(schema.headers ?? {}),
      };

      // Replace environment variables in headers
      for (const [key, value] of Object.entries(headers)) {
        if (value.includes('${ENV.')) {
          headers[key] = this.resolveEnvVars(value);
        }
      }

      const response = await fetch(schema.source_url, {
        method: schema.method,
        headers,
        body: schema.body ? JSON.stringify(schema.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return { error: `Request timeout after ${timeout}ms` };
      }

      return { error: `Fetch error: ${error}` };
    }
  }

  /**
   * Resolve environment variables in string
   */
  private resolveEnvVars(str: string): string {
    return str.replace(/\$\{ENV\.([^}]+)\}/g, (_, varName) => {
      return process.env[varName] ?? '';
    });
  }

  // -------------------------------------------------------------------------
  // Condition Evaluation
  // -------------------------------------------------------------------------

  /**
   * Evaluate a condition against extracted data
   */
  private evaluateCondition(
    actual: unknown,
    operator: ConditionOperator,
    expected: string | number | boolean
  ): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected || String(actual) === String(expected);

      case 'neq':
        return actual !== expected && String(actual) !== String(expected);

      case 'gt':
        return Number(actual) > Number(expected);

      case 'gte':
        return Number(actual) >= Number(expected);

      case 'lt':
        return Number(actual) < Number(expected);

      case 'lte':
        return Number(actual) <= Number(expected);

      case 'contains':
        return String(actual).includes(String(expected));

      case 'exists':
        return actual !== undefined && actual !== null;

      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pending resolution count
   */
  getPendingCount(): number {
    return this.pendingResolutions.size;
  }

  /**
   * Clear all pending resolutions
   */
  clearAll(): void {
    for (const timeout of this.pendingResolutions.values()) {
      clearTimeout(timeout);
    }
    this.pendingResolutions.clear();
  }
}
