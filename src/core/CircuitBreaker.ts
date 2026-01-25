/**
 * TRUTH-NET Circuit Breaker Pattern
 * 
 * Prevents cascade failures by "tripping" when error threshold is exceeded.
 * Provides automatic recovery with half-open state testing.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, fast-fail all requests
 * - HALF_OPEN: Testing recovery, allowing limited requests
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;      // Failures before opening
  successThreshold: number;      // Successes in half-open to close
  timeout: number;               // Ms before trying half-open
  volumeThreshold: number;       // Min requests before evaluating
  errorPercentThreshold: number; // Error % to trigger (0-100)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  name: 'default',
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  volumeThreshold: 10,
  errorPercentThreshold: 50,
};

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalRequests: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;
  private halfOpenSuccesses: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should allow the request
    if (!this.allowRequest()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker [${this.config.name}] is OPEN`,
        this.getStats()
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Execute with fallback on circuit open
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  allowRequest(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has passed
        if (this.openedAt && Date.now() - this.openedAt.getTime() >= this.config.timeout) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.successes++;
    this.totalRequests++;
    this.lastSuccess = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++;
    this.totalRequests++;
    this.lastFailure = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open goes back to open
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    if (this.state === CircuitState.CLOSED) {
      // Check if we should open
      if (this.shouldOpen()) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
    };
  }

  /**
   * Force state transition (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openedAt = null;
    this.state = CircuitState.CLOSED;
  }

  private shouldOpen(): boolean {
    // Need minimum volume
    if (this.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    // Check failure count
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check error percentage
    const errorPercent = (this.failures / this.totalRequests) * 100;
    return errorPercent >= this.config.errorPercentThreshold;
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.openedAt = new Date();
      this.halfOpenSuccesses = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
      this.totalRequests = 0;
      this.openedAt = null;
      this.halfOpenSuccesses = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses = 0;
    }

    console.log(`[CircuitBreaker:${this.config.name}] ${oldState} -> ${newState}`);
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  public readonly stats: CircuitBreakerStats;

  constructor(message: string, stats: CircuitBreakerStats) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.stats = stats;
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

/**
 * Manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker({ ...config, name });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  getAll(): Map<string, CircuitBreakerStats> {
    const result = new Map<string, CircuitBreakerStats>();
    for (const [name, breaker] of this.breakers) {
      result.set(name, breaker.getStats());
    }
    return result;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Singleton registry
export const circuitBreakers = new CircuitBreakerRegistry();

// ============================================================================
// WASH TRADING DETECTOR
// ============================================================================

export interface WashTradingConfig {
  windowMs: number;           // Time window to analyze
  selfTradeThreshold: number; // Max self-trades before flagging
  volumeRatioThreshold: number; // Suspicious if self-trade volume > X% of total
  cooldownMs: number;         // Pause duration when detected
}

interface TradeRecord {
  buyerId: string;
  sellerId: string;
  marketId: string;
  quantity: number;
  timestamp: number;
}

interface AgentStats {
  selfTrades: number;
  selfVolume: number;
  totalTrades: number;
  totalVolume: number;
  isPaused: boolean;
  pausedUntil: number | null;
  violations: number;
}

const DEFAULT_WASH_CONFIG: WashTradingConfig = {
  windowMs: 60000,           // 1 minute window
  selfTradeThreshold: 3,     // 3 self-trades triggers
  volumeRatioThreshold: 0.5, // 50% self-trade volume is suspicious
  cooldownMs: 300000,        // 5 minute pause
};

/**
 * Wash Trading Detector
 * Monitors and pauses agents that trade with themselves to inflate volume.
 */
export class WashTradingDetector {
  private config: WashTradingConfig;
  private trades: TradeRecord[] = [];
  private agentStats: Map<string, AgentStats> = new Map();
  private onViolation?: (agentId: string, stats: AgentStats) => void;

  constructor(config: Partial<WashTradingConfig> = {}, onViolation?: (agentId: string, stats: AgentStats) => void) {
    this.config = { ...DEFAULT_WASH_CONFIG, ...config };
    this.onViolation = onViolation;
  }

  /**
   * Record a trade and check for wash trading
   */
  recordTrade(buyerId: string, sellerId: string, marketId: string, quantity: number): {
    isSelfTrade: boolean;
    buyerPaused: boolean;
    sellerPaused: boolean;
  } {
    const now = Date.now();
    const isSelfTrade = buyerId === sellerId;

    // Add trade record
    this.trades.push({
      buyerId,
      sellerId,
      marketId,
      quantity,
      timestamp: now,
    });

    // Prune old trades
    this.trades = this.trades.filter(t => now - t.timestamp < this.config.windowMs);

    // Update buyer stats
    const buyerStats = this.getOrCreateStats(buyerId);
    buyerStats.totalTrades++;
    buyerStats.totalVolume += quantity;

    // Update seller stats (only if different from buyer)
    if (buyerId !== sellerId) {
      const sellerStats = this.getOrCreateStats(sellerId);
      sellerStats.totalTrades++;
      sellerStats.totalVolume += quantity;
    }

    // Check for self-trade
    if (isSelfTrade) {
      buyerStats.selfTrades++;
      buyerStats.selfVolume += quantity;

      console.log(`[WashDetector] Self-trade detected: Agent ${buyerId} traded with self, qty=${quantity}`);

      // Check if threshold exceeded
      if (this.shouldPause(buyerId)) {
        this.pauseAgent(buyerId);
      }
    }

    return {
      isSelfTrade,
      buyerPaused: this.isPaused(buyerId),
      sellerPaused: buyerId !== sellerId ? this.isPaused(sellerId) : false,
    };
  }

  /**
   * Check if an agent is paused
   */
  isPaused(agentId: string): boolean {
    const stats = this.agentStats.get(agentId);
    if (!stats || !stats.isPaused) return false;

    const now = Date.now();
    if (stats.pausedUntil && now >= stats.pausedUntil) {
      // Pause expired
      stats.isPaused = false;
      stats.pausedUntil = null;
      console.log(`[WashDetector] Agent ${agentId} pause expired, resuming.`);
      return false;
    }

    return true;
  }

  /**
   * Check if agent should be paused
   */
  private shouldPause(agentId: string): boolean {
    const stats = this.agentStats.get(agentId);
    if (!stats) return false;

    // Check self-trade count
    if (stats.selfTrades >= this.config.selfTradeThreshold) {
      return true;
    }

    // Check volume ratio
    if (stats.totalVolume > 0) {
      const ratio = stats.selfVolume / stats.totalVolume;
      if (ratio >= this.config.volumeRatioThreshold && stats.selfTrades >= 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Pause an agent
   */
  private pauseAgent(agentId: string): void {
    const stats = this.agentStats.get(agentId);
    if (!stats) return;

    const now = Date.now();
    stats.isPaused = true;
    stats.pausedUntil = now + this.config.cooldownMs;
    stats.violations++;

    console.log(`[WashDetector] ⚠️ Agent ${agentId} PAUSED for wash trading. Violations: ${stats.violations}. Resumes at: ${new Date(stats.pausedUntil).toISOString()}`);

    this.onViolation?.(agentId, stats);
  }

  /**
   * Manually unpause an agent (admin override)
   */
  unpauseAgent(agentId: string): void {
    const stats = this.agentStats.get(agentId);
    if (stats) {
      stats.isPaused = false;
      stats.pausedUntil = null;
      console.log(`[WashDetector] Agent ${agentId} manually unpaused.`);
    }
  }

  /**
   * Get agent stats
   */
  getAgentStats(agentId: string): AgentStats | undefined {
    return this.agentStats.get(agentId);
  }

  /**
   * Get all paused agents
   */
  getPausedAgents(): string[] {
    const paused: string[] = [];
    for (const [agentId, stats] of this.agentStats) {
      if (this.isPaused(agentId)) {
        paused.push(agentId);
      }
    }
    return paused;
  }

  /**
   * Get all stats
   */
  getAllStats(): Map<string, AgentStats> {
    return new Map(this.agentStats);
  }

  /**
   * Reset window for an agent
   */
  resetAgent(agentId: string): void {
    this.agentStats.delete(agentId);
    this.trades = this.trades.filter(t => t.buyerId !== agentId && t.sellerId !== agentId);
  }

  /**
   * Reset all
   */
  reset(): void {
    this.trades = [];
    this.agentStats.clear();
  }

  private getOrCreateStats(agentId: string): AgentStats {
    let stats = this.agentStats.get(agentId);
    if (!stats) {
      stats = {
        selfTrades: 0,
        selfVolume: 0,
        totalTrades: 0,
        totalVolume: 0,
        isPaused: false,
        pausedUntil: null,
        violations: 0,
      };
      this.agentStats.set(agentId, stats);
    }
    return stats;
  }
}

// Global wash trading detector instance
export const washTradingDetector = new WashTradingDetector();
