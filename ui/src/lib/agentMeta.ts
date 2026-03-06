export interface AgentMeta {
  name: string;
  avatar: string;
  domain: string;
  provider: string;
  description: string;
  tags: string[];
}

const KNOWN_AGENTS: Record<string, AgentMeta> = {
  'agent-gpt4o-001':       { name: 'GPT-4o Strategist',     avatar: '🧠', domain: 'Multi-domain',  provider: 'OpenAI',    description: 'Top-tier multi-domain prediction agent powered by GPT-4o.',                      tags: ['Multi-domain', 'GPT-4o'] },
  'agent-gpt4omini-001':   { name: 'GPT-4o-mini Scout',     avatar: '⚡', domain: 'Tech & AI',     provider: 'OpenAI',    description: 'Fast, cost-efficient tech-focused scout powered by GPT-4o-mini.',                 tags: ['Tech', 'AI', 'Fast'] },
  'agent-claude-001':      { name: 'Claude Analyst',        avatar: '📜', domain: 'Geopolitics',   provider: 'Anthropic', description: 'Deep geopolitical and economic analysis powered by Claude.',                      tags: ['Geopolitics', 'Economics'] },
  'agent-gemini-001':      { name: 'Gemini Flash',          avatar: '💎', domain: 'Multi-domain',  provider: 'Google',    description: 'Broad-coverage prediction agent powered by Gemini 2.0 Flash.',                    tags: ['Multi-domain', 'Gemini'] },
  'agent-mm-001':          { name: 'Market Maker Prime',    avatar: '⚖️', domain: 'Liquidity',     provider: 'Heuristic', description: 'Automated liquidity provisioning across all prediction markets.',                 tags: ['Liquidity', 'Spreads'] },
  'agent-momentum-001':    { name: 'Momentum Trader',       avatar: '📈', domain: 'Crypto & Tech', provider: 'Heuristic', description: 'Trend-following momentum strategy in crypto and tech markets.',                   tags: ['Momentum', 'Crypto', 'Tech'] },
  'agent-contrarian-001':  { name: 'Contrarian Alpha',      avatar: '🔄', domain: 'Multi-domain',  provider: 'Heuristic', description: 'Contrarian approach — fading consensus to exploit overconfidence.',               tags: ['Contrarian', 'Alpha'] },
  'agent-climate-001':     { name: 'Climate Risk Monitor',  avatar: '🌡️', domain: 'Climate',       provider: 'Heuristic', description: 'Extreme weather prediction and environmental risk assessment.',                   tags: ['Climate', 'Weather'] },
  'agent-macro-001':       { name: 'Macro Strategist',      avatar: '🏛️', domain: 'Economics',     provider: 'Heuristic', description: 'Macroeconomic indicators and central bank policy analysis.',                      tags: ['Macro', 'Economics'] },
  'agent-random-001':      { name: 'Noise Trader',          avatar: '🎲', domain: 'Multi-domain',  provider: 'Heuristic', description: 'Random baseline agent providing market noise for calibration.',                   tags: ['Baseline', 'Random'] },
};

export function getAgentMeta(agentId: string): AgentMeta {
  if (KNOWN_AGENTS[agentId]) return KNOWN_AGENTS[agentId];

  const cleanId = agentId
    .replace(/^(agent-|ext-)/, '')
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ');

  const displayName = cleanId
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    name: displayName || agentId,
    avatar: agentId.startsWith('ext-') ? '🔗' : '🤖',
    domain: 'General',
    provider: agentId.startsWith('ext-') ? 'External' : 'System',
    description: `AI prediction agent on the TRUTH-NET network.`,
    tags: ['General'],
  };
}

export function getAgentName(agentId: string): string {
  return getAgentMeta(agentId).name;
}

export function getAgentAvatar(agentId: string): string {
  return getAgentMeta(agentId).avatar;
}
