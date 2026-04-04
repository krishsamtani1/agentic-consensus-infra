/**
 * TRUTH-NET Governance API Routes
 * 
 * Exposes Doctrine Engine and Agent Manager functionality:
 * - Agent CRUD (Create, Read, Update, Delete)
 * - Doctrine configuration
 * - Control functions (pause, resume, kill switch)
 * - Force close positions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventBus } from '../../events/EventBus.js';
import { getDoctrineEngine, DoctrineConfig } from '../../core/DoctrineEngine.js';
import { getAgentManager, CreateAgentRequest, AgentConfig } from '../../core/AgentManager.js';
import { getRatingEngine } from '../../rating/RatingEngine.js';
import { getActiveTradingLoop } from '../../boot/PlatformSeeder.js';
import { authMiddleware } from './auth.js';

export function createGovernanceRoutes(eventBus: EventBus) {
  const doctrineEngine = getDoctrineEngine(eventBus);
  const agentManager = getAgentManager(eventBus);
  
  return async function governanceRoutes(fastify: FastifyInstance): Promise<void> {
    
    // =========================================================================
    // AGENT MANAGEMENT
    // =========================================================================
    
    /**
     * GET /v1/agents
     * List all agents
     */
    fastify.get('/agents', async (_request: FastifyRequest, reply: FastifyReply) => {
      const managedAgents = agentManager.getAllAgents();
      const managedIds = new Set(managedAgents.map(a => a.id));

      // Merge in seeded/platform agents from the rating engine
      const ratingEngine = getRatingEngine(eventBus);
      const tradingLoop = getActiveTradingLoop();
      const allRatings = ratingEngine.getFullLeaderboard(100);
      const platformAgents = allRatings
        .filter(r => !managedIds.has(r.agent_id))
        .map(r => {
          const loopStatus = tradingLoop?.getAgentStatus(r.agent_id);
          return {
            id: r.agent_id,
            name: r.agent_id,
            status: loopStatus === 'paused' ? 'paused' : 'active',
            truth_score: r.truth_score,
            grade: r.grade,
            brier_score: r.brier_score,
            total_trades: r.total_trades,
            total_pnl: r.total_pnl,
            created_at: new Date(),
            updated_at: new Date(),
          };
        });

      const agents = [...managedAgents, ...platformAgents];
      
      return reply.send({
        success: true,
        data: {
          agents,
          total: agents.length,
          active: agents.filter((a: any) => a.status === 'active').length,
          paused: agents.filter((a: any) => a.status === 'paused').length,
        },
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * GET /v1/agents/:id
     * Get agent by ID
     */
    fastify.get('/agents/:id', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const agent = agentManager.getAgent(request.params.id);
      
      if (agent) {
        return reply.send({
          success: true,
          data: agent,
          timestamp: new Date().toISOString(),
        });
      }

      // Fall back to rating engine data for seeded/platform agents
      const ratingEngine = getRatingEngine(eventBus);
      const rating = ratingEngine.getRating(request.params.id);
      if (rating) {
        const tradingLoop = getActiveTradingLoop();
        const loopStatus = tradingLoop?.getAgentStatus(request.params.id);
        return reply.send({
          success: true,
          data: {
            id: rating.agent_id,
            name: request.params.id,
            status: loopStatus === 'paused' ? 'paused' : 'active',
            truth_score: rating.truth_score,
            grade: rating.grade,
            brier_score: rating.brier_score,
            sharpe_ratio: rating.sharpe_ratio,
            win_rate: rating.win_rate,
            total_trades: rating.total_trades,
            winning_trades: rating.winning_trades,
            total_pnl: rating.total_pnl,
            max_drawdown: rating.max_drawdown,
            certified: rating.certified,
            created_at: rating.last_updated,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(404).send({
        success: false,
        error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
      });
    });
    
    /**
     * POST /v1/agents
     * Create new agent
     */
    fastify.post('/agents', async (
      request: FastifyRequest<{ Body: CreateAgentRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const agent = agentManager.createAgent(request.body);
        
        return reply.status(201).send({
          success: true,
          data: agent,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: error.message },
        });
      }
    });
    
    /**
     * PUT /v1/agents/:id
     * Update agent
     */
    fastify.put('/agents/:id', async (
      request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateAgentRequest> }>,
      reply: FastifyReply
    ) => {
      const agent = agentManager.updateAgent(request.params.id, request.body);
      
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        });
      }
      
      return reply.send({
        success: true,
        data: agent,
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * DELETE /v1/agents/:id
     * Delete agent
     */
    fastify.delete('/agents/:id', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const managedSuccess = agentManager.deleteAgent(request.params.id);

      const tradingLoop = getActiveTradingLoop();
      const loopSuccess = tradingLoop?.removeAgent(request.params.id) ?? false;

      if (!managedSuccess && !loopSuccess) {
        return reply.status(404).send({
          success: false,
          error: { code: 'DELETE_FAILED', message: 'Agent not found or cannot be deleted' },
        });
      }
      
      return reply.send({
        success: true,
        message: 'Agent deleted',
        timestamp: new Date().toISOString(),
      });
    });
    
    // =========================================================================
    // AGENT CONFIG
    // =========================================================================

    /**
     * PUT /v1/agents/:id/config
     * Update agent configuration (requires auth)
     */
    fastify.put<{ Params: { id: string }; Body: AgentConfig }>('/agents/:id/config', {
      preHandler: authMiddleware(),
    }, async (request, reply) => {
      const { id } = request.params;
      const config = request.body;

      const agent = agentManager.getAgent(id);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
          timestamp: new Date().toISOString(),
        });
      }

      // Apply config fields
      if (config.data_sources !== undefined) agent.config = { ...agent.config, data_sources: config.data_sources };
      if (config.methodology !== undefined) agent.config = { ...agent.config, methodology: config.methodology };
      if (config.risk_tolerance !== undefined) agent.config = { ...agent.config, risk_tolerance: config.risk_tolerance };
      if (config.max_position_pct !== undefined) {
        agent.trading_config.max_position_pct = config.max_position_pct;
        agent.config = { ...agent.config, max_position_pct: config.max_position_pct };
      }
      if (config.max_exposure_pct !== undefined) {
        agent.trading_config.max_exposure_pct = config.max_exposure_pct;
        agent.config = { ...agent.config, max_exposure_pct: config.max_exposure_pct };
      }
      if (config.allowed_topics !== undefined) {
        agent.trading_config.allowed_topics = config.allowed_topics;
        agent.config = { ...agent.config, allowed_topics: config.allowed_topics };
      }
      if (config.strategy_persona !== undefined) {
        agent.strategy_persona = config.strategy_persona;
        agent.config = { ...agent.config, strategy_persona: config.strategy_persona };
      }

      agent.updated_at = new Date();

      // Sync with doctrine engine
      const doctrineEngine = getDoctrineEngine(eventBus);
      doctrineEngine.setAgentDoctrine(id, {
        max_position_size_pct: agent.trading_config.max_position_pct,
        max_total_exposure_pct: agent.trading_config.max_exposure_pct,
        allowed_topics: agent.trading_config.allowed_topics,
      });

      return reply.send({
        success: true,
        data: { id: agent.id, name: agent.name, config: agent.config, trading_config: agent.trading_config },
        timestamp: new Date().toISOString(),
      });
    });

    // =========================================================================
    // AGENT CONTROL
    // =========================================================================
    
    /**
     * POST /v1/agents/:id/pause
     * Pause an agent
     */
    fastify.post('/agents/:id/pause', async (
      request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
      reply: FastifyReply
    ) => {
      const managedSuccess = agentManager.pauseAgent(request.params.id, request.body.reason);

      const tradingLoop = getActiveTradingLoop();
      const loopSuccess = tradingLoop?.pauseAgent(request.params.id) ?? false;

      if (!managedSuccess && !loopSuccess) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        });
      }
      
      return reply.send({
        success: true,
        message: 'Agent paused',
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * POST /v1/agents/:id/resume
     * Resume an agent
     */
    fastify.post('/agents/:id/resume', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const managedSuccess = agentManager.resumeAgent(request.params.id);

      const tradingLoop = getActiveTradingLoop();
      const loopSuccess = tradingLoop?.resumeAgent(request.params.id) ?? false;

      if (!managedSuccess && !loopSuccess) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        });
      }
      
      return reply.send({
        success: true,
        message: 'Agent resumed',
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * POST /v1/agents/:id/force-close
     * Force close an agent's position
     */
    fastify.post('/agents/:id/force-close', async (
      request: FastifyRequest<{ Params: { id: string }; Body: { market_id: string; reason?: string } }>,
      reply: FastifyReply
    ) => {
      const result = await doctrineEngine.forceClose(
        request.params.id,
        request.body.market_id,
        request.body.reason
      );
      
      return reply.send({
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    });
    
    // =========================================================================
    // DOCTRINE MANAGEMENT
    // =========================================================================
    
    /**
     * GET /v1/doctrine
     * Get governance summary
     */
    fastify.get('/doctrine', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: doctrineEngine.getGovernanceSummary(),
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * GET /v1/doctrine/:agentId
     * Get doctrine for specific agent
     */
    fastify.get('/doctrine/:agentId', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const doctrine = doctrineEngine.getAgentDoctrine(request.params.agentId);
      const state = doctrineEngine.getAgentState(request.params.agentId);
      
      return reply.send({
        success: true,
        data: { doctrine, state },
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * PUT /v1/doctrine/:agentId
     * Update doctrine for specific agent
     */
    fastify.put('/doctrine/:agentId', async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: Partial<DoctrineConfig> }>,
      reply: FastifyReply
    ) => {
      const doctrine = doctrineEngine.setAgentDoctrine(request.params.agentId, request.body);
      
      return reply.send({
        success: true,
        data: doctrine,
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * GET /v1/doctrine/violations
     * Get doctrine violations
     */
    fastify.get('/doctrine/violations', async (
      request: FastifyRequest<{ Querystring: { agent_id?: string; limit?: string } }>,
      reply: FastifyReply
    ) => {
      const violations = doctrineEngine.getViolations(
        request.query.agent_id,
        parseInt(request.query.limit || '50')
      );
      
      return reply.send({
        success: true,
        data: { violations, total: violations.length },
        timestamp: new Date().toISOString(),
      });
    });
    
    // =========================================================================
    // GLOBAL CONTROLS
    // =========================================================================
    
    /**
     * POST /v1/doctrine/kill-switch
     * Activate/deactivate global kill switch
     */
    fastify.post('/doctrine/kill-switch', async (
      request: FastifyRequest<{ Body: { activate: boolean; reason?: string } }>,
      reply: FastifyReply
    ) => {
      doctrineEngine.globalKillSwitch(request.body.activate, request.body.reason);
      
      return reply.send({
        success: true,
        message: request.body.activate ? 'Global kill switch activated' : 'Global kill switch deactivated',
        is_paused: doctrineEngine.isGloballyPaused(),
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * GET /v1/doctrine/kill-switch
     * Get global kill switch status
     */
    fastify.get('/doctrine/kill-switch', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: { is_paused: doctrineEngine.isGloballyPaused() },
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * POST /v1/doctrine/mandate
     * Submit a natural language mandate for LLM processing
     */
    fastify.post('/doctrine/mandate', async (
      request: FastifyRequest<{ Body: { mandate: string; weights?: { tag: string; weight: number }[] } }>,
      reply: FastifyReply
    ) => {
      const { mandate, weights } = request.body;
      
      // Store mandate for logging
      const mandateRecord = {
        id: `mandate-${Date.now()}`,
        mandate,
        weights: weights || [],
        applied_at: new Date().toISOString(),
        affected_agents: agentManager.getAllAgents().map(a => a.id),
      };
      
      // Apply weights to doctrine engine (simplified - in production, use LLM)
      if (weights && weights.length > 0) {
        for (const w of weights) {
          // Update doctrine for agents matching the tag
          const agents = agentManager.getAllAgents();
          for (const agent of agents) {
            const currentDoctrine = doctrineEngine.getAgentDoctrine(agent.id);
            if (currentDoctrine) {
              // Adjust leverage based on weight
              doctrineEngine.setAgentDoctrine(agent.id, {
                ...currentDoctrine,
                max_position_size_pct: Math.min(50, (currentDoctrine.max_position_size_pct || 15) * w.weight),
              });
            }
          }
        }
      }
      
      eventBus.publish('doctrine.mandate.applied', mandateRecord);
      
      return reply.send({
        success: true,
        data: mandateRecord,
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * POST /v1/doctrine/escalation/:id/approve
     * Approve an escalation
     */
    fastify.post('/doctrine/escalation/:id/approve', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      eventBus.publish('escalation.approved', { id: request.params.id });
      return reply.send({
        success: true,
        message: 'Escalation approved',
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * POST /v1/doctrine/escalation/:id/veto
     * Veto an escalation
     */
    fastify.post('/doctrine/escalation/:id/veto', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      eventBus.publish('escalation.vetoed', { id: request.params.id });
      return reply.send({
        success: true,
        message: 'Escalation vetoed',
        timestamp: new Date().toISOString(),
      });
    });
    
    // =========================================================================
    // A2A DISCOVERY
    // =========================================================================
    
    /**
     * GET /v1/agents/:id/agent.json
     * A2A discovery endpoint for specific agent
     */
    fastify.get('/agents/:id/agent.json', async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const agentJson = agentManager.generateAgentJson(request.params.id);
      
      if (!agentJson) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        });
      }
      
      reply.header('Content-Type', 'application/json');
      return reply.send(agentJson);
    });
  };
}
