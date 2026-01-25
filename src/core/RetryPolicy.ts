/**
 * TRUTH-NET Retry Policy
 * 
 * Implements exponential backoff with jitter for robust retries.
 * Supports configurable retry conditions and max attempts.
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number; // 0-1, adds randomness to prevent thundering herd
  retryOn?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalTimeMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Execute function with retry policy
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (cfg.retryOn && !cfg.retryOn(error)) {
        throw error;
      }

      // Don't delay after last attempt
      if (attempt < cfg.maxAttempts) {
        const delay = calculateDelay(attempt, cfg);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Execute with detailed result
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;

      if (cfg.retryOn && !cfg.retryOn(error)) {
        break;
      }

      if (attempt < cfg.maxAttempts) {
        const delay = calculateDelay(attempt, cfg);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: cfg.maxAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter
  const jitter = delay * config.jitterFactor * (Math.random() * 2 - 1);
  delay = Math.max(0, delay + jitter);

  return Math.round(delay);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// COMMON RETRY CONDITIONS
// ============================================================================

export const retryConditions = {
  /**
   * Retry on network errors
   */
  networkError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const networkErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
      return networkErrors.some(e => error.message.includes(e));
    }
    return false;
  },

  /**
   * Retry on HTTP 5xx errors
   */
  serverError: (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status >= 500 && status < 600;
    }
    return false;
  },

  /**
   * Retry on rate limit (429)
   */
  rateLimited: (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 429;
    }
    return false;
  },

  /**
   * Always retry (except on fatal errors)
   */
  always: (_error: unknown): boolean => true,

  /**
   * Never retry
   */
  never: (_error: unknown): boolean => false,
};
