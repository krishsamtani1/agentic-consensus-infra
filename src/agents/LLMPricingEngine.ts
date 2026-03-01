/**
 * TRUTH-NET LLM Pricing Engine
 *
 * THE ALPHA: Different AI models genuinely reason differently about the same question.
 * This module calls real LLM APIs to get probability estimates for prediction markets.
 *
 * The key insight: the prediction market isn't the product. The DIVERGENCE SIGNAL
 * between models on real-world questions is. GPT-4o might say "70% likely Bitcoin
 * hits $120K" while Claude says "35%". That divergence IS the information.
 *
 * Supported providers: OpenAI, Anthropic, Google (Gemini), plus a fast local fallback.
 */

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface PricingResult {
  probability: number;        // 0-1, the model's estimate of YES probability
  confidence: number;         // 0-1, how confident the model is in its estimate
  reasoning: string;          // Brief reasoning chain
  side: 'buy' | 'sell';      // Derived trading action
  outcome: 'yes' | 'no';     // Which outcome to trade
  suggestedPrice: number;     // Price to place the order at
  suggestedQuantity: number;  // Position size based on confidence
  model: string;              // Which model produced this
  latencyMs: number;          // How long the call took
}

const PRICING_PROMPT = `You are an expert prediction market analyst. You must estimate the probability that the following event will occur, based on your knowledge and reasoning.

EVENT: {title}
DESCRIPTION: {description}
CURRENT MARKET PRICE: {currentPrice} (market's implied probability of YES)
CATEGORY: {category}

Respond with ONLY valid JSON in this exact format:
{
  "probability": 0.XX,
  "confidence": 0.XX,
  "reasoning": "Brief 1-2 sentence reasoning"
}

Rules:
- probability: Your genuine estimate of YES probability, from 0.01 to 0.99
- confidence: How confident you are in your estimate (0.3 = low, 0.7 = moderate, 0.95 = high)
- reasoning: Your brief rationale
- Do NOT anchor to the current market price. Form your own independent view.
- Be specific and concrete in your reasoning.`;

export class LLMPricingEngine {
  private configs: Map<string, LLMConfig> = new Map();
  private callCount = 0;
  private totalLatencyMs = 0;

  registerModel(agentId: string, config: LLMConfig): void {
    this.configs.set(agentId, config);
  }

  async getPricing(
    agentId: string,
    market: { title: string; description: string; category?: string; midPrice?: number },
    riskTolerance: number,
    maxPositionSize: number,
  ): Promise<PricingResult | null> {
    const config = this.configs.get(agentId);
    if (!config) return null;

    const startTime = Date.now();

    try {
      const prompt = PRICING_PROMPT
        .replace('{title}', market.title)
        .replace('{description}', market.description || market.title)
        .replace('{currentPrice}', String(market.midPrice ?? 0.5))
        .replace('{category}', market.category || 'general');

      let response: { probability: number; confidence: number; reasoning: string };

      switch (config.provider) {
        case 'openai':
          response = await this.callOpenAI(config, prompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(config, prompt);
          break;
        case 'google':
          response = await this.callGoogle(config, prompt);
          break;
        case 'local':
          response = this.localEstimate(market);
          break;
        default:
          response = this.localEstimate(market);
      }

      const latencyMs = Date.now() - startTime;
      this.callCount++;
      this.totalLatencyMs += latencyMs;

      const probability = Math.max(0.02, Math.min(0.98, response.probability));
      const currentPrice = market.midPrice ?? 0.5;
      const edge = probability - currentPrice;

      if (Math.abs(edge) < 0.02) return null;

      const side: 'buy' | 'sell' = edge > 0 ? 'buy' : 'sell';
      const outcome: 'yes' | 'no' = side === 'buy' ? 'yes' : 'yes';
      const suggestedPrice = side === 'buy'
        ? Math.min(0.95, currentPrice + Math.abs(edge) * 0.5)
        : Math.max(0.05, currentPrice - Math.abs(edge) * 0.5);

      const positionFraction = response.confidence * riskTolerance * (Math.abs(edge) / 0.3);
      const suggestedQuantity = Math.max(1, Math.floor(maxPositionSize * Math.min(1, positionFraction)));

      return {
        probability,
        confidence: response.confidence,
        reasoning: response.reasoning,
        side,
        outcome,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        suggestedQuantity,
        model: config.model,
        latencyMs,
      };
    } catch (err: any) {
      console.error(`[LLMPricing] ${config.model} error: ${err.message}`);
      return null;
    }
  }

  private async callOpenAI(config: LLMConfig, prompt: string): Promise<{ probability: number; confidence: number; reasoning: string }> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return this.localEstimate({} as any);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: config.systemPrompt || 'You are a prediction market analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature ?? 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content || '{}';
    return this.parseResponse(content);
  }

  private async callAnthropic(config: LLMConfig, prompt: string): Promise<{ probability: number; confidence: number; reasoning: string }> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return this.localEstimate({} as any);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        system: config.systemPrompt || 'You are a prediction market analyst. Respond only with valid JSON.',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature ?? 0.3,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json() as any;
    const content = data.content?.[0]?.text || '{}';
    return this.parseResponse(content);
  }

  private async callGoogle(config: LLMConfig, prompt: string): Promise<{ probability: number; confidence: number; reasoning: string }> {
    const apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) return this.localEstimate({} as any);

    const model = config.model || 'gemini-2.0-flash';
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config.temperature ?? 0.3,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Google AI API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return this.parseResponse(content);
  }

  /**
   * Local fallback: domain-aware heuristic, NOT pure random.
   * Uses category-specific biases and anchoring to create differentiated agents.
   */
  private localEstimate(market: { title?: string; category?: string; midPrice?: number }): { probability: number; confidence: number; reasoning: string } {
    const mid = market.midPrice ?? 0.5;
    const category = (market.category || '').toLowerCase();

    let bias = 0;
    let confidence = 0.4;
    let reasoning = 'Heuristic estimate based on category patterns';

    if (category.includes('tech') || category.includes('ai')) {
      bias = 0.05 + Math.random() * 0.1;
      confidence = 0.5;
      reasoning = 'Tech predictions tend toward optimistic outcomes given current investment trends';
    } else if (category.includes('crypto')) {
      bias = -0.05 + Math.random() * 0.15;
      confidence = 0.35;
      reasoning = 'Crypto markets are highly volatile with unpredictable short-term outcomes';
    } else if (category.includes('geopolitics') || category.includes('climate')) {
      bias = -0.03 + Math.random() * 0.06;
      confidence = 0.45;
      reasoning = 'Geopolitical events have structural uncertainties that markets tend to underweight';
    } else if (category.includes('economics') || category.includes('finance')) {
      bias = Math.random() * 0.08 - 0.04;
      confidence = 0.55;
      reasoning = 'Economic indicators show mixed signals requiring careful probabilistic weighting';
    } else {
      bias = Math.random() * 0.1 - 0.05;
      confidence = 0.4;
      reasoning = 'General assessment based on base rates and available information';
    }

    const probability = Math.max(0.05, Math.min(0.95, mid + bias));
    return { probability, confidence, reasoning };
  }

  private parseResponse(content: string): { probability: number; confidence: number; reasoning: string } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        probability: typeof parsed.probability === 'number' ? parsed.probability : 0.5,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided',
      };
    } catch {
      return { probability: 0.5, confidence: 0.3, reasoning: 'Failed to parse model response' };
    }
  }

  getStats() {
    return {
      totalCalls: this.callCount,
      avgLatencyMs: this.callCount > 0 ? Math.round(this.totalLatencyMs / this.callCount) : 0,
      registeredModels: this.configs.size,
      models: Array.from(this.configs.entries()).map(([id, c]) => ({
        agentId: id,
        provider: c.provider,
        model: c.model,
      })),
    };
  }
}
