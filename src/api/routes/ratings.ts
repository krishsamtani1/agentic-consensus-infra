/**
 * TRUTH-NET Rating API Routes
 * 
 * Public-facing API for consuming agent ratings.
 * This is the primary product of the platform — enterprises and developers
 * query these endpoints to evaluate AI trading agents.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RatingEngine, RatingGrade, computeGrade, gradeToColor } from '../../rating/RatingEngine.js';
import { EventBus } from '../../events/EventBus.js';

export function createRatingRoutes(ratingEngine: RatingEngine, eventBus: EventBus) {
  return async function ratingRoutes(fastify: FastifyInstance): Promise<void> {

    // -----------------------------------------------------------------------
    // GET /ratings/leaderboard - Global agent leaderboard
    // -----------------------------------------------------------------------
    fastify.get('/ratings/leaderboard', async (
      request: FastifyRequest<{ Querystring: { limit?: string; include_unrated?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit || '20');
      const includeUnrated = request.query.include_unrated === 'true';

      const leaderboard = includeUnrated
        ? ratingEngine.getFullLeaderboard(limit)
        : ratingEngine.getLeaderboard(limit);

      return reply.send({
        success: true,
        data: {
          leaderboard: leaderboard.map((r, index) => ({
            rank: index + 1,
            agent_id: r.agent_id,
            truth_score: Math.round(r.truth_score * 10) / 10,
            grade: r.grade,
            grade_color: gradeToColor(r.grade),
            certified: r.certified,
            brier_score: r.brier_score,
            sharpe_ratio: Math.round(r.sharpe_ratio * 100) / 100,
            win_rate: Math.round(r.win_rate * 1000) / 10, // percentage with 1 decimal
            max_drawdown: Math.round(r.max_drawdown * 1000) / 10,
            total_trades: r.total_trades,
            total_pnl: Math.round(r.total_pnl * 100) / 100,
          })),
          total: leaderboard.length,
          distribution: ratingEngine.getDistribution(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/:agentId - Detailed rating for a specific agent
    // -----------------------------------------------------------------------
    fastify.get('/ratings/:agentId', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const rating = ratingEngine.getRating(agentId);

      if (!rating) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: `No rating found for agent ${agentId}` },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          agent_id: rating.agent_id,
          truth_score: Math.round(rating.truth_score * 10) / 10,
          grade: rating.grade,
          grade_color: gradeToColor(rating.grade),
          certified: rating.certified,
          certified_at: rating.certified_at?.toISOString(),

          // Component breakdown
          components: {
            brier: { score: rating.brier_component, weight: 0.35, raw: rating.brier_score },
            sharpe: { score: rating.sharpe_component, weight: 0.25, raw: rating.sharpe_ratio },
            win_rate: { score: rating.winrate_component, weight: 0.20, raw: rating.win_rate },
            consistency: { score: rating.consistency_component, weight: 0.10 },
            risk: { score: rating.risk_component, weight: 0.10, raw_drawdown: rating.max_drawdown },
          },

          // Performance stats
          performance: {
            total_trades: rating.total_trades,
            winning_trades: rating.winning_trades,
            win_rate: Math.round(rating.win_rate * 1000) / 10,
            total_pnl: Math.round(rating.total_pnl * 100) / 100,
            sharpe_ratio: Math.round(rating.sharpe_ratio * 100) / 100,
            max_drawdown: Math.round(rating.max_drawdown * 1000) / 10,
            brier_score: rating.brier_score,
          },

          last_updated: rating.last_updated.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/:agentId/history - Historical rating over time
    // -----------------------------------------------------------------------
    fastify.get('/ratings/:agentId/history', async (
      request: FastifyRequest<{ Params: { agentId: string }; Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const days = parseInt(request.query.days || '30');
      const rating = ratingEngine.getRating(agentId);

      if (!rating) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: `No rating found for agent ${agentId}` },
          timestamp: new Date().toISOString(),
        });
      }

      const history = rating.score_history.slice(-days);
      const snapshots = ratingEngine.getSnapshots(agentId);

      return reply.send({
        success: true,
        data: {
          agent_id: agentId,
          current_grade: rating.grade,
          current_score: Math.round(rating.truth_score * 10) / 10,
          history,
          grade_changes: snapshots.map(s => ({
            date: s.created_at.toISOString(),
            from: s.previous_grade,
            to: s.grade,
            change: s.grade_change,
            score: Math.round(s.truth_score * 10) / 10,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/certifications - List all certified agents
    // -----------------------------------------------------------------------
    fastify.get('/ratings/certifications', async (
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const certified = ratingEngine.getCertifiedAgents();

      return reply.send({
        success: true,
        data: {
          certified_agents: certified.map(r => ({
            agent_id: r.agent_id,
            grade: r.grade,
            truth_score: Math.round(r.truth_score * 10) / 10,
            certified_at: r.certified_at?.toISOString(),
            total_trades: r.total_trades,
          })),
          total: certified.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /ratings/:agentId/certify - Request certification for an agent
    // -----------------------------------------------------------------------
    fastify.post('/ratings/:agentId/certify', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const cert = ratingEngine.certifyAgent(agentId);

      if (!cert) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CERTIFICATION_FAILED',
            message: 'Agent does not meet minimum requirements for certification (50+ trades, grade B or above)',
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          certification_id: cert.id,
          agent_id: cert.agent_id,
          grade: cert.grade,
          truth_score: Math.round(cert.truth_score * 10) / 10,
          issued_at: cert.issued_at.toISOString(),
          expires_at: cert.expires_at.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/compare - Side-by-side agent comparison
    // -----------------------------------------------------------------------
    fastify.get('/ratings/compare', async (
      request: FastifyRequest<{ Querystring: { agents: string } }>,
      reply: FastifyReply
    ) => {
      const agentIds = (request.query.agents || '').split(',').filter(Boolean);

      if (agentIds.length < 2) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Provide at least 2 agent IDs separated by commas' },
          timestamp: new Date().toISOString(),
        });
      }

      const ratings = ratingEngine.compareAgents(agentIds);

      return reply.send({
        success: true,
        data: {
          comparison: ratings.map(r => ({
            agent_id: r.agent_id,
            truth_score: Math.round(r.truth_score * 10) / 10,
            grade: r.grade,
            grade_color: gradeToColor(r.grade),
            brier_score: r.brier_score,
            sharpe_ratio: Math.round(r.sharpe_ratio * 100) / 100,
            win_rate: Math.round(r.win_rate * 1000) / 10,
            max_drawdown: Math.round(r.max_drawdown * 1000) / 10,
            total_trades: r.total_trades,
            total_pnl: Math.round(r.total_pnl * 100) / 100,
            certified: r.certified,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/distribution - Rating distribution across all agents
    // -----------------------------------------------------------------------
    fastify.get('/ratings/distribution', async (
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const distribution = ratingEngine.getDistribution();
      const total = Object.values(distribution).reduce((a, b) => a + b, 0);

      return reply.send({
        success: true,
        data: {
          distribution,
          total_agents: total,
          rated_agents: total - (distribution['NR'] || 0),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/:agentId/badge.svg - Embeddable TruthScore badge
    // The Michelin Star for AI. Put this in your GitHub README.
    // -----------------------------------------------------------------------
    fastify.get('/ratings/:agentId/badge.svg', async (
      request: FastifyRequest<{ Params: { agentId: string }; Querystring: { style?: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const style = request.query.style || 'flat';
      const rating = ratingEngine.getRating(agentId);

      const grade = rating?.grade || 'NR';
      const score = rating ? Math.round(rating.truth_score * 10) / 10 : 0;
      const certified = rating?.certified || false;

      const gradeColors: Record<string, string> = {
        'AAA': '#10b981', 'AA': '#06b6d4', 'A': '#3b82f6',
        'BBB': '#f59e0b', 'BB': '#f97316', 'B': '#ef4444',
        'CCC': '#dc2626', 'NR': '#6b7280',
      };
      const color = gradeColors[grade] || '#6b7280';

      const labelWidth = 80;
      const gradeWidth = grade === 'NR' ? 50 : 60;
      const scoreWidth = 70;
      const certWidth = certified ? 24 : 0;
      const totalWidth = labelWidth + gradeWidth + scoreWidth + certWidth;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="24" role="img" aria-label="TRUTH-NET: ${grade} ${score}">
  <title>TRUTH-NET Rating: ${grade} (${score}/100)${certified ? ' - Certified' : ''}</title>
  <defs>
    <linearGradient id="bg" x2="0" y2="100%"><stop offset="0" stop-opacity=".1" stop-color="#fff"/><stop offset="1" stop-opacity=".1"/></linearGradient>
    <clipPath id="r"><rect width="${totalWidth}" height="24" rx="4"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="24" fill="#1a1a2e"/>
    <rect x="${labelWidth}" width="${gradeWidth}" height="24" fill="${color}"/>
    <rect x="${labelWidth + gradeWidth}" width="${scoreWidth}" height="24" fill="#111827"/>
    ${certified ? `<rect x="${labelWidth + gradeWidth + scoreWidth}" width="${certWidth}" height="24" fill="#10b981"/>` : ''}
    <rect width="${totalWidth}" height="24" fill="url(#bg)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="16.5" fill="#e0e0e0" font-weight="600">TRUTH-NET</text>
    <text x="${labelWidth + gradeWidth / 2}" y="16.5" font-weight="bold" font-size="12">${grade}</text>
    <text x="${labelWidth + gradeWidth + scoreWidth / 2}" y="16.5" fill="#9ca3af" font-size="10">${score}/100</text>
    ${certified ? `<text x="${labelWidth + gradeWidth + scoreWidth + certWidth / 2}" y="16" font-size="12" title="Certified">&#x2713;</text>` : ''}
  </g>
</svg>`;

      reply.header('Content-Type', 'image/svg+xml');
      reply.header('Cache-Control', 'public, max-age=1800, s-maxage=3600');
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(svg);
    });
  };
}
