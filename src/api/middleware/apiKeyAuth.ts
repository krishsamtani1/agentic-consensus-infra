/**
 * TRUTH-NET API Key Authentication & Rate Limiting Middleware
 * 
 * Manages API keys for programmatic access to rating data.
 * Enforces tier-based rate limits and feature access.
 * 
 * Tiers:
 *   free       → 100 calls/day, public leaderboard only
 *   developer  → 1,000 calls/day, full ratings API
 *   pro        → 10,000 calls/day, advanced analytics + webhooks
 *   enterprise → 100,000 calls/day, white-label + custom benchmarks
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiKey {
  id: string;
  key: string;           // hashed
  prefix: string;        // first 8 chars for display: "tn_live_abc..."
  userId: string;
  name: string;
  tier: 'free' | 'developer' | 'pro' | 'enterprise';
  
  // Rate limiting
  dailyLimit: number;
  callsToday: number;
  lastResetDate: string; // YYYY-MM-DD
  
  // Permissions
  scopes: string[];
  
  // Status
  active: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

export interface ApiKeyUsage {
  apiKeyId: string;
  endpoint: string;
  timestamp: Date;
  responseTime: number;
  statusCode: number;
}

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

const TIER_CONFIG = {
  free: {
    dailyLimit: 100,
    scopes: ['leaderboard:read', 'ratings:basic'],
    ratePerMinute: 10,
  },
  developer: {
    dailyLimit: 1000,
    scopes: ['leaderboard:read', 'ratings:read', 'ratings:history', 'agents:read'],
    ratePerMinute: 60,
  },
  pro: {
    dailyLimit: 10000,
    scopes: ['leaderboard:read', 'ratings:read', 'ratings:history', 'ratings:compare', 'agents:read', 'agents:certify', 'analytics:read', 'webhooks:manage'],
    ratePerMinute: 200,
  },
  enterprise: {
    dailyLimit: 100000,
    scopes: ['*'], // All access
    ratePerMinute: 1000,
  },
} as const;

// ============================================================================
// API KEY STORE (In-memory; production: PostgreSQL)
// ============================================================================

const apiKeys = new Map<string, ApiKey>();       // key hash → ApiKey
const keysByUser = new Map<string, string[]>();   // userId → key hashes
const usageLogs: ApiKeyUsage[] = [];

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

export function generateApiKey(
  userId: string,
  name: string,
  tier: 'free' | 'developer' | 'pro' | 'enterprise'
): { key: string; apiKey: ApiKey } {
  const rawKey = `tn_live_${uuidv4().replace(/-/g, '')}`;
  const keyHash = hashKey(rawKey);
  const config = TIER_CONFIG[tier];

  const apiKey: ApiKey = {
    id: uuidv4(),
    key: keyHash,
    prefix: rawKey.slice(0, 16) + '...',
    userId,
    name,
    tier,
    dailyLimit: config.dailyLimit,
    callsToday: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    scopes: [...config.scopes],
    active: true,
    createdAt: new Date(),
  };

  apiKeys.set(keyHash, apiKey);
  
  const userKeys = keysByUser.get(userId) || [];
  userKeys.push(keyHash);
  keysByUser.set(userId, userKeys);

  return { key: rawKey, apiKey };
}

export function revokeApiKey(keyId: string): boolean {
  for (const [hash, apiKey] of apiKeys.entries()) {
    if (apiKey.id === keyId) {
      apiKey.active = false;
      return true;
    }
  }
  return false;
}

export function getUserApiKeys(userId: string): Omit<ApiKey, 'key'>[] {
  const hashes = keysByUser.get(userId) || [];
  return hashes
    .map(h => apiKeys.get(h))
    .filter((k): k is ApiKey => k !== undefined)
    .map(({ key, ...rest }) => rest); // Don't expose hash
}

export function getApiKeyStats(keyId: string): { calls_today: number; calls_this_month: number; tier: string } | null {
  for (const apiKey of apiKeys.values()) {
    if (apiKey.id === keyId) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthCalls = usageLogs.filter(
        u => u.apiKeyId === keyId && u.timestamp >= monthStart
      ).length;
      
      return {
        calls_today: apiKey.callsToday,
        calls_this_month: monthCalls,
        tier: apiKey.tier,
      };
    }
  }
  return null;
}

// ============================================================================
// FASTIFY MIDDLEWARE
// ============================================================================

/**
 * Middleware that validates API key and enforces rate limits.
 * Attaches apiKey info to request for downstream use.
 */
export async function apiKeyAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers['authorization'];
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
  
  const rawKey = apiKeyHeader || (authHeader?.startsWith('Bearer tn_') ? authHeader.slice(7) : null);
  
  if (!rawKey) {
    // No API key — allow through as unauthenticated (free tier endpoints)
    (request as any).apiTier = 'free';
    (request as any).apiScopes = TIER_CONFIG.free.scopes;
    return;
  }

  const keyHash = hashKey(rawKey);
  const apiKey = apiKeys.get(keyHash);

  if (!apiKey || !apiKey.active) {
    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid or revoked API key' },
      timestamp: new Date().toISOString(),
    });
  }

  // Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return reply.status(401).send({
      success: false,
      error: { code: 'EXPIRED_API_KEY', message: 'API key has expired' },
      timestamp: new Date().toISOString(),
    });
  }

  // Reset daily counter if new day
  const today = new Date().toISOString().split('T')[0];
  if (apiKey.lastResetDate !== today) {
    apiKey.callsToday = 0;
    apiKey.lastResetDate = today;
  }

  // Check daily limit
  if (apiKey.callsToday >= apiKey.dailyLimit) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'DAILY_LIMIT_EXCEEDED',
        message: `Daily limit of ${apiKey.dailyLimit} API calls exceeded. Upgrade your plan for higher limits.`,
        limit: apiKey.dailyLimit,
        reset: 'midnight UTC',
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Increment counter
  apiKey.callsToday++;
  apiKey.lastUsedAt = new Date();

  // Log usage
  usageLogs.push({
    apiKeyId: apiKey.id,
    endpoint: request.url,
    timestamp: new Date(),
    responseTime: 0, // Will be updated in onResponse hook
    statusCode: 200,
  });

  // Keep only last 10K logs in memory
  if (usageLogs.length > 10000) {
    usageLogs.splice(0, usageLogs.length - 10000);
  }

  // Attach to request
  (request as any).apiKey = apiKey;
  (request as any).apiTier = apiKey.tier;
  (request as any).apiScopes = apiKey.scopes;
  (request as any).apiUserId = apiKey.userId;
}

/**
 * Check if request has required scope
 */
export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const scopes: string[] = (request as any).apiScopes || [];
    
    if (scopes.includes('*') || scopes.includes(scope)) {
      return; // Allowed
    }
    
    return reply.status(403).send({
      success: false,
      error: {
        code: 'INSUFFICIENT_SCOPE',
        message: `This endpoint requires the '${scope}' scope. Upgrade your plan for access.`,
      },
      timestamp: new Date().toISOString(),
    });
  };
}
