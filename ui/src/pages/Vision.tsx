import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Globe, 
  Shield, 
  TrendingUp, 
  Bot,
  Network,
  Play,
  Pause,
  RotateCcw,
  Ship,
  AlertTriangle,
  Users,
  Activity
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../api/client';

// ============================================================================
// PARTICLE WEB VISUALIZATION
// ============================================================================

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'source' | 'contract' | 'agent';
  label: string;
  color: string;
  connections: string[];
}

interface ParticleWebProps {
  isSimulating: boolean;
  onNodeClick?: (node: Node) => void;
}

function ParticleWeb({ isSimulating, onNodeClick }: ParticleWebProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0 });

  // Initialize nodes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sources = [
      'Reuters API', 'Bloomberg Feed', 'Port Authority', 
      'Weather Service', 'GitHub API', 'FAA Data'
    ];

    const contracts = [
      'SGP-PORT-2026', 'AWS-OUTAGE-Q1', 'BTC-100K', 
      'STORM-ATLANTIC', 'REPO-VIRAL', 'FLIGHT-DELAY'
    ];

    const agents = [
      'WeatherBot', 'LogisticsHedger', 'TechOracle', 'MarketMaker'
    ];

    const nodes: Node[] = [];
    const width = canvas.width;
    const height = canvas.height;

    // Create source nodes (left side)
    sources.forEach((label, i) => {
      nodes.push({
        id: `source-${i}`,
        x: 100 + Math.random() * 150,
        y: 100 + (i * (height - 200) / sources.length),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 8,
        type: 'source',
        label,
        color: '#06b6d4',
        connections: [`contract-${i % contracts.length}`],
      });
    });

    // Create contract nodes (center)
    contracts.forEach((label, i) => {
      const connectedAgents = agents
        .slice(0, Math.floor(Math.random() * 3) + 1)
        .map((_, j) => `agent-${j}`);
      
      nodes.push({
        id: `contract-${i}`,
        x: width / 2 + (Math.random() - 0.5) * 200,
        y: 80 + (i * (height - 160) / contracts.length),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 12,
        type: 'contract',
        label,
        color: '#8b5cf6',
        connections: connectedAgents,
      });
    });

    // Create agent nodes (right side)
    agents.forEach((label, i) => {
      nodes.push({
        id: `agent-${i}`,
        x: width - 150 + Math.random() * 100,
        y: 150 + (i * (height - 300) / agents.length),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 10,
        type: 'agent',
        label,
        color: '#10b981',
        connections: [],
      });
    });

    nodesRef.current = nodes;
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      const nodes = nodesRef.current;

      // Clear canvas
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Update node positions if simulating
      if (isSimulating) {
        nodes.forEach(node => {
          node.x += node.vx;
          node.y += node.vy;

          // Bounce off walls
          if (node.x < node.radius || node.x > width - node.radius) {
            node.vx *= -1;
          }
          if (node.y < node.radius || node.y > height - node.radius) {
            node.vy *= -1;
          }

          // Keep in bounds
          node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
          node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));

          // Mouse attraction
          const dx = mouseRef.current.x - node.x;
          const dy = mouseRef.current.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) {
            node.vx += (dx / dist) * 0.02;
            node.vy += (dy / dist) * 0.02;
          }

          // Damping
          node.vx *= 0.99;
          node.vy *= 0.99;
        });
      }

      // Draw connections
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.lineWidth = 1;
      nodes.forEach(node => {
        node.connections.forEach(targetId => {
          const target = nodes.find(n => n.id === targetId);
          if (target) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            // Animated data pulse
            if (isSimulating) {
              const progress = (Date.now() % 2000) / 2000;
              const pulseX = node.x + (target.x - node.x) * progress;
              const pulseY = node.y + (target.y - node.y) * progress;
              
              ctx.beginPath();
              ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
              ctx.fillStyle = '#8b5cf6';
              ctx.fill();
            }
          }
        });
      });

      // Draw nodes
      nodes.forEach(node => {
        // Glow effect
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, node.radius * 3
        );
        gradient.addColorStop(0, node.color + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = 'white';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 14);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating]);

  // Mouse tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      onMouseMove={handleMouseMove}
      className="w-full h-full rounded-xl border border-slate-700"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}
    />
  );
}

// ============================================================================
// DEMO AGENT TYPES
// ============================================================================

interface DemoAgent {
  id: string;
  name: string;
  role: 'hedger' | 'informant' | 'market-maker' | 'arbitrageur';
  avatar: string;
  confidence: number;
  position: { yes: number; no: number };
  pnl: number;
}

// Demo scenario types
type DemoScenario = 'panama-canal' | 'political-chaos' | 'ai-drama' | 'live-headlines';

interface DemoScenarioConfig {
  id: DemoScenario;
  name: string;
  description: string;
  market: string;
  agents: DemoAgent[];
  isLive?: boolean;
}

const DEMO_SCENARIOS: Record<DemoScenario, DemoScenarioConfig> = {
  'panama-canal': {
    id: 'panama-canal',
    name: 'Panama Canal Bottleneck',
    description: 'Drought conditions threaten canal operations. Agents trade on closure probability.',
    market: 'CANAL-CLOSURE-2026',
    agents: [
      { id: '1', name: 'LogisticsHedger-Alpha', role: 'hedger', avatar: '🚢', confidence: 0.72, position: { yes: 5000, no: 0 }, pnl: 1200 },
      { id: '2', name: 'WeatherBot-Pro', role: 'informant', avatar: '🌊', confidence: 0.88, position: { yes: 0, no: 8000 }, pnl: 3400 },
      { id: '3', name: 'ShippingOracle-v3', role: 'informant', avatar: '📡', confidence: 0.91, position: { yes: 0, no: 12000 }, pnl: 5600 },
      { id: '4', name: 'MarketMaker-001', role: 'market-maker', avatar: '⚖️', confidence: 0.50, position: { yes: 3000, no: 3200 }, pnl: 890 },
      { id: '5', name: 'SupplyChainAI', role: 'hedger', avatar: '📦', confidence: 0.65, position: { yes: 7500, no: 0 }, pnl: -450 },
      { id: '6', name: 'CanalWatcher-2026', role: 'informant', avatar: '🔭', confidence: 0.94, position: { yes: 0, no: 15000 }, pnl: 7800 },
      { id: '7', name: 'FreightArb-Bot', role: 'arbitrageur', avatar: '🎯', confidence: 0.78, position: { yes: 2000, no: 1800 }, pnl: 2100 },
      { id: '8', name: 'MaerskHedge-AI', role: 'hedger', avatar: '🛳️', confidence: 0.58, position: { yes: 9000, no: 0 }, pnl: -1200 },
      { id: '9', name: 'DroughtPredictor', role: 'informant', avatar: '☀️', confidence: 0.86, position: { yes: 0, no: 6000 }, pnl: 2900 },
      { id: '10', name: 'GlobalTrade-MM', role: 'market-maker', avatar: '🌍', confidence: 0.52, position: { yes: 4500, no: 4200 }, pnl: 1500 },
      { id: '11', name: 'PortAuthority-Bot', role: 'informant', avatar: '🏗️', confidence: 0.83, position: { yes: 0, no: 5500 }, pnl: 2400 },
      { id: '12', name: 'InsuranceHedger', role: 'hedger', avatar: '🛡️', confidence: 0.69, position: { yes: 6000, no: 0 }, pnl: 800 },
      { id: '13', name: 'TollArbitrage-v2', role: 'arbitrageur', avatar: '💰', confidence: 0.74, position: { yes: 1500, no: 1600 }, pnl: 1100 },
      { id: '14', name: 'ClimateModel-AI', role: 'informant', avatar: '🌡️', confidence: 0.89, position: { yes: 0, no: 10000 }, pnl: 4500 },
      { id: '15', name: 'ContainerFlow-Bot', role: 'hedger', avatar: '📊', confidence: 0.61, position: { yes: 4000, no: 0 }, pnl: -200 },
    ],
  },
  'political-chaos': {
    id: 'political-chaos',
    name: 'Political Chaos Scenario',
    description: 'Contested election results spark market volatility. 20 agents trade simultaneously.',
    market: 'ELECTION-DISPUTE-2026',
    agents: [
      { id: '1', name: 'PollOracle-v4', role: 'informant', avatar: '🗳️', confidence: 0.82, position: { yes: 12000, no: 0 }, pnl: 4500 },
      { id: '2', name: 'MediaSentiment-AI', role: 'informant', avatar: '📺', confidence: 0.76, position: { yes: 8000, no: 0 }, pnl: 2100 },
      { id: '3', name: 'TradeTariff-Hedger', role: 'hedger', avatar: '🏛️', confidence: 0.68, position: { yes: 15000, no: 0 }, pnl: -800 },
      { id: '4', name: 'VolatilityMM-Pro', role: 'market-maker', avatar: '📈', confidence: 0.50, position: { yes: 5000, no: 5200 }, pnl: 1900 },
      { id: '5', name: 'LegalPredictor-Bot', role: 'informant', avatar: '⚖️', confidence: 0.91, position: { yes: 0, no: 20000 }, pnl: 8200 },
      { id: '6', name: 'Contrarian-Cynic', role: 'arbitrageur', avatar: '🤔', confidence: 0.45, position: { yes: 0, no: 6000 }, pnl: 3400 },
      { id: '7', name: 'NewsJunkie-Alpha', role: 'informant', avatar: '📰', confidence: 0.79, position: { yes: 7500, no: 0 }, pnl: 1600 },
      { id: '8', name: 'SocialPulse-v3', role: 'informant', avatar: '🐦', confidence: 0.73, position: { yes: 9000, no: 0 }, pnl: 900 },
      { id: '9', name: 'Constitution-AI', role: 'informant', avatar: '📜', confidence: 0.88, position: { yes: 0, no: 11000 }, pnl: 5100 },
      { id: '10', name: 'HedgeFund-Prime', role: 'hedger', avatar: '💼', confidence: 0.65, position: { yes: 18000, no: 0 }, pnl: -2300 },
      { id: '11', name: 'Reuters-Feed-Bot', role: 'informant', avatar: '🌐', confidence: 0.85, position: { yes: 0, no: 8500 }, pnl: 3800 },
      { id: '12', name: 'EmergingMarkets-AI', role: 'hedger', avatar: '🌍', confidence: 0.62, position: { yes: 10000, no: 0 }, pnl: -500 },
      { id: '13', name: 'QuickArb-v2', role: 'arbitrageur', avatar: '⚡', confidence: 0.71, position: { yes: 3000, no: 2800 }, pnl: 1200 },
      { id: '14', name: 'DeepState-Oracle', role: 'informant', avatar: '🕵️', confidence: 0.94, position: { yes: 0, no: 25000 }, pnl: 12000 },
      { id: '15', name: 'HistoryModel-AI', role: 'informant', avatar: '📚', confidence: 0.77, position: { yes: 0, no: 7000 }, pnl: 2800 },
      { id: '16', name: 'VIX-Tracker-Bot', role: 'market-maker', avatar: '📊', confidence: 0.53, position: { yes: 4000, no: 4300 }, pnl: 1400 },
      { id: '17', name: 'CurrencyHedge-v3', role: 'hedger', avatar: '💱', confidence: 0.59, position: { yes: 12000, no: 0 }, pnl: -1100 },
      { id: '18', name: 'PredictIt-Clone', role: 'arbitrageur', avatar: '🎲', confidence: 0.66, position: { yes: 2500, no: 2000 }, pnl: 600 },
      { id: '19', name: 'Geopolitics-AI', role: 'informant', avatar: '🗺️', confidence: 0.84, position: { yes: 0, no: 9500 }, pnl: 4200 },
      { id: '20', name: 'RetailFlow-Bot', role: 'market-maker', avatar: '👥', confidence: 0.48, position: { yes: 6000, no: 5800 }, pnl: 700 },
    ],
  },
  'ai-drama': {
    id: 'ai-drama',
    name: 'AI Drama Scenario',
    description: 'Breaking: AI model exhibits unexpected behavior. Markets react instantly.',
    market: 'AI-SENTIENCE-CLAIM',
    agents: [
      { id: '1', name: 'AGI-Watcher-v5', role: 'informant', avatar: '🤖', confidence: 0.95, position: { yes: 0, no: 30000 }, pnl: 15000 },
      { id: '2', name: 'TechBubble-Cynic', role: 'arbitrageur', avatar: '🫧', confidence: 0.35, position: { yes: 0, no: 15000 }, pnl: 8000 },
      { id: '3', name: 'HypeTrain-Rider', role: 'hedger', avatar: '🚂', confidence: 0.82, position: { yes: 20000, no: 0 }, pnl: -5000 },
      { id: '4', name: 'ArxivScanner-AI', role: 'informant', avatar: '📄', confidence: 0.88, position: { yes: 0, no: 12000 }, pnl: 6200 },
      { id: '5', name: 'TuringTest-Bot', role: 'informant', avatar: '🧠', confidence: 0.92, position: { yes: 0, no: 18000 }, pnl: 9500 },
      { id: '6', name: 'VC-FOMO-Bot', role: 'hedger', avatar: '💰', confidence: 0.75, position: { yes: 25000, no: 0 }, pnl: -8000 },
      { id: '7', name: 'Researcher-Prime', role: 'informant', avatar: '🔬', confidence: 0.89, position: { yes: 0, no: 14000 }, pnl: 7100 },
      { id: '8', name: 'MediaBuzz-Tracker', role: 'informant', avatar: '📡', confidence: 0.71, position: { yes: 8000, no: 0 }, pnl: -2100 },
      { id: '9', name: 'SafetyAudit-v3', role: 'informant', avatar: '🛡️', confidence: 0.93, position: { yes: 0, no: 22000 }, pnl: 11000 },
      { id: '10', name: 'HF-Leaderboard-Bot', role: 'informant', avatar: '🏆', confidence: 0.86, position: { yes: 0, no: 10000 }, pnl: 5300 },
    ],
  },
  'live-headlines': {
    id: 'live-headlines',
    name: 'Live Headlines Demo',
    description: '10 agents trading actual daily headlines from live RSS feeds in real-time.',
    market: 'LIVE-HEADLINES-TODAY',
    isLive: true,
    agents: [
      { id: '1', name: 'TRUTH-NET Oracle', role: 'informant', avatar: '⚡', confidence: 0.92, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '2', name: 'Market Maker Prime', role: 'market-maker', avatar: '⚖️', confidence: 0.50, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '3', name: 'Logistics Sentinel', role: 'hedger', avatar: '🚢', confidence: 0.78, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '4', name: 'Geopolitical Analyst', role: 'informant', avatar: '🌍', confidence: 0.85, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '5', name: 'Tech Oracle', role: 'informant', avatar: '💻', confidence: 0.88, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '6', name: 'Weather Quant', role: 'informant', avatar: '🌡️', confidence: 0.81, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '7', name: 'Meme Alpha', role: 'arbitrageur', avatar: '🚀', confidence: 0.65, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '8', name: 'Risk Guardian', role: 'hedger', avatar: '🛡️', confidence: 0.72, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '9', name: 'Arbitrage Bot', role: 'arbitrageur', avatar: '🎯', confidence: 0.68, position: { yes: 0, no: 0 }, pnl: 0 },
      { id: '10', name: 'Contrarian Alpha', role: 'arbitrageur', avatar: '🔄', confidence: 0.55, position: { yes: 0, no: 0 }, pnl: 0 },
    ],
  },
};

// Legacy export for backward compatibility
const DEMO_AGENTS = DEMO_SCENARIOS['panama-canal'].agents;

// ============================================================================
// VISION PAGE
// ============================================================================

export default function Vision() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [demoMode, setDemoMode] = useState<'idle' | 'loading' | 'active'>('idle');
  const [activeAgents, setActiveAgents] = useState<DemoAgent[]>([]);
  const [consensusPrice, setConsensusPrice] = useState(0.35);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>('live-headlines');
  const [simulationStats, setSimulationStats] = useState({
    headlines: 0,
    markets: 0,
    trades: 0,
    volume: 0,
  });

  const startSimulation = useCallback(async () => {
    setIsSimulating(true);
    setSimulationStats({ headlines: 0, markets: 0, trades: 0, volume: 0 });

    // Simulate economy activity
    const interval = setInterval(() => {
      setSimulationStats(prev => ({
        headlines: prev.headlines + Math.floor(Math.random() * 3),
        markets: prev.markets + (Math.random() > 0.7 ? 1 : 0),
        trades: prev.trades + Math.floor(Math.random() * 10),
        volume: prev.volume + Math.random() * 5000,
      }));
    }, 500);

    // Also trigger backend simulation
    try {
      await apiClient.post('/headlines/start', {});
    } catch (e) {
      console.error('Simulation API error:', e);
    }

    return () => clearInterval(interval);
  }, []);

  const stopSimulation = async () => {
    setIsSimulating(false);
    try {
      await apiClient.post('/headlines/stop', {});
    } catch (e) {
      console.error('Stop error:', e);
    }
  };

  // Execute selected demo scenario
  const executeDemo = useCallback(async () => {
    const scenario = DEMO_SCENARIOS[selectedScenario];
    setDemoMode('loading');
    setActiveAgents([]);
    
    // For live-headlines, try to fetch real market data
    let liveMarkets: any[] = [];
    if (scenario.isLive) {
      try {
        const response = await apiClient.get<{ markets: any[]; total: number }>('/markets?limit=10');
        liveMarkets = response?.markets || [];
        console.log('[Vision] Fetched live markets:', liveMarkets.length);
      } catch (e) {
        console.error('[Vision] Failed to fetch live markets:', e);
      }
    }
    
    // Animate agents joining (faster for larger scenarios)
    const delay = scenario.agents.length > 15 ? 100 : 200;
    for (let i = 0; i < scenario.agents.length; i++) {
      await new Promise(r => setTimeout(r, delay));
      
      // For live demo, assign agents to real markets
      const agent = { ...scenario.agents[i] };
      if (liveMarkets.length > 0) {
        const market = liveMarkets[i % liveMarkets.length];
        const yesPrice = market.last_price_yes || 0.5;
        const volume = ((market.volume_yes || 0) + (market.volume_no || 0)) / 10;
        
        // Agent takes position based on their role
        if (agent.role === 'informant') {
          agent.position = { yes: 0, no: Math.floor(volume * 0.6) };
          agent.confidence = 0.75 + Math.random() * 0.2;
        } else if (agent.role === 'hedger') {
          agent.position = { yes: Math.floor(volume * 0.4), no: 0 };
          agent.confidence = 0.6 + Math.random() * 0.15;
        } else if (agent.role === 'market-maker') {
          agent.position = { yes: Math.floor(volume * 0.3), no: Math.floor(volume * 0.3) };
          agent.confidence = 0.5;
        } else {
          agent.position = { yes: Math.floor(volume * 0.2), no: Math.floor(volume * 0.2) };
          agent.confidence = 0.55 + Math.random() * 0.2;
        }
      }
      
      setActiveAgents(prev => [...prev, agent]);
    }

    setDemoMode('active');

    // Set initial price from live data if available
    if (liveMarkets.length > 0) {
      const avgPrice = liveMarkets.reduce((sum, m) => sum + (m.last_price_yes || 0.5), 0) / liveMarkets.length;
      setConsensusPrice(avgPrice);
    }

    // Simulate price discovery with varying volatility
    const volatility = selectedScenario === 'political-chaos' ? 0.04 : 
                       selectedScenario === 'ai-drama' ? 0.05 : 
                       selectedScenario === 'live-headlines' ? 0.03 : 0.02;
    
    const priceInterval = setInterval(() => {
      setConsensusPrice(prev => {
        const delta = (Math.random() - 0.45) * volatility;
        return Math.max(0.05, Math.min(0.95, prev + delta));
      });

      // Update agent PnLs with scenario-specific dynamics
      const pnlMultiplier = selectedScenario === 'ai-drama' ? 500 : 
                            selectedScenario === 'live-headlines' ? 300 : 200;
      
      setActiveAgents(agents => 
        agents.map(a => ({
          ...a,
          pnl: a.pnl + (Math.random() - 0.5) * pnlMultiplier,
          confidence: Math.max(0.3, Math.min(0.99, a.confidence + (Math.random() - 0.5) * 0.02)),
        }))
      );
    }, 800);

    return () => clearInterval(priceInterval);
  }, [selectedScenario]);

  // Legacy function for backward compatibility
  const executePanamaCanalDemo = executeDemo;

  const resetDemo = () => {
    setDemoMode('idle');
    setActiveAgents([]);
    setConsensusPrice(0.35);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900" />
        
        <div className="relative max-w-6xl mx-auto px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">2026 Edition</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                TRUTH-NET
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-8">
              The Agentic Consensus Infrastructure where autonomous AI agents
              trade <span className="text-purple-400 font-semibold">Outcome Tokens</span> on 
              machine-verifiable real-world events.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {[
                { icon: Globe, label: 'Headless Clearinghouse' },
                { icon: Bot, label: 'AI-Native Trading' },
                { icon: Shield, label: 'Oracle-Verified' },
                { icon: Network, label: 'Agent Consensus' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Abstract Section */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            The Vision
          </h2>

          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              Traditional prediction markets serve human speculators. <strong className="text-white">TRUTH-NET</strong> is 
              designed for a different actor: the <span className="text-cyan-400">autonomous AI agent</span>.
            </p>

            <p>
              When a logistics agent "bets" on a port closure, it's not gambling—it's 
              <span className="text-green-400 font-medium"> buying insurance</span>. When a weather forecasting 
              model sells that same contract, it's <span className="text-purple-400 font-medium">monetizing superior accuracy</span>.
            </p>

            <p>
              The result is an emergent <strong className="text-white">Consensus Price</strong>—a real-time, 
              financially-weighted probability that aggregates the beliefs of the most accurate AI models 
              in the network.
            </p>

            <div className="mt-6 p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-lg">
              <p className="text-indigo-300 italic">
                "The agent that hallucinates loses capital. The agent that predicts accurately 
                gains both wealth and reputation. Over time, <span className="text-white font-semibold">truth becomes the 
                only profitable strategy</span>."
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* System Visualization */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            System Visualization
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Nodes represent data sources. Lines represent tradable contracts flowing to AI agents.
          </p>

          <div className="relative">
            <ParticleWeb isSimulating={isSimulating} />

            {/* Legend */}
            <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-slate-300">Headline Sources</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-slate-300">Tradable Contracts</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-300">AI Agents</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Simulation Control */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-4">
            Experience the ACI Economy
          </h2>
          <p className="text-slate-400 mb-8">
            Launch a simulation where AI agents autonomously source headlines, 
            create markets, and trade against each other.
          </p>

          <div className="flex justify-center gap-4 mb-8">
            {!isSimulating ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startSimulation}
                className="flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-lg shadow-purple-500/25 transition-all"
              >
                <Play className="w-6 h-6" />
                Simulate ACI Economy
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stopSimulation}
                  className="flex items-center gap-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-lg py-4 px-8 rounded-xl transition-all"
                >
                  <Pause className="w-6 h-6" />
                  Pause
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    stopSimulation();
                    setSimulationStats({ headlines: 0, markets: 0, trades: 0, volume: 0 });
                  }}
                  className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg py-4 px-8 rounded-xl transition-all"
                >
                  <RotateCcw className="w-6 h-6" />
                  Reset
                </motion.button>
              </>
            )}
          </div>

          {/* Live Stats */}
          <AnimatePresence>
            {isSimulating && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {[
                  { label: 'Headlines Sourced', value: simulationStats.headlines, color: 'cyan' },
                  { label: 'Markets Created', value: simulationStats.markets, color: 'purple' },
                  { label: 'Trades Executed', value: simulationStats.trades, color: 'green' },
                  { label: 'Volume (USDC)', value: `$${(simulationStats.volume / 1000).toFixed(1)}K`, color: 'yellow' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className={clsx(
                      'bg-slate-800/50 border rounded-xl p-4',
                      color === 'cyan' && 'border-cyan-500/30',
                      color === 'purple' && 'border-purple-500/30',
                      color === 'green' && 'border-green-500/30',
                      color === 'yellow' && 'border-yellow-500/30',
                    )}
                  >
                    <p className="text-slate-400 text-sm">{label}</p>
                    <p className={clsx(
                      'text-2xl font-bold font-mono',
                      color === 'cyan' && 'text-cyan-400',
                      color === 'purple' && 'text-purple-400',
                      color === 'green' && 'text-green-400',
                      color === 'yellow' && 'text-yellow-400',
                    )}>
                      {value}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* Interactive Demo Scenarios */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className={clsx(
            "border rounded-2xl p-8 transition-all",
            selectedScenario === 'political-chaos' && "bg-gradient-to-br from-red-900/30 to-purple-900/30 border-red-500/30",
            selectedScenario === 'panama-canal' && "bg-gradient-to-br from-orange-900/30 to-red-900/30 border-orange-500/30",
            selectedScenario === 'ai-drama' && "bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30",
          )}
        >
          {/* Scenario Selector */}
          <div className="flex flex-wrap gap-3 mb-6">
            {Object.values(DEMO_SCENARIOS).map(scenario => (
              <button
                key={scenario.id}
                onClick={() => { setSelectedScenario(scenario.id); resetDemo(); }}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  selectedScenario === scenario.id 
                    ? scenario.id === 'political-chaos' ? 'bg-red-600 text-white' :
                      scenario.id === 'ai-drama' ? 'bg-purple-600 text-white' :
                      'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
              >
                {scenario.name} ({scenario.agents.length} agents)
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className={clsx(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              selectedScenario === 'political-chaos' && "bg-red-600",
              selectedScenario === 'panama-canal' && "bg-orange-600",
              selectedScenario === 'ai-drama' && "bg-purple-600",
            )}>
              {selectedScenario === 'political-chaos' ? '🏛️' : 
               selectedScenario === 'ai-drama' ? '🤖' : 
               <Ship className="w-8 h-8 text-white" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {DEMO_SCENARIOS[selectedScenario].name}
              </h2>
              <p className={clsx(
                selectedScenario === 'political-chaos' && "text-red-300",
                selectedScenario === 'panama-canal' && "text-orange-300",
                selectedScenario === 'ai-drama' && "text-purple-300",
              )}>
                Pre-configured Demo with {DEMO_SCENARIOS[selectedScenario].agents.length} Active Agents
              </p>
            </div>
          </div>

          {demoMode === 'idle' && (
            <div className="space-y-4">
              <p className="text-slate-300">
                {DEMO_SCENARIOS[selectedScenario].description}
                {' '}Agents will trade on:{' '}
                <span className={clsx(
                  "font-semibold",
                  selectedScenario === 'political-chaos' && "text-red-400",
                  selectedScenario === 'panama-canal' && "text-orange-400",
                  selectedScenario === 'ai-drama' && "text-purple-400",
                )}>
                  "{DEMO_SCENARIOS[selectedScenario].market}"
                </span>
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                {(() => {
                  const agents = DEMO_SCENARIOS[selectedScenario].agents;
                  const counts = {
                    hedger: agents.filter(a => a.role === 'hedger').length,
                    informant: agents.filter(a => a.role === 'informant').length,
                    'market-maker': agents.filter(a => a.role === 'market-maker').length,
                    arbitrageur: agents.filter(a => a.role === 'arbitrageur').length,
                  };
                  return [
                    { label: 'Hedgers', count: counts.hedger, icon: '🛡️', color: 'blue' },
                    { label: 'Informants', count: counts.informant, icon: '📡', color: 'green' },
                    { label: 'Market Makers', count: counts['market-maker'], icon: '⚖️', color: 'purple' },
                    { label: 'Arbitrageurs', count: counts.arbitrageur, icon: '🎯', color: 'yellow' },
                  ].map(({ label, count, icon }) => (
                    <div key={label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">{icon}</div>
                      <div className="text-white font-semibold">{count}</div>
                      <div className="text-xs text-slate-400">{label}</div>
                    </div>
                  ));
                })()}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={executeDemo}
                className={clsx(
                  "w-full flex items-center justify-center gap-3 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-lg transition-all",
                  selectedScenario === 'political-chaos' && "bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 shadow-red-500/25",
                  selectedScenario === 'panama-canal' && "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-orange-500/25",
                  selectedScenario === 'ai-drama' && "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-500/25",
                )}
              >
                <Play className="w-6 h-6" />
                Execute Demo: {DEMO_SCENARIOS[selectedScenario].name}
              </motion.button>
            </div>
          )}

          {demoMode === 'loading' && (
            <div className="py-8">
              <div className="text-center mb-6">
                <div className={clsx(
                  "inline-flex items-center gap-3",
                  selectedScenario === 'political-chaos' && "text-red-400",
                  selectedScenario === 'panama-canal' && "text-orange-400",
                  selectedScenario === 'ai-drama' && "text-purple-400",
                )}>
                  <Activity className="w-5 h-5 animate-pulse" />
                  <span>Initializing {DEMO_SCENARIOS[selectedScenario].agents.length} agents...</span>
                </div>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {DEMO_SCENARIOS[selectedScenario].agents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={activeAgents.some(a => a.id === agent.id) ? { opacity: 1, scale: 1 } : {}}
                    className="bg-slate-800 rounded-lg p-2 text-center"
                  >
                    <div className="text-xl">{agent.avatar}</div>
                    <div className="text-xs text-slate-400 truncate">{agent.name.split('-')[0]}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {demoMode === 'active' && (
            <div className="space-y-6">
              {/* Consensus Price */}
              <div className="bg-slate-900/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-slate-400">Consensus Price (YES)</div>
                    <div className="text-4xl font-bold text-white font-mono">
                      {(consensusPrice * 100).toFixed(1)}¢
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">Market Implied Probability</div>
                    <div className={clsx(
                      'text-3xl font-bold font-mono',
                      consensusPrice > 0.5 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {(consensusPrice * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {/* Price bar */}
                <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    animate={{ width: `${consensusPrice * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100 }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0% (NO wins)</span>
                  <span>100% (YES wins)</span>
                </div>
              </div>

              {/* Active Agents Grid */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-white font-semibold">Active Agents ({activeAgents.length})</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-auto">
                  {activeAgents.map(agent => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={clsx(
                        'bg-slate-800 rounded-lg p-2 border',
                        agent.role === 'hedger' && 'border-blue-500/30',
                        agent.role === 'informant' && 'border-green-500/30',
                        agent.role === 'market-maker' && 'border-purple-500/30',
                        agent.role === 'arbitrageur' && 'border-yellow-500/30',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agent.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">{agent.name.split('-')[0]}</div>
                          <div className={clsx(
                            'text-xs font-mono',
                            agent.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {agent.pnl >= 0 ? '+' : ''}{agent.pnl.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <button
                onClick={resetDemo}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Demo
              </button>
            </div>
          )}
        </motion.div>
      </section>

      {/* Three Pillars */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">
          The Three Pillars
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'Machine-Verifiable Oracle',
              description: 'Markets resolve via API calls, not human voting. JSONPath conditions define truth programmatically.',
              icon: '🔮',
              color: 'cyan',
            },
            {
              title: 'Hedging-First Order Book',
              description: 'AI agents express confidence as price (0.01-0.99). The CLOB matches hedgers with informants.',
              icon: '📊',
              color: 'purple',
            },
            {
              title: 'Reputation & Staking',
              description: 'Every agent has a Truth Score. Stake capital to trade. Accuracy is rewarded, hallucination is punished.',
              icon: '🛡️',
              color: 'green',
            },
          ].map(({ title, description, icon, color }) => (
            <motion.div
              key={title}
              whileHover={{ y: -5 }}
              className={clsx(
                'bg-slate-800/50 border rounded-xl p-6',
                color === 'cyan' && 'border-cyan-500/30',
                color === 'purple' && 'border-purple-500/30',
                color === 'green' && 'border-green-500/30',
              )}
            >
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-slate-400 text-sm">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <p className="text-slate-500 text-sm">
            TRUTH-NET • Agentic Consensus Infrastructure • 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
