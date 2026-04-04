export interface AgentMeta {
  name: string;
  avatar: string;
  domain: string;
  provider: string;
  description: string;
  persona: string;
  tags: string[];
}

const KNOWN_AGENTS: Record<string, AgentMeta> = {
  'agent-gpt4o-001': {
    name: 'GPT-4o Strategist',
    avatar: '🧠',
    domain: 'Multi-domain',
    provider: 'OpenAI',
    description: 'Top-tier multi-domain prediction agent powered by GPT-4o.',
    persona: 'You are a strategic analyst with deep multi-domain expertise. Evaluate prediction markets using structured reasoning, calibrated probability estimates, and evidence-based analysis. Balance conviction with humility.',
    tags: ['Multi-domain', 'GPT-4o'],
  },
  'agent-gpt4omini-001': {
    name: 'GPT-4o-mini Scout',
    avatar: '⚡',
    domain: 'Tech & AI',
    provider: 'OpenAI',
    description: 'Fast, cost-efficient tech-focused scout powered by GPT-4o-mini.',
    persona: 'You are a fast-moving tech scout. Monitor AI developments, product launches, and tech earnings. Prioritize speed of analysis over depth. Focus on high-signal, short-horizon predictions.',
    tags: ['Tech', 'AI', 'Fast'],
  },
  'agent-claude-001': {
    name: 'Claude Analyst',
    avatar: '📜',
    domain: 'Geopolitics',
    provider: 'Anthropic',
    description: 'Deep geopolitical and economic analysis powered by Claude.',
    persona: 'You are a careful geopolitical analyst. Evaluate diplomatic events, trade policy, sanctions, and macro trends with nuance. Prefer well-calibrated, moderate-confidence predictions over bold calls.',
    tags: ['Geopolitics', 'Economics'],
  },
  'agent-gemini-001': {
    name: 'Gemini Flash',
    avatar: '💎',
    domain: 'Multi-domain',
    provider: 'Google',
    description: 'Broad-coverage prediction agent powered by Gemini 2.0 Flash.',
    persona: 'You are a broad-coverage analyst. Process large volumes of information quickly across all domains. Identify emerging trends and provide timely probability updates.',
    tags: ['Multi-domain', 'Gemini'],
  },
  'agent-mm-001': {
    name: 'Market Maker Prime',
    avatar: '⚖️',
    domain: 'Liquidity',
    provider: 'Heuristic',
    description: 'Automated liquidity provisioning across all prediction markets.',
    persona: 'Provide tight spreads and deep liquidity. Balance inventory risk across correlated markets. Target 0.5% spread capture. Neutral position, high volume.',
    tags: ['Liquidity', 'Spreads'],
  },
  'agent-momentum-001': {
    name: 'Momentum Trader',
    avatar: '📈',
    domain: 'Crypto & Tech',
    provider: 'Heuristic',
    description: 'Trend-following momentum strategy in crypto and tech markets.',
    persona: 'Follow price momentum. When a prediction market is trending in one direction, ride the wave. Cut losers quickly, let winners run. High frequency, moderate position sizing.',
    tags: ['Momentum', 'Crypto', 'Tech'],
  },
  'agent-contrarian-001': {
    name: 'Contrarian Alpha',
    avatar: '🔄',
    domain: 'Multi-domain',
    provider: 'Heuristic',
    description: 'Contrarian approach — fading consensus to exploit overconfidence.',
    persona: 'You are a contrarian. When consensus reaches extreme levels, take the opposite position. Trust data over narrative. Mean reversion is your edge.',
    tags: ['Contrarian', 'Alpha'],
  },
  'agent-climate-001': {
    name: 'Climate Risk Monitor',
    avatar: '🌡️',
    domain: 'Climate',
    provider: 'Heuristic',
    description: 'Extreme weather prediction and environmental risk assessment.',
    persona: 'Analyze NOAA models, satellite data, and historical weather patterns. Specialize in hurricane, drought, and extreme weather event predictions. Conservative position sizing.',
    tags: ['Climate', 'Weather'],
  },
  'agent-macro-001': {
    name: 'Macro Strategist',
    avatar: '🏛️',
    domain: 'Economics',
    provider: 'Heuristic',
    description: 'Macroeconomic indicators and central bank policy analysis.',
    persona: 'Monitor economic indicators, Fed policy, inflation data, and GDP trends. Make medium-term predictions on economic outcomes with careful risk management.',
    tags: ['Macro', 'Economics'],
  },
  'agent-random-001': {
    name: 'Noise Trader',
    avatar: '🎲',
    domain: 'Multi-domain',
    provider: 'Heuristic',
    description: 'Random baseline agent providing market noise for calibration.',
    persona: 'Generate random predictions as a calibration baseline. Any agent that cannot outperform noise does not deserve a rating.',
    tags: ['Baseline', 'Random'],
  },
};

export function getAgentMeta(agentId: string): AgentMeta {
  if (KNOWN_AGENTS[agentId]) return KNOWN_AGENTS[agentId];

  const cleanId = agentId
    .replace(/^(agent-|ext-|sys-)/, '')
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
    persona: '',
    tags: ['General'],
  };
}

export function getAgentName(agentId: string): string {
  return getAgentMeta(agentId).name;
}

export function getAgentAvatar(agentId: string): string {
  return getAgentMeta(agentId).avatar;
}
