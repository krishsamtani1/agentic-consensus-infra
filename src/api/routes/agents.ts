/**
 * TRUTH-NET Agent Routes
 * Manages AI agent registration, wallets, and reputation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { CreateAgentRequestSchema } from '../schemas/index.js';
import { Agent, AgentStatus, Wallet } from '../../types.js';
import { EscrowLedger } from '../../engine/escrow/EscrowLedger.js';

// In-memory store (production would use PostgreSQL)
const agents: Map<string, Agent> = new Map();
const apiKeyToAgentId: Map<string, string> = new Map();

export function createAgentRoutes(escrow: EscrowLedger) {
  return async function agentRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /v1/agents
     * Register a new AI agent
     */
    fastify.post('/agents', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = CreateAgentRequestSchema.safeParse(request.body);
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

      const { name, description, metadata } = parseResult.data;

      // Generate API key
      const apiKey = `tn_${crypto.randomBytes(32).toString('hex')}`;
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Create agent
      const agent: Agent = {
        id: uuidv4(),
        name,
        description,
        truth_score: 0.5,
        total_trades: 0,
        winning_trades: 0,
        total_staked: 0,
        total_pnl: 0,
        status: AgentStatus.ACTIVE,
        metadata: metadata ?? {},
        created_at: new Date(),
        updated_at: new Date(),
        last_active_at: new Date(),
      };

      // Create wallet
      const wallet = escrow.createWallet(agent.id, 0);

      // Store
      agents.set(agent.id, agent);
      apiKeyToAgentId.set(apiKeyHash, agent.id);

      return reply.status(201).send({
        success: true,
        data: {
          agent: formatAgent(agent),
          api_key: apiKey, // Only returned once!
          wallet: formatWallet(wallet),
        },
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/agents/:id
     * Get agent profile and reputation
     */
    fastify.get('/agents/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const agent = agents.get(id);

      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: formatAgent(agent),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * GET /v1/agents/:id/wallet
     * Get agent wallet balance
     */
    fastify.get('/agents/:id/wallet', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const agent = agents.get(id);

      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const wallet = escrow.getWallet(id);
      if (!wallet) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'WALLET_NOT_FOUND',
            message: `Wallet for agent ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: formatWallet(wallet),
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * POST /v1/agents/:id/deposit
     * Deposit funds to agent wallet
     */
    fastify.post('/agents/:id/deposit', async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { amount: number };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { amount } = request.body as { amount: number };

      if (!amount || amount <= 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be a positive number',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const agent = agents.get(id);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const tx = await escrow.deposit(id, amount);
        const wallet = escrow.getWallet(id)!;

        return reply.send({
          success: true,
          data: {
            transaction_id: tx.id,
            amount: tx.amount,
            balance: formatWallet(wallet),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'DEPOSIT_FAILED',
            message: String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    /**
     * POST /v1/agents/:id/withdraw
     * Withdraw funds from agent wallet
     */
    fastify.post('/agents/:id/withdraw', async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { amount: number };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { amount } = request.body as { amount: number };

      if (!amount || amount <= 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be a positive number',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const agent = agents.get(id);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const tx = await escrow.withdraw(id, amount);
        const wallet = escrow.getWallet(id)!;

        return reply.send({
          success: true,
          data: {
            transaction_id: tx.id,
            amount: Math.abs(tx.amount),
            balance: formatWallet(wallet),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WITHDRAWAL_FAILED',
            message: String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });
  };
}

// Helper functions
function formatAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? null,
    truth_score: agent.truth_score,
    total_trades: agent.total_trades,
    winning_trades: agent.winning_trades,
    win_rate: agent.total_trades > 0 ? agent.winning_trades / agent.total_trades : 0,
    total_staked: agent.total_staked,
    total_pnl: agent.total_pnl,
    status: agent.status,
    metadata: agent.metadata,
    created_at: agent.created_at.toISOString(),
    updated_at: agent.updated_at.toISOString(),
    last_active_at: agent.last_active_at.toISOString(),
  };
}

function formatWallet(wallet: Wallet) {
  return {
    id: wallet.id,
    agent_id: wallet.agent_id,
    currency: wallet.currency,
    available: wallet.available,
    locked: wallet.locked,
    total: wallet.available + wallet.locked,
    created_at: wallet.created_at.toISOString(),
    updated_at: wallet.updated_at.toISOString(),
  };
}

// Export for use in other modules
export { agents, apiKeyToAgentId };
