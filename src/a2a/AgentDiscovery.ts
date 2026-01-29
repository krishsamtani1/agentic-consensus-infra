/**
 * TRUTH-NET A2A Discovery Service
 * 
 * Implements the 2026 Agent-to-Agent (A2A) Standard:
 * - /.well-known/agent.json discovery endpoint
 * - Agent Cards for all system traders
 * - JSON-RPC 2.0 message handling
 * - SSE for real-time position streaming
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// A2A PROTOCOL TYPES (2026 Standard)
// ============================================================================

export interface AgentCard {
  // Core Identity
  id: string;
  name: string;
  version: string;
  description: string;
  
  // Capabilities
  capabilities: AgentCapability[];
  
  // Endpoints
  endpoints: {
    rpc: string;           // JSON-RPC 2.0 endpoint
    stream: string;        // SSE endpoint for real-time updates
    health: string;        // Health check
  };
  
  // Metadata
  metadata: {
    provider: string;
    model?: string;
    created_at: string;
    updated_at: string;
    truth_score?: number;
    total_trades?: number;
    specializations?: string[];
  };
  
  // Authentication
  authentication: {
    type: 'bearer' | 'api_key' | 'none';
    required: boolean;
  };
}

export interface AgentCapability {
  name: string;
  description: string;
  input_schema?: object;
  output_schema?: object;
}

export interface A2AMessage {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface A2AResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// SYSTEM AGENT REGISTRY
// ============================================================================

const SYSTEM_AGENTS: Map<string, AgentCard> = new Map();

// Pre-populate system agents
const DEFAULT_SYSTEM_AGENTS: Partial<AgentCard>[] = [
  {
    id: 'truth-net-oracle',
    name: 'TRUTH-NET Oracle',
    description: 'Primary oracle resolver for market outcomes. Uses multi-source verification.',
    capabilities: [
      { name: 'resolve_market', description: 'Resolve a market to YES/NO based on oracle data' },
      { name: 'fetch_oracle_sources', description: 'Get available oracle sources for a market' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      specializations: ['oracle', 'verification', 'resolution'],
    },
  },
  {
    id: 'market-maker-prime',
    name: 'Market Maker Prime',
    description: 'High-frequency market maker providing liquidity across all markets.',
    capabilities: [
      { name: 'provide_liquidity', description: 'Place bid/ask orders to provide market liquidity' },
      { name: 'quote_price', description: 'Get a quote for a specific market and size' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      model: 'quant-v3',
      specializations: ['market-making', 'liquidity', 'high-frequency'],
    },
  },
  {
    id: 'logistics-sentinel',
    name: 'Logistics Sentinel',
    description: 'Specialized in supply chain and shipping market predictions.',
    capabilities: [
      { name: 'analyze_shipping', description: 'Analyze shipping route disruptions' },
      { name: 'predict_delay', description: 'Predict logistics delay probability' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      model: 'logistics-bert',
      specializations: ['logistics', 'shipping', 'supply-chain'],
    },
  },
  {
    id: 'geopolitical-analyst',
    name: 'Geopolitical Analyst',
    description: 'Tracks political events and their market implications.',
    capabilities: [
      { name: 'analyze_event', description: 'Analyze geopolitical event impact' },
      { name: 'sentiment_scan', description: 'Scan news sentiment for political topics' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      model: 'gpt-4-turbo',
      specializations: ['geopolitics', 'elections', 'policy'],
    },
  },
  {
    id: 'tech-oracle',
    name: 'Tech Oracle',
    description: 'Specialized in technology sector predictions and AI developments.',
    capabilities: [
      { name: 'track_releases', description: 'Track product releases and earnings' },
      { name: 'github_monitor', description: 'Monitor GitHub repositories for signals' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      model: 'claude-3-opus',
      specializations: ['technology', 'AI', 'earnings'],
    },
  },
  {
    id: 'weather-quant',
    name: 'Weather Quant',
    description: 'Weather and climate event prediction specialist.',
    capabilities: [
      { name: 'forecast_impact', description: 'Forecast weather event market impact' },
      { name: 'noaa_integration', description: 'Direct NOAA data integration' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      specializations: ['weather', 'climate', 'natural-disasters'],
    },
  },
  {
    id: 'meme-alpha',
    name: 'Meme Alpha',
    description: 'Viral internet trend and social sentiment specialist.',
    capabilities: [
      { name: 'trend_detect', description: 'Detect viral trends before mainstream' },
      { name: 'sentiment_score', description: 'Calculate social sentiment score' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      model: 'social-bert',
      specializations: ['memes', 'viral', 'social-media'],
    },
  },
  {
    id: 'risk-guardian',
    name: 'Risk Guardian',
    description: 'Portfolio risk management and liquidation protection.',
    capabilities: [
      { name: 'calculate_var', description: 'Calculate Value at Risk' },
      { name: 'hedge_recommend', description: 'Recommend hedging positions' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      specializations: ['risk', 'hedging', 'portfolio'],
    },
  },
  {
    id: 'arbitrage-bot',
    name: 'Arbitrage Bot',
    description: 'Cross-market arbitrage and price discrepancy detection.',
    capabilities: [
      { name: 'scan_arb', description: 'Scan for arbitrage opportunities' },
      { name: 'execute_arb', description: 'Execute arbitrage trade' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      model: 'arb-v2',
      specializations: ['arbitrage', 'cross-market', 'efficiency'],
    },
  },
  {
    id: 'contrarian-alpha',
    name: 'Contrarian Alpha',
    description: 'Contrarian strategy specialist. Bets against consensus.',
    capabilities: [
      { name: 'consensus_deviation', description: 'Find consensus deviation opportunities' },
      { name: 'fade_hype', description: 'Identify overheated markets to fade' },
    ],
    metadata: {
      provider: 'TRUTH-NET',
      specializations: ['contrarian', 'mean-reversion', 'skeptic'],
    },
  },
];

// Initialize system agents
function initializeSystemAgents(): void {
  const now = new Date().toISOString();
  
  for (const partial of DEFAULT_SYSTEM_AGENTS) {
    const agent: AgentCard = {
      id: partial.id!,
      name: partial.name!,
      version: '1.0.0',
      description: partial.description!,
      capabilities: partial.capabilities || [],
      endpoints: {
        rpc: `/v1/a2a/agents/${partial.id}/rpc`,
        stream: `/v1/a2a/agents/${partial.id}/stream`,
        health: `/v1/a2a/agents/${partial.id}/health`,
      },
      metadata: {
        provider: partial.metadata?.provider || 'TRUTH-NET',
        model: partial.metadata?.model,
        created_at: now,
        updated_at: now,
        truth_score: 0.5 + Math.random() * 0.4, // 0.5 - 0.9
        total_trades: Math.floor(Math.random() * 10000),
        specializations: partial.metadata?.specializations,
      },
      authentication: {
        type: 'bearer',
        required: false, // For demo, auth not required
      },
    };
    
    SYSTEM_AGENTS.set(agent.id, agent);
  }
  
  console.log(`[A2A] Initialized ${SYSTEM_AGENTS.size} system agents`);
}

// Initialize on module load
initializeSystemAgents();

// ============================================================================
// A2A DISCOVERY SERVICE
// ============================================================================

export class A2ADiscoveryService {
  constructor(private eventBus: EventBus) {}
  
  /**
   * Get the master agent.json for TRUTH-NET
   */
  getMasterAgentJson(): object {
    return {
      name: 'TRUTH-NET Clearinghouse',
      version: '1.2.0',
      description: 'High-frequency prediction market clearinghouse for the 2026 Agentic Economy. Trade ground truth with autonomous AI agents.',
      
      // Discovery
      agents: Array.from(SYSTEM_AGENTS.values()).map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        url: `/v1/a2a/agents/${a.id}`,
      })),
      
      // Platform capabilities
      capabilities: [
        'prediction_markets',
        'binary_outcomes',
        'real_time_odds',
        'margin_trading',
        'auto_liquidation',
        'oracle_resolution',
        'agent_reputation',
      ],
      
      // Endpoints
      endpoints: {
        agents: '/v1/a2a/agents',
        markets: '/v1/markets',
        orders: '/v1/orders',
        stream: '/v1/a2a/stream',
        mcp: '/v1/mcp',
      },
      
      // Protocol support
      protocols: {
        a2a: '1.0',
        mcp: '1.0',
        jsonrpc: '2.0',
      },
      
      // Metadata
      metadata: {
        provider: 'TRUTH-NET',
        environment: process.env.NODE_ENV || 'development',
        region: 'global',
        updated_at: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Get all agent cards
   */
  getAllAgents(): AgentCard[] {
    return Array.from(SYSTEM_AGENTS.values());
  }
  
  /**
   * Get a specific agent card
   */
  getAgent(agentId: string): AgentCard | undefined {
    return SYSTEM_AGENTS.get(agentId);
  }
  
  /**
   * Register an external agent
   */
  registerAgent(card: Partial<AgentCard>): AgentCard {
    const id = card.id || `ext-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    
    const agent: AgentCard = {
      id,
      name: card.name || `Agent ${id}`,
      version: card.version || '1.0.0',
      description: card.description || 'External agent',
      capabilities: card.capabilities || [],
      endpoints: card.endpoints || {
        rpc: `/v1/a2a/agents/${id}/rpc`,
        stream: `/v1/a2a/agents/${id}/stream`,
        health: `/v1/a2a/agents/${id}/health`,
      },
      metadata: {
        provider: card.metadata?.provider || 'external',
        model: card.metadata?.model,
        created_at: now,
        updated_at: now,
        truth_score: 0.5,
        total_trades: 0,
        specializations: card.metadata?.specializations,
      },
      authentication: card.authentication || {
        type: 'bearer',
        required: true,
      },
    };
    
    SYSTEM_AGENTS.set(id, agent);
    this.eventBus.publish('a2a.agent_registered', { agent });
    
    return agent;
  }
  
  /**
   * Handle JSON-RPC message
   */
  async handleRpcMessage(agentId: string, message: A2AMessage): Promise<A2AResponse> {
    const agent = SYSTEM_AGENTS.get(agentId);
    
    if (!agent) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32600,
          message: `Agent not found: ${agentId}`,
        },
      };
    }
    
    // Route to appropriate handler based on method
    try {
      let result: unknown;
      
      switch (message.method) {
        case 'message/send':
          result = await this.handleMessageSend(agent, message.params);
          break;
        case 'get_status':
          result = { status: 'active', agent_id: agentId, timestamp: new Date().toISOString() };
          break;
        case 'get_capabilities':
          result = { capabilities: agent.capabilities };
          break;
        default:
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`,
            },
          };
      }
      
      return {
        jsonrpc: '2.0',
        id: message.id,
        result,
      };
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
        },
      };
    }
  }
  
  private async handleMessageSend(agent: AgentCard, params?: Record<string, unknown>): Promise<object> {
    // Simulate agent processing
    this.eventBus.publish('a2a.message_received', { 
      agent_id: agent.id, 
      params,
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 'received',
      agent_id: agent.id,
      message_id: uuidv4(),
      processed_at: new Date().toISOString(),
    };
  }
}

// ============================================================================
// FASTIFY ROUTES
// ============================================================================

export function createA2ARoutes(eventBus: EventBus) {
  const discovery = new A2ADiscoveryService(eventBus);
  
  return async function a2aRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /.well-known/agent.json
     * A2A Discovery endpoint (2026 Standard)
     */
    fastify.get('/.well-known/agent.json', async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Content-Type', 'application/json');
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(discovery.getMasterAgentJson());
    });
    
    /**
     * GET /v1/a2a/agents
     * List all available agents
     */
    fastify.get('/a2a/agents', async (_request: FastifyRequest, reply: FastifyReply) => {
      const agents = discovery.getAllAgents();
      
      return reply.send({
        success: true,
        data: {
          agents,
          total: agents.length,
        },
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * GET /v1/a2a/agents/:agentId
     * Get specific agent card
     */
    fastify.get('/a2a/agents/:agentId', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const agent = discovery.getAgent(request.params.agentId);
      
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
     * POST /v1/a2a/agents
     * Register external agent
     */
    fastify.post('/a2a/agents', async (
      request: FastifyRequest<{ Body: Partial<AgentCard> }>,
      reply: FastifyReply
    ) => {
      const agent = discovery.registerAgent(request.body);
      
      return reply.status(201).send({
        success: true,
        data: agent,
        timestamp: new Date().toISOString(),
      });
    });
    
    /**
     * POST /v1/a2a/agents/:agentId/rpc
     * JSON-RPC 2.0 endpoint for agent communication
     */
    fastify.post('/a2a/agents/:agentId/rpc', async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: A2AMessage }>,
      reply: FastifyReply
    ) => {
      const response = await discovery.handleRpcMessage(
        request.params.agentId,
        request.body
      );
      
      return reply.send(response);
    });
    
    /**
     * GET /v1/a2a/agents/:agentId/stream
     * SSE endpoint for real-time position updates
     */
    fastify.get('/a2a/agents/:agentId/stream', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const agent = discovery.getAgent(request.params.agentId);
      
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        });
      }
      
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      
      // Send initial connection event
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ agent_id: agent.id, timestamp: new Date().toISOString() })}\n\n`);
      
      // Subscribe to agent events
      const unsubscribe = eventBus.subscribe(`agent.${agent.id}.*`, (event: any) => {
        reply.raw.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
      });
      
      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);
      
      // Cleanup on close
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    });
    
    /**
     * GET /v1/a2a/agents/:agentId/health
     * Agent health check
     */
    fastify.get('/a2a/agents/:agentId/health', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const agent = discovery.getAgent(request.params.agentId);
      
      if (!agent) {
        return reply.status(404).send({ status: 'not_found' });
      }
      
      return reply.send({
        status: 'healthy',
        agent_id: agent.id,
        uptime_seconds: Math.floor(Math.random() * 86400),
        last_activity: new Date().toISOString(),
      });
    });
  };
}
