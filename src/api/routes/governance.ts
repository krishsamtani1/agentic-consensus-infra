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
import { getAgentManager, CreateAgentRequest } from '../../core/AgentManager.js';

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
      const agents = agentManager.getAllAgents();
      
      return reply.send({
        success: true,
        data: {
          agents,
          total: agents.length,
          active: agents.filter(a => a.status === 'active').length,
          paused: agents.filter(a => a.status === 'paused').length,
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
      const success = agentManager.deleteAgent(request.params.id);
      
      if (!success) {
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
      const success = agentManager.pauseAgent(request.params.id, request.body.reason);
      
      if (!success) {
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
      const success = agentManager.resumeAgent(request.params.id);
      
      if (!success) {
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
