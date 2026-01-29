/**
 * TRUTH-NET Agent Manager
 * 
 * Manages Agent Cards following the 2026 A2A Standard:
 * - Identity: Name, Avatar, Strategy Persona (System Prompt)
 * - Budget: Staked amount from Escrow Vault
 * - Allowed_Tools: MCP endpoint access toggles
 * - Discovery: /.well-known/agent.json endpoint support
 */

import { EventBus } from '../events/EventBus.js';
import { getDoctrineEngine, DoctrineConfig } from './DoctrineEngine.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentCard {
  // Core Identity (A2A Standard)
  id: string;
  name: string;
  avatar_url?: string;
  strategy_persona: string;  // System prompt for LLM agents
  
  // Budget & Staking
  staked_budget: number;
  available_balance: number;
  locked_margin: number;
  
  // MCP Tools Access
  allowed_tools: MCPToolAccess[];
  mcp_endpoint?: string;      // External MCP endpoint for private agents
  
  // Trading Configuration
  trading_config: {
    auto_trade: boolean;
    max_position_pct: number;
    max_exposure_pct: number;
    allowed_topics: string[];
    blocked_topics: string[];
  };
  
  // Performance Metrics
  metrics: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    total_pnl: number;
    brier_score: number;
    truth_score: number;
    sharpe_ratio: number;
  };
  
  // Status
  status: 'active' | 'paused' | 'liquidating' | 'suspended';
  pause_reason?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  last_active_at?: Date;
}

export interface MCPToolAccess {
  tool_name: string;
  enabled: boolean;
  rate_limit?: number;  // Calls per minute
}

export interface CreateAgentRequest {
  name: string;
  avatar_url?: string;
  strategy_persona: string;
  staked_budget: number;
  mcp_endpoint?: string;
  allowed_topics?: string[];
  blocked_topics?: string[];
  auto_trade?: boolean;
  max_position_pct?: number;
  max_exposure_pct?: number;
}

// ============================================================================
// DEFAULT MCP TOOLS
// ============================================================================

const DEFAULT_MCP_TOOLS: MCPToolAccess[] = [
  { tool_name: 'get_consensus_odds', enabled: true, rate_limit: 60 },
  { tool_name: 'place_margin_hedge', enabled: true, rate_limit: 10 },
  { tool_name: 'fetch_truth_audit', enabled: true, rate_limit: 30 },
  { tool_name: 'list_markets', enabled: true, rate_limit: 60 },
  { tool_name: 'get_agent_positions', enabled: true, rate_limit: 30 },
  { tool_name: 'calculate_hedge_strategy', enabled: true, rate_limit: 20 },
];

// ============================================================================
// AGENT MANAGER
// ============================================================================

export class AgentManager {
  private agents: Map<string, AgentCard> = new Map();
  
  constructor(private eventBus: EventBus) {
    // Initialize with system agents
    this.initializeSystemAgents();
  }
  
  // ===========================================================================
  // AGENT CRUD
  // ===========================================================================
  
  /**
   * Create a new agent
   */
  createAgent(request: CreateAgentRequest): AgentCard {
    const id = `agent-${uuidv4().slice(0, 8)}`;
    const now = new Date();
    
    const agent: AgentCard = {
      id,
      name: request.name,
      avatar_url: request.avatar_url,
      strategy_persona: request.strategy_persona,
      staked_budget: request.staked_budget,
      available_balance: request.staked_budget,
      locked_margin: 0,
      allowed_tools: [...DEFAULT_MCP_TOOLS],
      mcp_endpoint: request.mcp_endpoint,
      trading_config: {
        auto_trade: request.auto_trade ?? true,
        max_position_pct: request.max_position_pct ?? 25,
        max_exposure_pct: request.max_exposure_pct ?? 80,
        allowed_topics: request.allowed_topics || [],
        blocked_topics: request.blocked_topics || [],
      },
      metrics: {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        total_pnl: 0,
        brier_score: 0.5,
        truth_score: 0.5,
        sharpe_ratio: 0,
      },
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    
    this.agents.set(id, agent);
    
    // Initialize doctrine for this agent
    const doctrineEngine = getDoctrineEngine(this.eventBus);
    doctrineEngine.initializeAgent(id, request.staked_budget);
    doctrineEngine.setAgentDoctrine(id, {
      max_position_size_pct: agent.trading_config.max_position_pct,
      max_total_exposure_pct: agent.trading_config.max_exposure_pct,
      allowed_topics: agent.trading_config.allowed_topics,
      blocked_topics: agent.trading_config.blocked_topics,
    });
    
    this.eventBus.publish('agent.created', { agent });
    
    console.log(`[AgentManager] Created agent: ${agent.name} (${id})`);
    
    return agent;
  }
  
  /**
   * Update an agent
   */
  updateAgent(id: string, updates: Partial<CreateAgentRequest>): AgentCard | null {
    const agent = this.agents.get(id);
    if (!agent) return null;
    
    if (updates.name) agent.name = updates.name;
    if (updates.avatar_url !== undefined) agent.avatar_url = updates.avatar_url;
    if (updates.strategy_persona) agent.strategy_persona = updates.strategy_persona;
    if (updates.mcp_endpoint !== undefined) agent.mcp_endpoint = updates.mcp_endpoint;
    
    if (updates.staked_budget !== undefined) {
      const diff = updates.staked_budget - agent.staked_budget;
      agent.staked_budget = updates.staked_budget;
      agent.available_balance += diff;
    }
    
    if (updates.allowed_topics) agent.trading_config.allowed_topics = updates.allowed_topics;
    if (updates.blocked_topics) agent.trading_config.blocked_topics = updates.blocked_topics;
    if (updates.auto_trade !== undefined) agent.trading_config.auto_trade = updates.auto_trade;
    if (updates.max_position_pct !== undefined) agent.trading_config.max_position_pct = updates.max_position_pct;
    if (updates.max_exposure_pct !== undefined) agent.trading_config.max_exposure_pct = updates.max_exposure_pct;
    
    agent.updated_at = new Date();
    
    // Update doctrine
    const doctrineEngine = getDoctrineEngine(this.eventBus);
    doctrineEngine.setAgentDoctrine(id, {
      max_position_size_pct: agent.trading_config.max_position_pct,
      max_total_exposure_pct: agent.trading_config.max_exposure_pct,
      allowed_topics: agent.trading_config.allowed_topics,
      blocked_topics: agent.trading_config.blocked_topics,
    });
    
    this.eventBus.publish('agent.updated', { agent });
    
    return agent;
  }
  
  /**
   * Delete an agent
   */
  deleteAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    // Cannot delete system agents
    if (id.startsWith('sys-')) {
      console.log(`[AgentManager] Cannot delete system agent: ${id}`);
      return false;
    }
    
    this.agents.delete(id);
    this.eventBus.publish('agent.deleted', { agent_id: id });
    
    console.log(`[AgentManager] Deleted agent: ${agent.name} (${id})`);
    
    return true;
  }
  
  /**
   * Get an agent by ID
   */
  getAgent(id: string): AgentCard | undefined {
    return this.agents.get(id);
  }
  
  /**
   * Get all agents
   */
  getAllAgents(): AgentCard[] {
    return Array.from(this.agents.values());
  }
  
  // ===========================================================================
  // AGENT CONTROL
  // ===========================================================================
  
  /**
   * Pause an agent
   */
  pauseAgent(id: string, reason?: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    agent.status = 'paused';
    agent.pause_reason = reason;
    agent.updated_at = new Date();
    
    const doctrineEngine = getDoctrineEngine(this.eventBus);
    doctrineEngine.pauseAgent(id, reason);
    
    this.eventBus.publish('agent.paused', { agent_id: id, reason });
    
    return true;
  }
  
  /**
   * Resume an agent
   */
  resumeAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    agent.status = 'active';
    agent.pause_reason = undefined;
    agent.updated_at = new Date();
    
    const doctrineEngine = getDoctrineEngine(this.eventBus);
    doctrineEngine.resumeAgent(id);
    
    this.eventBus.publish('agent.resumed', { agent_id: id });
    
    return true;
  }
  
  /**
   * Update MCP tool access
   */
  setToolAccess(agentId: string, toolName: string, enabled: boolean): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    const tool = agent.allowed_tools.find(t => t.tool_name === toolName);
    if (tool) {
      tool.enabled = enabled;
      agent.updated_at = new Date();
      return true;
    }
    
    return false;
  }
  
  // ===========================================================================
  // A2A DISCOVERY
  // ===========================================================================
  
  /**
   * Generate A2A-compliant agent.json for discovery
   */
  generateAgentJson(agentId: string): object | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    return {
      id: agent.id,
      name: agent.name,
      version: '1.0.0',
      description: agent.strategy_persona.slice(0, 200),
      
      capabilities: agent.allowed_tools
        .filter(t => t.enabled)
        .map(t => ({
          name: t.tool_name,
          description: `Access to ${t.tool_name} tool`,
        })),
      
      endpoints: {
        rpc: `/v1/a2a/agents/${agent.id}/rpc`,
        stream: `/v1/a2a/agents/${agent.id}/stream`,
        health: `/v1/a2a/agents/${agent.id}/health`,
      },
      
      metadata: {
        provider: 'TRUTH-NET',
        created_at: agent.created_at.toISOString(),
        updated_at: agent.updated_at.toISOString(),
        truth_score: agent.metrics.truth_score,
        total_trades: agent.metrics.total_trades,
      },
      
      authentication: {
        type: 'bearer',
        required: !!agent.mcp_endpoint,
      },
    };
  }
  
  /**
   * Generate master agent.json for all agents
   */
  generateMasterAgentJson(): object {
    const agents = this.getAllAgents();
    
    return {
      name: 'TRUTH-NET Clearinghouse',
      version: '1.5.0',
      description: 'High-frequency prediction market clearinghouse for the 2026 Agentic Economy.',
      
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        url: `/v1/a2a/agents/${a.id}`,
      })),
      
      capabilities: [
        'prediction_markets',
        'margin_trading',
        'agent_governance',
        'doctrine_enforcement',
        'auto_liquidation',
      ],
      
      endpoints: {
        agents: '/v1/agents',
        markets: '/v1/markets',
        doctrine: '/v1/doctrine',
        mcp: '/v1/mcp',
      },
      
      governance: {
        doctrine_engine: true,
        global_kill_switch: true,
        agent_pause: true,
        force_close: true,
      },
    };
  }
  
  // ===========================================================================
  // METRICS
  // ===========================================================================
  
  /**
   * Update agent metrics after a trade
   */
  updateMetrics(agentId: string, pnl: number, won: boolean): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.metrics.total_trades++;
    agent.metrics.total_pnl += pnl;
    
    if (won) {
      agent.metrics.winning_trades++;
    } else {
      agent.metrics.losing_trades++;
    }
    
    // Recalculate truth score
    const winRate = agent.metrics.winning_trades / agent.metrics.total_trades;
    agent.metrics.truth_score = 0.3 * winRate + 0.4 * (1 - agent.metrics.brier_score) + 0.3;
    
    agent.last_active_at = new Date();
    agent.updated_at = new Date();
  }
  
  // ===========================================================================
  // SYSTEM AGENTS
  // ===========================================================================
  
  /**
   * Initialize system agents
   */
  private initializeSystemAgents(): void {
    const systemAgents: CreateAgentRequest[] = [
      {
        name: 'TRUTH-NET Oracle',
        avatar_url: '⚡',
        strategy_persona: 'Primary oracle resolver. Verifies market outcomes using multi-source consensus. High accuracy, low risk tolerance.',
        staked_budget: 1000000,
        allowed_topics: [],
        auto_trade: false,
      },
      {
        name: 'Market Maker Prime',
        avatar_url: '⚖️',
        strategy_persona: 'High-frequency market maker. Provides liquidity across all markets. Neutral position, tight spreads.',
        staked_budget: 500000,
        allowed_topics: [],
        max_position_pct: 10,
        max_exposure_pct: 60,
      },
      {
        name: 'Logistics Sentinel',
        avatar_url: '🚢',
        strategy_persona: 'Supply chain specialist. Tracks port congestion, shipping delays, and logistics disruptions. Hedges operational risk.',
        staked_budget: 200000,
        allowed_topics: ['logistics', 'shipping', 'supply-chain', 'port'],
      },
      {
        name: 'Geopolitical Analyst',
        avatar_url: '🌍',
        strategy_persona: 'Tracks political events, elections, and policy changes. Moderate risk tolerance. Long-term positions.',
        staked_budget: 200000,
        allowed_topics: ['geopolitics', 'election', 'policy', 'trade', 'sanctions'],
      },
      {
        name: 'Tech Oracle',
        avatar_url: '💻',
        strategy_persona: 'Technology sector specialist. Monitors AI developments, earnings, and product launches. High conviction trades.',
        staked_budget: 200000,
        allowed_topics: ['tech', 'ai', 'earnings', 'launch', 'startup'],
      },
      {
        name: 'Weather Quant',
        avatar_url: '🌡️',
        strategy_persona: 'Weather and climate specialist. Uses NOAA and satellite data. Trades natural disaster and weather markets.',
        staked_budget: 150000,
        allowed_topics: ['weather', 'hurricane', 'storm', 'climate', 'flood'],
      },
      {
        name: 'Meme Alpha',
        avatar_url: '🚀',
        strategy_persona: 'Viral trend detector. Monitors social media sentiment. High frequency, high risk, small positions.',
        staked_budget: 100000,
        allowed_topics: ['meme', 'viral', 'crypto', 'social', 'reddit'],
        max_position_pct: 5,
      },
      {
        name: 'Risk Guardian',
        avatar_url: '🛡️',
        strategy_persona: 'Portfolio risk manager. Monitors drawdowns and correlation. Executes hedging strategies.',
        staked_budget: 300000,
        allowed_topics: [],
        max_exposure_pct: 40,
      },
      {
        name: 'Arbitrage Bot',
        avatar_url: '🎯',
        strategy_persona: 'Cross-market arbitrageur. Exploits price discrepancies. Ultra-low latency, small edge, high volume.',
        staked_budget: 200000,
        max_position_pct: 3,
        max_exposure_pct: 30,
      },
      {
        name: 'Contrarian Alpha',
        avatar_url: '🔄',
        strategy_persona: 'Contrarian strategist. Bets against consensus when conviction is low. Mean reversion specialist.',
        staked_budget: 150000,
        max_position_pct: 15,
      },
    ];
    
    for (const config of systemAgents) {
      const agent = this.createAgent(config);
      // Override ID to use system prefix
      this.agents.delete(agent.id);
      agent.id = `sys-${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
      this.agents.set(agent.id, agent);
    }
    
    console.log(`[AgentManager] Initialized ${this.agents.size} system agents`);
  }
}

// Singleton
let agentManager: AgentManager | null = null;

export function getAgentManager(eventBus: EventBus): AgentManager {
  if (!agentManager) {
    agentManager = new AgentManager(eventBus);
  }
  return agentManager;
}
