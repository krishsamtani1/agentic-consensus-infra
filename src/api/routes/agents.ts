/**
 * TRUTH-NET Agent Wallet Routes
 * Handles wallet operations (deposit, withdraw, balance)
 * 
 * NOTE: Agent CRUD operations moved to governance.ts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Wallet } from '../../types.js';
import { EscrowLedger } from '../../engine/escrow/EscrowLedger.js';

export function createAgentRoutes(escrow: EscrowLedger) {
  return async function agentRoutes(fastify: FastifyInstance): Promise<void> {
    
    /**
     * GET /v1/agents/:id/wallet
     * Get agent wallet balance
     */
    fastify.get('/agents/:id/wallet', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const wallet = escrow.getWallet(id);
      if (!wallet) {
        // Create wallet if it doesn't exist
        const newWallet = escrow.createWallet(id, 0);
        return reply.send({
          success: true,
          data: formatWallet(newWallet),
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

      try {
        // Ensure wallet exists
        if (!escrow.getWallet(id)) {
          escrow.createWallet(id, 0);
        }
        
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

      try {
        const tx = await escrow.withdraw(id, amount);
        const updatedWallet = escrow.getWallet(id)!;

        return reply.send({
          success: true,
          data: {
            transaction_id: tx.id,
            amount: Math.abs(tx.amount),
            balance: formatWallet(updatedWallet),
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

// Helper function
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
