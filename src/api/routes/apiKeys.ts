/**
 * TRUTH-NET API Key Management Routes
 * 
 * Endpoints for developers to create, manage, and monitor their API keys.
 * Keys are tied to subscription tiers.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  generateApiKey, 
  revokeApiKey, 
  getUserApiKeys, 
  getApiKeyStats 
} from '../middleware/apiKeyAuth.js';

export function createApiKeyRoutes() {
  return async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {

    // -----------------------------------------------------------------------
    // POST /api-keys/create - Generate a new API key
    // -----------------------------------------------------------------------
    fastify.post('/api-keys/create', async (
      request: FastifyRequest<{ Body: { userId: string; name: string; tier?: string } }>,
      reply: FastifyReply
    ) => {
      const { userId, name, tier = 'free' } = request.body;

      if (!userId || !name) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'userId and name are required' },
          timestamp: new Date().toISOString(),
        });
      }

      const validTiers = ['free', 'developer', 'pro', 'enterprise'] as const;
      if (!validTiers.includes(tier as any)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_TIER', message: `Invalid tier. Choose: ${validTiers.join(', ')}` },
          timestamp: new Date().toISOString(),
        });
      }

      const result = generateApiKey(userId, name, tier as any);

      return reply.send({
        success: true,
        data: {
          key: result.key,          // Only shown once!
          id: result.apiKey.id,
          prefix: result.apiKey.prefix,
          tier: result.apiKey.tier,
          dailyLimit: result.apiKey.dailyLimit,
          scopes: result.apiKey.scopes,
          message: 'Store this key securely — it will not be shown again.',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /api-keys/:userId - List user's API keys
    // -----------------------------------------------------------------------
    fastify.get('/api-keys/:userId', async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const keys = getUserApiKeys(userId);

      return reply.send({
        success: true,
        data: { keys },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /api-keys/stats/:keyId - Get usage stats for a key
    // -----------------------------------------------------------------------
    fastify.get('/api-keys/stats/:keyId', async (
      request: FastifyRequest<{ Params: { keyId: string } }>,
      reply: FastifyReply
    ) => {
      const { keyId } = request.params;
      const stats = getApiKeyStats(keyId);

      if (!stats) {
        return reply.status(404).send({
          success: false,
          error: { code: 'KEY_NOT_FOUND', message: 'API key not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // DELETE /api-keys/:keyId - Revoke an API key
    // -----------------------------------------------------------------------
    fastify.delete('/api-keys/:keyId', async (
      request: FastifyRequest<{ Params: { keyId: string } }>,
      reply: FastifyReply
    ) => {
      const { keyId } = request.params;
      const revoked = revokeApiKey(keyId);

      if (!revoked) {
        return reply.status(404).send({
          success: false,
          error: { code: 'KEY_NOT_FOUND', message: 'API key not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: { message: 'API key revoked successfully' },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
